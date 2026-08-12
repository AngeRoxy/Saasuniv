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

export type StatutPresence = 'present' | 'absent'

/** Statut d'un étudiant pour UNE session d'appel (dénormalisé, snapshot figé au moment de l'appel). */
export interface AppelEtudiant {
  uid: string
  displayName: string
  statut: StatutPresence
  /** Uniquement pertinent si `statut === 'absent'`. */
  justifie?: boolean
}

/**
 * Trace d'un appel de classe (nœud appels/{creneauId}__{date}) : sert à la
 * fois d'indicateur « appel déjà fait » sur le sélecteur enseignant ET
 * d'historique consultable (liste de présence complète par session).
 * Ne remplace pas les `Absence` elles-mêmes, qui restent la source de vérité
 * de qui est présent/absent — un appel à 0 absent ne crée aucune `Absence`,
 * d'où ce nœud séparé pour distinguer « pas encore fait » de « fait, personne
 * d'absent ».
 *
 * Pas de `presents`/`absents` stockés : dérivés de `etudiants` via
 * `compterPresences` pour éviter deux sources de vérité qui pourraient
 * diverger (cf. feedback « pas de faux succès / pas de duplication »).
 */
export interface Appel {
  id: string
  creneauId: string
  date: string
  faitParUid: string
  faitParNom: string
  etudiants: AppelEtudiant[]
  updatedAt: number
}

/** Clé déterministe d'un appel : un seul par créneau + date. */
export function appelKey(creneauId: string, date: string): string {
  return `${creneauId}__${date}`
}

/** Compteurs présents/absents dérivés de la liste — jamais stockés séparément. */
export function compterPresences(etudiants: AppelEtudiant[] | undefined): { presents: number; absents: number } {
  let presents = 0
  let absents = 0
  for (const e of etudiants ?? []) {
    if (e.statut === 'present') presents++
    else absents++
  }
  return { presents, absents }
}
