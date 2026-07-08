// Helper CÔTÉ CLIENT pour synchroniser le cookie de session httpOnly lu par le
// proxy (src/proxy.ts). À appeler après une connexion/inscription réussie AVANT
// toute redirection vers /dashboard (sinon le proxy ne voit pas encore le cookie
// et renvoie vers /auth/login), et à chaque renouvellement de token.

import { auth } from './firebase'

/** Pose/rafraîchit le cookie de session à partir du token de l'utilisateur courant. */
export async function syncSessionCookie(): Promise<void> {
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return
    await fetch('/api/session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    /* non bloquant : le guard client (AuthContext) reste la seconde ligne */
  }
}

/** Efface le cookie de session (déconnexion). */
export async function clearSessionCookie(): Promise<void> {
  try {
    await fetch('/api/session', { method: 'DELETE' })
  } catch {
    /* non bloquant */
  }
}
