'use client'

import { useEffect, useState } from 'react'
import {
  checkTrialExpired,
  getDaysRemaining,
  getTrialInfo,
} from '@/lib/db'
import type { PlanId } from '@/types/plan'
import type { UniversityTrial } from '@/types/trial'

interface UseTrialResult {
  trialInfo: UniversityTrial | null
  loading: boolean
  isTrialActive: boolean
  isTrialExpired: boolean
  isConverted: boolean
  daysRemaining: number
  /**
   * Plan effectif pour résoudre les feature flags :
   * - essai actif   → "premium"
   * - essai expiré  → "standard" (accès minimal)
   * - converti      → le plan réel choisi
   */
  effectivePlan: PlanId
}

/**
 * Cache module-level : une info d'essai par universityId, partagée entre
 * montages pour éviter les re-fetches inutiles (même approche que usePlan).
 */
const trialCache = new Map<string, UniversityTrial | null>()

function isPlanId(value: unknown): value is PlanId {
  return value === 'standard' || value === 'premium' || value === 'enterprise'
}

/** Dérive le plan effectif à appliquer selon le statut de l'essai. */
function resolveEffectivePlan(info: UniversityTrial | null): PlanId {
  if (!info) return 'standard'
  if (info.plan === 'trial') {
    const expired =
      info.trialStatus === 'expired' || info.trialEndsAt < Date.now()
    return expired ? 'standard' : 'premium'
  }
  return isPlanId(info.plan) ? info.plan : 'standard'
}

/**
 * Charge et expose l'état de l'essai gratuit d'une université.
 * Au montage : lit getTrialInfo() et déclenche checkTrialExpired() pour
 * persister un éventuel passage à "expired".
 */
export function useTrial(universityId: string): UseTrialResult {
  const cached = universityId ? trialCache.get(universityId) ?? null : null

  const [trialInfo, setTrialInfo] = useState<UniversityTrial | null>(cached)
  const [loading, setLoading] = useState(
    Boolean(universityId) && !trialCache.has(universityId)
  )
  // Instant figé au montage : évite d'appeler Date.now() en plein rendu
  // (règle react-hooks/purity) tout en gardant une comparaison de date fiable.
  const [now] = useState(() => Date.now())

  // Réinitialisation lors d'un changement d'universityId (pattern « storing
  // information from previous renders » — évite un setState en effet).
  const [prevId, setPrevId] = useState(universityId)
  if (universityId !== prevId) {
    setPrevId(universityId)
    setTrialInfo(cached)
    setLoading(Boolean(universityId) && !trialCache.has(universityId))
  }

  useEffect(() => {
    if (!universityId || trialCache.has(universityId)) return

    let active = true
    ;(async () => {
      try {
        // Persiste le passage à "expired" si nécessaire (write conditionnel).
        await checkTrialExpired(universityId)
        const info = await getTrialInfo(universityId)
        if (!active) return
        trialCache.set(universityId, info)
        setTrialInfo(info)
        setLoading(false)
      } catch {
        if (active) {
          setTrialInfo(null)
          setLoading(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [universityId])

  const isTrial = trialInfo?.plan === 'trial'
  // Expiré si le statut a été persisté OU si la date est dépassée (le write
  // de checkTrialExpired peut ne pas encore avoir abouti).
  const isTrialExpired = Boolean(
    isTrial &&
      (trialInfo!.trialStatus === 'expired' || trialInfo!.trialEndsAt < now)
  )
  const isTrialActive = Boolean(isTrial && !isTrialExpired)
  const isConverted = trialInfo?.trialStatus === 'converted'
  const daysRemaining = trialInfo ? getDaysRemaining(trialInfo.trialEndsAt) : 0

  return {
    trialInfo,
    loading,
    isTrialActive,
    isTrialExpired,
    isConverted,
    daysRemaining,
    effectivePlan: resolveEffectivePlan(trialInfo),
  }
}

export default useTrial
