// Modèle de données de l'essai gratuit (trial 30 jours).
// Les valeurs runtime sont écrites/lues dans /universities/{universityId}
// via les fonctions de src/lib/db.ts.

import type { PlanId } from '@/types/plan'

/** Statut courant de l'essai gratuit d'une université. */
export type TrialStatus = 'active' | 'expired' | 'converted'

/**
 * Valeur stockée dans `/universities/{id}/plan`. Pendant l'essai, vaut "trial"
 * et donne accès aux fonctionnalités du plan Premium ; après conversion, prend
 * la valeur d'un plan payant réel.
 */
export type StoredPlan = PlanId | 'trial'

/** Durée de l'essai gratuit en millisecondes (30 jours). */
export const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000

export interface UniversityTrial {
  plan: StoredPlan
  /** Timestamp ms — Date.now() + 30 jours à l'activation. */
  trialEndsAt: number
  trialStatus: TrialStatus
  /** Timestamp ms de la conversion (présent uniquement si converti). */
  convertedAt?: number
  /** Plan choisi après conversion. */
  convertedPlan?: PlanId
}
