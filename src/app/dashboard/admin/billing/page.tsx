'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Check,
  X,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTrial } from '@/hooks/useTrial'
import { convertTrial } from '@/lib/db'
import { PLANS_CONFIG, PLAN_ORDER } from '@/lib/plans'
import { PlanBadge } from '@/components/ui/plan-badge'
import type { PlanFeatures, PlanId } from '@/types/plan'
import { TRIAL_DURATION_MS } from '@/types/trial'

const CONTACT_EMAIL = 'contact@gestuniv.com'
const TRIAL_DAYS = Math.round(TRIAL_DURATION_MS / (24 * 60 * 60 * 1000))

/** Fonctionnalités affichées dans les cartes (libellé + clé). */
const FEATURE_ROWS: { key: keyof PlanFeatures; label: string }[] = [
  { key: 'chatbotIA', label: 'Assistant IA' },
  { key: 'recommandationsIA', label: 'Recommandations IA' },
  { key: 'importCSV', label: 'Import CSV / Excel' },
  { key: 'exportPDF', label: 'Export PDF' },
  { key: 'bulletinsPDF', label: 'Bulletins PDF' },
  { key: 'messagerieInterne', label: 'Messagerie interne' },
  { key: 'notificationsEmail', label: 'Notifications email' },
  { key: 'multiCampus', label: 'Multi-campus' },
  { key: 'apiAccess', label: 'Accès API' },
  { key: 'supportPrioritaire', label: 'Support prioritaire' },
  { key: 'auditLogs', label: 'Journaux d’audit' },
  { key: 'sousDomainePerso', label: 'Sous-domaine personnalisé' },
]

