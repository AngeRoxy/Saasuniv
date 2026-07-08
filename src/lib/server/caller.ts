// ⚠️ Module SERVEUR UNIQUEMENT.
// Lit le profil AUTHENTIQUE de l'appelant (rôle + universityId) depuis
// /users/{uid} via l'API REST RTDB, authentifiée par SON idToken. Sert aux
// Route Handlers à vérifier la cohérence université/rôle du corps reçu contre
// l'identité réelle du token — jamais contre des valeurs "prétendues" par le
// client (empêche un utilisateur d'agir sur une autre université en trafiquant
// le body).

export interface CallerProfile {
  uid: string
  role: string
  universityId: string
}

export async function fetchCallerProfile(
  uid: string,
  idToken: string
): Promise<CallerProfile | null> {
  try {
    const dbUrl = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? '').replace(/\/$/, '')
    const res = await fetch(`${dbUrl}/users/${uid}.json?auth=${idToken}`)
    if (!res.ok) return null
    const data = (await res.json()) as { role?: string; universityId?: string } | null
    if (!data) return null
    return { uid, role: data.role ?? '', universityId: data.universityId ?? '' }
  } catch {
    return null
  }
}

/** Extrait l'idToken d'un header `Authorization: Bearer <token>`. */
export function bearerToken(request: Request): string {
  return (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
}
