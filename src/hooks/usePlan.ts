'use client'

import { useCallback, useEffect, useState } from 'react'
import { ref, get } from 'firebase/database'
import { db } from '@/lib/firebase'
import {
  DEFAULT_FEATURES,
  getPlanConfig,
  getUpgradePlan,
  hasFeature as hasFeatureFor,
  isWithinLimit as isWithinLimitFor,
  PLANS_CONFIG,
} from '@/lib/plans'
import type { PlanFeatures, PlanId, PlanLimitKey } from '@/types/plan'

interface UsePlanResult {
  plan: PlanId | null
  features: PlanFeatures
  loading: boolean
  hasFeature: (feature: keyof PlanFeatures) => boolean
  isWithinLimit: (feature: PlanLimitKey, count: number) => boolean
  /** Plan minimal débloquant la feature, ou null si déjà disponible. */
  upgradeRequired: (feature: keyof PlanFeatures) => PlanId | null
}

function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && value in PLANS_CONFIG
}

/** Cache module-level : un plan par universityId, partagé entre montages. */
const planCache = new Map<string, PlanId>()

/**
 * Charge le plan tarifaire d'une université une seule fois au montage.
 * Fallback silencieux sur "standard" en cas d'erreur Firebase.
 */
export function usePlan(universityId: string): UsePlanResult {
  const cachedPlan = universityId ? planCache.get(universityId) ?? null : null

  const [plan, setPlan] = useState<PlanId | null>(cachedPlan)
  const [loading, setLoading] = useState(
    Boolean(universityId) && !planCache.has(universityId)
  )

  // Ajustement d'état lors d'un changement d'universityId (pattern React
  // « storing information from previous renders » — évite un setState en effet).
  const [prevId, setPrevId] = useState(universityId)
  if (universityId !== prevId) {
    setPrevId(universityId)
    setPlan(cachedPlan)
    setLoading(Boolean(universityId) && !planCache.has(universityId))
  }

  useEffect(() => {
    // Un seul fetch par universityId : ni id vide, ni valeur déjà en cache.
    if (!universityId || planCache.has(universityId)) return

    let active = true
    get(ref(db, `universities/${universityId}/plan`))
      .then((snapshot) => {
        const value = snapshot.val()
        const resolved: PlanId = isPlanId(value) ? value : 'standard'
        planCache.set(universityId, resolved)
        if (active) {
          setPlan(resolved)
          setLoading(false)
        }
      })
      .catch(() => {
        // Fallback silencieux ; non mis en cache pour autoriser une nouvelle
        // tentative au prochain montage.
        if (active) {
          setPlan('standard')
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [universityId])

  const features = getPlanConfig(plan ?? undefined).features
  const effectivePlan = plan ?? undefined

  const hasFeature = useCallback(
    (feature: keyof PlanFeatures) => hasFeatureFor(effectivePlan, feature),
    [effectivePlan]
  )
  const isWithinLimit = useCallback(
    (feature: PlanLimitKey, count: number) =>
      isWithinLimitFor(effectivePlan, feature, count),
    [effectivePlan]
  )
  const upgradeRequired = useCallback(
    (feature: keyof PlanFeatures) => getUpgradePlan(effectivePlan, feature),
    [effectivePlan]
  )

  return {
    plan,
    features: plan ? features : DEFAULT_FEATURES,
    loading,
    hasFeature,
    isWithinLimit,
    upgradeRequired,
  }
}

export default usePlan
