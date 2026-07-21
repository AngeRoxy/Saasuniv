'use client'

import { useState, useEffect } from 'react'
import { User, Mail, KeyRound, Building2, Info, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { sendResetPasswordEmail } from '@/lib/auth'
import { getAllUniversities } from '@/lib/db'

// Version / date de dernière mise à jour : constantes simples et assumées.
// Périmètre volontairement réduit — aucun nœud Firebase, aucune config éditable.
// (Mise à jour manuelle lors d'un déploiement notable.)
const PLATFORM_VERSION = '1.0'
const PLATFORM_LAST_UPDATE = '21 juillet 2026'

// NOTE — évolution possible, NON construite ici : certains réglages mériteraient
// de devenir réellement configurables, p. ex. le nombre de jours d'essai gratuit
// par défaut (aujourd'hui codé en dur). Le rendre éditable supposerait un nœud
// global super-admin + des règles de sécurité dédiées : à faire seulement quand
// le besoin est confirmé, pas de façon spéculative.

export default function SuperAdminSettingsPage() {
  const { user, profile } = useAuth()
  const email = user?.email ?? '—'
  const displayName = profile?.displayName ?? user?.displayName ?? '—'

  // Réinitialisation du mot de passe : réutilise la fonction du flow existant
  // (sendResetPasswordEmail, cf. /auth/forgot-password), pré-remplie avec l'email
  // du super-admin connecté. AUCUN FAUX SUCCÈS : on n'affiche la confirmation
  // que si la fonction retourne réellement success.
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [resetError, setResetError] = useState('')

  // Nombre d'universités actives — réutilise getAllUniversities (dashboard principal).
  // null = comptage indisponible → on affiche « — » plutôt qu'un faux 0.
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const list = await getAllUniversities()
        if (!active) return
        setActiveCount(list.filter((u) => u.status === 'active').length)
      } catch {
        if (active) setActiveCount(null)
      } finally {
        if (active) setCountLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  async function handleReset() {
    if (!user?.email) {
      setResetError("Aucune adresse email n'est associée à votre compte.")
      return
    }
    setResetError('')
    setSending(true)
    const result = await sendResetPasswordEmail(user.email)
    if (result.success) {
      setSent(true)
    } else {
      setResetError(result.error ?? 'Une erreur est survenue. Veuillez réessayer.')
    }
    setSending(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Paramètres</h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
          Votre compte et quelques informations sur la plateforme.
        </p>
      </div>

      {/* ─── Section 1 : Compte super-administrateur ─────────────────────────── */}
      <section className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-orange-500/10 flex items-center gap-2">
          <ShieldCheck size={16} className="text-blue-600 dark:text-orange-400" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Compte super-administrateur</h2>
        </div>

        <div className="p-6 space-y-4">
          <InfoRow icon={User} label="Nom" value={displayName} />
          <InfoRow icon={Mail} label="Email" value={email} />

          {/* Réinitialisation du mot de passe */}
          <div className="pt-2 border-t border-zinc-200 dark:border-orange-500/10">
            {sent ? (
              <div className="flex items-start gap-2.5 bg-orange-500/5 border border-orange-500/20 rounded-xl px-4 py-3">
                <CheckCircle2 size={16} className="text-blue-600 dark:text-orange-400 mt-0.5 shrink-0" />
                <p className="text-sm text-zinc-800 dark:text-orange-100/80 leading-relaxed">
                  Un lien de réinitialisation a été envoyé à <span className="font-medium">{email}</span>.
                  Pensez à vérifier vos courriers indésirables.
                </p>
              </div>
            ) : (
              <>
                <button
                  onClick={handleReset}
                  disabled={sending || !user?.email}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 transition-colors"
                >
                  {sending ? (
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <KeyRound size={15} />
                  )}
                  Réinitialiser mon mot de passe
                </button>
                <p className="text-xs text-zinc-500 dark:text-orange-200/40 mt-2">
                  Un lien sécurisé sera envoyé à votre adresse email.
                </p>
                {resetError && (
                  <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mt-3">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{resetError}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ─── Section 2 : À propos de la plateforme (lecture seule) ───────────── */}
      <section className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-orange-500/10 flex items-center gap-2">
          <Info size={16} className="text-blue-600 dark:text-orange-400" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">À propos de la plateforme</h2>
        </div>

        <div className="p-6 space-y-4">
          <InfoRow
            icon={Building2}
            label="Universités actives"
            value={countLoading ? '…' : activeCount === null ? '—' : activeCount.toLocaleString('fr-FR')}
          />
          <InfoRow icon={Info} label="Version" value={PLATFORM_VERSION} />
          <InfoRow icon={Info} label="Dernière mise à jour" value={PLATFORM_LAST_UPDATE} />
        </div>
      </section>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-blue-600 dark:text-orange-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-orange-300/40">{label}</p>
        <p className="text-sm text-zinc-900 dark:text-white font-medium truncate">{value}</p>
      </div>
    </div>
  )
}
