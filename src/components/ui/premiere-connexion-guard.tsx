'use client'

import { useEffect, useState } from 'react'
import { Lock, Eye, EyeOff, CheckCircle2, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  checkPremiereConnexion,
  markConnexionEffectuee,
  updateOwnProfile,
} from '@/lib/auth'

type CheckState = 'checking' | 'required' | 'done'

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.'
  if (!/[A-Z]/.test(pw)) return 'Le mot de passe doit contenir au moins une majuscule.'
  if (!/[0-9]/.test(pw)) return 'Le mot de passe doit contenir au moins un chiffre.'
  return null
}

export function PremiereConnexionGuard({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth()
  const [state, setState] = useState<CheckState>('checking')

  // Form state
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    // Tant qu'il n'y a pas d'utilisateur, le layout parent gère la redirection ;
    // on reste sur l'état initial 'checking' (skeleton) sans setState synchrone.
    if (!user) return
    let cancelled = false
    checkPremiereConnexion(user.uid)
      .then((required) => {
        if (!cancelled) setState(required ? 'required' : 'done')
      })
      .catch(() => {
        // En cas d'erreur de lecture, ne pas bloquer l'utilisateur.
        if (!cancelled) setState('done')
      })
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const validation = validatePassword(newPw)
    if (validation) {
      setError(validation)
      return
    }
    if (newPw !== confirmPw) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    if (!user || !profile) {
      setError('Session introuvable. Reconnectez-vous.')
      return
    }

    setSubmitting(true)
    try {
      // updateOwnProfile gère updatePassword(auth.currentUser).
      await updateOwnProfile(
        profile.universityId,
        user.uid,
        { motDePasse: newPw },
        profile.role
      )
      await markConnexionEffectuee(user.uid, profile.universityId)
      setToast('Mot de passe mis à jour. Bienvenue !')
      setState('done')
      setTimeout(() => setToast(null), 4000)
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      setError(
        code === 'auth/requires-recent-login'
          ? 'Pour des raisons de sécurité, reconnectez-vous puis réessayez.'
          : code === 'auth/weak-password'
            ? 'Mot de passe trop faible.'
            : 'Impossible de mettre à jour le mot de passe. Réessayez.'
      )
      setSubmitting(false)
    }
  }

  // Skeleton plein écran pendant la vérification.
  if (state === 'checking') {
    return (
      <div className="fixed inset-0 z-100 bg-[#fafafa] dark:bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (state === 'required') {
    return (
      <div className="fixed inset-0 z-100 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-950 border border-orange-500/20 shadow-2xl shadow-black/50 overflow-hidden flex flex-col max-h-[90vh]">
          <div className="px-7 pt-7 pb-5 text-center border-b border-zinc-200 dark:border-orange-500/10 shrink-0">
            <div className="mx-auto w-12 h-12 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center mb-4">
              <ShieldCheck className="h-6 w-6 text-blue-600 dark:text-orange-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Bienvenue sur GestUniv !</h2>
            <p className="text-sm text-zinc-600 dark:text-orange-200/60 mt-2 leading-relaxed">
              Pour sécuriser votre compte, vous devez changer votre mot de passe
              temporaire avant de continuer.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-7 py-6 flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-600 dark:text-orange-200/60 font-medium">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#fafafa] dark:bg-black border border-orange-500/20 rounded-xl px-4 py-2.5 pr-10 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-600 dark:text-orange-200/60 font-medium">Confirmer le mot de passe</label>
              <input
                type={showNew ? 'text' : 'password'}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#fafafa] dark:bg-black border border-orange-500/20 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 transition-colors"
              />
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-orange-200/40 leading-relaxed">
              Minimum 8 caractères, dont au moins une majuscule et un chiffre.
            </p>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                {error}
              </p>
            )}

            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.5 transition-colors mt-4 shrink-0"
            >
              {submitting && (
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              )}
              <Lock size={15} />
              Changer mon mot de passe
            </button>
          </form>
        </div>
      </div>
    )
  }

  // state === 'done' → on rend l'application.
  return (
    <>
      {children}
      {toast && (
        <div className="fixed bottom-6 right-6 z-110 flex items-center gap-2.5 bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-3 shadow-2xl">
          <CheckCircle2 size={16} className="text-blue-600 dark:text-orange-400 shrink-0" />
          <p className="text-zinc-800 dark:text-orange-100 text-sm">{toast}</p>
        </div>
      )}
    </>
  )
}

export default PremiereConnexionGuard
