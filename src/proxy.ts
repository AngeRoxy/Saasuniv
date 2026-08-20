import { NextResponse, type NextRequest } from 'next/server'

/*
 * Proxy Next.js 16 (ex-"middleware", renommé en v16) — exécuté AVANT le rendu
 * de CHAQUE route (cf. matcher en bas de fichier, audit sécurité 2026-08-19).
 * Deux responsabilités bien distinctes selon le chemin :
 *
 * 1. TOUTES les routes (sauf assets statiques) : pose un nonce CSP par
 *    requête et l'en-tête Content-Security-Policy (voir buildCsp ci-dessous).
 *
 * 2. UNIQUEMENT /dashboard/* : garde d'authentification et de rôle CÔTÉ
 *    SERVEUR, en plus de la CSP.
 *
 *    CHOIX D'IMPLÉMENTATION — Approche A du cahier des charges :
 *    ce projet n'utilise PAS firebase-admin pour cette garde (indisponible
 *    dans l'environnement d'origine, cf. src/lib/verify-token.ts — il existe
 *    désormais mais scopé au webhook GeniusPay, voir SECURITY_AUDIT.md). On
 *    ne peut donc pas vérifier cryptographiquement le token ici. On applique
 *    une "optimistic check" — usage explicitement recommandé par la doc
 *    Next.js pour le proxy — basée sur un cookie httpOnly posé par
 *    /api/session :
 *      - gestuniv_session : idToken Firebase (présence + format JWT vérifiés) ;
 *      - gestuniv_role    : rôle authentifié CÔTÉ SERVEUR (lu depuis
 *                           /users/{uid} par /api/session, jamais depuis le
 *                           client).
 *
 *    La sécurité réelle repose sur DEUX autres couches, non remplacées par le
 *    proxy :
 *      1. les Route Handlers (verifyFirebaseToken via Identity Toolkit REST) ;
 *      2. les règles Realtime Database (isolation stricte par universityId).
 *    Le proxy sert à éliminer le flash de contenu protégé et à bloquer les
 *    accès de rôle croisés par URL directe — pas à faire autorité sur les
 *    données.
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

// ─── Content-Security-Policy (posée ICI, pas dans next.config.ts) ───────────
//
// next.config.ts `headers()` ne peut renvoyer que des valeurs STATIQUES,
// figées au build. Or Next.js App Router injecte à CHAQUE requête ses propres
// <script> inline (streaming RSC, hydratation) dont le contenu change à
// chaque fois : impossible de les autoriser par hash statique, et les
// autoriser via 'unsafe-inline' annulerait l'intérêt de script-src. La
// solution officielle Next.js est un NONCE généré PAR REQUÊTE ici (seul
// endroit qui s'exécute avant le rendu) :
//   - posé sur l'en-tête de réponse Content-Security-Policy (script-src
//     'nonce-xxx') ;
//   - transmis via l'en-tête de requête `x-nonce`, relu par
//     src/app/layout.tsx (next/headers) pour l'appliquer à SON propre script
//     inline (anti-flash de thème).
// Next.js applique automatiquement ce même nonce à ses propres scripts dès
// qu'il détecte un CSP avec 'nonce-' dans script-src — aucune autre config.
//
// 'strict-dynamic' : un script de confiance (nonce/hash) peut charger
// dynamiquement d'autres scripts, qui héritent automatiquement de la
// confiance. C'est ce qui permet à
// src/components/ui/jitsi-video-call.tsx d'injecter
// https://meet.jit.si/external_api.js via document.createElement sans nonce
// propre. https://meet.jit.si reste listé en repli pour les navigateurs sans
// support de 'strict-dynamic' (celui-ci l'ignore quand il est supporté).
//
// style-src garde 'unsafe-inline' (seul assouplissement volontaire de cette
// CSP) : l'app utilise des attributs `style={{...}}` React dynamiques un peu
// partout (ex. src/components/ui/member-avatar.tsx, tailles calculées) —
// aucun mécanisme de nonce/hash ne s'applique à un attribut `style=""`
// arbitraire par élément. Risque résiduel largement inférieur à
// script-src 'unsafe-inline' (pas d'exécution de code).

// ⚠️ CORRECTIF URGENT (2026-08-19, casse confirmée en prod par capture
// console) : le databaseURL du projet (saasuniv-default-rtdb.europe-
// west1.firebasedatabase.app) n'est PAS le domaine réellement utilisé pour la
// connexion temps réel. Le SDK RTDB se connecte à un hôte TECHNIQUE assigné
// par le load balancer régional GKE de Google (observé en prod :
// s-gke-euw1-nssi2-5.europe-west1.firebasedatabase.app), différent du
// databaseURL et potentiellement variable dans le temps/selon le shard —
// impossible à figer en dur. Remplacé par un wildcard multi-niveaux
// (`*.firebasedatabase.app` couvre un nombre ARBITRAIRE de sous-domaines en
// CSP — contrairement aux wildcards de certificat TLS, limités à un seul
// niveau — donc `s-gke-euw1-nssi2-5.europe-west1.firebasedatabase.app`
// correspond bien à `*.firebasedatabase.app`).
//
// Le même hôte RTDB dynamique doit AUSSI être autorisé en frame-src : quand
// la connexion WebSocket échoue (ex. bloquée par connect-src, comme ici), le
// SDK RTDB retombe automatiquement sur un transport de repli en long-polling
// via un iframe caché pointant vers ce même hôte — c'est ce qui expliquait le
// message d'erreur "Framing '<hôte RTDB>' violates frame-src" observé en
// prod : rien à voir avec Jitsi malgré l'apparence, c'est Firebase RTDB
// lui-même qui tentait ce repli après l'échec du WebSocket.
//
// Par précaution, l'iframe d'assistance interne de Firebase Auth
// (<authDomain>/__/auth/iframe, utilisée par le SDK même en email/mot de
// passe pour la synchronisation d'état entre onglets) est aussi ajoutée à
// frame-src — non confirmée cassée, mais même famille de risque que le
// domaine RTDB : mieux vaut l'anticiper que revivre cette panne pour l'auth.
const FIREBASE_AUTH = 'https://saasuniv.firebaseapp.com'
const FIREBASE_IDENTITY = 'https://identitytoolkit.googleapis.com'
const FIREBASE_SECURE_TOKEN = 'https://securetoken.googleapis.com'
const FIREBASE_RTDB_WILDCARD = 'https://*.firebasedatabase.app'
const FIREBASE_RTDB_WILDCARD_WSS = 'wss://*.firebasedatabase.app'
// Storage est désactivé (STORAGE_ENABLED=false, cf. src/lib/storage.ts) mais
// déjà référencé par src/components/ui/member-avatar.tsx (photoUrl) : inclus
// par anticipation pour ne pas casser silencieusement les avatars le jour où
// il est réactivé. Domaine Google partagé (pas de sous-domaine dynamique par
// projet comme RTDB) : pas besoin de wildcard.
const FIREBASE_STORAGE = 'https://firebasestorage.googleapis.com'
const JITSI = 'https://meet.jit.si'
const JITSI_WSS = 'wss://meet.jit.si'

// Volontairement PAS de wildcard `*.googleapis.com` : ce domaine héberge des
// centaines d'API Google sans rapport avec l'app (Maps, Ads, Cloud...). Un tel
// wildcard viderait la CSP de son intérêt contre l'exfiltration en cas de XSS.
// Seul firebasedatabase.app a un besoin DÉMONTRÉ de wildcard (hôte dynamique
// par shard) ; identitytoolkit/securetoken.googleapis.com et
// firebasestorage.googleapis.com sont des points d'entrée Google stables et
// documentés, pas des domaines générés par un load balancer régional.

function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${JITSI}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: ${FIREBASE_STORAGE} ${JITSI}`,
    `font-src 'self' data:`,
    `connect-src 'self' ${FIREBASE_AUTH} ${FIREBASE_IDENTITY} ${FIREBASE_SECURE_TOKEN} ${FIREBASE_RTDB_WILDCARD} ${FIREBASE_RTDB_WILDCARD_WSS} ${FIREBASE_STORAGE} ${JITSI} ${JITSI_WSS}`,
    `frame-src ${JITSI} ${FIREBASE_AUTH} ${FIREBASE_RTDB_WILDCARD}`,
    `media-src 'self'`,
    `worker-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ')
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Nonce frais à chaque requête (voir commentaire ci-dessus) — posé pour
  // TOUTE route couverte par le matcher, pas seulement /dashboard/*.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  // Seules les routes /dashboard/* sont gardées par le cookie de session. Pour
  // tout le reste (/, /auth/*, /api/*, /contact...), le proxy ne fait QUE
  // poser la CSP/le nonce et laisse passer : les routes API ont leur propre
  // authentification par Bearer token (verifyFirebaseToken), indépendante de
  // ce cookie — les y soumettre casserait tous les appels API.
  if (!pathname.startsWith('/dashboard')) {
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set('Content-Security-Policy', csp)
    return response
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value

  // 1. Aucune session valide → redirection vers /auth/login avant tout rendu.
  if (!looksLikeJwt(session)) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    const response = NextResponse.redirect(loginUrl)
    response.headers.set('Content-Security-Policy', csp)
    return response
  }

  // 2. Garde de rôle : un étudiant ne doit pas accéder à /dashboard/admin/*, etc.
  //    (rôle absent → garde neutre, la couche client/DB prend le relais).
  const role = request.cookies.get(ROLE_COOKIE)?.value
  if (role) {
    const section = SECTION_ROLES.find((s) => pathname.startsWith(s.prefix))
    if (section && !section.allowed.includes(role)) {
      const response = NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/auth/login', request.url))
      response.headers.set('Content-Security-Policy', csp)
      return response
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  // Toutes les routes SAUF les assets statiques Next.js (jamais de document
  // HTML à protéger par CSP, et un nonce y serait sans effet).
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
