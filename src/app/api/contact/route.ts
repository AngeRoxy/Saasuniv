import { sendContactEmail } from '@/lib/server/email'
import type { ContactMessage } from '@/lib/server/email'
import { checkRateLimit, getClientIp, rateLimitMessage } from '@/lib/server/rate-limit'

/** Route publique non authentifiée : 5 requêtes par IP et par heure. */
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 60 * 1000

export async function POST(request: Request): Promise<Response> {
  const rate = await checkRateLimit('contact', getClientIp(request), RATE_LIMIT, RATE_WINDOW_MS)
  if (!rate.allowed) {
    return Response.json(
      { success: false, error: rateLimitMessage(rate.retryAfterSeconds ?? 60) },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds ?? 60) } }
    )
  }

  let body: Partial<ContactMessage>
  try {
    body = (await request.json()) as Partial<ContactMessage>
  } catch {
    return Response.json({ success: false, error: 'Corps invalide.' }, { status: 400 })
  }

  const { name, email, subject, message } = body
  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    return Response.json({ success: false, error: 'Tous les champs sont requis.' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ success: false, error: 'Adresse email invalide.' }, { status: 400 })
  }
  if (message.length > 5000 || name.length > 200 || subject.length > 200) {
    return Response.json({ success: false, error: 'Message trop long.' }, { status: 400 })
  }

  const result = await sendContactEmail({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() })
  if (!result.success) {
    return Response.json(result, { status: 502 })
  }
  return Response.json(result)
}
