'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Clock, AlertTriangle, XCircle } from 'lucide-react'
import { useTrial } from '@/hooks/useTrial'
import { cn } from '@/lib/utils'

interface TrialBannerProps {
  universityId: string
  className?: string
}

const BILLING_HREF = '/dashboard/admin/billing'

/**
 * Bannière d'état de l'essai gratuit, affichée en haut du dashboard admin.
 * - essai actif (> 7 j)  → bannière discrète (ambre)
 * - essai actif (≤ 7 j)  → bannière urgente (orange, fermable localement)
 * - essai expiré         → overlay bloquant plein écran (non fermable)
 * - converti / hors essai → rien
 */
export function TrialBanner({ universityId, className }: TrialBannerProps) {
  const { isTrialActive, isTrialExpired, daysRemaining, loading } =
    useTrial(universityId)
  const [dismissed, setDismissed] = useState(false)
  const pathname = usePathname()

  if (loading) return null

  // La page de sélection de plan reste toujours accessible : on n'y rend ni
  // overlay bloquant ni bannière (la page billing affiche son propre statut).
  if (pathname.startsWith(BILLING_HREF)) return null

  // ── Essai expiré : overlay bloquant non fermable ───────────────────────────
  if (isTrialExpired) {
    return (
      <div className="fixed inset-0 z-100 bg-zinc-950/95 backdrop-blur-md flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-950 border border-red-500/20 shadow-2xl shadow-black/50 overflow-hidden text-center">
          <div className="px-7 py-8">
            <div className="mx-auto w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mb-4">
              <XCircle className="h-6 w-6 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              Votre essai gratuit a expiré
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
              Choisissez un plan pour continuer à utiliser GestUniv.
            </p>
            <Link
              href={BILLING_HREF}
              className="mt-6 inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-6 py-2.5 transition-colors"
            >
              Voir les plans
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!isTrialActive) return null

  // ── Essai actif, urgent (≤ 7 jours) ────────────────────────────────────────
  if (daysRemaining <= 7) {
    if (dismissed) return null
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/15 px-4 py-3',
          className
        )}
      >
        <AlertTriangle
          size={18}
          className="shrink-0 text-blue-600 dark:text-orange-400 animate-pulse"
        />
        <p className="flex-1 text-sm text-zinc-600 dark:text-orange-200">
          ⚠️ Votre essai expire dans{' '}
          <span className="font-semibold text-zinc-800 dark:text-orange-100">
            {daysRemaining} jour{daysRemaining > 1 ? 's' : ''}
          </span>{' '}
          — Choisissez un plan pour continuer
        </p>
        <Link
          href={BILLING_HREF}
          className="shrink-0 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-600"
        >
          Choisir un plan maintenant
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs font-medium text-zinc-600 dark:text-orange-200/60 transition-colors hover:text-zinc-900 dark:hover:text-orange-200"
        >
          Ignorer
        </button>
      </div>
    )
  }

  // ── Essai actif, discret (> 7 jours) ───────────────────────────────────────
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3',
        className
      )}
    >
      <Clock size={18} className="shrink-0 text-blue-600 dark:text-amber-400" />
      <p className="flex-1 text-sm text-zinc-600 dark:text-amber-200/90">
        Essai gratuit —{' '}
        <span className="font-semibold text-zinc-800 dark:text-amber-100">
          {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant
          {daysRemaining > 1 ? 's' : ''}
        </span>
      </p>
      <Link
        href={BILLING_HREF}
        className="shrink-0 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-amber-200 transition-colors hover:bg-amber-500/10"
      >
        Choisir un plan
      </Link>
    </div>
  )
}

export default TrialBanner
