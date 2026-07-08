export type StatutSemestre = 'en_cours' | 'termine' | 'a_venir'

export interface Semestre {
  id: string
  universityId: string
  nom: string              // ex: "Semestre 1 — 2025/2026"
  anneeAcademique: string  // ex: "2025/2026"
  numero: number           // saisi librement par l'école, sans restriction
  dateDebut: number        // timestamp ms
  dateFin: number          // timestamp ms
  statut: StatutSemestre
  filiereIds: string[]     // filières concernées par ce semestre
  createdAt: number
  updatedAt: number
}

export type SemestreFormData = Omit<
  Semestre,
  'id' | 'universityId' | 'createdAt' | 'updatedAt'
>

export const STATUT_LABELS: Record<StatutSemestre, string> = {
  en_cours: 'En cours',
  termine: 'Terminé',
  a_venir: 'À venir',
}

export const STATUT_STYLES: Record<StatutSemestre, string> = {
  en_cours: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
  termine: 'bg-zinc-700/30 border-white/10 text-zinc-400',
  a_venir: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
}
