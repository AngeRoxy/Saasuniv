// Helper CÔTÉ CLIENT pour déclencher la création d'un membre via le Route
// Handler /api/create-member. Toute la logique sensible (génération du mot de
// passe temporaire, création du compte Auth) reste côté serveur ; ici on se
// contente d'attacher l'idToken de l'admin connecté et de relayer la réponse.

import { auth } from './firebase'
import type {
  CreateMemberRequest,
  AdminUpdateEmailRequest,
  AdminUpdateEmailResponse,
} from '@/types/member'

export interface CreateMemberResponse {
  uid: string
  emailSent: boolean
  /** Présent uniquement si l'email a échoué (à communiquer manuellement). */
  tempPassword?: string
}

export async function createMemberViaApi(
  payload: CreateMemberRequest
): Promise<CreateMemberResponse> {
  const user = auth.currentUser
  if (!user) throw new Error('Vous devez être connecté.')

  const idToken = await user.getIdToken()
  const res = await fetch('/api/create-member', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  })

  const data = (await res.json()) as CreateMemberResponse & { error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? 'La création du compte a échoué.')
  }
  return data
}

/**
 * Déclenche la correction de l'email d'un membre via /api/admin-update-email.
 * Attache l'idToken de l'admin connecté ; toute la logique sensible (autorisation,
 * écriture RTDB, notifications) reste côté serveur.
 */
export async function updateMemberEmailViaApi(
  payload: AdminUpdateEmailRequest
): Promise<AdminUpdateEmailResponse> {
  const user = auth.currentUser
  if (!user) throw new Error('Vous devez être connecté.')

  const idToken = await user.getIdToken()
  const res = await fetch('/api/admin-update-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  })

  const data = (await res.json()) as AdminUpdateEmailResponse
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? "La mise à jour de l'email a échoué.")
  }
  return data
}
