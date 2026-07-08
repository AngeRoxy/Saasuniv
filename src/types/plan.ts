// Modèle de données des plans tarifaires et feature flags.
// PLANS_CONFIG (src/lib/plans.ts) est la seule source de vérité runtime ;
// ce fichier ne définit que les types.

export type PlanId = 'standard' | 'premium' | 'enterprise'

export interface PlanFeatures {
  // ─── Limites (Infinity = illimité) ───────────────────────────────────────
  maxEtudiants: number
  maxEnseignants: number
  maxFilieres: number
  maxAdmins: number
  stockageGo: number

  // ─── Fonctionnalités booléennes ──────────────────────────────────────────
  chatbotIA: boolean
  recommandationsIA: boolean
  importCSV: boolean
  exportPDF: boolean
  bulletinsPDF: boolean
  messagerieInterne: boolean
  notificationsEmail: boolean
  multiCampus: boolean
  apiAccess: boolean
  supportPrioritaire: boolean
  auditLogs: boolean
  sousDomainePerso: boolean
}

/** Clés de PlanFeatures correspondant à une limite numérique. */
export type PlanLimitKey =
  | 'maxEtudiants'
  | 'maxEnseignants'
  | 'maxFilieres'
  | 'maxAdmins'
  | 'stockageGo'

export interface PlanConfig {
  id: PlanId
  nom: string
  /** Prix en FCFA (0 = sur devis). */
  prixMensuel: number
  /** Prix en FCFA (0 = sur devis). */
  prixAnnuel: number
  /** Classe Tailwind d'accent associée au plan. */
  couleur: string
  badge?: string
  features: PlanFeatures
}
