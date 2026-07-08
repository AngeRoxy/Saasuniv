export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
}

export interface ChatContext {
  universityId: string
  userId: string
  role: string
  nomUniversite: string
  semestreEnCours?: string
  filiere?: string
  notes?: Array<{ matiere: string; note: number; credits: number }>
}

export type RecommandationType =
  | 'alerte_echec'
  | 'orientation'
  | 'revision'
  | 'encouragement'

export interface RecommandationIA {
  id: string
  etudiantUid: string
  universityId: string
  type: RecommandationType
  contenu: string
  matieresImpactees: string[]
  genereeAt: number
  lue: boolean
}
