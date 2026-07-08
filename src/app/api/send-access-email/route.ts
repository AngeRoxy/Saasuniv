import { verifyFirebaseToken } from '@/lib/verify-token'
import { sendAccessEmail } from '@/lib/server/email'
import type { SendAccessEmailRequest } from '@/types/member'

export async function POST(request: Request): Promise<Response> {
  // Secret partagé interne : cette route ne doit être appelable que par du code
  // serveur de confiance (jamais directement par un client authentifié, sinon
  // n'importe qui pourrait spammer des emails à l'en-tête GestUniv). Le flux
  // normal de création de compte appelle sendAccessEmail() en direct (import),
  // pas cette route HTTP. On exige donc un secret configuré et correspondant.
  const expected = process.env.INTERNAL_API_SECRET
  const provided = request.headers.get('x-internal-secret')
  if (!expected || provided !== expected) {
    return Response.json({ success: false, error: 'Accès refusé.' }, { status: 403 })
  }

  // Authentification : seul un utilisateur connecté peut déclencher l'envoi.
  const auth = await verifyFirebaseToken(request)
  if (!auth) {
    return Response.json({ success: false, error: 'Non authentifié.' }, { status: 401 })
  }

  let body: SendAccessEmailRequest
  try {
    body = (await request.json()) as SendAccessEmailRequest
  } catch {
    return Response.json({ success: false, error: 'Corps invalide.' }, { status: 400 })
  }

  if (!body.to || !body.email || !body.tempPassword) {
    return Response.json(
      { success: false, error: 'Champs requis manquants.' },
      { status: 400 }
    )
  }

  // L'envoi est non bloquant : sendAccessEmail ne throw jamais.
  const result = await sendAccessEmail(body)
  return Response.json(result)
}
