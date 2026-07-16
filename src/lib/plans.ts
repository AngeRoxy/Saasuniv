import type { PlanConfig, PlanFeatures, PlanId, PlanLimitKey } from '@/types/plan'
import type { StoredPlan } from '@/types/trial'

/**
 * Source de vérité unique des plans tarifaires et de leurs feature flags.
 * Aucune valeur de plan ne doit être hardcodée ailleurs dans l'application.
 */
export const PLANS_CONFIG: Record<PlanId, PlanConfig> = {
  standard: {
    id: 'standard',
    nom: 'Standard',
    prixMensuel: 50_000,
    prixAnnuel: Math.round(50_000 * 12 * 0.8),
    couleur: 'zinc-400',
    features: {
      maxEtudiants: 200,
      maxEnseignants: 20,
      maxFilieres: 3,
      maxAdmins: 1,
      stockageGo: 2,

      chatbotIA: false,
      recommandationsIA: false,
      importCSV: true,
      exportPDF: false,
      bulletinsPDF: false,
      messagerieInterne: false,
      notificationsEmail: false,
      multiCampus: false,
      apiAccess: false,
      supportPrioritaire: false,
      auditLogs: false,
      sousDomainePerso: false,
    },
  },
  premium: {
    id: 'premium',
    nom: 'Premium',
    prixMensuel: 200_000,
    prixAnnuel: Math.round(200_000 * 12 * 0.8),
    couleur: 'orange-500',
    badge: 'Recommandé',
    features: {
      maxEtudiants: 1_000,
      maxEnseignants: 100,
      maxFilieres: 15,
      maxAdmins: 3,
      stockageGo: 20,

      chatbotIA: true,
      recommandationsIA: false,
      importCSV: true,
      exportPDF: true,
      bulletinsPDF: true,
      messagerieInterne: true,
      notificationsEmail: true,
      multiCampus: false,
      apiAccess: false,
      supportPrioritaire: true,
      auditLogs: true,
      sousDomainePerso: false,
    },
  },
  enterprise: {
    id: 'enterprise',
    nom: 'Enterprise',
    prixMensuel: 0, // sur devis
    prixAnnuel: 0, // sur devis
    couleur: 'violet-500',
    features: {
      maxEtudiants: Infinity,
      maxEnseignants: Infinity,
      maxFilieres: Infinity,
      maxAdmins: Infinity,
      stockageGo: 100,

      chatbotIA: true,
      recommandationsIA: true,
      importCSV: true,
      exportPDF: true,
      bulletinsPDF: true,
      messagerieInterne: true,
      notificationsEmail: true,
      multiCampus: true,
      apiAccess: true,
      supportPrioritaire: true,
      auditLogs: true,
      sousDomainePerso: true,
    },
  },
}

/** Ordre croissant des plans (du moins au plus complet). */
export const PLAN_ORDER: PlanId[] = ['standard', 'premium', 'enterprise']

/** Valeurs les plus restrictives — fallback si plan inconnu. */
export const DEFAULT_FEATURES: PlanFeatures = PLANS_CONFIG.standard.features

/**
 * Retourne la config d'un plan, fallback sur "standard" si undefined/inconnu.
 * Le plan spécial "trial" est traité comme "premium" (mêmes fonctionnalités) ;
 * il n'apparaît donc jamais dans la grille tarifaire (PLANS_CONFIG).
 */
export function getPlanConfig(planId: StoredPlan | undefined): PlanConfig {
  if (planId === 'trial') return PLANS_CONFIG.premium
  if (planId && planId in PLANS_CONFIG) return PLANS_CONFIG[planId as PlanId]
  return PLANS_CONFIG.standard
}

/** True si la fonctionnalité est activée (ou limite > 0) pour ce plan. */
export function hasFeature(
  planId: StoredPlan | undefined,
  feature: keyof PlanFeatures
): boolean {
  return Boolean(getPlanConfig(planId).features[feature])
}

/** True si currentCount est strictement inférieur à la limite du plan. */
export function isWithinLimit(
  planId: PlanId | undefined,
  feature: PlanLimitKey,
  currentCount: number
): boolean {
  return currentCount < getPlanConfig(planId).features[feature]
}

/**
 * Retourne le plan minimal débloquant une fonctionnalité, ou null si elle est
 * déjà disponible dans le plan courant (ou si aucun plan ne la propose).
 */
export function getUpgradePlan(
  planId: PlanId | undefined,
  feature: keyof PlanFeatures
): PlanId | null {
  if (hasFeature(planId, feature)) return null
  for (const id of PLAN_ORDER) {
    if (PLANS_CONFIG[id].features[feature]) return id
  }
  return null
}