function formatPrice(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value)
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function BillingPage() {
  const { profile, loading: authLoading } = useAuth()
  const universityId = profile?.universityId ?? ''
  const {
    trialInfo,
    isTrialActive,
    isTrialExpired,
    isConverted,
    daysRemaining,
    loading: trialLoading,
  } = useTrial(universityId)

  const [annual, setAnnual] = useState(false)
  const [pending, setPending] = useState<PlanId | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const role = profile?.role
  const allowed = role === 'admin_universite' || role === 'super_admin_plateforme'

  // ── Garde d'accès ──────────────────────────────────────────────────────────
  if (!authLoading && profile && !allowed) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-16 text-center">
        <ShieldAlert className="h-8 w-8 text-red-400" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Cette page est réservée aux administrateurs de l’université.
        </p>
      </div>
    )
  }

  async function handleConfirm() {
    if (!pending || !universityId) return
    setSubmitting(true)
    try {
      await convertTrial(universityId, pending)
      setToast('Plan mis à jour avec succès')
      setPending(null)
      // Recharger pour refléter le nouveau plan partout (sidebar, gates…).
      setTimeout(() => window.location.reload(), 900)
    } catch {
      setToast('Échec de la mise à jour. Réessayez.')
      setSubmitting(false)
    }
  }

  const currentPlanId: PlanId | null =
    trialInfo && trialInfo.plan !== 'trial' ? (trialInfo.plan as PlanId) : null

  return (
    <div className="space-y-8">
      {/* ── Section 1 : statut actuel ─────────────────────────────────────── */}
      <section className="rounded-xl border border-zinc-200 dark:border-orange-500/10 bg-white dark:bg-zinc-950 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Statut de l’abonnement</h2>
          {currentPlanId && <PlanBadge plan={currentPlanId} />}
          {isTrialActive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-amber-300">
              Essai gratuit
            </span>
          )}
        </div>

        {trialLoading ? (
          <p className="mt-4 text-sm text-zinc-500">Chargement…</p>
        ) : isTrialActive ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Vous bénéficiez de toutes les fonctionnalités{' '}
              <span className="font-medium text-blue-700 dark:text-orange-300">Premium</span> —{' '}
              <span className="font-semibold text-zinc-900 dark:text-white">
                {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant
                {daysRemaining > 1 ? 's' : ''}
              </span>
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white dark:bg-white/5">
              <div
                className="h-full rounded-full bg-orange-500 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, (daysRemaining / TRIAL_DAYS) * 100))}%` }}
              />
            </div>
          </div>
        ) : isTrialExpired ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
            <p className="text-sm text-red-300">
              Votre essai gratuit a expiré. Choisissez un plan ci-dessous pour
              réactiver votre université.
            </p>
          </div>
        ) : isConverted && trialInfo?.convertedAt ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Plan souscrit le{' '}
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {formatDate(trialInfo.convertedAt)}
            </span>
            .
          </p>
        ) : (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Gérez le plan tarifaire de votre université.
          </p>
        )}
      </section>

      {/* ── Toggle mensuel / annuel ───────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm ${!annual ? 'text-zinc-900 dark:text-white font-medium' : 'text-zinc-500'}`}>
          Mensuel
        </span>
        <button
          onClick={() => setAnnual((v) => !v)}
          className="relative h-6 w-11 rounded-full bg-zinc-100 dark:bg-white/10 transition-colors"
          aria-label="Basculer mensuel/annuel"
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-orange-500 transition-transform ${
              annual ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className={`text-sm ${annual ? 'text-zinc-900 dark:text-white font-medium' : 'text-zinc-500'}`}>
          Annuel <span className="text-blue-600 dark:text-orange-400">−20%</span>
        </span>
      </div>

      {/* ── Section 2 : grille des plans ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const config = PLANS_CONFIG[planId]
          const isCurrent = currentPlanId === planId
          const isEnterprise = planId === 'enterprise'
          const price = annual ? config.prixAnnuel : config.prixMensuel

          return (
            <div
              key={planId}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                isCurrent
                  ? 'border-orange-500/50 bg-orange-500/5'
                  : planId === 'premium'
                    ? 'border-orange-500/30 bg-white dark:bg-zinc-950'
                    : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950'
              }`}
            >
              {config.badge && !isCurrent && (
                <span className="absolute -top-2.5 left-6 rounded-full bg-orange-500 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  {config.badge}
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-2.5 left-6 rounded-full bg-orange-500 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  Plan actuel
                </span>
              )}

              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{config.nom}</h3>

              <div className="mt-2 mb-4">
                {isEnterprise ? (
                  <span className="text-2xl font-bold text-zinc-900 dark:text-white">Sur devis</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-zinc-900 dark:text-white">
                      {formatPrice(price)}
                    </span>
                    <span className="text-sm text-zinc-500">
                      {' '}
                      FCFA / {annual ? 'an' : 'mois'}
                    </span>
                  </>
                )}
              </div>

              <ul className="flex-1 space-y-2">
                {FEATURE_ROWS.map(({ key, label }) => {
                  const on = Boolean(config.features[key])
                  return (
                    <li
                      key={key}
                      className={`flex items-center gap-2 text-sm ${
                        on ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-600 line-through'
                      }`}
                    >
                      {on ? (
                        <Check size={14} className="shrink-0 text-blue-600 dark:text-orange-400" />
                      ) : (
                        <X size={14} className="shrink-0 text-zinc-700" />
                      )}
                      {label}
                    </li>
                  )
                })}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full cursor-default rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 py-2.5 text-sm font-semibold text-zinc-600 dark:text-zinc-400"
                  >
                    Plan actuel
                  </button>
                ) : isEnterprise ? (
                  <Link
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="block w-full rounded-xl border border-violet-500/30 bg-violet-500/10 py-2.5 text-center text-sm font-semibold text-blue-700 dark:text-violet-300 transition-colors hover:bg-violet-500/20"
                  >
                    Nous contacter
                  </Link>
                ) : (
                  <button
                    onClick={() => setPending(planId)}
                    className="w-full rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                  >
                    Choisir ce plan
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mention essai (informatif) */}
      {isTrialActive && (
        <p className="text-center text-xs text-zinc-500">
          Votre essai gratuit de {TRIAL_DAYS} jours inclut toutes les
          fonctionnalités Premium. Aucune carte bancaire requise.
        </p>
      )}

      {/* ── Dialog de confirmation ────────────────────────────────────────── */}
      {pending && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-orange-500/20 bg-white dark:bg-zinc-950 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Confirmer votre choix</h3>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Vous êtes sur le point de passer au plan{' '}
              <span className="font-semibold text-blue-700 dark:text-orange-300">
                {PLANS_CONFIG[pending].nom}
              </span>{' '}
              à{' '}
              <span className="font-semibold text-zinc-900 dark:text-white">
                {formatPrice(
                  annual ? PLANS_CONFIG[pending].prixAnnuel : PLANS_CONFIG[pending].prixMensuel
                )}{' '}
                FCFA/{annual ? 'an' : 'mois'}
              </span>
              . Confirmez-vous votre choix ?
            </p>
            <p className="mt-2 text-xs text-zinc-600">
              Le paiement réel sera intégré ultérieurement — la conversion est
              ici simulée.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setPending(null)}
                disabled={submitting}
                className="flex-1 rounded-xl border border-zinc-200 dark:border-white/10 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
              >
                {submitting && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                )}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-110 flex items-center gap-2.5 rounded-xl border border-orange-500/20 bg-white dark:bg-zinc-900 px-4 py-3 shadow-2xl">
          <CheckCircle2 size={16} className="shrink-0 text-blue-600 dark:text-orange-400" />
          <p className="text-sm text-zinc-800 dark:text-orange-100">{toast}</p>
        </div>
      )}
    </div>
  )
}
