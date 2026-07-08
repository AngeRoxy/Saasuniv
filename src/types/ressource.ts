// Ressources pédagogiques : liens / documents partagés par les enseignants.
// (Pas d'upload binaire : Firebase Storage n'est pas configuré — on stocke des URL.)

export interface Ressource {
  id: string
  titre: string
  /** Lien vers la ressource (Drive, PDF en ligne, vidéo…). */
  url: string
  description: string
  /** '' = toutes les filières. */
  filiereId: string
  /** '' = tous les niveaux. */
  niveau: string
  matiere: string
  auteur: string
  createdAt: number
}

export type RessourceFormData = Omit<Ressource, 'id' | 'createdAt'>
