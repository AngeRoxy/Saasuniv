// ─── Rôles & statuts membres ────────────────────────────────────────────────
//
// NOTE D'IMPLÉMENTATION : tout le codebase (db.ts, AuthContext, login, dashboards)
// utilise des clés de rôle ANGLAISES. On les conserve ici pour ne rien casser ;
// le français n'est utilisé que comme libellé d'affichage (ROLE_LABELS_FR).

export type MemberRole =
  | 'admin_universite'
  | 'teacher'
  | 'student'
  | 'parent'
  | 'super_admin_plateforme'

/** Rôles qu'une administration d'université peut créer (RÈGLE 1). */
export type CreatableRole = 'teacher' | 'student' | 'parent'

/** Seuls ces rôles peuvent s'inscrire eux-mêmes via /auth/register (RÈGLE 1). */
export type SelfRegisterRole = 'super_admin_plateforme'

export type MemberStatus = 'actif' | 'inactif' | 'premiere_connexion'

export const ROLE_LABELS_FR: Record<MemberRole, string> = {
  admin_universite: 'Administrateur',
  teacher: 'Enseignant',
  student: 'Étudiant',
  parent: 'Parent / Tuteur',
  super_admin_plateforme: 'Super administrateur',
}

export interface Member {
  uid: string
  email: string
  displayName: string
  role: MemberRole
  universityId: string
  telephone?: string
  filiere?: string // étudiant : filière unique (nom de la filière)
  filiereIds?: string[] // enseignant : IDs des filières où il intervient (plusieurs possibles)
  niveau?: string
  matricule?: string
  chargeHoraire?: number // enseignant : charge horaire (h / semaine)
  matieres?: string[] // enseignant : matières enseignées
  parentUid?: string // pour un étudiant : uid du parent lié
  enfantUids?: string[] // pour un parent : uids des étudiants liés
  statut: MemberStatus
  premiereConnexion: boolean
  createdAt: number
  updatedAt: number
}

/** Champs que TOUT le monde peut modifier sur son propre profil. */
export interface EditableProfileFields {
  // Modifiable par tous
  motDePasse?: string
  // Réservés à admin / enseignant pour leur propre profil
  displayName?: string
  telephone?: string
}

/** Champs que l'admin peut modifier sur n'importe quel membre. */
export interface AdminEditableMemberFields {
  displayName: string
  telephone?: string
  filiere?: string // étudiant
  filiereIds?: string[] // enseignant : filières où il intervient
  niveau?: string
  matricule?: string
  chargeHoraire?: number
  matieres?: string[]
  statut: MemberStatus
  parentUid?: string
  enfantUids?: string[]
}

/** Corps attendu par POST /api/create-member. */
export interface CreateMemberRequest {
  universityId: string
  email: string
  displayName: string
  role: CreatableRole
  filiere?: string // étudiant : filière unique (nom)
  filiereIds?: string[] // enseignant : IDs des filières où il intervient
  niveau?: string
  telephone?: string
  matricule?: string
  chargeHoraire?: number // enseignant : charge horaire (h / semaine)
  matieres?: string[] // enseignant : matières enseignées
  parentUid?: string
  enfantUids?: string[]
}

/** Corps attendu par POST /api/send-access-email. */
export interface SendAccessEmailRequest {
  to: string
  displayName: string
  nomUniversite: string
  role: string
  email: string
  tempPassword: string
  loginUrl: string
}

/** Corps attendu par POST /api/admin-update-email. */
export interface AdminUpdateEmailRequest {
  targetUid: string
  newEmail: string
  universityId: string
}

/** Réponse de POST /api/admin-update-email. */
export interface AdminUpdateEmailResponse {
  success: boolean
  /** Avertissement non bloquant (ex: synchro Firebase Auth impossible ici). */
  warning?: string
  error?: string
}
