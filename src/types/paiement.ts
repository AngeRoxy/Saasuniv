// Paiements : un enregistrement par échéance d'un étudiant.
// Le statut « En retard » est DÉRIVÉ (échéance dépassée + non payé), jamais
// stocké, pour éviter des valeurs périmées.

export type PaiementStatut = 'Payé' | 'En attente'
export type PaiementStatutAffiche = PaiementStatut | 'En retard'
export type PaiementType = 'Scolarité' | 'Inscription' | 'Examen' | 'Autre'

export const PAIEMENT_TYPES: PaiementType[] = ['Scolarité', 'Inscription', 'Examen', 'Autre']

export interface Paiement {
  id: string
  studentUid: string
  /** Nom dénormalisé pour l'affichage. */
  studentNom: string
  matricule: string
  type: PaiementType
  montant: number
  /** Date d'échéance 'YYYY-MM-DD'. */
  echeance: string
  statut: PaiementStatut
  createdAt: number
  updatedAt: number
}

export type PaiementFormData = Omit<Paiement, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Statut affiché : « En retard » si non payé et échéance dépassée.
 * `today` au format 'YYYY-MM-DD' est fourni par l'appelant (pureté du rendu).
 */
export function statutAffiche(p: Paiement, today: string): PaiementStatutAffiche {
  if (p.statut === 'Payé') return 'Payé'
  if (p.echeance && p.echeance < today) return 'En retard'
  return 'En attente'
}

export function formatFCFA(n: number): string {
  return n.toLocaleString('fr-FR') + ' FCFA'
}
