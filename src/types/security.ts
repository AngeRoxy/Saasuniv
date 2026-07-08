// ─── Sécurité de l'authentification ─────────────────────────────────────────
//
// Types partagés pour la protection anti brute-force du login. Le suivi des
// tentatives est GLOBAL (nœud racine /loginAttempts), volontairement HORS de
// /universities : au moment d'une tentative de connexion, on ne connaît pas
// encore l'utilisateur ni son université.

/** Compteur de tentatives de connexion échouées pour un email donné. */
export interface LoginAttempt {
  email: string
  attemptsCount: number
  /** Timestamp ms de la dernière tentative. */
  lastAttemptAt: number
  /** Timestamp ms jusqu'auquel le login est verrouillé, ou null si libre. */
  lockedUntil: number | null
}

/** Nombre de tentatives échouées consécutives avant verrouillage. */
export const MAX_LOGIN_ATTEMPTS = 5

/** Durée du verrouillage temporaire (15 minutes) en millisecondes. */
export const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000
