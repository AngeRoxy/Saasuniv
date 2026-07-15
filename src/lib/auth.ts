import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  confirmPasswordReset,
  type User,
} from 'firebase/auth'
import { ref, set, update, get } from 'firebase/database'
import { auth, db } from './firebase'
import type { MemberRole } from '@/types/member'

export async function loginWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function registerAdmin(
  email: string,
  password: string,
  universityId: string,
  displayName: string
) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  const uid = credential.user.uid

  try {
    await set(ref(db, `users/${uid}`), {
      email,
      displayName,
      role: 'admin_universite',
      universityId,
      createdAt: Date.now(),
    })
  } catch (dbError) {
    // Rollback : supprimer le compte Auth pour éviter un orphelin
    await deleteUser(credential.user)
    throw dbError
  }

  return credential
}

export async function registerMember(
  email: string,
  password: string,
  universityId: string,
  displayName: string,
  role: 'teacher' | 'student' | 'parent' | 'super_admin_plateforme'
) {
  // SÉCURITÉ — refus explicite et inconditionnel du rôle plateforme. Cette voie
  // (inscription publique) ne doit JAMAIS pouvoir créer un super_admin_plateforme,
  // même si l'appelant contourne l'UI (DevTools, appel direct de la fonction).
  // Le contrôle est ici AVANT createUserWithEmailAndPassword pour ne laisser
  // aucun compte Auth orphelin. Le super_admin a été amorcé une seule fois via une
  // route de bootstrap temporaire, depuis SUPPRIMÉE (verrou /bootstrap dans les règles).
  if (role === 'super_admin_plateforme') {
    throw new Error(
      "Rôle interdit : un compte super_admin_plateforme ne peut pas être créé via l'inscription."
    )
  }

  const credential = await createUserWithEmailAndPassword(auth, email, password)
  const uid = credential.user.uid
  const createdAt = Date.now()

  try {
    await update(ref(db), {
      [`users/${uid}`]: { email, displayName, role, universityId, createdAt },
      [`universities/${universityId}/members/${uid}`]: { displayName, email, role, createdAt },
    })
  } catch (dbError) {
    await deleteUser(credential.user)
    throw dbError
  }

  return credential
}

export async function logout() {
  return signOut(auth)
}

export function getCurrentUser(): User | null {
  return auth.currentUser
}

// ─── Restrictions de profil & première connexion (RÈGLES 2 & 3) ──────────────
//
// NB : ces helpers s'exécutent CÔTÉ CLIENT, en tant qu'utilisateur connecté
// (updatePassword agit sur auth.currentUser). À ne pas confondre avec la
// fonction `updateMemberProfile` de lib/db.ts (mise à jour DB par l'admin).

export interface OwnProfileUpdate {
  /** Nouveau mot de passe (tous les rôles peuvent le changer). */
  motDePasse?: string
  /** Mot de passe actuel — requis pour ré-authentifier avant changement. */
  motDePasseActuel?: string
  /** Réservé à admin / enseignant pour leur propre profil. */
  displayName?: string
  telephone?: string
}

/**
 * Met à jour le profil de l'utilisateur courant en appliquant les restrictions
 * de la RÈGLE 2 :
 *  - étudiant / parent : SEUL le mot de passe est modifiable (le reste est ignoré).
 *  - admin / enseignant : peuvent aussi modifier displayName & telephone.
 */
export async function updateOwnProfile(
  universityId: string,
  uid: string,
  data: OwnProfileUpdate,
  callerRole: MemberRole
): Promise<void> {
  const restricted = callerRole === 'student' || callerRole === 'parent'

  // 1. Changement de mot de passe (autorisé pour tous les rôles).
  if (data.motDePasse) {
    const current = auth.currentUser
    if (!current || !current.email) throw new Error('Aucun utilisateur connecté.')
    // Ré-authentification si le mot de passe actuel est fourni (sinon Firebase
    // peut exiger une connexion récente → erreur auth/requires-recent-login).
    if (data.motDePasseActuel) {
      const credential = EmailAuthProvider.credential(current.email, data.motDePasseActuel)
      await reauthenticateWithCredential(current, credential)
    }
    await updatePassword(current, data.motDePasse)
  }

  if (restricted) return // étudiant / parent : on ignore tout le reste.

  // 2. Champs DB autorisés pour admin / enseignant sur leur propre profil.
  const updates: Record<string, unknown> = {}
  if (data.displayName !== undefined) updates.displayName = data.displayName
  if (data.telephone !== undefined) updates.telephone = data.telephone
  if (Object.keys(updates).length > 0) {
    updates.updatedAt = Date.now()
    await update(ref(db, `universities/${universityId}/members/${uid}`), updates)
    // Garder /users/{uid} cohérent pour le displayName affiché partout.
    if (data.displayName !== undefined) {
      await update(ref(db, `users/${uid}`), { displayName: data.displayName })
    }
  }
}

/** Lit /users/{uid}/premiereConnexion. */
export async function checkPremiereConnexion(uid: string): Promise<boolean> {
  const snapshot = await get(ref(db, `users/${uid}/premiereConnexion`))
  return snapshot.exists() && snapshot.val() === true
}

/**
 * Marque la première connexion comme effectuée : premiereConnexion=false et
 * statut='actif' dans /users/{uid} ET /universities/{id}/members/{uid}.
 */
