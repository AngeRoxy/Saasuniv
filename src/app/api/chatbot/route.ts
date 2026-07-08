import { verifyFirebaseToken } from '@/lib/verify-token'
import { fetchCallerProfile, bearerToken } from '@/lib/server/caller'
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

    const semestreEnCours = context.semestreEnCours ?? 'non précisé'
    const filiere = context.filiere ?? 'non précisée'

    const systemPrompt = `Tu es l'assistant IA de ${context.nomUniversite}, un système de gestion universitaire. Tu réponds uniquement en français. Tu aides les utilisateurs avec leurs questions sur leurs cours, notes, emploi du temps et procédures administratives. Tu n'as accès qu'aux données de ${context.nomUniversite}. Rôle de l'utilisateur : ${context.role}. Semestre en cours : ${semestreEnCours}. Filière : ${filiere}. Tu ne dois jamais inventer de notes ou de données. Si tu ne sais pas, dis-le.`

    // d. Appel de l'API Anthropic via fetch natif (jamais côté client).
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

    // e. Extraire la réponse texte.
    const data = (await res.json()) as AnthropicMessagesResponse
    const text = data.content?.[0]?.text ?? ''

    return Response.json({ reply: text })
  } catch {
    // f. Catch global : message d'erreur en français.
    return Response.json(
      { error: "Une erreur est survenue lors de la communication avec l'assistant." },
      { status: 500 }
    )
  }
}
