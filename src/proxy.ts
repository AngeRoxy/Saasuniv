import { NextResponse, type NextRequest } from 'next/server'

/*
 * Proxy Next.js 16 (ex-"middleware", renommé en v16) — garde d'authentification
 * et de rôle CÔTÉ SERVEUR pour /dashboard/*, exécutée AVANT le rendu de la page.
 *
 * CHOIX D'IMPLÉMENTATION — Approche A du cahier des charges :
 * ce projet n'utilise PAS firebase-admin (indisponible dans cet environnement,
 * cf. src/lib/verify-token.ts). On ne peut donc pas vérifier cryptographiquement
 * le token ici. On applique une "optimistic check" — usage explicitement
 * recommandé par la doc Next.js pour le proxy — basée sur un cookie httpOnly
 * posé par /api/session :
 *   - gestuniv_session : idToken Firebase (présence + format JWT vérifiés) ;
 *   - gestuniv_role    : rôle authentifié CÔTÉ SERVEUR (lu depuis /users/{uid}
 *                        par /api/session, jamais depuis le client).
 *
 * La sécurité réelle repose sur DEUX autres couches, non remplacées par le proxy :
 *   1. les Route Handlers (verifyFirebaseToken via Identity Toolkit REST) ;
 *   2. les règles Realtime Database (isolation stricte par universityId).
 * Le proxy sert à éliminer le flash de contenu protégé et à bloquer les accès
 * de rôle croisés par URL directe — pas à faire autorité sur les données.
 */

const SESSION_COOKIE = 'gestuniv_session'
const ROLE_COOKIE = 'gestuniv_role'

const ROLE_HOME: Record<string, string> = {
  admin_universite: '/dashboard/admin',
  teacher: '/dashboard/teacher',
  student: '/dashboard/student',
  parent: '/dashboard/parent',
  super_admin_plateforme: '/dashboard/super-admin',
}

// Section de dashboard → rôles autorisés. Le super admin a accès à tout.
// Ordre important : les préfixes les plus spécifiques ne se chevauchent pas
// (`/dashboard/super-admin` n'est pas un préfixe de `/dashboard/admin`).
const SECTION_ROLES: { prefix: string; allowed: string[] }[] = [
  { prefix: '/dashboard/super-admin', allowed: ['super_admin_plateforme'] },
  { prefix: '/dashboard/admin', allowed: ['admin_universite', 'super_admin_plateforme'] },
  { prefix: '/dashboard/teacher', allowed: ['teacher', 'super_admin_plateforme'] },
  { prefix: '/dashboard/student', allowed: ['student', 'super_admin_plateforme'] },
  { prefix: '/dashboard/parent', allowed: ['parent', 'super_admin_plateforme'] },
]

/** Un idToken Firebase est un JWT : 3 segments base64url non vides séparés par '.'. */
function looksLikeJwt(value: string | undefined): value is string {
  if (!value) return false
  const parts = value.split('.')
  return parts.length === 3 && parts.every((p) => p.length > 0)
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Seules les routes /dashboard/* atteignent ce proxy (cf. matcher). Les routes
  // publiques (/, /auth/*, /api/*) ne sont jamais gardées ici.
  const session = request.cookies.get(SESSION_COOKIE)?.value

  // 1. Aucune session valide → redirection vers /auth/login avant tout rendu.
  if (!looksLikeJwt(session)) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 2. Garde de rôle : un étudiant ne doit pas accéder à /dashboard/admin/*, etc.
  //    (rôle absent → garde neutre, la couche client/DB prend le relais).
  const role = request.cookies.get(ROLE_COOKIE)?.value
  if (role) {
    const section = SECTION_ROLES.find((s) => pathname.startsWith(s.prefix))
    if (section && !section.allowed.includes(role)) {
      return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/auth/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