export async function markConnexionEffectuee(
  uid: string,
  universityId: string
): Promise<void> {
  await update(ref(db), {
    [`users/${uid}/premiereConnexion`]: false,
    [`users/${uid}/statut`]: 'actif',
    [`universities/${universityId}/members/${uid}/premiereConnexion`]: false,
    [`universities/${universityId}/members/${uid}/statut`]: 'actif',
    [`universities/${universityId}/members/${uid}/updatedAt`]: Date.now(),
  })
}

// ─── Mot de passe oublié (réinitialisation en libre-service) ──────────────────
//
// Ce flux est DISTINCT de la première connexion (PremiereConnexionGuard) : il
// permet à n'importe quel rôle de réinitialiser un mot de passe DÉFINITIVEMENT
// oublié, sans intervention de l'admin, via un email envoyé par Firebase Auth.

/**
 * Contrainte de mot de passe partagée avec PremiereConnexionGuard :
 * min 8 caractères, ≥ 1 majuscule, ≥ 1 chiffre. Retourne un message d'erreur
 * en français ou `null` si le mot de passe est valide.
 */
export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.'
  if (!/[A-Z]/.test(pw)) return 'Le mot de passe doit contenir au moins une majuscule.'
  if (!/[0-9]/.test(pw)) return 'Le mot de passe doit contenir au moins un chiffre.'
  return null
}

/**
 * Envoie l'email de réinitialisation via Firebase Auth.
 *
 * IMPORTANT — quelle page reçoit l'oobCode ? Ce n'est PAS `actionCodeSettings.url`.
 * Pour un reset de mot de passe, la page qui reçoit le code (`?oobCode=...`) est
 * l'« URL d'action » configurée dans la console Firebase :
 *   Authentication → Templates → Réinitialisation du mot de passe →
 *   « Personnaliser l'URL d'action » = https://<domaine>/auth/reset-password-confirm
 * Tant que cette URL d'action reste le domaine par défaut, Firebase affiche sa
 * page générique (…/__/auth/action), quoi qu'on passe ici.
 *
 * `url` ci-dessous n'est que le `continueUrl` : le lien « retour à l'application »
 * proposé APRÈS le reset. On le fait pointer vers /auth/reset-password-confirm par
 * cohérence, mais il ne transporte pas le code. (`handleCodeInApp` n'est pas
 * utilisé : ce flag concerne le sign-in par email-link, pas le reset.)
 *
 * SÉCURITÉ ANTI-ÉNUMÉRATION : cette fonction ne révèle jamais si l'email existe.
 * `auth/user-not-found` est traité comme un SUCCÈS silencieux — l'UI affiche
 * toujours le même message générique. Seules les vraies erreurs techniques
 * (email malformé, quota) remontent un échec.
 */
export async function sendResetPasswordEmail(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const actionCodeSettings = {
    // continueUrl : bouton « retour à l'application » affiché après le reset.
    url:
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/reset-password-confirm`
        : 'https://gestuniv.com/auth/reset-password-confirm',
  }
  try {
    await sendPasswordResetEmail(auth, email, actionCodeSettings)
    return { success: true }
  } catch (err) {
    const code = (err as { code?: string }).code ?? ''
    switch (code) {
      // Compte inexistant : on NE le révèle PAS → succès silencieux côté UI.
      case 'auth/user-not-found':
        return { success: true }
      case 'auth/invalid-email':
        return { success: false, error: 'Adresse email invalide.' }
      case 'auth/too-many-requests':
        return {
          success: false,
          error: 'Trop de tentatives. Réessayez dans quelques minutes.',
        }
      case 'auth/missing-android-pkg-name':
      case 'auth/unauthorized-continue-uri':
        // Erreur de configuration : ne pas exposer, message générique.
        return { success: false, error: 'Une erreur est survenue. Veuillez réessayer.' }
      default:
        return { success: false, error: 'Une erreur est survenue. Veuillez réessayer.' }
    }
  }
}

/**
 * Confirme la réinitialisation avec le code (oobCode) reçu par email et le
 * nouveau mot de passe. Valide la robustesse du mot de passe AVANT l'appel
 * Firebase, puis traduit les erreurs Firebase courantes en français.
 */
export async function confirmResetPassword(
  code: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!code) {
    return { success: false, error: 'Lien de réinitialisation invalide ou expiré.' }
  }
  const validation = validatePasswordStrength(newPassword)
  if (validation) {
    return { success: false, error: validation }
  }
  try {
    await confirmPasswordReset(auth, code, newPassword)
    return { success: true }
  } catch (err) {
    const errCode = (err as { code?: string }).code ?? ''
    switch (errCode) {
      case 'auth/expired-action-code':
        return { success: false, error: 'Ce lien de réinitialisation a expiré. Veuillez en demander un nouveau.' }
      case 'auth/invalid-action-code':
        return { success: false, error: 'Lien de réinitialisation invalide ou déjà utilisé. Veuillez en demander un nouveau.' }
      case 'auth/user-disabled':
        return { success: false, error: 'Ce compte a été désactivé.' }
      case 'auth/weak-password':
        return { success: false, error: 'Mot de passe trop faible.' }
      default:
        return { success: false, error: 'Impossible de réinitialiser le mot de passe. Veuillez réessayer.' }
    }
  }
}
