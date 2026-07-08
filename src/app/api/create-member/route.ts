import { verifyFirebaseToken } from '@/lib/verify-token'
import { createMemberByAdmin, assertAdminCaller } from '@/lib/server/members'
import type { CreateMemberRequest, CreatableRole } from '@/types/member'

const CREATABLE_ROLES: CreatableRole[] = ['teacher', 'student', 'parent']

export async function POST(request: Request): Promise<Response> {
  // 1. Authentification de l'appelant via son idToken (header Bearer).
  const auth = await verifyFirebaseToken(request)
  if (!auth) {
    return Response.json({ error: 'Non authentifié.' }, { status: 401 })
  }
  const adminIdToken = (request.headers.get('authorization') ?? '').split(' ')[1]

  // 2. Parsing + validation du corps.
  let body: CreateMemberRequest
  try {
    body = (await request.json()) as CreateMemberRequest
  } catch {
    return Response.json({ error: 'Corps invalide.' }, { status: 400 })
  }

  if (!body.universityId || !body.email || !body.displayName || !body.role) {
    return Response.json(
      { error: 'Champs requis manquants (universityId, email, displayName, role).' },
      { status: 400 }
    )
  }
  // Validation de FORMAT côté serveur (jamais uniquement côté client) : email
  // valide et displayName non vide après trim.
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
  if (typeof body.email !== 'string' || !EMAIL_RE.test(body.email.trim())) {
    return Response.json({ error: 'Adresse email invalide.' }, { status: 400 })
  }
  if (typeof body.displayName !== 'string' || body.displayName.trim().length === 0) {
    return Response.json({ error: 'Nom affiché requis.' }, { status: 400 })
  }
  if (!CREATABLE_ROLES.includes(body.role)) {
    return Response.json(
      { error: 'Rôle non autorisé. Seuls enseignant, étudiant et parent peuvent être créés.' },
      { status: 400 }
    )
  }
  // Charge horaire (enseignant) : entier 0–40 si fourni.
  let chargeHoraire: number | undefined
  if (body.chargeHoraire !== undefined) {
    const h = Number(body.chargeHoraire)
    if (!Number.isFinite(h) || h < 0 || h > 40) {
      return Response.json({ error: 'Charge horaire invalide (0 à 40 h/semaine).' }, { status: 400 })
    }
    chargeHoraire = Math.round(h)
  }
  // Matières enseignées : tableau de chaînes non vides si fourni.
  let matieres: string[] | undefined
  if (body.matieres !== undefined) {
    if (!Array.isArray(body.matieres) || body.matieres.some((m) => typeof m !== 'string')) {
      return Response.json({ error: 'Liste de matières invalide.' }, { status: 400 })
    }
    matieres = body.matieres.map((m) => m.trim()).filter(Boolean)
  }
  // Filières de l'enseignant : tableau d'IDs (chaînes) si fourni. On dédoublonne
  // ici ; l'EXISTENCE de chaque filière est vérifiée plus bas (après autorisation).
  let filiereIds: string[] | undefined
  if (body.filiereIds !== undefined) {
    if (!Array.isArray(body.filiereIds) || body.filiereIds.some((f) => typeof f !== 'string')) {
      return Response.json({ error: 'Liste de filières invalide.' }, { status: 400 })
    }
    filiereIds = [...new Set(body.filiereIds.map((f) => f.trim()).filter(Boolean))]
  }

  // 3. Autorisation : l'appelant doit être admin de l'université ciblée.
  const caller = await assertAdminCaller(auth.uid, adminIdToken, body.universityId)
  if (!caller) {
    return Response.json(
      { error: "Accès refusé. Seule l'administration de l'université peut créer des comptes." },
      { status: 403 }
    )
  }

  // 3-bis. Validation d'EXISTENCE des filières fournies (enseignant) : chaque
  // filiereId doit correspondre à une filière réelle de l'université, afin de ne
  // jamais enregistrer une référence orpheline. On lit les clés en mode `shallow`.
  const dbUrl = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? '').replace(/\/$/, '')
  if (filiereIds && filiereIds.length > 0) {
    let existing: Record<string, unknown> | null
    try {
      const fRes = await fetch(
        `${dbUrl}/universities/${body.universityId}/filieres.json?shallow=true&auth=${adminIdToken}`
      )
      if (!fRes.ok) throw new Error('read failed')
      existing = (await fRes.json()) as Record<string, unknown> | null
    } catch {
      return Response.json({ error: 'Vérification des filières impossible.' }, { status: 502 })
    }
    const knownIds = new Set(existing ? Object.keys(existing) : [])
    const unknown = filiereIds.filter((id) => !knownIds.has(id))
    if (unknown.length > 0) {
      return Response.json(
        { error: `Filière(s) inexistante(s) : ${unknown.join(', ')}.` },
        { status: 400 }
      )
    }
  }

  // 4. Récupération du nom de l'université (pour l'email) + URL de connexion.
  let nomUniversite = body.universityId
  try {
    const uRes = await fetch(
      `${dbUrl}/universities/${body.universityId}/name.json?auth=${adminIdToken}`
    )
    if (uRes.ok) {
      const name = (await uRes.json()) as string | null
      if (name) nomUniversite = name
    }
  } catch {
    /* fallback sur l'identifiant */
  }
  const loginUrl = `${new URL(request.url).origin}/auth/login`

  // 5. Création du compte + envoi de l'email (email non bloquant).
  try {
    const result = await createMemberByAdmin({
      universityId: body.universityId,
      email: body.email,
      displayName: body.displayName,
      role: body.role,
      filiere: body.filiere,
      filiereIds,
      niveau: body.niveau,
      telephone: body.telephone,
      matricule: body.matricule,
      chargeHoraire,
      matieres,
      parentUid: body.parentUid,
      enfantUids: body.enfantUids,
      nomUniversite,
      loginUrl,
      adminIdToken,
    })

    // Le mot de passe temporaire n'est renvoyé que si l'email a échoué, afin que
    // l'admin puisse communiquer les accès manuellement. Sinon il reste secret.
    return Response.json({
      uid: result.uid,
      emailSent: result.emailSent,
      tempPassword: result.emailSent ? undefined : result.tempPassword,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue.'
    const friendly =
      message.includes('EMAIL_EXISTS')
        ? 'Cet email est déjà utilisé par un compte existant.'
        : message.includes('INVALID_EMAIL')
          ? 'Adresse email invalide.'
          : "La création du compte a échoué. Veuillez réessayer."
    return Response.json({ error: friendly }, { status: 400 })
  }
}
