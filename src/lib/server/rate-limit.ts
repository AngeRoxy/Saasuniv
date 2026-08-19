// ⚠️ MODULE SERVEUR UNIQUEMENT — compteurs stockés dans /rateLimits via
// firebase-admin (SDK Admin, contourne les règles). Ce nœud est en
// .read/.write: false pour tout client (cf. database.rules.json) : aucune
// valeur n'est lisible ni falsifiable depuis l'extérieur, contrairement à
// /loginAttempts qui doit rester accessible avant connexion.
//
// Fenêtre FIXE (pas glissante au sens strict) par transaction atomique : simple,
// sans dépendance externe (pas de Redis/Upstash), suffisant pour dissuader
// l'abus des routes coûteuses (appels Anthropic) et le spam du formulaire de
// contact public. Fail-open en cas d'erreur d'écriture : une panne du rate
// limiting ne doit jamais bloquer un utilisateur légitime.

import { getAdminDb } from './firebase-admin'

interface RateLimitRecord {
  count: number
  windowStart: number
}

export interface RateLimitResult {
  allowed: boolean
  /** Secondes à attendre avant de réessayer (présent seulement si `allowed` est false). */
  retryAfterSeconds?: number
}

/** Rend une clé utilisable comme segment de chemin RTDB (caractères interdits : . # $ [ ] /). */
export function sanitizeRateLimitKey(raw: string): string {
  return raw.replace(/[.#$[\]/]/g, '_')
}

/** IP du client à partir des en-têtes de proxy standard (Vercel/Next les pose). */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  // Aucune IP identifiable (environnement local, en-têtes absents) : tous les
  // appelants dans ce cas partagent un seul compartiment plutôt que d'échapper
  // totalement à la limite.
  return 'inconnu'
}

/**
 * Vérifie et incrémente atomiquement le compteur `scope/key`. Fenêtre fixe de
 * `windowMs` : si la fenêtre précédente est expirée, elle repart à zéro. Au-delà
 * de `limit` requêtes dans la fenêtre courante, la transaction est abandonnée
 * (aucune écriture) et la requête est refusée.
 */
export async function checkRateLimit(
  scope: string,
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    const ref = getAdminDb().ref(`rateLimits/${scope}/${sanitizeRateLimitKey(key)}`)

    const result = await ref.transaction((current: RateLimitRecord | null) => {
      const now = Date.now()
      if (!current || now - current.windowStart >= windowMs) {
        return { count: 1, windowStart: now }
      }
      if (current.count >= limit) {
        // Abandonne la transaction (aucune écriture) : limite déjà atteinte.
        return undefined
      }
      return { count: current.count + 1, windowStart: current.windowStart }
    })

    if (result.committed) {
      return { allowed: true }
    }

    // Transaction abandonnée : la limite est atteinte pour la fenêtre en cours.
    // result.snapshot reflète la valeur serveur actuelle même en cas d'abandon.
    const current = result.snapshot.val() as RateLimitRecord | null
    const retryAfterSeconds = current
      ? Math.max(1, Math.ceil((current.windowStart + windowMs - Date.now()) / 1000))
      : Math.ceil(windowMs / 1000)
    return { allowed: false, retryAfterSeconds }
  } catch (err) {
    console.error(`[rate-limit] échec (scope=${scope}) — fail-open`, err)
    return { allowed: true }
  }
}

/** Message français prêt à afficher pour une réponse 429. */
export function rateLimitMessage(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60)
  return minutes <= 1
    ? 'Trop de requêtes. Réessayez dans une minute.'
    : `Trop de requêtes. Réessayez dans ${minutes} minutes.`
}
