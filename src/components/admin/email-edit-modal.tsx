'use client'

import { useState } from 'react'
import { X, Mail, AlertTriangle } from 'lucide-react'
import { updateMemberEmailViaApi } from '@/lib/members-client'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export interface EmailEditTarget {
  uid: string
  displayName: string
  email: string
}

interface Props {
  target: EmailEditTarget
  universityId: string
  onClose: () => void
  /** Appelé après succès avec le nouvel email et l'éventuel avertissement serveur. */
  onUpdated: (newEmail: string, warning?: string) => void
}

/**
 * Modal dédié à la CORRECTION de l'email d'un membre par l'admin (ex: faute de
 * frappe). Opération sensible (Auth + RTDB + notifications) → volontairement
 * séparée du formulaire d'édition classique. Réservée à l'admin ; l'API
 * revérifie l'autorisation côté serveur.
 */
export function EmailEditModal({ target, universityId, onClose, onUpdated }: Props) {
  const [email, setEmail] = useState(target.email)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setError('Adresse email invalide.')
      return
    }
    if (trimmed.toLowerCase() === target.email.trim().toLowerCase()) {
      setError('La nouvelle adresse est identique à l’actuelle.')
      return
    }

    setSubmitting(true)
    try {
      const result = await updateMemberEmailViaApi({
        targetUid: target.uid,
        newEmail: trimmed,
        universityId,
      })
      onUpdated(trimmed, result.warning)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la mise à jour.")
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-orange-500/20 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Mail size={18} className="text-orange-400" />
            Corriger l&apos;email
          </h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-zinc-400 mb-5">
          Membre : <span className="text-white font-medium">{target.displayName}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Nouvelle adresse email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="membre@exemple.com"
              disabled={submitting}
              className="w-full bg-black border border-zinc-800 focus:border-orange-500/60 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none transition-colors disabled:opacity-50"
            />
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20 px-4 py-3">
            <AlertTriangle size={15} className="text-orange-400 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-200/70 leading-relaxed">
              Une notification sera envoyée à l&apos;ancienne et à la nouvelle
              adresse. L&apos;email est réservé à l&apos;administration ; le membre
              ne peut pas le modifier lui-même.
            </p>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-black rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
              {submitting ? 'Mise à jour…' : "Mettre à jour l'email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EmailEditModal
