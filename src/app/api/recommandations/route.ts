import { verifyFirebaseToken } from '@/lib/verify-token'
import { fetchCallerProfile } from '@/lib/server/caller'
import type { RecommandationIA, RecommandationType } from '@/types/chatbot'

interface NoteInput {
  matiere: string
  note: number
  credits: number
  coefficient: number
}

interface RecommandationsRequestBody {
  etudiantUid: string
  universityId: string
  notes: NoteInput[]
}

interface AnthropicMessagesResponse {
  content: Array<{ type: string; text: string }>
}

interface RecommandationParsed {
  type: RecommandationType
  contenu: string
  matieresImpactees: string[]
}

export async function POST(request: Request): Promise<Response> {
  try {
    // a. Vérification du token Firebase avant tout appel Anthropic.
    const auth = await verifyFirebaseToken(request)
    if (!auth) {
      return Response.json({ error: 'Non authentifié.' }, { status: 401 })
    }
    // L'idToken vérifié sert à authentifier l'écriture RTDB côté serveur :
    // le SDK client n'a pas de session ici, on écrit donc via l'API REST en
    // passant ?auth=<idToken> afin que les règles de sécurité s'appliquent.
    const idToken = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''

    // b. Vérifier la présence de la clé API (serveur-only).
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'Clé API non configurée.' }, { status: 500 })
    }

    // Parser le body.
    const body = (await request.json()) as RecommandationsRequestBody
    const { etudiantUid, universityId, notes } = body

    // b-bis. Cohérence université + rôle : l'appelant doit appartenir à
    // `universityId`, et ne peut générer/écrire des recommandations que pour
    // lui-même (étudiant) OU en tant qu'admin/enseignant de cette université
    // (sinon 403). Empêche la génération croisée inter-étudiant/inter-université.
    const caller = await fetchCallerProfile(auth.uid, idToken)
    if (!caller) {
      return Response.json({ error: 'Profil introuvable.' }, { status: 403 })
    }
    const isSuperAdmin = caller.role === 'super_admin_plateforme'
    const sameUniversity = caller.universityId === universityId
    const isOwnerOrStaff =
      caller.uid === etudiantUid ||
      caller.role === 'admin_universite' ||
      caller.role === 'teacher'
    if (!isSuperAdmin && !(sameUniversity && isOwnerOrStaff)) {
      return Response.json({ error: 'Accès non autorisé.' }, { status: 403 })
    }

    // Validation de format des notes reçues (0–20) avant analyse.
    if (
      !Array.isArray(notes) ||
      notes.some(
        (n) => typeof n.note !== 'number' || n.note < 0 || n.note > 20
      )
    ) {
      return Response.json({ error: 'Notes invalides.' }, { status: 400 })
    }

    // c. Construire le prompt d'analyse.
    const analysePrompt = `Analyse ces résultats académiques d'un étudiant et génère des recommandations personnalisées en français. Résultats : ${JSON.stringify(
      notes
    )}. Retourne UNIQUEMENT un tableau JSON valide sans markdown ni backticks, avec des objets ayant les champs : type ('alerte_echec'|'orientation'|'revision'|'encouragement'), contenu (string, max 200 caractères), matieresImpactees (string[]). Maximum 4 recommandations. Priorise les alertes d'échec (note < 10).`

    // d. Appel de l'API Anthropic via fetch natif.
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: 'Tu es un conseiller pédagogique.',
        messages: [{ role: 'user', content: analysePrompt }],
      }),
    })

    if (!res.ok) {
      throw new Error(`Anthropic API a répondu avec le statut ${res.status}`)
    }

    const data = (await res.json()) as AnthropicMessagesResponse
    const rawText = data.content?.[0]?.text ?? ''

    // e. Parser le JSON renvoyé de façon robuste (strip d'éventuels backticks/```json).
    let parsed: unknown
    try {
      const cleaned = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return Response.json(
        { error: "Impossible d'analyser la réponse de l'assistant." },
        { status: 500 }
      )
    }

    if (!Array.isArray(parsed)) {
      return Response.json(
        { error: "La réponse de l'assistant n'a pas le format attendu." },
        { status: 500 }
      )
    }

    // f. Construire les RecommandationIA complètes.
    const now = Date.now()
    const recommandations: RecommandationIA[] = (parsed as RecommandationParsed[]).map((item) => ({
      id: crypto.randomUUID(),
      etudiantUid,
      universityId,
      type: item.type,
      contenu: item.contenu,
      matieresImpactees: Array.isArray(item.matieresImpactees) ? item.matieresImpactees : [],
      genereeAt: now,
      lue: false,
    }))

    // g. Sauvegarder dans Firebase Realtime DB via l'API REST, authentifiée
    // avec l'idToken de l'utilisateur (les règles vérifient que son
    // universityId correspond → pas de fuite inter-établissement).
    const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    if (databaseURL && idToken) {
      const updates: Record<string, RecommandationIA> = {}
      for (const reco of recommandations) {
        updates[reco.id] = reco
      }
      const writeUrl = `${databaseURL}/universities/${universityId}/recommandations/${etudiantUid}.json?auth=${idToken}`
      const writeRes = await fetch(writeUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!writeRes.ok) {
        throw new Error(`Écriture RTDB échouée avec le statut ${writeRes.status}`)
      }
    }

    // h. Retourner les recommandations.
    return Response.json({ recommandations })
  } catch {
    // i. Catch global : message d'erreur en français.
    return Response.json(
      { error: 'Une erreur est survenue lors de la génération des recommandations.' },
      { status: 500 }
    )
  }
}
