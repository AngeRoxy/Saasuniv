interface IdentityToolkitUser {
  localId: string
}

interface IdentityToolkitLookupResponse {
  users?: IdentityToolkitUser[]
}

/**
 * Vérifie un idToken Firebase via l'endpoint REST Identity Toolkit
 * (firebase-admin n'étant pas disponible côté serveur).
 *
 * Attend un header `Authorization: Bearer <idToken>`.
 * Retourne `{ uid }` si le token est valide, sinon `null`.
 */
export async function verifyFirebaseToken(
  request: Request
): Promise<{ uid: string } | null> {
  try {
    const authorization = request.headers.get('authorization')
    if (!authorization) return null

    const [scheme, idToken] = authorization.split(' ')
    if (scheme !== 'Bearer' || !idToken) return null

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    if (!apiKey) return null

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    )

    if (!res.ok) return null

    const data = (await res.json()) as IdentityToolkitLookupResponse
    if (!data.users || data.users.length === 0) return null

    return { uid: data.users[0].localId }
  } catch {
    return null
  }
}
