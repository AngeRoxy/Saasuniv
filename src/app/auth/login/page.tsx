'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loginWithEmail } from '@/lib/auth'
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

  return (
    <div className="bg-white dark:bg-white/5 border border-orange-500/20 rounded-2xl p-8 shadow-lg shadow-zinc-300/40 dark:shadow-none">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">Connexion</h1>
      <p className="text-zinc-600 dark:text-orange-200/60 text-sm mb-8">Accédez à votre espace universitaire</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Email</label>
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
            disabled={loading}
            className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Mot de passe</label>
            <Link
              href="/auth/forgot-password"
              className="text-blue-600 dark:text-orange-400 hover:text-blue-900 dark:hover:text-orange-300 text-xs font-medium transition-colors"
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
            disabled={loading}
            className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 disabled:opacity-50"
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
              className="inline-block text-blue-600 dark:text-orange-400 hover:text-blue-900 dark:hover:text-orange-300 font-medium transition-colors"
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
          disabled={loading || lockedMinutes !== null}
          className="mt-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-full py-3 transition-colors flex items-center justify-center gap-2"
        >
          {loading && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
          {loading ? 'Connexion…' : lockedMinutes !== null ? 'Connexion verrouillée' : 'Se connecter'}
        </button>
      </form>

      <p className="mt-6 text-center text-zinc-600 dark:text-orange-200/60 text-sm">
        Pas encore de compte ?{' '}
        <Link href="/auth/register" className="text-blue-600 dark:text-orange-400 hover:text-blue-900 dark:hover:text-orange-300 font-medium transition-colors">
          Créer un compte
        </Link>
      </p>
      <p className="mt-3 text-center text-zinc-500 dark:text-orange-200/40 text-xs">
        Administrateur ?{' '}
        <Link href="/auth/register-university" className="text-blue-700 dark:text-orange-500/70 hover:text-blue-800 dark:hover:text-orange-400 font-medium transition-colors">
          Créer votre université
        </Link>
      </p>
    </div>
  )
}
