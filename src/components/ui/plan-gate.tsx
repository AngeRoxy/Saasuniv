'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { useTrial } from '@/hooks/useTrial'
import { getPlanConfig, getUpgradePlan, hasFeature } from '@/lib/plans'
import type { PlanFeatures, PlanId } from '@/types/plan'

interface PlanGateProps {
  feature: keyof PlanFeatures
  universityId: string
  children: React.ReactNode
  /** Affiché si la feature est indisponible et showUpgradePrompt = false. */
  fallback?: React.ReactNode
  /** Affiche un encart d'upgrade si la feature est indisponible (défaut: true). */
  showUpgradePrompt?: boolean
}

/**
 * Protège un bloc d'UI derrière un feature flag de plan.
 * - feature disponible → rend `children`
 * - indisponible + showUpgradePrompt → encart d'upgrade
 * - indisponible sans prompt → `fallback` (ou rien)
 * - pendant le chargement → rien (évite tout flash de contenu)
 *
 * Gestion de l'essai (via useTrial) :
 * - essai actif  → les features du plan Premium s'appliquent (effectivePlan)
 * - essai expiré → toutes les features sont bloquées (plan inexistant)
 */
export function PlanGate({
  feature,
  universityId,
  children,
  fallback,
  showUpgradePrompt = true,
}: PlanGateProps) {
  const { effectivePlan, isTrialExpired, loading } = useTrial(universityId)

  if (loading) return null

  // Essai expiré : aucune fonctionnalité accessible.
  const available = isTrialExpired ? false : hasFeature(effectivePlan, feature)

  if (available) return <>{children}</>
  if (showUpgradePrompt)
    return (
      <UpgradePrompt
        feature={feature}
        plan={isTrialExpired ? 'standard' : effectivePlan}
      />
    )
  return <>{fallback ?? null}</>
}

interface UpgradePromptProps {
  feature: keyof PlanFeatures
  plan: PlanId
}

/** Encart compact et non intrusif invitant à passer au plan supérieur. */
export function UpgradePrompt({ feature, plan }: UpgradePromptProps) {
  const planMinimal = getUpgradePlan(plan, feature)
  const nomPlan = planMinimal ? getPlanConfig(planMinimal).nom : 'supérieur'

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/20 bg-white/3 px-6 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-zinc-400">
        <Lock className="h-5 w-5" />
      </div>
      <p className="max-w-sm text-sm text-zinc-400">
        Cette fonctionnalité est disponible à partir du plan{' '}
        <span className="font-medium text-zinc-200">{nomPlan}</span>.
      </p>
      <Link
        href="/dashboard/admin/billing"
        className="rounded-lg border border-white/10 bg-orange-500/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500"
      >
        Voir les plans
      </Link>
    </div>
  )
}

export default PlanGate
