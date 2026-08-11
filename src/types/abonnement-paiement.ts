// Paiements d'ABONNEMENT (conversion de plan via GeniusPay) — à ne pas
// confondre avec `types/paiement.ts` (échéances de scolarité PAR ÉTUDIANT,
// schéma différent). Stocké sous
// /universities/{universityId}/abonnementPaiements/{id}, écrit UNIQUEMENT
// par les routes serveur via le SDK Admin (voir database.rules.md).

import type { PlanId } from './plan'

export type AbonnementPaiementStatut = 'en_attente' | 'reussi' | 'echoue'
export type AbonnementPeriode = 'mensuel' | 'annuel'

export interface AbonnementPaiement {
  id: string
  plan: PlanId
  periode: AbonnementPeriode
  montant: number
  statut: AbonnementPaiementStatut
  reference: string
  checkoutUrl?: string
  createdAt: number
  updatedAt: number
  paidAt?: number
  initiatedByUid: string
}
