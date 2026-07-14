// Suivi du parcours annuel d'un étudiant — couche ADDITIVE posée au-dessus du
// module notes/clôture existant. Les notes restent à leur clé
// `semestreId__matiereId__studentUid` ; on ne les déplace ni ne les efface jamais.
// Une entrée `ParcoursAnnuel` acte, pour une année académique donnée, le niveau
// suivi et la décision de fin d'année (validé / redoublé). C'est cette couche qui
// porte l'historique de redoublement, sans toucher aux notes elles-mêmes.

/** Année académique, format libre saisi par l'école (ex: "2025/2026", "2025-2026"). */
export type AnneeAcademique = string

export type StatutParcours = 'en_cours' | 'valide' | 'redouble' | 'abandonne'

export interface ParcoursAnnuel {
  /** Clé Firebase déterministe : `${studentUid}__${anneeAcademique}`. */
  id: string
  universityId: string
  studentUid: string
  filiereId: string
  niveau: string
  anneeAcademique: AnneeAcademique
  statut: StatutParcours
  /** Moyenne générale calculée à la clôture de cette année (absente si sans notes). */
  moyenneGenerale?: number
  /** Timestamp ms de la clôture. */
  dateCloture?: number
  clotureParUid?: string
  clotureParNom?: string
  createdAt: number
  updatedAt: number
}

/**
 * Synthèse de la situation de redoublement d'un étudiant, telle qu'affichée à
 * l'administration. Calculée à partir de l'historique `ParcoursAnnuel` — jamais
 * stockée en dur, pour rester toujours cohérente avec les faits.
 */
export interface InfosRedoublement {
  niveauActuel: string
  /** Nombre de fois où le niveau ACTUEL a été clôturé « redoublé ». */
  nombreRedoublements: number
  /** Années académiques concernées par ces redoublements (niveau actuel). */
  anneesRedoublees: AnneeAcademique[]
}

/**
 * Rend un segment utilisable comme clé Firebase RTDB. Les clés interdisent
 * `. # $ [ ] /` — or l'année académique de l'app s'écrit couramment « 2025/2026 »
 * (avec un slash), qui créerait sinon un chemin imbriqué au lieu d'une seule clé.
 * On neutralise ces caractères ; la valeur réelle reste stockée telle quelle dans
 * le champ `anneeAcademique` (seule la CLÉ est normalisée).
 */
function safeKeySegment(segment: string): string {
  return segment.replace(/[.#$[\]/]/g, '-')
}

/** Clé déterministe d'un parcours annuel (upsert idempotent par année). */
export function parcoursId(studentUid: string, anneeAcademique: AnneeAcademique): string {
  return `${studentUid}__${safeKeySegment(anneeAcademique)}`
}

/**
 * Incrémente le SEUL nombre présent dans un libellé de niveau (« Licence 1 » →
 * « Licence 2 », « L1 » → « L2 »). Renvoie `null` si le libellé ne contient pas
 * exactement un nombre — cas ambigu où l'on refuse de deviner (l'admin choisira).
 */
export function incrementNiveauNumerique(niveau: string): string | null {
  const matches = niveau.match(/\d+/g)
  if (!matches || matches.length !== 1) return null
  const n = parseInt(matches[0], 10)
  if (Number.isNaN(n)) return null
  return niveau.replace(/\d+/, String(n + 1))
}

/**
 * Suggère le niveau suivant pour un étudiant validé. Stratégie fiable d'abord :
 * position dans la liste ORDONNÉE des niveaux de sa filière (telle que saisie par
 * l'école). Repli best-effort sur l'incrément numérique. Renvoie `null` quand
 * rien ne peut être déduit avec confiance (dernier niveau de la filière, format
 * non numérique…) : l'interface impose alors un choix manuel à l'admin plutôt
 * qu'une déduction risquée.
 */
export function suggestNiveauSuivant(
  niveauActuel: string,
  niveauxFiliere: string[]
): string | null {
  const idx = niveauxFiliere.indexOf(niveauActuel)
  if (idx !== -1 && idx + 1 < niveauxFiliere.length) return niveauxFiliere[idx + 1]
  return incrementNiveauNumerique(niveauActuel)
}

/**
 * Libellé de badge NEUTRE pour un étudiant qui reprend son niveau. Volontairement
 * factuel et respectueux (pas de « ÉCHEC »). Vide si l'étudiant ne redouble pas.
 * Ex: 1 redoublement → « Licence 1 — 2ᵉ année ».
 */
export function redoublementBadgeLabel(niveau: string, nombreRedoublements: number): string {
  if (nombreRedoublements <= 0) return ''
  const annee = nombreRedoublements + 1
  return `${niveau} — ${annee}ᵉ année`
}

export const STATUT_PARCOURS_LABELS: Record<StatutParcours, string> = {
  en_cours: 'En cours',
  valide: 'Validé',
  redouble: 'Niveau repris',
  abandonne: 'Abandon',
}

// Palette volontairement sobre : le redoublement reste neutre (ambre/zinc), jamais
// rouge alarmant. Le vert « validé » reste discret pour ne pas écraser le reste.
export const STATUT_PARCOURS_STYLES: Record<StatutParcours, string> = {
  en_cours: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25',
  valide: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  redouble: 'bg-amber-500/10 text-blue-700 dark:text-amber-300 border-amber-500/25',
  abandonne: 'bg-zinc-700/30 text-zinc-600 dark:text-zinc-400 border-white/10',
}
