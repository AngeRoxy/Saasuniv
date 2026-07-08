// ⚠️ Module SERVEUR UNIQUEMENT — ne jamais importer depuis un composant client.
//
// Correction de l'email d'un membre par l'administration. Ce projet n'ayant PAS
// firebase-admin, on ne peut PAS changer l'email dans Firebase Auth côté serveur
// (l'API REST Identity Toolkit `accounts:update` exige l'idToken de l'utilisateur
// concerné, pas celui de l'admin). On met donc à jour la Realtime Database via
// son API REST authentifiée par l'idToken de l'admin, et on notifie l'utilisateur.
//
// TODO(firebase-admin) : quand firebase-admin sera intégré, appeler
//   adminAuth.updateUser(targetUid, { email: newEmail })
// pour synchroniser l'identifiant de connexion réel, puis retirer l'avertissement
// `authSynced: false` renvoyé ici.

import { sendEmailChangeNotification } from './email'

function databaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_FIREBASE_DATABASE_URL manquante.')
  return url.replace(/\/$/, '')
}

async function dbGet<T>(path: string, idToken: string): Promise<T | null> {
  const res = await fetch(`${databaseUrl()}/${path}.json?auth=${idToken}`)
  if (!res.ok) return null
  return (await res.json()) as T | null
}

/** PATCH RTDB REST. Retourne le statut HTTP sans throw (utile pour les écritures best-effort). */
async function dbPatch(
  path: string,
  idToken: string,
  value: object
): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`${databaseUrl()}/${path}.json?auth=${idToken}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  })
  return { ok: res.ok, status: res.status }
}

export interface UpdateMemberEmailParams {
  universityId: string
  targetUid: string
  newEmail: string
  /** idToken de l'admin appelant : satisfait les règles d'écriture sur /members. */
  adminIdToken: string
  nomUniversite: string
  loginUrl: string
}

export interface UpdateMemberEmailResult {
  success: boolean
  /** Firebase Auth synchronisé ? (false tant que firebase-admin n'est pas intégré) */
  authSynced: boolean
  /** Nœud global /users/{uid} synchronisé ? (nécessite super-admin sinon refusé par les règles) */
  usersNodeSynced: boolean
  warning?: string
}

/**
 * Met à jour l'email d'un membre dans la Realtime Database (membre + best-effort
 * /users), puis notifie l'ancienne ET la nouvelle adresse. La mise à jour du
 * nœud membre est obligatoire (throw si elle échoue) ; le reste est best-effort.
 */
export async function updateMemberEmailByAdmin(
  params: UpdateMemberEmailParams
): Promise<UpdateMemberEmailResult> {
  const { universityId, targetUid, newEmail, adminIdToken } = params
  const now = Date.now()

  // 1. Lire l'email actuel + le nom, pour la notification.
  const memberPath = `universities/${universityId}/members/${targetUid}`
  const member = await dbGet<{ email?: string; displayName?: string }>(
    memberPath,
    adminIdToken
  )
  if (!member) {
    throw new Error('MEMBER_NOT_FOUND')
  }
  const oldEmail = member.email ?? ''
  const displayName = member.displayName ?? ''

  // 2. Mise à jour OBLIGATOIRE du nœud membre (l'admin y est autorisé).
  const memberRes = await dbPatch(memberPath, adminIdToken, {
    email: newEmail,
    updatedAt: now,
  })
  if (!memberRes.ok) {
    throw new Error(`MEMBER_UPDATE_FAILED_${memberRes.status}`)
  }

  // 3. Best-effort : /users/{uid}/email. Les règles n'autorisent l'écriture
  //    de /users/{autreUid} qu'au super-admin → un admin_universite recevra un
  //    refus (401/403), qu'on signale via l'avertissement.
  const usersRes = await dbPatch(`users/${targetUid}`, adminIdToken, {
    email: newEmail,
  })
  const usersNodeSynced = usersRes.ok

  // 4. Firebase Auth : impossible sans firebase-admin (cf. TODO en tête de fichier).
  const authSynced = false

  // 5. Notifications (non bloquantes) — ancienne ET nouvelle adresse.
  await Promise.all([
    oldEmail && oldEmail !== newEmail
      ? sendEmailChangeNotification({
          to: oldEmail,
          displayName,
          nomUniversite: params.nomUniversite,
          oldEmail,
          newEmail,
          loginUrl: params.loginUrl,
        })
      : Promise.resolve({ success: false }),
    sendEmailChangeNotification({
      to: newEmail,
      displayName,
      nomUniversite: params.nomUniversite,
      oldEmail,
      newEmail,
      loginUrl: params.loginUrl,
    }),
  ])

  const warnings: string[] = []
  if (!authSynced) {
    warnings.push(
      "L'identifiant de connexion Firebase Auth conserve l'ancien email (synchronisation complète nécessite firebase-admin)."
    )
  }
  if (!usersNodeSynced) {
    warnings.push(
      "Le profil global (/users) n'a pas pu être mis à jour avec ce compte (droits super-admin requis)."
    )
  }

  return {
    success: true,
    authSynced,
    usersNodeSynced,
    warning: warnings.length ? warnings.join(' ') : undefined,
  }
}
