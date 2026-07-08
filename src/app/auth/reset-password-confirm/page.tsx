'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Lock, Eye, EyeOff, CheckCircle2, ShieldAlert } from 'lucide-react'
import { confirmResetPassword, validatePasswordStrength } from '@/lib/auth'

function ResetConfirmInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Firebase transmet le code via ?oobCode=... (le paramètre ?mode=resetPassword
  // est également présent mais on ne s'en sert pas ici).
  const oobCode = searchParams.get('oobCode') ?? ''

  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Redirection automatique vers le login 3 s après un succès.
  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => router.push('/auth/login'), 3000)
    return () => clearTimeout(id)
  }, [done, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const validation = validatePasswordStrength(newPw)
    if (validation) {
      setError(validation)
      return
    }
    if (newPw !== confirmPw) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSubmitting(true)
    const result = await confirmResetPassword(oobCode, newPw)
    if (result.success) {
      setDone(true)
    } else {
      setError(result.error ?? 'Une erreur est survenue. Veuillez réessayer.')
      setSubmitting(false)
    }
  }

  // Code manquant → lien invalide, on invite à recommencer.
  if (!oobCode) {
    return (
      <div className="bg-black/60 backdrop-blur-md border border-red-500/20 rounded-2xl p-8 shadow-2xl shadow-black/50 text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mb-4">
          <ShieldAlert className="h-6 w-6 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Lien invalide ou expiré</h1>
        <p className="text-orange-200/60 text-sm mb-6 leading-relaxed">
          Ce lien de réinitialisation est invalide ou a expiré. Vous pouvez en
          demander un nouveau.
        </p>
        <Link
          href="/auth/forgot-password"
          className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-full py-2.5 px-6 text-sm transition-colors"
        >
          Recommencer la réinitialisation
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="bg-black/60 backdrop-blur-md border border-orange-500/20 rounded-2xl p-8 shadow-2xl shadow-black/50 text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-6 w-6 text-orange-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Mot de passe réinitialisé</h1>
        <p className="text-orange-200/60 text-sm mb-6 leading-relaxed">
          Votre mot de passe a été mis à jour. Vous allez être redirigé vers la
          page de connexion…
        </p>
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center gap-2 text-orange-400 hover:text-orange-300 text-sm font-medium transition-colors"
        >
          Se connecter maintenant
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-black/60 backdrop-blur-md border border-orange-500/20 rounded-2xl p-8 shadow-2xl shadow-black/50">
      <h1 className="text-2xl font-bold text-white mb-1">Nouveau mot de passe</h1>
      <p className="text-orange-200/60 text-sm mb-8">
        Choisissez un nouveau mot de passe pour votre compte.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-orange-200/60 text-sm font-medium">Nouveau mot de passe</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="••••••••"
              required
              disabled={submitting}
              className="w-full bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 pr-10 text-white placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-orange-200/60 text-sm font-medium">Confirmer le mot de passe</label>
          <input
            type={showPw ? 'text' : 'password'}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="••••••••"
            required
            disabled={submitting}
            className="bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 disabled:opacity-50"
          />
        </div>

        <p className="text-[11px] text-orange-200/40 leading-relaxed">
          Minimum 8 caractères, dont au moins une majuscule et un chiffre.
        </p>

        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold rounded-full py-3 transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            <Lock size={16} />
          )}
          {submitting ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
        </button>
      </form>

      <p className="mt-6 text-center text-orange-200/40 text-xs">
        <Link href="/auth/login" className="hover:text-orange-300 transition-colors">
          Retour à la connexion
        </Link>
      </p>
    </div>
  )
}

export default function ResetPasswordConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ResetConfirmInner />
    </Suspense>
  )
}
