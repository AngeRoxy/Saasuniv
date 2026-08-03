// Multi-établissement : aucun niveau ni semestre n'est prédéfini.
// Chaque université saisit librement ses propres libellés
// (ex: "L1", "Master", "BTS", "Semestre 1", "S1", "Trimestre 1"…).
// Ce sont donc de simples chaînes de texte, jamais des unions figées.
export type NiveauLabel = string
export type SemestreLabel = string

export interface Matiere {
  id: string
  nom: string
  code: string
  coefficient: number
  credits: number
  semestre: SemestreLabel
  heuresTotal: number
  obligatoire: boolean
  createdAt: number
  updatedAt: number
}

export type MatiereFormData = Omit<Matiere, 'id' | 'createdAt' | 'updatedAt'>

export interface Filiere {
  id: string
  universityId: string
  campusId: string
  nom: string
  code: string
  description: string
  niveaux: NiveauLabel[]
  dureeAns: number
  totalCreditsRequis: number
  actif: boolean
  createdAt: number
  updatedAt: number
}

// `campusId` n'est PAS dans le formulaire : il est déterminé par l'appelant
// (campus courant / campus principal) et passé en paramètre séparé à
// `createFiliere`, pas saisi par l'utilisateur (pas encore de sélecteur de
// campus dans l'UI).
export type FiliereFormData = Omit<Filiere, 'id' | 'universityId' | 'campusId' | 'createdAt' | 'updatedAt'>
