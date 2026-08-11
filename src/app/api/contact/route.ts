import { sendContactEmail } from '@/lib/server/email'
import type { ContactMessage } from '@/lib/server/email'

export async function POST(request: Request): Promise<Response> {
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
