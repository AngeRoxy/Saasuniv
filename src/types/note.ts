// Notes : une note /20 par (étudiant, matière, semestre).
// Clé déterministe `${semestreId}__${matiereId}__${studentUid}` → upsert simple.

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
  /** Note sur 20 (session NORMALE). Reste toujours la note d'origine. */
  note: number
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
  if (note >= 14) return { label: 'Bien', abbr: 'B', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' }
  if (note >= 12) return { label: 'Assez Bien', abbr: 'AB', cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25' }
  if (note >= 10) return { label: 'Passable', abbr: 'P', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' }
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
