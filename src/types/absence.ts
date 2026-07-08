// Absences : un enregistrement par séance manquée d'un étudiant.

/** Catégorie normalisée d'une absence justifiée (RÈGLE 2). */
export type MotifAbsence = 'maladie' | 'raison_familiale' | 'autre'

/** Libellés d'affichage des catégories de motif (source unique, pas de hardcode UI). */
export const MOTIFS: { value: MotifAbsence; label: string }[] = [
  { value: 'maladie', label: 'Maladie' },
  { value: 'raison_familiale', label: 'Raison familiale' },
  { value: 'autre', label: 'Autre' },
]

export function motifLabel(value?: MotifAbsence | null): string {
  return MOTIFS.find((m) => m.value === value)?.label ?? ''
}

/** Seuil d'alerte par défaut si l'université n'a rien configuré (RÈGLE 3). */
export const DEFAULT_SEUIL_ABSENCES = 3

export interface Absence {
  id: string
  studentUid: string
  /** Nom dénormalisé pour l'affichage. */
  studentNom: string
  matricule: string
  /** Date de l'absence 'YYYY-MM-DD'. */
  date: string
  /** Matière concernée (facultatif). */
  matiere: string
  justifiee: boolean
  /** Motif / précision libre (facultatif) — sert aussi de commentaire. */
  motif: string
  // ─── Champs optionnels ajoutés à l'itération « seuil + traçabilité » ─────────
  // Tous optionnels : les absences déjà enregistrées (schéma précédent) restent
  // valides et s'affichent sans migration.
  /** Catégorie normalisée du motif, renseignée lors de la justification. */
  motifCategorie?: MotifAbsence
  /** Référence / nom du justificatif fourni (pas d'upload dans cette itération). */
  referenceJustificatif?: string
  /** Créneau d'emploi du temps concerné (renseigné quand marquée par l'enseignant). */
  creneauId?: string
  /** uid de l'enseignant / admin ayant marqué l'absence (traçabilité). */
  marqueParUid?: string
  /** Nom dénormalisé de qui a marqué l'absence, pour affichage direct. */
  marqueParNom?: string
  createdAt: number
  updatedAt: number
}

export type AbsenceFormData = Omit<Absence, 'id' | 'createdAt' | 'updatedAt'>

/** Configuration du seuil d'alerte d'une université (nœud config/seuilAlerte). */
export interface SeuilAlerteConfig {
  seuilAbsencesInjustifiees: number
  updatedAt: number
}
