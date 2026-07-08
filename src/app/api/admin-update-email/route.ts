import { verifyFirebaseToken } from '@/lib/verify-token'
import { assertAdminCaller } from '@/lib/server/members'
import { updateMemberEmailByAdmin } from '@/lib/server/email-change'
import type { AdminUpdateEmailRequest } from '@/types/member'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export async function POST(request: Request): Promise<Response> {
  // 1. Authentification de l'appelant via son idToken (header Bearer).
  const auth = await verifyFirebaseToken(request)
  if (!auth) {
    return Response.json({ success: false, error: 'Non authentifié.' }, { status: 401 })
  }
  const adminIdToken = (request.headers.get('authorization') ?? '').split(' ')[1]

  // 2. Parsing + validation du corps.
  let body: AdminUpdateEmailRequest
  try {
    body = (await request.json()) as AdminUpdateEmailRequest
  } catch {
    return Response.json({ success: false, error: 'Corps invalide.' }, { status: 400 })
  }

  if (!body.targetUid || !body.newEmail || !body.universityId) {
    return Response.json(
      { success: false, error: 'Champs requis manquants (targetUid, newEmail, universityId).' },
      { status: 400 }
    )
  }
  if (typeof body.newEmail !== 'string' || !EMAIL_RE.test(body.newEmail.trim())) {
    return Response.json({ success: false, error: 'Adresse email invalide.' }, { status: 400 })
  }

  // 3. Autorisation : l'appelant doit être admin de l'université ciblée (ou super-admin).
  const caller = await assertAdminCaller(auth.uid, adminIdToken, body.universityId)
  if (!caller) {
    return Response.json(
      { success: false, error: "Accès refusé. Seule l'administration de l'université peut corriger un email." },
      { status: 403 }
    )
  }

  // 4. Nom de l'université (pour la notification) + URL de connexion.
  const dbUrl = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? '').replace(/\/$/, '')
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

  // 5. Mise à jour RTDB + notifications.
  try {
    const result = await updateMemberEmailByAdmin({
      universityId: body.universityId,
      targetUid: body.targetUid,
      newEmail: body.newEmail.trim(),
      adminIdToken,
      nomUniversite,
      loginUrl,
    })
    return Response.json({ success: true, warning: result.warning })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue.'
    const friendly = message.startsWith('MEMBER_NOT_FOUND')
      ? 'Membre introuvable dans cette université.'
      : "La mise à jour de l'email a échoué. Veuillez réessayer."
    return Response.json({ success: false, error: friendly }, { status: 400 })
  }
}
