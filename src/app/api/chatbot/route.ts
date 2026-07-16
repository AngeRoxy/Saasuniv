import { verifyFirebaseToken } from '@/lib/verify-token'
import { fetchCallerProfile, bearerToken } from '@/lib/server/caller'
import { buildUserDataSummary } from '@/lib/server/chatbot-context'
import type { ChatMessage, ChatContext } from '@/types/chatbot'

interface ChatbotRequestBody {
  messages: ChatMessage[]
  context: ChatContext
}

interface AnthropicMessagesResponse {
  content: Array<{ type: string; text: string }>
}

export async function POST(request: Request): Promise<Response> {
  try {
    // a. Vérification du token Firebase avant tout appel Anthropic.
    const auth = await verifyFirebaseToken(request)
    if (!auth) {
      return Response.json({ error: 'Non authentifié.' }, { status: 401 })
    }

    // b. Vérifier la présence de la clé API (serveur-only).
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'Clé API non configurée.' }, { status: 500 })
    }

    // c. Parser le body et construire le system prompt.
    const body = (await request.json()) as ChatbotRequestBody
    const { messages, context } = body

    // c-bis. Cohérence université : le context envoyé par le client doit
    // correspondre à l'université réelle de l'appelant (sauf super admin), afin
    // qu'un utilisateur ne puisse pas interroger l'assistant "au nom" d'un autre
    // établissement en modifiant le context.
    const caller = await fetchCallerProfile(auth.uid, bearerToken(request))
    if (!caller) {
      return Response.json({ error: 'Profil introuvable.' }, { status: 403 })
    }
    if (
      caller.role !== 'super_admin_plateforme' &&
      context.universityId !== caller.universityId
    ) {
      return Response.json(
        { error: 'Université non autorisée pour cet utilisateur.' },
        { status: 403 }
      )
    }

    // d. Données RÉELLES de l'appelant, lues dans Firebase selon son rôle (avec
    //    SON token : le chatbot ne peut rien lire de plus que lui). Le rôle vient
    //    du profil authentique, jamais du context envoyé par le client.
    const dataSummary = await buildUserDataSummary(caller, bearerToken(request), {
      enfantUid: context.enfantUid,
    })

    const contexteDonnees = dataSummary
      ? `Voici les informations RÉELLES de l'utilisateur, extraites à l'instant de la base de données de l'établissement. Utilise-les pour répondre :\n${dataSummary}`
      : `Aucune donnée personnelle n'a pu être chargée pour cet utilisateur. Tu ne disposes donc d'AUCUNE information sur ses notes, son emploi du temps, ses absences ou ses paiements : dis-le clairement s'il pose une question dessus, et invite-le à consulter son tableau de bord.`

    const systemPrompt = `Tu es l'assistant IA de ${context.nomUniversite}, un système de gestion universitaire. Tu réponds uniquement en français. Tu aides les utilisateurs avec leurs questions sur leurs cours, notes, emploi du temps, absences et procédures administratives. Tu n'as accès qu'aux données de ${context.nomUniversite}. Rôle de l'utilisateur : ${caller.role}.

${contexteDonnees}

Règles impératives :
- Réponds en te basant sur les données réelles fournies ci-dessus. Cite les chiffres tels quels, sans les recalculer ni les arrondir différemment.
- Si la question porte sur une information qui n'est pas dans ce contexte, dis clairement que tu ne disposes pas de cette information, et n'invente pas de réponse.
- Tu ne dois JAMAIS inventer une note, une moyenne, une date, un horaire, une salle, un montant ou un nom qui ne figure pas dans le contexte ci-dessus. Une donnée annoncée comme absente ("aucune note saisie", "aucun examen programmé") est une information exacte : rapporte-la telle quelle, ne la comble pas.
- Les questions générales sur le fonctionnement de l'application (rattrapage, justification d'une absence, procédures…) restent les bienvenues : réponds-y normalement, même sans données personnelles.`

    // e. Appel de l'API Anthropic via fetch natif (jamais côté client).
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
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    })

    if (!res.ok) {
      throw new Error(`Anthropic API a répondu avec le statut ${res.status}`)
    }

    // f. Extraire la réponse texte.
    const data = (await res.json()) as AnthropicMessagesResponse
    const text = data.content?.[0]?.text ?? ''

    return Response.json({ reply: text })
  } catch {
    // g. Catch global : message d'erreur en français.
    return Response.json(
      { error: "Une erreur est survenue lors de la communication avec l'assistant." },
      { status: 500 }
    )
  }
}
