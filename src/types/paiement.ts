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
  /**
   * Regroupe les tranches d'un même échéancier créé en une fois (voir
   * `createEcheancier` dans db.ts). Absent = échéance "libre" — paiement créé
   * avant cette fonctionnalité, ou hors scolarité planifiée (inscription,
   * examen, cas particulier) : reste affiché normalement, jamais migré de force.
   */
  echeancierId?: string
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

/** Un échéancier reconstitué à partir des tranches (`Paiement`) qui le composent. */
export interface EcheancierGroupe {
  echeancierId: string
  /** Tranches triées par date d'échéance croissante. */
  tranches: Paiement[]
  montantTotal: number
  montantPaye: number
  solde: number
}

/**
 * Regroupe les paiements d'un étudiant par échéancier (même `echeancierId`) et
 * isole les paiements « libres » (sans échéancier) — anciens paiements
 * pré-migration ou hors scolarité planifiée.
 */
export function regrouperEcheanciers(paiements: Paiement[]): {
  echeanciers: EcheancierGroupe[]
  libres: Paiement[]
} {
  const parEcheancier = new Map<string, Paiement[]>()
  const libres: Paiement[] = []
  for (const p of paiements) {
    if (p.echeancierId) {
      const tranches = parEcheancier.get(p.echeancierId) ?? []
      tranches.push(p)
      parEcheancier.set(p.echeancierId, tranches)
    } else {
      libres.push(p)
    }
  }
  const echeanciers: EcheancierGroupe[] = Array.from(parEcheancier.entries()).map(
    ([echeancierId, tranches]) => {
      const triees = [...tranches].sort((a, b) => a.echeance.localeCompare(b.echeance))
      const montantTotal = triees.reduce((s, p) => s + p.montant, 0)
      const montantPaye = triees.filter((p) => p.statut === 'Payé').reduce((s, p) => s + p.montant, 0)
      return { echeancierId, tranches: triees, montantTotal, montantPaye, solde: montantTotal - montantPaye }
    }
  )
  return { echeanciers, libres }
}

/** Statut agrégé d'un échéancier, même dérivation que `statutAffiche` pour une tranche. */
export function statutEcheancier(g: EcheancierGroupe, today: string): PaiementStatutAffiche {
  if (g.solde <= 0) return 'Payé'
  if (g.tranches.some((p) => p.statut !== 'Payé' && p.echeance && p.echeance < today)) return 'En retard'
  return 'En attente'
}

/** Prochaine échéance non payée (toutes origines confondues), triée par date. */
export function prochaineEcheanceNonPayee(paiements: Paiement[]): Paiement | null {
  const impayes = paiements.filter((p) => p.statut !== 'Payé' && p.echeance)
  if (impayes.length === 0) return null
  return [...impayes].sort((a, b) => a.echeance.localeCompare(b.echeance))[0]
}

export function formatFCFA(n: number): string {
  return n.toLocaleString('fr-FR') + ' FCFA'
}
