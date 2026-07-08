import { NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/verify-token'

// ─── Session cookie handler (Approche A) ─────────────────────────────────────
//
// Firebase Auth (SDK client) stocke la session dans IndexedDB — invisible pour
// le proxy côté serveur. Cette route pose un cookie httpOnly que le proxy peut
// lire pour garder /dashboard/* AVANT le rendu (élimine le flash de contenu
// protégé + bloque les accès de rôle croisés par URL directe).
//
// POST  { Authorization: Bearer <idToken> }  → vérifie le token (Identity
//        Toolkit), lit le rôle AUTHENTIQUE depuis /users/{uid} (jamais depuis le
//        client) et pose gestuniv_session + gestuniv_role.
// DELETE → efface les cookies (déconnexion).
//
// La vérification cryptographique complète du token reste assurée par les Route
// Handlers et les règles RTDB ; le cookie n'est qu'un marqueur optimiste.

const SESSION_COOKIE = 'gestuniv_session'
const ROLE_COOKIE = 'gestuniv_role'
// 5 jours : le token stocké peut expirer (renouvelé côté client via
// onIdTokenChanged), mais le proxy ne vérifie que présence + format.
const MAX_AGE = 60 * 60 * 24 * 5

export async function POST(request: Request): Promise<Response> {
  const authResult = await verifyFirebaseToken(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Token invalide.' }, { status: 401 })
  }

  const idToken = (request.headers.get('authorization') ?? '').split(' ')[1] ?? ''

  // Rôle authentique lu côté serveur avec le token de l'appelant (jamais le
  // rôle "prétendu" par le client) → la garde de rôle du proxy est fiable.
  let role = ''
  try {
    const dbUrl = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? '').replace(/\/$/, '')
    const res = await fetch(
      `${dbUrl}/users/${authResult.uid}/role.json?auth=${idToken}`
    )
    if (res.ok) {
      const val = (await res.json()) as string | null
      if (typeof val === 'string') role = val
    }
  } catch {
    /* rôle inconnu → la garde de rôle du proxy sera simplement neutre */
  }

  const response = NextResponse.json({ ok: true })
  const secure = process.env.NODE_ENV === 'production'
  const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: MAX_AGE }
  response.cookies.set(SESSION_COOKIE, idToken, base)
  response.cookies.set(ROLE_COOKIE, role, base)
  return response
}

export async function DELETE(): Promise<Response> {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  response.cookies.set(ROLE_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return response
}
