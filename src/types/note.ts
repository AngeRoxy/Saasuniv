// Notes : une note /20 par (étudiant, matière, semestre).
// Clé déterministe `${semestreId}__${matiereId}__${studentUid}` → upsert simple.

// ─── Évaluations d'une matière (extension additive) ─────────────────────────────
// Une matière se note en 3 évaluations : 2 interrogations + 1 examen.
// `note` reste LA note de la matière (session normale) : c'est la moyenne
// pondérée des 3 évaluations. Tout ce qui consomme déjà `note` (moyennes,
// clôture, éligibilité au rattrapage, recommandations IA) continue donc de
// fonctionner sans modification, et les notes saisies AVANT cette évolution —
// qui n'ont que `note` — restent parfaitement valides et lisibles.

export type TypeEvaluation = 'interrogation_1' | 'interrogation_2' | 'examen'

/** Barème : (Interro1 + Interro2 + 2 × Examen) / 4. Source unique des poids. */
export const EVALUATIONS: {
  type: TypeEvaluation
  /** Clé du champ correspondant sur NoteEntry. */
  champ: 'interro1' | 'interro2' | 'examen'
  label: string
  labelCourt: string
  poids: number
}[] = [
  { type: 'interrogation_1', champ: 'interro1', label: 'Interrogation 1', labelCourt: 'Interro 1', poids: 1 },
  { type: 'interrogation_2', champ: 'interro2', label: 'Interrogation 2', labelCourt: 'Interro 2', poids: 1 },
  { type: 'examen', champ: 'examen', label: 'Examen', labelCourt: 'Examen', poids: 2 },
]

/** Détail des évaluations d'une matière (chaque note est facultative). */
export interface DetailEvaluations {
  interro1?: number | null
  interro2?: number | null
  examen?: number | null
}

/**
 * Moyenne pondérée d'une matière à partir des évaluations SAISIES.
 *
 * Les 3 notes présentes → (I1 + I2 + 2×E) / 4.
 * Saisie partielle → moyenne pondérée des seules évaluations présentes. Une
 * évaluation non encore passée n'est PAS comptée comme un zéro : traiter une
 * note manquante comme 0 fabriquerait un échec qui n'existe pas.
 * Aucune évaluation saisie → null (la matière n'a pas de note).
 */
export function calculerMoyenneMatiere(detail: DetailEvaluations): number | null {
  let total = 0
  let poidsTotal = 0

  for (const { champ, poids } of EVALUATIONS) {
    const valeur = detail[champ]
    if (typeof valeur === 'number' && !Number.isNaN(valeur)) {
      total += valeur * poids
      poidsTotal += poids
    }
  }

  if (poidsTotal === 0) return null
  // Arrondi au centième : évite les 13.333333333333334 en base.
  return Math.round((total / poidsTotal) * 100) / 100
}

/** Vrai si au moins une des 3 évaluations détaillées est saisie. */
export function aDesEvaluations(detail: DetailEvaluations): boolean {
  return EVALUATIONS.some(({ champ }) => typeof detail[champ] === 'number')
}

export interface NoteEntry {
  /** Clé Firebase (déterministe). Présent à la lecture. */
  id?: string
  studentUid: string
  /** Nom de la matière (dénormalisé pour l'affichage étudiant/parent). */
  matiere: string
  matiereId: string
  filiereId: string
  niveau: string
  semestreId: string
  /**
   * Note sur 20 de la matière (session NORMALE) = moyenne pondérée des
   * évaluations ci-dessous. Pour les notes saisies avant l'introduction des 3
   * évaluations, c'est la note saisie directement. Reste LA référence unique
   * pour tout le reste de l'application.
   */
  note: number
  // ─── Détail des 3 évaluations (optionnel) ────────────────────────────────────
  // Absents sur les notes historiques : leur `note` fait alors foi telle quelle.
  /** Interrogation 1 (/20, coefficient 1). */
  interro1?: number
  /** Interrogation 2 (/20, coefficient 1). */
  interro2?: number
  /** Examen (/20, coefficient 2). */
  examen?: number
  commentaire?: string
  // ─── Session de rattrapage (extension additive) ──────────────────────────────
  // Renseignés uniquement si l'étudiant a repassé la matière en rattrapage.
  // La note normale ci-dessus n'est JAMAIS écrasée (traçabilité).
  /** Note obtenue en session de rattrapage (/20). */
  noteRattrapage?: number
  /** Date de saisie du rattrapage, "YYYY-MM-DD". */
  dateRattrapage?: string
  /** UID de l'enseignant/admin ayant saisi le rattrapage. */
  rattrapageParUid?: string
  /** Nom dénormalisé de la personne ayant saisi le rattrapage. */
  rattrapageParNom?: string
  updatedAt: number
}

/** Seuil de validation d'une matière (/20). En dessous → candidat au rattrapage. */
export const SEUIL_VALIDATION = 10

export interface Mention {
  label: string
  abbr: string
  /** Classes Tailwind du badge. */
  cls: string
}

/** Mention française standard à partir d'une note /20. */
export function getMention(note: number | null | undefined): Mention | null {
  if (note === null || note === undefined || Number.isNaN(note)) return null
  if (note >= 16) return { label: 'Très Bien', abbr: 'TB', cls: 'bg-green-500/15 text-green-400 border-green-500/25' }
  if (note >= 14) return { label: 'Bien', abbr: 'B', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25' }
  if (note >= 12) return { label: 'Assez Bien', abbr: 'AB', cls: 'bg-cyan-500/15 text-blue-600 dark:text-cyan-400 border-cyan-500/25' }
  if (note >= 10) return { label: 'Passable', abbr: 'P', cls: 'bg-yellow-500/15 text-blue-600 dark:text-yellow-400 border-yellow-500/25' }
  return { label: 'Insuffisant', abbr: 'I', cls: 'bg-red-500/15 text-red-400 border-red-500/25' }
}

/** Clé déterministe d'une note (upsert). */
export function noteKey(semestreId: string, matiereId: string, studentUid: string): string {
  return `${semestreId}__${matiereId}__${studentUid}`
}

/** Vrai si une note de rattrapage a été saisie (0 est une valeur valide). */
export function hasRattrapage(note: Pick<NoteEntry, 'noteRattrapage'>): boolean {
  return typeof note.noteRattrapage === 'number' && !Number.isNaN(note.noteRattrapage)
}

/**
 * Note RETENUE pour une matière : la note de rattrapage si elle existe, sinon la
 * note normale. À utiliser PARTOUT où « la » note finale d'un étudiant compte
 * (calcul de moyenne, mentions, décisions) afin que les vues admin / étudiant /
 * parent restent cohérentes. La note normale reste consultable séparément pour
 * l'historique (voir `note.note` + `note.noteRattrapage`).
 */
export function getNoteRetenue(note: Pick<NoteEntry, 'note' | 'noteRattrapage'>): number {
  return hasRattrapage(note) ? (note.noteRattrapage as number) : note.note
}
