'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loginWithEmail, loginWithGoogle } from '@/lib/auth'
import {
  getUserProfile,
  checkLoginLocked,
  recordFailedLoginAttempt,
  resetLoginAttempts,
} from '@/lib/db'
import { MAX_LOGIN_ATTEMPTS } from '@/types/security'
import { syncSessionCookie } from '@/lib/session-client'

type Role = 'admin_universite' | 'teacher' | 'student' | 'parent' | 'super_admin_plateforme'

const ROLE_REDIRECTS: Record<Role, string> = {
  admin_universite: '/dashboard/admin',
  teacher: '/dashboard/teacher',
  student: '/dashboard/student',
  parent: '/dashboard/parent',
  super_admin_plateforme: '/dashboard/super-admin',
}

function getErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email':       return 'Adresse email invalide.'
    case 'auth/user-not-found':      return 'Aucun compte trouvé avec cet email.'
    case 'auth/wrong-password':      return 'Mot de passe incorrect.'
    case 'auth/invalid-credential':  return 'Email ou mot de passe incorrect.'
    case 'auth/too-many-requests':   return 'Trop de tentatives. Réessayez dans quelques minutes.'
    case 'auth/user-disabled':       return 'Ce compte a été désactivé.'
    case 'auth/popup-closed-by-user': return 'Connexion annulée.'
    case 'auth/cancelled-popup-request': return 'Connexion annulée.'
    default:                         return 'Une erreur est survenue. Veuillez réessayer.'
  }
}

async function resolveAndRedirect(uid: string, router: ReturnType<typeof useRouter>) {
  let role: Role = 'student'
  try {
    const profile = await Promise.race([
      getUserProfile(uid),
      new Promise<null>(r => setTimeout(() => r(null), 4000)),
    ])
    if (profile?.role) role = profile.role as Role
  } catch { /* default */ }
  // Pose le cookie de session AVANT la navigation pour que le proxy voie la
  // session dès le premier chargement de /dashboard (évite un rebond login).
  await syncSessionCookie()
  router.push(ROLE_REDIRECTS[role])
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  // Anti brute-force : minutes restantes de verrouillage (null = non verrouillé)
  // et compteur local d'échecs (hint « X tentatives restantes » ; le verrou fait
  // autorité côté serveur via /loginAttempts).
  const [lockedMinutes, setLockedMinutes] = useState<number | null>(null)
  const [failedCount, setFailedCount] = useState(0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLockedMinutes(null)
    setLoading(true)

    // 1. Le login de cet email est-il temporairement verrouillé ?
    //    (best-effort : une erreur de lecture ne doit pas bloquer la connexion).
    let lock: { locked: boolean; remainingMinutes?: number } = { locked: false }
    try {
      lock = await checkLoginLocked(email)
    } catch {
      /* on continue : Firebase Auth reste la ligne de défense principale */
    }
    if (lock.locked) {
      setLockedMinutes(lock.remainingMinutes ?? 15)
      setLoading(false)
      return
    }

    // 2. Tentative de connexion.
    try {
      const credential = await loginWithEmail(email, password)
      // Succès → on nettoie le compteur d'échecs (best-effort).
      resetLoginAttempts(email).catch(() => {})
      setFailedCount(0)
      await resolveAndRedirect(credential.user.uid, router)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      // 3. Échec → on enregistre la tentative (anti brute-force).
      let recorded: { locked: boolean; lockedUntil?: number } | null = null
      try {
        recorded = await recordFailedLoginAttempt(email)
      } catch {
        /* enregistrement non bloquant */
      }

      if (recorded?.locked) {
        const mins = recorded.lockedUntil
          ? Math.ceil((recorded.lockedUntil - Date.now()) / 60000)
          : 15
        setLockedMinutes(mins)
      } else {
        const nextCount = failedCount + 1
        setFailedCount(nextCount)
        const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - nextCount)
        const base = getErrorMessage(code)
        setError(
          remaining > 0 && remaining < MAX_LOGIN_ATTEMPTS
            ? `${base} ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''} avant verrouillage.`
            : base
        )
      }
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)
    try {
      const credential = await loginWithGoogle()
      await resolveAndRedirect(credential.user.uid, router)
    } catch (err: unknown) {
      setError(getErrorMessage((err as { code?: string }).code ?? ''))
      setGoogleLoading(false)
    }
  }

  return (
    <div className="bg-black/60 backdrop-blur-md border border-orange-500/20 rounded-2xl p-8 shadow-2xl shadow-black/50">
      <h1 className="text-2xl font-bold text-white mb-1">Connexion</h1>
      <p className="text-orange-200/60 text-sm mb-8">Accédez à votre espace universitaire</p>

      {/* Google button */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading || googleLoading}
        className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl py-3 mb-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
      >
        {googleLoading ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.3 0-9.6-2.9-11.3-7l-6.5 5C9.8 39.9 16.4 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C41 35.1 44 30 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
        )}
        Continuer avec Google
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-orange-200/30">ou</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-orange-200/60 text-sm font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value)
              // Le verrou est par email : changer d'email réactive le bouton.
              setLockedMinutes(null)
              setFailedCount(0)
            }}
            placeholder="vous@exemple.com"
            required
            disabled={loading || googleLoading}
            className="bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-orange-200/60 text-sm font-medium">Mot de passe</label>
            <Link
              href="/auth/forgot-password"
              className="text-orange-400 hover:text-orange-300 text-xs font-medium transition-colors"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={loading || googleLoading}
            className="bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 disabled:opacity-50"
          />
        </div>

        {lockedMinutes !== null ? (
          <div className="text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 space-y-1.5">
            <p>
              Trop de tentatives échouées. Réessayez dans{' '}
              <span className="font-semibold text-red-200">{lockedMinutes} minute{lockedMinutes > 1 ? 's' : ''}</span>,
              ou réinitialisez votre mot de passe.
            </p>
            <Link
              href="/auth/forgot-password"
              className="inline-block text-orange-400 hover:text-orange-300 font-medium transition-colors"
            >
              Réinitialiser mon mot de passe →
            </Link>
          </div>
        ) : (
          error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )
        )}

        <button
          type="submit"
          disabled={loading || googleLoading || lockedMinutes !== null}
          className="mt-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold rounded-full py-3 transition-colors flex items-center justify-center gap-2"
        >
          {loading && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
          {loading ? 'Connexion…' : lockedMinutes !== null ? 'Connexion verrouillée' : 'Se connecter'}
        </button>
      </form>

      <p className="mt-6 text-center text-orange-200/60 text-sm">
        Pas encore de compte ?{' '}
        <Link href="/auth/register" className="text-orange-400 hover:text-orange-300 font-medium transition-colors">
          Créer un compte
        </Link>
      </p>
      <p className="mt-3 text-center text-orange-200/40 text-xs">
        Administrateur ?{' '}
        <Link href="/auth/register-university" className="text-orange-500/70 hover:text-orange-400 font-medium transition-colors">
          Créer votre université
        </Link>
      </p>
    </div>
  )
}
