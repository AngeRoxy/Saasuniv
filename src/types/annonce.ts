// Annonces : messages diffusés par l'administration vers un public ciblé.

import type { Role } from '@/lib/db'

/** Public ciblé : « tous » ou un rôle précis. */
export type AnnonceCible = 'tous' | 'student' | 'teacher' | 'parent'

export const CIBLE_LABEL: Record<AnnonceCible, string> = {
  tous: 'Tous',
  student: 'Étudiants',
  teacher: 'Enseignants',
  parent: 'Parents',
}

export interface Annonce {
  id: string
  titre: string
  message: string
  destinataire: AnnonceCible
  /** Nom de l'auteur (admin). */
  auteur: string
  createdAt: number
}

export type AnnonceFormData = Omit<Annonce, 'id' | 'createdAt'>

/** True si une annonce concerne le rôle donné. */
export function annonceVisiblePour(a: Annonce, role: Role | undefined): boolean {
  if (a.destinataire === 'tous') return true
  return a.destinataire === role
}
