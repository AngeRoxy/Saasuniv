// ─── Filtres contextuels des dashboards (PROMPT 07) ────────────────────────────

/** Option d'un select de filtre. */
export interface FilterOption {
  label: string
  value: string
}

/**
 * État des filtres applicables aux dashboards.
 * Chaque clé est optionnelle : absente = valeur par défaut ("tous" pour `statut`,
 * chaîne vide pour les autres).
 */
export interface DashboardFilters {
  semestre?: string // semestreId
  filiere?: string // filiereId
  matiere?: string // matiereId
  enfant?: string // uid étudiant (dashboard parent)
  enseignant?: string // uid enseignant (dashboard admin)
  statut?: string // "actif" | "inactif" | "tous"
  groupe?: string // identifiant groupe/classe
}

/** Liste ordonnée et typée des clés de filtre. */
export const FILTER_KEYS = [
  'semestre',
  'filiere',
  'matiere',
  'enfant',
  'enseignant',
  'statut',
  'groupe',
] as const

export type FilterKey = (typeof FILTER_KEYS)[number]

/** Valeur par défaut d'un filtre (celle qui n'est jamais persistée dans l'URL). */
export function defaultFilterValue(key: FilterKey): string {
  return key === 'statut' ? 'tous' : ''
}

/** Options statiques pour le filtre de statut étudiant. */
export const STATUT_OPTIONS: FilterOption[] = [
  { label: 'Tous', value: 'tous' },
  { label: 'Actifs', value: 'actif' },
  { label: 'Inactifs', value: 'inactif' },
]
