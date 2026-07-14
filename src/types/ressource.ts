// Ressources pédagogiques : liens ET/OU documents partagés par les enseignants.
// Le fichier (Firebase Storage) est une extension ADDITIVE du lien : les
// ressources déjà enregistrées (url seule) restent valides, sans migration.

export interface Ressource {
  id: string
  titre: string
  /**
   * Lien vers la ressource (Drive, PDF en ligne, vidéo…).
   * Peut être '' lorsque la ressource est un fichier uploadé (voir `fichierUrl`).
   */
  url: string
  description: string
  /** '' = toutes les filières. */
  filiereId: string
  /** '' = tous les niveaux. */
  niveau: string
  matiere: string
  auteur: string
  createdAt: number

  // ─── Fichier uploadé (Firebase Storage) — tous optionnels ────────────────────
  /** URL de téléchargement du fichier. Absent si la ressource est un simple lien. */
  fichierUrl?: string
  /** Nom d'origine du fichier, affiché à l'étudiant. */
  fichierNom?: string
  /** Taille en octets. */
  fichierTaille?: number
  /** Chemin Storage — requis pour supprimer le fichier en même temps que la ressource. */
  fichierPath?: string
}

export type RessourceFormData = Omit<Ressource, 'id' | 'createdAt'>

/** Une ressource n'est exploitable que si elle porte au moins un lien OU un fichier. */
export function aUnContenu(r: Pick<Ressource, 'url' | 'fichierUrl'>): boolean {
  return Boolean(r.url?.trim() || r.fichierUrl)
}
