'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'
import { sendResetPasswordEmail } from '@/lib/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    // SÉCURITÉ ANTI-ÉNUMÉRATION : quel que soit le résultat réel (compte
    // existant ou non), on affiche TOUJOURS le même message générique. Seule
    // une vraie erreur technique (email malformé, quota) interrompt le flux.
    const result = await sendResetPasswordEmail(email)
    if (result.success) {
      setSent(true)
    } else {
      setError(result.error ?? 'Une erreur est survenue. Veuillez réessayer.')
    }
    setLoading(false)
  }

  return (
    <div className="bg-white dark:bg-white/5 border border-orange-500/20 rounded-2xl p-8 shadow-lg shadow-zinc-300/40 dark:shadow-none">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">Mot de passe oublié</h1>
      <p className="text-zinc-600 dark:text-orange-200/60 text-sm mb-8">
        Saisissez votre email pour recevoir un lien de réinitialisation.
      </p>

      {sent ? (
        <div className="flex flex-col items-center text-center gap-4 py-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-orange-400" />
          </div>
          <p className="text-zinc-900 dark:text-white text-sm leading-relaxed">
            Si un compte existe avec cet email, un lien de réinitialisation a
            été envoyé. Pensez à vérifier vos courriers indésirables.
          </p>
          <Link
            href="/auth/login"
            className="mt-2 inline-flex items-center gap-2 text-blue-600 dark:text-orange-400 hover:text-blue-900 dark:hover:text-orange-300 text-sm font-medium transition-colors"
          >
            <ArrowLeft size={15} />
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
                disabled={loading}
                className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 disabled:opacity-50"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-full py-3 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <Mail size={16} />
              )}
              {loading ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
            </button>
          </form>

          <p className="mt-6 text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 text-zinc-600 dark:text-orange-200/60 hover:text-blue-900 dark:hover:text-orange-300 text-sm font-medium transition-colors"
            >
              <ArrowLeft size={15} />
              Retour à la connexion
            </Link>
          </p>
        </>
      )}
    </div>
  )
}
