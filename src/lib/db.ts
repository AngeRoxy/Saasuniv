import { ref, get, set, update, push, remove, onValue, type Unsubscribe } from 'firebase/database'
import { db } from './firebase'

export type Role = 'super_admin_plateforme' | 'admin_universite' | 'teacher' | 'student' | 'parent'

export interface UserProfile {
  email: string
  displayName: string
  role: Role
  universityId: string
  createdAt: number
}

export interface University {
  name: string
  slug: string
  plan: string
  createdAt: number
  adminUid: string
  status: 'active' | 'inactive' | 'suspended'
  pays?: string
  type?: string
  annee?: string
  // Champs d'essai — présents uniquement si l'université est passée par un essai
  // gratuit (écrits par initTrial / convertTrial / checkTrialExpired). Le
  // super-admin les lit pour le MRR, le taux de conversion et les alertes.
  trialEndsAt?: number
  trialStatus?: TrialStatus
  convertedAt?: number
  convertedPlan?: PlanId
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await get(ref(db, `users/${uid}`))
  if (!snapshot.exists()) return null
  return snapshot.val() as UserProfile
}

export async function createUniversity(
  universityId: string,
  data: Omit<University, 'status' | 'createdAt'> & { createdAt?: number }
): Promise<void> {
  await set(ref(db, `universities/${universityId}`), {
    ...data,
    createdAt: data.createdAt ?? Date.now(),
    status: 'active',
  })
}

export async function getUniversity(universityId: string): Promise<University | null> {
  const snapshot = await get(ref(db, `universities/${universityId}`))
  if (!snapshot.exists()) return null
  return snapshot.val() as University
}

/**
 * Met à jour les informations générales d'une université, sur le chemin scopé
 * par tenant `universities/${universityId}`. N'écrit que les champs fournis
 * (update partiel). Les règles RTDB par-champ n'autorisent l'admin_universite
 * qu'à modifier name/pays/type/annee de SA propre université — un échec de
 * permission rejette la promesse (aucun faux succès).
 */
export async function updateUniversity(
  universityId: string,
  data: Partial<Pick<University, 'name' | 'pays' | 'type' | 'annee'>>
): Promise<void> {
  await update(ref(db, `universities/${universityId}`), data)
}

// ─── University members ────────────────────────────────────────────────────────

export interface UniversityMember {
  uid: string
  email: string
  displayName: string
  role: Role
  createdAt: number
  updatedAt?: number
  filiere?: string // étudiant : filière unique (nom)
  filiereIds?: string[] // enseignant : IDs des filières où il intervient
  niveau?: string
  telephone?: string
  matricule?: string
  chargeHoraire?: number // enseignant : charge horaire (h / semaine)
  matieres?: string[] // enseignant : matières enseignées
  // Anciennes valeurs 'Actif'/'Inactif' (étudiants manuels) coexistent avec les
  // nouvelles 'actif'/'inactif'/'premiere_connexion' (comptes créés par l'admin).
  statut?: 'Actif' | 'Inactif' | 'actif' | 'inactif' | 'premiere_connexion'
  premiereConnexion?: boolean
  parentUid?: string // étudiant → uid du parent lié
  enfantUids?: string[] // parent → uids des étudiants liés
  /** URL Storage de la photo de profil (voir uploadAvatar). */
  photoUrl?: string
}

export async function getUniversityMembers(
  universityId: string,
  role?: Role
): Promise<UniversityMember[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/members`))
  if (!snapshot.exists()) return []
  const members: UniversityMember[] = []
  snapshot.forEach((child) => {
    const data = child.val() as Omit<UniversityMember, 'uid'>
    if (!role || data.role === role) {
      members.push({ uid: child.key!, ...data })
    }
  })
  return members
}

export async function getUniversityMember(
  universityId: string,
  uid: string
): Promise<UniversityMember | null> {
  const snapshot = await get(ref(db, `universities/${universityId}/members/${uid}`))
  if (!snapshot.exists()) return null
  return { uid, ...snapshot.val() } as UniversityMember
}

export async function updateMemberProfile(
  universityId: string,
  uid: string,
  // `filiere` (nom unique) reste utilisé par les étudiants ; `filiereIds`
  // (tableau d'IDs) est réservé aux enseignants — le tableau complet est
  // toujours réécrit en une fois (pas d'ajout/retrait partiel).
  data: Partial<Pick<UniversityMember, 'filiere' | 'filiereIds' | 'niveau' | 'telephone' | 'matricule' | 'statut' | 'displayName' | 'chargeHoraire' | 'matieres' | 'photoUrl'>>
): Promise<void> {
  await update(ref(db, `universities/${universityId}/members/${uid}`), data)
}

/**
 * Enregistre l'URL de la photo de profil d'un membre.
 * Écrit sur `members/{uid}/photoUrl` : les règles RTDB autorisent déjà un membre
 * à modifier sa propre fiche tant que les champs sensibles (email, rôle,
 * filière, niveau, matricule) restent inchangés — aucune règle à redéployer.
 */
export async function updateMemberPhoto(
  universityId: string,
  uid: string,
  photoUrl: string
): Promise<void> {
  await update(ref(db, `universities/${universityId}/members/${uid}`), { photoUrl })
}

// Supprime l'entrée `members/{uid}` (la source qui pilote les listes admin).
// Ne touche PAS à `/users/{uid}` ni au compte Firebase Auth : ces deux-là
// exigent firebase-admin côté serveur (à traiter séparément). Retirer ce
// nœud suffit à faire disparaître le membre des listes de façon persistante.
export async function removeMember(
  universityId: string,
  uid: string
): Promise<void> {
  // On lit d'abord le membre : son rôle pilote le nettoyage en cascade. Toute
  // erreur de cascade remonte (pas de faux succès) ; la suppression du membre
  // lui-même se fait EN DERNIER pour ne pas laisser d'orphelins si une étape échoue.
  const member = await getUniversityMember(universityId, uid)

  // ── Enseignant : ses cours et examens restent VALIDES. On retire seulement son
  //    affectation — le nom sur les créneaux, l'uid + le nom sur les examens.
  if (member?.role === 'teacher') {
    const nom = member.displayName.trim().toLowerCase()
    // Créneaux : rattachés par NOM. Si un homonyme enseignant subsiste, le nom
    // reste valide et indissociable → on ne touche pas aux créneaux.
    if (nom) {
      const teachers = await getUniversityMembers(universityId, 'teacher')
      const homonymeRestant = teachers.some(
        (t) => t.uid !== uid && t.displayName.trim().toLowerCase() === nom
      )
      if (!homonymeRestant) {
        const creneaux = await getCreneaux(universityId)
        const concernes = creneaux
          .filter((c) => c.enseignant.trim().toLowerCase() === nom)
          .map((c) => c.id)
        await clearEnseignantOnCreneaux(universityId, concernes)
      }
    }
    // Examens : rattachés par UID (aucun risque d'homonyme). On vide l'enseignant
    // et/ou le surveillant sur chaque examen où cet uid apparaît.
    const examens = await getExamens(universityId)
    await clearEnseignantOnExamens(universityId, examens, uid)
  }

  // ── Étudiant : on CONSERVE tout son historique (notes, absences, paiements,
  //    parcours…). Seule action : retirer son uid de la liste enfantUids du
  //    parent lié, pour ne pas laisser de référence orpheline.
  if (member?.role === 'student' && member.parentUid) {
    const parent = await getUniversityMember(universityId, member.parentUid)
    const enfantUids = parent?.enfantUids ?? []
    if (enfantUids.includes(uid)) {
      const next = enfantUids.filter((x) => x !== uid)
      await update(ref(db, `universities/${universityId}/members/${member.parentUid}`), {
        enfantUids: next.length ? next : null,
        updatedAt: Date.now(),
      })
    }
  }

  // Suppression du membre lui-même (comportement existant).
  await remove(ref(db, `universities/${universityId}/members/${uid}`))
}

// ─── Liens parent ↔ enfants ─────────────────────────────────────────────────
//
// Un étudiant porte `parentUid` (le parent qui le suit) ; un parent porte
// `enfantUids` (ses étudiants). Les deux nœuds membres doivent rester cohérents.
// Ces helpers sont la source unique pour (re)lier ou délier depuis l'admin — la
// CRÉATION applique déjà une logique équivalente côté serveur (createMemberByAdmin,
// lib/server/members.ts). Chaque écriture est attendue : toute erreur remonte à
// l'appelant (aucun faux succès), pour respecter la même exigence que teachers/
// students (await Firebase AVANT toute mise à jour d'UI).

/**
 * Resynchronise les liens d'un parent après édition de sa liste d'enfants.
 * Réécrit `enfantUids` sur le parent, pose `parentUid` sur chaque enfant
 * nouvellement lié et l'efface (null) sur chaque enfant retiré.
 * `previousEnfantUids` sert à calculer le delta des retraits.
 */
export async function syncParentEnfants(
  universityId: string,
  parentUid: string,
  nextEnfantUids: string[],
  previousEnfantUids: string[]
): Promise<void> {
  const now = Date.now()
  const nextSet = new Set(nextEnfantUids)
  const prevSet = new Set(previousEnfantUids)

  // Réécrit la liste complète sur le parent (tableau vide → la clé est effacée).
  await update(ref(db, `universities/${universityId}/members/${parentUid}`), {
    enfantUids: nextEnfantUids.length ? nextEnfantUids : null,
    updatedAt: now,
  })

  // Enfants AJOUTÉS : rattacher au parent.
  for (const uid of nextEnfantUids) {
    if (!prevSet.has(uid)) {
      await update(ref(db, `universities/${universityId}/members/${uid}`), {
        parentUid,
        updatedAt: now,
      })
    }
  }

  // Enfants RETIRÉS : détacher (parentUid effacé).
  for (const uid of previousEnfantUids) {
    if (!nextSet.has(uid)) {
      await update(ref(db, `universities/${universityId}/members/${uid}`), {
        parentUid: null,
        updatedAt: now,
      })
    }
  }
}

/**
 * Détache des étudiants de leur parent (efface `parentUid`). À appeler AVANT de
 * supprimer un parent pour ne pas laisser de références orphelines.
 */
export async function detachEnfantsFromParent(
  universityId: string,
  enfantUids: string[]
): Promise<void> {
  const now = Date.now()
  for (const uid of enfantUids) {
    await update(ref(db, `universities/${universityId}/members/${uid}`), {
      parentUid: null,
      updatedAt: now,
    })
  }
}

// ─── Manual student records (no Firebase Auth) ─────────────────────────────────

export type ManualStudent = Omit<UniversityMember, 'uid' | 'role'> & { key?: string }

export async function addManualStudent(
  universityId: string,
  data: Omit<ManualStudent, 'key'>
): Promise<string> {
  const newRef = push(ref(db, `universities/${universityId}/manual_students`))
  await set(newRef, { ...data, role: 'student' })
  return newRef.key!
}

export async function updateManualStudent(
  universityId: string,
  key: string,
  data: Partial<Omit<ManualStudent, 'key'>>
): Promise<void> {
  await update(ref(db, `universities/${universityId}/manual_students/${key}`), data)
}

export async function removeManualStudent(
  universityId: string,
  key: string
): Promise<void> {
  await remove(ref(db, `universities/${universityId}/manual_students/${key}`))
}

export async function getManualStudents(universityId: string): Promise<(ManualStudent & { key: string })[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/manual_students`))
  if (!snapshot.exists()) return []
  const result: (ManualStudent & { key: string })[] = []
  snapshot.forEach((child) => {
    result.push({ key: child.key!, ...child.val() })
  })
  return result
}

// ─── Filières ─────────────────────────────────────────────────────────────────

import type { Filiere, FiliereFormData, Matiere, MatiereFormData } from '@/types/filiere'

export type { Filiere, FiliereFormData, Matiere, MatiereFormData }

export async function createFiliere(
  universityId: string,
  data: FiliereFormData
): Promise<string> {
  const newRef = push(ref(db, `universities/${universityId}/filieres`))
  const now = Date.now()
  await set(newRef, { ...data, universityId, createdAt: now, updatedAt: now })
  return newRef.key!
}

/**
 * Firebase RTDB ne stocke pas les tableaux vides : une filière enregistrée avec
 * `niveaux: []` revient SANS la clé `niveaux`. On normalise donc à la lecture
 * pour garantir un tableau (évite les `undefined.map(...)` côté UI).
 */
function normalizeFiliere(id: string, val: Record<string, unknown>): Filiere {
  return { id, ...val, niveaux: (val.niveaux as Filiere['niveaux']) ?? [] } as Filiere
}

export async function getFilieres(universityId: string): Promise<Filiere[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/filieres`))
  if (!snapshot.exists()) return []
  const result: Filiere[] = []
  snapshot.forEach((child) => {
    result.push(normalizeFiliere(child.key!, child.val()))
  })
  return result
}

export async function getFiliere(
  universityId: string,
  filiereId: string
): Promise<Filiere | null> {
  const snapshot = await get(ref(db, `universities/${universityId}/filieres/${filiereId}`))
  if (!snapshot.exists()) return null
  return normalizeFiliere(filiereId, snapshot.val())
}

export async function updateFiliere(
  universityId: string,
  filiereId: string,
  data: Partial<FiliereFormData>
): Promise<void> {
  await update(ref(db, `universities/${universityId}/filieres/${filiereId}`), {
    ...data,
    updatedAt: Date.now(),
  })
}

export async function deleteFiliere(
  universityId: string,
  filiereId: string
): Promise<void> {
  // Comportement existant : suppression de la filière et de ses matières.
  await Promise.all([
    remove(ref(db, `universities/${universityId}/filieres/${filiereId}`)),
    remove(ref(db, `universities/${universityId}/matieres/${filiereId}`)),
  ])
  // Cascade : un créneau OU un examen sans filière n'a plus aucun sens →
  // suppression complète (référence par ID). Toute erreur ici remonte : l'admin
  // est informé si la filière a été supprimée mais qu'un nettoyage a échoué.
  const [creneaux, examens] = await Promise.all([
    getCreneaux(universityId),
    getExamens(universityId),
  ])
  for (const c of creneaux) {
    if (c.filiereId === filiereId) {
      await deleteCreneau(universityId, c.id)
    }
  }
  for (const e of examens) {
    if (e.filiereId === filiereId) {
      await deleteExamen(universityId, e.id)
    }
  }
}

// ─── Matières ─────────────────────────────────────────────────────────────────

export async function createMatiere(
  universityId: string,
  filiereId: string,
  data: MatiereFormData
): Promise<string> {
  const newRef = push(ref(db, `universities/${universityId}/matieres/${filiereId}`))
  const now = Date.now()
  await set(newRef, { ...data, createdAt: now, updatedAt: now })
  return newRef.key!
}

export async function getMatieres(
  universityId: string,
  filiereId: string
): Promise<Matiere[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/matieres/${filiereId}`))
  if (!snapshot.exists()) return []
  const result: Matiere[] = []
  snapshot.forEach((child) => {
    result.push({ id: child.key!, ...child.val() } as Matiere)
  })
  return result
}

export async function updateMatiere(
  universityId: string,
  filiereId: string,
  matiereId: string,
  data: Partial<MatiereFormData>
): Promise<void> {
  await update(ref(db, `universities/${universityId}/matieres/${filiereId}/${matiereId}`), {
    ...data,
    updatedAt: Date.now(),
  })
}

export async function deleteMatiere(
  universityId: string,
  filiereId: string,
  matiereId: string
): Promise<void> {
  // Récupère le NOM de la matière AVANT suppression : les créneaux référencent la
  // matière par son nom (pas par son id), on en a donc besoin pour la cascade.
  const matieres = await getMatieres(universityId, filiereId)
  const cible = matieres.find((m) => m.id === matiereId)

  // Comportement existant : suppression de la matière.
  await remove(ref(db, `universities/${universityId}/matieres/${filiereId}/${matiereId}`))

  // Cascade EXAMENS : rattachés par matiereId (ID unique) → suppression directe,
  // sans risque d'homonyme, et indépendante du nom (donc même si `cible` est absent).
  const examens = await getExamens(universityId)
  for (const e of examens) {
    if (e.matiereId === matiereId) {
      await deleteExamen(universityId, e.id)
    }
  }

  if (!cible) return // matière déjà absente : plus rien à nettoyer côté créneaux.

  // Cascade CRÉNEAUX : rattachés par NOM. Si une AUTRE matière de la filière porte
  // encore ce nom, ces créneaux restent valides → on ne touche à rien.
  const nomCible = cible.nom.trim().toLowerCase()
  const nomEncorePresent = matieres.some(
    (m) => m.id !== matiereId && m.nom.trim().toLowerCase() === nomCible
  )
  if (nomEncorePresent) return

  // Bornée à la filière du créneau (un même nom peut exister ailleurs légitimement).
  const creneaux = await getCreneaux(universityId)
  for (const c of creneaux) {
    if (c.filiereId === filiereId && c.matiere.trim().toLowerCase() === nomCible) {
      await deleteCreneau(universityId, c.id)
    }
  }
}

export async function getTotalCreditsFiliere(
  universityId: string,
  filiereId: string
): Promise<number> {
  const matieres = await getMatieres(universityId, filiereId)
  return matieres.reduce((sum, m) => sum + m.credits, 0)
}

// ─── Semestres ────────────────────────────────────────────────────────────────

import type { Semestre, SemestreFormData, StatutSemestre } from '@/types/semestre'

export type { Semestre, SemestreFormData, StatutSemestre }

export async function createSemestre(
  universityId: string,
  data: SemestreFormData
): Promise<string> {
  const newRef = push(ref(db, `universities/${universityId}/semestres`))
  const now = Date.now()
  await set(newRef, { ...data, universityId, createdAt: now, updatedAt: now })
  return newRef.key!
}

export async function getSemestres(universityId: string): Promise<Semestre[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/semestres`))
  if (!snapshot.exists()) return []
  const result: Semestre[] = []
  snapshot.forEach((child) => {
    result.push({ id: child.key!, ...child.val() } as Semestre)
  })
  return result
}

export async function getSemestreEnCours(
  universityId: string
): Promise<Semestre | null> {
  const semestres = await getSemestres(universityId)
  return semestres.find((s) => s.statut === 'en_cours') ?? null
}

export async function updateSemestre(
  universityId: string,
  semestreId: string,
  data: Partial<SemestreFormData>
): Promise<void> {
  await update(ref(db, `universities/${universityId}/semestres/${semestreId}`), {
    ...data,
    updatedAt: Date.now(),
  })
}

export async function deleteSemestre(
  universityId: string,
  semestreId: string
): Promise<void> {
  // Comportement existant : suppression du semestre.
  await remove(ref(db, `universities/${universityId}/semestres/${semestreId}`))
  // Cascade : un créneau OU un examen rattaché à un semestre disparu n'a plus de
  // sens → suppression complète. (Référence par ID dans les deux cas.)
  const [creneaux, examens] = await Promise.all([
    getCreneaux(universityId),
    getExamens(universityId),
  ])
  for (const c of creneaux) {
    if (c.semestreId === semestreId) {
      await deleteCreneau(universityId, c.id)
    }
  }
  for (const e of examens) {
    if (e.semestreId === semestreId) {
      await deleteExamen(universityId, e.id)
    }
  }
}

/**
 * Définit le statut d'un semestre. Lorsqu'on passe un semestre à "en_cours",
 * tous les autres sont rebasculés à "termine" ou "a_venir" selon leurs dates
 * (un seul semestre peut être "en_cours" à la fois).
 */
export async function setStatutSemestre(
  universityId: string,
  semestreId: string,
  statut: StatutSemestre
): Promise<void> {
  const now = Date.now()

  if (statut !== 'en_cours') {
    await update(ref(db, `universities/${universityId}/semestres/${semestreId}`), {
      statut,
      updatedAt: now,
    })
    return
  }

  // Passage à "en_cours" : recalculer tous les semestres en une écriture atomique.
  const semestres = await getSemestres(universityId)
  const updates: Record<string, unknown> = {}
  for (const s of semestres) {
    let next: StatutSemestre
    if (s.id === semestreId) {
      next = 'en_cours'
    } else {
      next = s.dateFin < now ? 'termine' : 'a_venir'
    }
    if (next !== s.statut) {
      updates[`${s.id}/statut`] = next
      updates[`${s.id}/updatedAt`] = now
    }
  }
  if (Object.keys(updates).length > 0) {
    await update(ref(db, `universities/${universityId}/semestres`), updates)
  }
}

// ─── Super admin — all universities ───────────────────────────────────────────

export interface UniversityEntry extends University {
  id: string
}

export async function getAllUniversities(): Promise<UniversityEntry[]> {
  const snapshot = await get(ref(db, 'universities'))
  if (!snapshot.exists()) return []
  const result: UniversityEntry[] = []
  snapshot.forEach((child) => {
    result.push({ id: child.key!, ...child.val() })
  })
  return result
}

export async function updateUniversityStatus(
  universityId: string,
  status: 'active' | 'inactive' | 'suspended'
): Promise<void> {
  await update(ref(db, `universities/${universityId}`), { status })
}

/**
 * Nombre de membres `role === "student"` d'une université — pour les KPIs du
 * super-admin (lecture autorisée par la cascade `.read` de /universities).
 * Retourne 0 si l'université n'a aucun membre (jamais d'exception sur données
 * absentes). Une erreur réelle (permission/réseau) rejette la promesse :
 * l'appelant décide alors s'il parallélise plusieurs comptages ou affiche "—".
 */
export async function getUniversityStudentCount(universityId: string): Promise<number> {
  const snapshot = await get(ref(db, `universities/${universityId}/members`))
  if (!snapshot.exists()) return 0
  let count = 0
  snapshot.forEach((child) => {
    if ((child.val() as { role?: Role }).role === 'student') count++
  })
  return count
}

// ─── Essai gratuit (trial 30 jours) ────────────────────────────────────────────

import type { PlanId } from '@/types/plan'
import {
  TRIAL_DURATION_MS,
  type StoredPlan,
  type TrialStatus,
  type UniversityTrial,
} from '@/types/trial'

export type { StoredPlan, TrialStatus, UniversityTrial }

/**
 * Active l'essai gratuit d'une université. À n'appeler QU'UNE SEULE FOIS, juste
 * après createUniversity() — ne jamais réinitialiser un essai existant.
 */
export async function initTrial(universityId: string): Promise<void> {
  await update(ref(db, `universities/${universityId}`), {
    plan: 'trial',
    trialEndsAt: Date.now() + TRIAL_DURATION_MS,
    trialStatus: 'active',
  })
}

/** Lit plan, trialEndsAt et trialStatus depuis Firebase, ou null si absent. */
export async function getTrialInfo(
  universityId: string
): Promise<UniversityTrial | null> {
  const snapshot = await get(ref(db, `universities/${universityId}`))
  if (!snapshot.exists()) return null
  const data = snapshot.val() as Partial<UniversityTrial>
  if (!data.plan) return null
  return {
    plan: data.plan as StoredPlan,
    trialEndsAt: data.trialEndsAt ?? 0,
    trialStatus: data.trialStatus ?? 'active',
    convertedAt: data.convertedAt,
    convertedPlan: data.convertedPlan,
  }
}

/**
 * Retourne true si l'essai est expiré (plan "trial" ET trialEndsAt dépassé).
 * Met à jour trialStatus → "expired" dans Firebase uniquement si le statut
 * change (évite les écritures inutiles à chaque chargement).
 */
export async function checkTrialExpired(universityId: string): Promise<boolean> {
  const info = await getTrialInfo(universityId)
  if (!info) return false
  if (info.plan !== 'trial') return false

  const expired = info.trialEndsAt < Date.now()
  if (expired && info.trialStatus !== 'expired') {
    await update(ref(db, `universities/${universityId}`), {
      trialStatus: 'expired',
    })
  }
  return expired
}

/**
 * Convertit l'essai en plan payant : `plan` prend la valeur choisie,
 * trialStatus passe à "converted" et la date/plan de conversion sont mémorisés.
 */
export async function convertTrial(
  universityId: string,
  newPlan: PlanId
): Promise<void> {
  await update(ref(db, `universities/${universityId}`), {
    plan: newPlan,
    trialStatus: 'converted',
    convertedAt: Date.now(),
    convertedPlan: newPlan,
  })
}

/**
 * Nombre de jours restants avant la fin de l'essai, arrondi à l'entier
 * supérieur. Toujours >= 0 (retourne 0 si déjà expiré).
 */
export function getDaysRemaining(trialEndsAt: number): number {
  const ms = trialEndsAt - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

// ─── Emploi du temps (créneaux par filière + niveau + semestre) ────────────────

import {
  ConflitError,
  findConflits,
  type ConflitInfo,
  type Creneau,
  type CreneauCandidat,
  type CreneauFormData,
} from '@/types/emploi-du-temps'

export { ConflitError }
export type { Creneau, CreneauFormData, ConflitInfo }

/**
 * Détecte les conflits d'un créneau candidat (RÈGLE 3). Charge tous les créneaux
 * de l'université puis délègue à la fonction pure `findConflits`. `excludeId`
 * exclut le créneau en cours de modification de la comparaison.
 */
export async function detectConflits(
  universityId: string,
  candidat: CreneauCandidat,
  excludeId?: string
): Promise<ConflitInfo[]> {
  const all = await getCreneaux(universityId)
  return findConflits(all, candidat, excludeId)
}

export async function createCreneau(
  universityId: string,
  data: CreneauFormData
): Promise<string> {
  const conflits = await detectConflits(universityId, data)
  if (conflits.length > 0) throw new ConflitError(conflits)

  const newRef = push(ref(db, `universities/${universityId}/emploi_du_temps`))
  const now = Date.now()
  await set(newRef, { ...data, createdAt: now, updatedAt: now })
  return newRef.key!
}

/** Tous les créneaux de l'université (le filtrage filière/niveau se fait côté UI). */
export async function getCreneaux(universityId: string): Promise<Creneau[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/emploi_du_temps`))
  if (!snapshot.exists()) return []
  const result: Creneau[] = []
  snapshot.forEach((child) => {
    result.push({ id: child.key!, ...child.val() } as Creneau)
  })
  return result
}

export async function updateCreneau(
  universityId: string,
  creneauId: string,
  data: Partial<CreneauFormData>
): Promise<void> {
  // Fusionne les champs modifiés avec l'existant pour tester le créneau complet,
  // en s'excluant lui-même de la comparaison.
  const all = await getCreneaux(universityId)
  const existing = all.find((c) => c.id === creneauId)
  if (existing) {
    const conflits = findConflits(all, { ...existing, ...data }, creneauId)
    if (conflits.length > 0) throw new ConflitError(conflits)
  }

  await update(ref(db, `universities/${universityId}/emploi_du_temps/${creneauId}`), {
    ...data,
    updatedAt: Date.now(),
  })
}

export async function deleteCreneau(
  universityId: string,
  creneauId: string
): Promise<void> {
  await remove(ref(db, `universities/${universityId}/emploi_du_temps/${creneauId}`))
}

/**
 * Vide le champ `enseignant` de plusieurs créneaux (le cours reste actif, juste
 * sans enseignant assigné). Écriture directe par sous-chemin — pas de contrôle de
 * conflit à refaire, retirer une valeur ne peut jamais créer de conflit. Chaque
 * écriture est attendue : toute erreur remonte à l'appelant.
 */
async function clearEnseignantOnCreneaux(
  universityId: string,
  creneauIds: string[]
): Promise<void> {
  const now = Date.now()
  for (const id of creneauIds) {
    await update(ref(db, `universities/${universityId}/emploi_du_temps/${id}`), {
      enseignant: '',
      updatedAt: now,
    })
  }
}

// ─── Nettoyage ponctuel des données orphelines (maintenance, usage unique) ───────
//
// Utilitaire de MAINTENANCE (pas une fonctionnalité récurrente de l'app) pour
// réparer les données déjà orphelines laissées par d'anciennes suppressions sans
// cascade. La cascade automatique (deleteFiliere / deleteMatiere / deleteSemestre /
// removeMember) empêche désormais ces orphelins d'apparaître. Couvre en une passe
// l'EMPLOI DU TEMPS (créneaux) ET les EXAMENS, avec la même règle de prudence :
//   • filière / semestre / matière introuvable  → n'a plus de sens → SUPPRIMÉ
//   • enseignant / surveillant introuvable       → reste valide → champ VIDÉ (pas supprimé)
//
// Détection selon le schéma RÉEL de chaque entité :
//   • Creneau : filiereId/semestreId par ID, matiere/enseignant par NOM.
//   • Examen  : filiereId/semestreId/matiereId par ID, enseignantUid/surveillantUid par UID.

export interface OrphanEntityCleanup {
  deletedFiliere: number
  deletedSemestre: number
  deletedMatiere: number
  /** Créneaux : enseignant vidé. Examens : enseignant et/ou surveillant vidé. */
  personneCleared: number
}

export interface OrphanDataCleanupResult {
  creneaux: OrphanEntityCleanup
  examens: OrphanEntityCleanup
}

export async function cleanupOrphanData(
  universityId: string
): Promise<OrphanDataCleanupResult> {
  const [creneaux, examens, filieres, semestres, teachers] = await Promise.all([
    getCreneaux(universityId),
    getExamens(universityId),
    getFilieres(universityId),
    getSemestres(universityId),
    getUniversityMembers(universityId, 'teacher'),
  ])

  const filiereIds = new Set(filieres.map((f) => f.id))
  const semestreIds = new Set(semestres.map((s) => s.id))
  const teacherNames = new Set(teachers.map((t) => t.displayName.trim().toLowerCase()))
  const teacherUids = new Set(teachers.map((t) => t.uid))

  // Par filière encore existante : noms de matières (pour les créneaux) ET ids de
  // matières (pour les examens), résolus en une seule lecture par filière.
  const matiereNomsParFiliere = new Map<string, Set<string>>()
  const matiereIdsParFiliere = new Map<string, Set<string>>()
  await Promise.all(
    filieres.map(async (f) => {
      const list = await getMatieres(universityId, f.id)
      matiereNomsParFiliere.set(f.id, new Set(list.map((m) => m.nom.trim().toLowerCase())))
      matiereIdsParFiliere.set(f.id, new Set(list.map((m) => m.id)))
    })
  )

  const result: OrphanDataCleanupResult = {
    creneaux: { deletedFiliere: 0, deletedSemestre: 0, deletedMatiere: 0, personneCleared: 0 },
    examens: { deletedFiliere: 0, deletedSemestre: 0, deletedMatiere: 0, personneCleared: 0 },
  }

  // ── Créneaux (emploi du temps) ──────────────────────────────────────────────
  const enseignantAVider: string[] = []
  for (const c of creneaux) {
    if (!filiereIds.has(c.filiereId)) {
      await deleteCreneau(universityId, c.id)
      result.creneaux.deletedFiliere++
      continue
    }
    if (!semestreIds.has(c.semestreId)) {
      await deleteCreneau(universityId, c.id)
      result.creneaux.deletedSemestre++
      continue
    }
    // Matière par NOM, dans la filière du créneau.
    const noms = matiereNomsParFiliere.get(c.filiereId)
    if (!noms || !noms.has(c.matiere.trim().toLowerCase())) {
      await deleteCreneau(universityId, c.id)
      result.creneaux.deletedMatiere++
      continue
    }
    // Enseignant (nom non vide) introuvable → cours conservé, nom à vider.
    const nom = c.enseignant.trim().toLowerCase()
    if (nom && !teacherNames.has(nom)) enseignantAVider.push(c.id)
  }
  if (enseignantAVider.length > 0) {
    await clearEnseignantOnCreneaux(universityId, enseignantAVider)
    result.creneaux.personneCleared = enseignantAVider.length
  }

  // ── Examens ─────────────────────────────────────────────────────────────────
  const now = Date.now()
  for (const e of examens) {
    if (!filiereIds.has(e.filiereId)) {
      await deleteExamen(universityId, e.id)
      result.examens.deletedFiliere++
      continue
    }
    if (!semestreIds.has(e.semestreId)) {
      await deleteExamen(universityId, e.id)
      result.examens.deletedSemestre++
      continue
    }
    // Matière par ID, dans la filière de l'examen (schéma examen : matiereId).
    const ids = matiereIdsParFiliere.get(e.filiereId)
    if (!ids || !ids.has(e.matiereId)) {
      await deleteExamen(universityId, e.id)
      result.examens.deletedMatiere++
      continue
    }
    // Enseignant / surveillant (par UID) introuvable → examen conservé, champ vidé.
    const patch: Record<string, unknown> = {}
    if (e.enseignantUid && !teacherUids.has(e.enseignantUid)) {
      patch.enseignantUid = null
      patch.enseignantNom = null
    }
    if (e.surveillantUid && !teacherUids.has(e.surveillantUid)) {
      patch.surveillantUid = null
      patch.surveillantNom = null
    }
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = now
      await update(ref(db, `universities/${universityId}/examens/${e.id}`), patch)
      result.examens.personneCleared++
    }
  }

  return result
}

// ─── Notes (note /20 par étudiant + matière + semestre) ────────────────────────

import {
  noteKey,
  SEUIL_VALIDATION,
  EVALUATIONS,
  calculerMoyenneMatiere,
  type NoteEntry,
  type DetailEvaluations,
} from '@/types/note'

export type { NoteEntry }

/** Date du jour au format "YYYY-MM-DD" (fuseau local). */
function todayISODate(): string {
  const d = new Date()
  const mois = String(d.getMonth() + 1).padStart(2, '0')
  const jour = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mois}-${jour}`
}

/** Entrée de saisie : 3 évaluations, plus `note` pour la compat historique. */
export type SaveNoteEntry = Omit<
  NoteEntry,
  'id' | 'updatedAt' | 'note' | 'interro1' | 'interro2' | 'examen'
> &
  DetailEvaluations & {
    /**
     * Note directe, utilisée UNIQUEMENT si aucune évaluation détaillée n'est
     * saisie (entrée historique rééditée sans passer aux 3 évaluations).
     * Ignorée dès qu'au moins une évaluation est renseignée.
     */
    note?: number | null
  }

/**
 * Enregistre (upsert) un lot de notes via leur clé déterministe.
 *
 * La note de la matière (`note`) est DÉRIVÉE des 3 évaluations :
 * (Interro1 + Interro2 + 2×Examen)/4, ou moyenne pondérée des seules
 * évaluations saisies. Elle reste la référence unique consommée partout
 * ailleurs (moyennes, clôture, éligibilité au rattrapage) — d'où le choix de
 * la recalculer ici plutôt que de disperser le barème dans l'UI.
 *
 * Entrée entièrement vide (aucune évaluation ET aucune note directe) →
 * l'entrée est supprimée.
 */
export async function saveNotes(
  universityId: string,
  entries: SaveNoteEntry[]
): Promise<void> {
  const updates: Record<string, unknown> = {}
  const now = Date.now()

  for (const e of entries) {
    const key = noteKey(e.semestreId, e.matiereId, e.studentUid)

    const moyenne = calculerMoyenneMatiere(e)
    // Aucune évaluation saisie → on retombe sur la note directe (schéma
    // historique). Si les deux sont absentes, la note n'existe pas.
    const noteFinale =
      moyenne ?? (typeof e.note === 'number' && !Number.isNaN(e.note) ? e.note : null)

    if (noteFinale === null) {
      updates[key] = null // suppression de l'entrée complète (rattrapage inclus)
      continue
    }

    // Écriture par SOUS-CHEMINS (merge) et non remplacement du nœud entier :
    // préserve d'éventuels champs rattrapage déjà saisis sur cette entrée
    // (noteRattrapage, dateRattrapage, …) — un re-save des notes normales ne
    // doit jamais effacer un rattrapage.
    updates[`${key}/studentUid`] = e.studentUid
    updates[`${key}/matiere`] = e.matiere
    updates[`${key}/matiereId`] = e.matiereId
    updates[`${key}/filiereId`] = e.filiereId
    updates[`${key}/niveau`] = e.niveau
    updates[`${key}/semestreId`] = e.semestreId
    updates[`${key}/note`] = noteFinale
    updates[`${key}/commentaire`] = e.commentaire ?? ''
    updates[`${key}/updatedAt`] = now

    // Détail des évaluations : `null` efface le sous-champ (une note effacée par
    // l'enseignant doit disparaître, pas rester à son ancienne valeur).
    for (const { champ } of EVALUATIONS) {
      const valeur = e[champ]
      updates[`${key}/${champ}`] =
        typeof valeur === 'number' && !Number.isNaN(valeur) ? valeur : null
    }
  }

  if (Object.keys(updates).length > 0) {
    await update(ref(db, `universities/${universityId}/notes`), updates)
  }
}

/** Toutes les notes de l'université (filtrage côté UI). */
export async function getNotes(universityId: string): Promise<NoteEntry[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/notes`))
  if (!snapshot.exists()) return []
  const result: NoteEntry[] = []
  snapshot.forEach((child) => {
    result.push({ id: child.key!, ...child.val() } as NoteEntry)
  })
  return result
}

/** Notes d'un étudiant précis. */
export async function getNotesForStudent(
  universityId: string,
  studentUid: string
): Promise<NoteEntry[]> {
  const all = await getNotes(universityId)
  return all.filter((n) => n.studentUid === studentUid)
}

// ─── Rattrapage (extension additive du module notes) ────────────────────────────
//
// Une note de rattrapage est stockée SUR l'entrée note existante (même clé
// déterministe), dans des champs distincts — la note normale n'est jamais
// écrasée. `getNoteRetenue()` (types/note.ts) décide ensuite quelle note compte.

/**
 * Saisit une note de RATTRAPAGE : met à jour UNIQUEMENT les champs rattrapage de
 * l'entrée note existante (merge via `update` sur la clé déterministe), sans
 * toucher à la note normale ni aux autres champs. Suppose que l'entrée existe
 * déjà (l'étudiant n'est éligible que s'il a une note normale < seuil).
 */
export async function saveNoteRattrapage(
  universityId: string,
  semestreId: string,
  matiereId: string,
  studentUid: string,
  noteRattrapage: number,
  saisiParUid: string,
  saisiParNom: string
): Promise<void> {
  const key = noteKey(semestreId, matiereId, studentUid)
  await update(ref(db, `universities/${universityId}/notes/${key}`), {
    noteRattrapage,
    dateRattrapage: todayISODate(),
    rattrapageParUid: saisiParUid,
    rattrapageParNom: saisiParNom,
    updatedAt: Date.now(),
  })
}

/**
 * Étudiants ÉLIGIBLES au rattrapage pour une matière/semestre d'une cohorte :
 * ceux dont la note NORMALE est en dessous du seuil de validation (< 10). Un
 * étudiant ayant déjà validé n'a pas besoin de rattrapage et n'apparaît pas.
 * Renvoie aussi la note de rattrapage déjà saisie (le cas échéant) pour
 * pré-remplir l'interface de saisie.
 */
export async function getEtudiantsEligiblesRattrapage(
  universityId: string,
  semestreId: string,
  matiereId: string,
  filiereId: string,
  niveau: string
): Promise<
  Array<{
    studentUid: string
    displayName: string
    noteNormale: number
    noteRattrapageActuelle: number | null
  }>
> {
  const [notes, membres] = await Promise.all([
    getNotes(universityId),
    getUniversityMembers(universityId, 'student'),
  ])
  const nomByUid = new Map(membres.map((m) => [m.uid, m.displayName]))
  return notes
    .filter(
      (n) =>
        n.semestreId === semestreId &&
        n.matiereId === matiereId &&
        n.filiereId === filiereId &&
        n.niveau === niveau &&
        typeof n.note === 'number' &&
        n.note < SEUIL_VALIDATION
    )
    .map((n) => ({
      studentUid: n.studentUid,
      displayName: nomByUid.get(n.studentUid) ?? '—',
      noteNormale: n.note,
      noteRattrapageActuelle: typeof n.noteRattrapage === 'number' ? n.noteRattrapage : null,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

// ─── Moyennes manuelles (override de secours, saisie ENSEIGNANT) ────────────────
//
// La moyenne reste calculée automatiquement à partir des notes ; cette valeur
// optionnelle permet à l'enseignant de FORCER une moyenne (priorité sur l'auto)
// au cas où le calcul automatique poserait problème. Stockée par semestre.

/** Upsert d'un lot de moyennes manuelles ; `null` supprime l'override. */
export async function saveMoyennes(
  universityId: string,
  semestreId: string,
  entries: { studentUid: string; moyenne: number | null }[]
): Promise<void> {
  const updates: Record<string, unknown> = {}
  for (const e of entries) {
    updates[e.studentUid] = e.moyenne === null || Number.isNaN(e.moyenne) ? null : e.moyenne
  }
  if (Object.keys(updates).length > 0) {
    await update(ref(db, `universities/${universityId}/moyennes/${semestreId}`), updates)
  }
}

/** Moyennes manuelles d'un semestre (studentUid → moyenne forcée). */
export async function getMoyennesManuelles(
  universityId: string,
  semestreId: string
): Promise<Record<string, number>> {
  const snapshot = await get(ref(db, `universities/${universityId}/moyennes/${semestreId}`))
  if (!snapshot.exists()) return {}
  return snapshot.val() as Record<string, number>
}

// ─── Paiements ─────────────────────────────────────────────────────────────────

import type { Paiement, PaiementFormData } from '@/types/paiement'

export type { Paiement, PaiementFormData }

export async function createPaiement(
  universityId: string,
  data: PaiementFormData
): Promise<string> {
  const newRef = push(ref(db, `universities/${universityId}/paiements`))
  const now = Date.now()
  await set(newRef, { ...data, createdAt: now, updatedAt: now })
  return newRef.key!
}

export async function getPaiements(universityId: string): Promise<Paiement[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/paiements`))
  if (!snapshot.exists()) return []
  const result: Paiement[] = []
  snapshot.forEach((child) => {
    result.push({ id: child.key!, ...child.val() } as Paiement)
  })
  return result
}

export async function getPaiementsForStudent(
  universityId: string,
  studentUid: string
): Promise<Paiement[]> {
  const all = await getPaiements(universityId)
  return all.filter((p) => p.studentUid === studentUid)
}

export async function updatePaiement(
  universityId: string,
  paiementId: string,
  data: Partial<PaiementFormData>
): Promise<void> {
  await update(ref(db, `universities/${universityId}/paiements/${paiementId}`), {
    ...data,
    updatedAt: Date.now(),
  })
}

export async function deletePaiement(
  universityId: string,
  paiementId: string
): Promise<void> {
  await remove(ref(db, `universities/${universityId}/paiements/${paiementId}`))
}

// ─── Absences ──────────────────────────────────────────────────────────────────

import {
  DEFAULT_SEUIL_ABSENCES,
  type Absence,
  type AbsenceFormData,
} from '@/types/absence'

export type { Absence, AbsenceFormData }
export { DEFAULT_SEUIL_ABSENCES }

/**
 * Firebase RTDB refuse les valeurs `undefined` (set/update lèvent une erreur).
 * Les champs optionnels d'une absence (motifCategorie, creneauId…) valent
 * `undefined` tant qu'ils ne sont pas saisis : on les retire avant écriture pour
 * éviter un échec silencieux au lieu d'un vrai enregistrement.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as Partial<T>
}

export async function createAbsence(
  universityId: string,
  data: AbsenceFormData
): Promise<string> {
  const newRef = push(ref(db, `universities/${universityId}/absences`))
  const now = Date.now()
  await set(newRef, stripUndefined({ ...data, createdAt: now, updatedAt: now }))
  return newRef.key!
}

export async function getAbsences(universityId: string): Promise<Absence[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/absences`))
  if (!snapshot.exists()) return []
  const result: Absence[] = []
  snapshot.forEach((child) => {
    result.push({ id: child.key!, ...child.val() } as Absence)
  })
  return result
}

export async function getAbsencesForStudent(
  universityId: string,
  studentUid: string
): Promise<Absence[]> {
  const all = await getAbsences(universityId)
  return all.filter((a) => a.studentUid === studentUid)
}

export async function updateAbsence(
  universityId: string,
  absenceId: string,
  data: Partial<AbsenceFormData>
): Promise<void> {
  await update(
    ref(db, `universities/${universityId}/absences/${absenceId}`),
    stripUndefined({ ...data, updatedAt: Date.now() })
  )
}

export async function deleteAbsence(
  universityId: string,
  absenceId: string
): Promise<void> {
  await remove(ref(db, `universities/${universityId}/absences/${absenceId}`))
}

// ─── Seuil d'alerte des absences injustifiées (RÈGLE 3) ─────────────────────────
// Nœud : /universities/{universityId}/config/seuilAlerte
// Lisible par tous les membres de l'université (cascade .read du nœud université) ;
// écrit uniquement par l'admin (cf. database.rules.json → config).

/** Seuil configuré, ou DEFAULT_SEUIL_ABSENCES si l'université n'a rien défini. */
export async function getSeuilAlerteConfig(universityId: string): Promise<number> {
  const snapshot = await get(ref(db, `universities/${universityId}/config/seuilAlerte`))
  if (!snapshot.exists()) return DEFAULT_SEUIL_ABSENCES
  const val = snapshot.val()
  // Tolère un ancien stockage sous forme de simple nombre.
  const seuil = typeof val === 'number' ? val : val?.seuilAbsencesInjustifiees
  return typeof seuil === 'number' && seuil > 0 ? seuil : DEFAULT_SEUIL_ABSENCES
}

export async function setSeuilAlerteConfig(
  universityId: string,
  seuil: number
): Promise<void> {
  await set(ref(db, `universities/${universityId}/config/seuilAlerte`), {
    seuilAbsencesInjustifiees: seuil,
    updatedAt: Date.now(),
  })
}

// ─── Configuration académique de l'université (frais, calendrier, sous-domaine) ─
// Tout vit sous /universities/{universityId}/config/* : ce nœud est déjà lisible
// par les membres de l'université (cascade .read) et écrit par le seul admin
// (database.rules.json → "config"). Aucune règle à redéployer.

/** Frais de scolarité d'une filière. Le nom est dénormalisé pour l'affichage. */
export interface FraisFiliere {
  filiereId: string
  filiereNom: string
  montant: number
}

/**
 * Frais par filiereId. Retourne un objet vide si l'université n'a rien configuré
 * — jamais de montant inventé.
 */
export async function getFraisScolarite(
  universityId: string
): Promise<Record<string, FraisFiliere>> {
  const snapshot = await get(ref(db, `universities/${universityId}/config/frais`))
  if (!snapshot.exists()) return {}
  const val = snapshot.val() as Record<string, FraisFiliere> | null
  return val ?? {}
}

/**
 * Remplace l'intégralité des frais (l'admin édite la liste complète des filières
 * dans un seul formulaire). Rejette si les règles refusent l'écriture.
 */
export async function setFraisScolarite(
  universityId: string,
  frais: FraisFiliere[]
): Promise<void> {
  const payload: Record<string, FraisFiliere & { updatedAt: number }> = {}
  const now = Date.now()
  for (const f of frais) {
    payload[f.filiereId] = { ...f, updatedAt: now }
  }
  await set(ref(db, `universities/${universityId}/config/frais`), payload)
}

/** Dates clés de l'année académique. Format ISO `YYYY-MM-DD` (input type="date"). */
export interface CalendrierAcademique {
  rentree: string
  examsS1: string
  vacances: string
  examsS2: string
  cloture: string
}

export const CALENDRIER_VIDE: CalendrierAcademique = {
  rentree: '',
  examsS1: '',
  vacances: '',
  examsS2: '',
  cloture: '',
}

/** Calendrier configuré, ou toutes dates vides si l'université n'a rien saisi. */
export async function getCalendrierAcademique(
  universityId: string
): Promise<CalendrierAcademique> {
  const snapshot = await get(ref(db, `universities/${universityId}/config/calendrier`))
  if (!snapshot.exists()) return { ...CALENDRIER_VIDE }
  const val = snapshot.val() as Partial<CalendrierAcademique> | null
  return { ...CALENDRIER_VIDE, ...(val ?? {}) }
}

export async function setCalendrierAcademique(
  universityId: string,
  calendrier: CalendrierAcademique
): Promise<void> {
  await set(ref(db, `universities/${universityId}/config/calendrier`), {
    ...calendrier,
    updatedAt: Date.now(),
  })
}

/**
 * Sous-domaine personnalisé (fonctionnalité Enterprise). Stocké sous `config`
 * et non à la racine de l'université : les règles n'y autorisent que les champs
 * name/slug/pays/type/annee, un champ racine supplémentaire serait rejeté.
 */
export async function getSousDomaine(universityId: string): Promise<string> {
  const snapshot = await get(ref(db, `universities/${universityId}/config/sousDomaine`))
  if (!snapshot.exists()) return ''
  const val = snapshot.val()
  return typeof val === 'string' ? val : (val?.valeur ?? '')
}

export async function setSousDomaine(
  universityId: string,
  sousDomaine: string
): Promise<void> {
  await set(ref(db, `universities/${universityId}/config/sousDomaine`), {
    valeur: sousDomaine,
    updatedAt: Date.now(),
  })
}

/**
 * Nombre d'absences NON justifiées d'un étudiant, filtrable par matière.
 * Sans `matiere`, compte toutes matières confondues.
 */
export async function compterAbsencesInjustifiees(
  universityId: string,
  etudiantUid: string,
  matiere?: string
): Promise<number> {
  const list = await getAbsencesForStudent(universityId, etudiantUid)
  return list.filter(
    (a) => !a.justifiee && (matiere === undefined || a.matiere === matiere)
  ).length
}

// ─── Annonces ──────────────────────────────────────────────────────────────────

import type { Annonce, AnnonceFormData } from '@/types/annonce'

export type { Annonce, AnnonceFormData }

export async function createAnnonce(
  universityId: string,
  data: AnnonceFormData
): Promise<string> {
  const newRef = push(ref(db, `universities/${universityId}/annonces`))
  await set(newRef, { ...data, createdAt: Date.now() })
  return newRef.key!
}

export async function getAnnonces(universityId: string): Promise<Annonce[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/annonces`))
  if (!snapshot.exists()) return []
  const result: Annonce[] = []
  snapshot.forEach((child) => {
    result.push({ id: child.key!, ...child.val() } as Annonce)
  })
  // Plus récentes en premier.
  return result.sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteAnnonce(
  universityId: string,
  annonceId: string
): Promise<void> {
  await remove(ref(db, `universities/${universityId}/annonces/${annonceId}`))
}

// ─── Délibérations / clôture ───────────────────────────────────────────────────

export type Decision = 'Admis' | 'Redoublant' | 'Diplômé' | 'Sans notes'

export interface DeliberationEntry {
  studentUid: string
  studentNom: string
  moyenne: number | null
  decision: Decision
}

/** Enregistre les décisions de délibération d'un semestre. */
export async function saveDeliberation(
  universityId: string,
  semestreId: string,
  entries: DeliberationEntry[]
): Promise<void> {
  const payload: Record<string, unknown> = {}
  for (const e of entries) {
    payload[e.studentUid] = {
      studentNom: e.studentNom,
      moyenne: e.moyenne,
      decision: e.decision,
      updatedAt: Date.now(),
    }
  }
  await set(ref(db, `universities/${universityId}/deliberations/${semestreId}`), payload)
}

// ─── Ressources pédagogiques ───────────────────────────────────────────────────

import type { Ressource, RessourceFormData } from '@/types/ressource'
import { supprimerFichier, STORAGE_ENABLED } from './storage'

export type { Ressource, RessourceFormData }

export async function createRessource(
  universityId: string,
  data: RessourceFormData
): Promise<string> {
  const newRef = push(ref(db, `universities/${universityId}/ressources`))
  // Les champs de fichier sont optionnels : `undefined` ferait échouer set().
  await set(newRef, { ...stripUndefined(data), createdAt: Date.now() })
  return newRef.key!
}

export async function getRessources(universityId: string): Promise<Ressource[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/ressources`))
  if (!snapshot.exists()) return []
  const result: Ressource[] = []
  snapshot.forEach((child) => {
    result.push({ id: child.key!, ...child.val() } as Ressource)
  })
  return result.sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Supprime la ressource ET son fichier Storage s'il y en a un — sans quoi le
 * bucket accumulerait des fichiers orphelins, invisibles et facturés.
 * L'entrée RTDB n'est retirée qu'après la suppression du fichier : en cas
 * d'échec, la ressource reste visible et l'erreur remonte (pas de faux succès).
 *
 * Storage désactivé (STORAGE_ENABLED = false) : aucune ressource ne peut porter
 * de fichier, mais par sécurité on saute carrément l'appel Storage — un bucket
 * injoignable ne doit jamais empêcher de supprimer une ressource (qui, elle, ne
 * dépend que de la RTDB, toujours disponible).
 */
export async function deleteRessource(
  universityId: string,
  ressourceId: string
): Promise<void> {
  if (STORAGE_ENABLED) {
    const snapshot = await get(ref(db, `universities/${universityId}/ressources/${ressourceId}`))
    const fichierPath = snapshot.exists()
      ? (snapshot.val() as Ressource).fichierPath
      : undefined
    if (fichierPath) {
      await supprimerFichier(fichierPath)
    }
  }
  await remove(ref(db, `universities/${universityId}/ressources/${ressourceId}`))
}

// ─── Messagerie interne ────────────────────────────────────────────────────────

export interface Message {
  id: string
  fromUid: string
  fromNom: string
  toUid: string
  toNom: string
  sujet: string
  corps: string
  lu: boolean
  createdAt: number
}

export type MessageFormData = Omit<Message, 'id' | 'lu' | 'createdAt'>

export async function sendMessage(
  universityId: string,
  data: MessageFormData
): Promise<string> {
  const newRef = push(ref(db, `universities/${universityId}/messages`))
  await set(newRef, { ...data, lu: false, createdAt: Date.now() })
  return newRef.key!
}

/** Messages reçus OU envoyés par un utilisateur (triés récent → ancien). */
export async function getMessagesForUser(
  universityId: string,
  uid: string
): Promise<Message[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/messages`))
  if (!snapshot.exists()) return []
  const result: Message[] = []
  snapshot.forEach((child) => {
    const m = { id: child.key!, ...child.val() } as Message
    if (m.toUid === uid || m.fromUid === uid) result.push(m)
  })
  return result.sort((a, b) => b.createdAt - a.createdAt)
}

export async function markMessageRead(
  universityId: string,
  messageId: string
): Promise<void> {
  await update(ref(db, `universities/${universityId}/messages/${messageId}`), { lu: true })
}

export async function deleteMessage(
  universityId: string,
  messageId: string
): Promise<void> {
  await remove(ref(db, `universities/${universityId}/messages/${messageId}`))
}

/** Décisions déjà enregistrées pour un semestre (studentUid → décision). */
export async function getDeliberation(
  universityId: string,
  semestreId: string
): Promise<Record<string, { moyenne: number | null; decision: Decision }>> {
  const snapshot = await get(ref(db, `universities/${universityId}/deliberations/${semestreId}`))
  if (!snapshot.exists()) return {}
  return snapshot.val() as Record<string, { moyenne: number | null; decision: Decision }>
}

// ─── Anti brute-force du login (nœud racine /loginAttempts) ─────────────────────
//
// Ce suivi est GLOBAL et volontairement HORS de /universities : au moment d'une
// tentative de connexion, l'utilisateur n'est pas encore authentifié et on ne
// connaît pas son université. Le nœud /loginAttempts est donc accessible sans
// authentification (cf. database.rules.json) — c'est un compromis assumé : les
// données y sont sans valeur (juste des compteurs) et la vraie protection reste
// Firebase Auth + les règles RTDB par université.

import {
  LOGIN_LOCK_DURATION_MS,
  MAX_LOGIN_ATTEMPTS,
  type LoginAttempt,
} from '@/types/security'

export type { LoginAttempt }

/**
 * Rend un email utilisable comme clé Firebase RTDB. Les clés ne peuvent pas
 * contenir `.` `#` `$` `[` `]` `/` — or les emails contiennent des points.
 * Simple transformation réversible (pas un hash cryptographique) : on
 * normalise en minuscules puis on remplace les caractères interdits.
 */
export function hashEmailForKey(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/\./g, '_DOT_')
    .replace(/@/g, '_AT_')
    .replace(/[#$[\]/]/g, '_')
}

/**
 * Enregistre une tentative de connexion ÉCHOUÉE. Incrémente le compteur ; au
 * seuil `MAX_LOGIN_ATTEMPTS`, pose un verrou de `LOGIN_LOCK_DURATION_MS`.
 * Si un ancien verrou est déjà expiré, on repart d'un compteur neuf.
 */
export async function recordFailedLoginAttempt(
  email: string
): Promise<{ locked: boolean; lockedUntil?: number }> {
  const key = hashEmailForKey(email)
  const attemptRef = ref(db, `loginAttempts/${key}`)
  const now = Date.now()

  const snapshot = await get(attemptRef)
  const current = snapshot.exists() ? (snapshot.val() as LoginAttempt) : null

  // Un verrou expiré (ou aucun état) → on recommence à 1.
  const previousCount =
    current && (current.lockedUntil == null || current.lockedUntil > now)
      ? current.attemptsCount
      : 0
  const attemptsCount = previousCount + 1

  const lockedUntil =
    attemptsCount >= MAX_LOGIN_ATTEMPTS ? now + LOGIN_LOCK_DURATION_MS : null

  const next: LoginAttempt = {
    email: email.trim().toLowerCase(),
    attemptsCount,
    lastAttemptAt: now,
    lockedUntil,
  }
  await set(attemptRef, next)

  return lockedUntil !== null
    ? { locked: true, lockedUntil }
    : { locked: false }
}

/**
 * Vérifie si le login est verrouillé pour cet email. Si le verrou est expiré,
 * il est nettoyé automatiquement (compteur remis à zéro) et l'email est
 * considéré comme libre.
 */
export async function checkLoginLocked(
  email: string
): Promise<{ locked: boolean; remainingMinutes?: number }> {
  const key = hashEmailForKey(email)
  const attemptRef = ref(db, `loginAttempts/${key}`)
  const now = Date.now()

  const snapshot = await get(attemptRef)
  if (!snapshot.exists()) return { locked: false }

  const current = snapshot.val() as LoginAttempt
  if (current.lockedUntil && current.lockedUntil > now) {
    const remainingMinutes = Math.ceil((current.lockedUntil - now) / 60000)
    return { locked: true, remainingMinutes }
  }

  // Verrou expiré (ou jamais posé) : nettoyage automatique.
  if (current.lockedUntil && current.lockedUntil <= now) {
    await remove(attemptRef)
  }
  return { locked: false }
}

/** Remet le compteur à zéro après une connexion RÉUSSIE. */
export async function resetLoginAttempts(email: string): Promise<void> {
  const key = hashEmailForKey(email)
  await remove(ref(db, `loginAttempts/${key}`))
}

// ─── Examens (épreuves datées, nœud séparé de l'emploi du temps) ─────────────────
//
// Système complètement distinct de emploi_du_temps : un examen a une DATE précise,
// un type de session, un statut, un surveillant optionnel. Seule l'administration
// écrit (cf. database.rules.json → examens). Les champs dénormalisés (matiereNom,
// enseignantNom, surveillantNom) sont résolus ICI, à l'écriture, pour rester
// autoritaires (le client ne peut pas usurper un libellé d'affichage).

import {
  ConflitExamenError,
  findConflitsExamen,
  type ConflitExamenInfo,
  type Examen,
  type ExamenCandidat,
  type ExamenFormData,
  type StatutExamen,
  type TypeSession,
} from '@/types/examen'

export { ConflitExamenError }
export type { Examen, ExamenFormData, ConflitExamenInfo }

export interface ExamenFilters {
  filiereId?: string
  niveau?: string
  semestreId?: string
  typeSession?: TypeSession
  statut?: StatutExamen
}

/** Retire les métadonnées non stockées (l'id est la clé RTDB ; universityId est implicite). */
function stripMeta<T extends object>(obj: T): Record<string, unknown> {
  const rest = { ...obj } as Record<string, unknown>
  delete rest.id
  delete rest.universityId
  return rest
}

/**
 * Résout les libellés dénormalisés d'un examen depuis Firebase. Renvoie TOUJOURS
 * les trois clés (matiereNom, enseignantNom, surveillantNom) : une valeur
 * `undefined` explicite permet, lors d'une mise à jour, d'effacer un nom devenu
 * obsolète (ex : surveillant retiré) plutôt que de laisser traîner l'ancien.
 */
async function resolveExamenLabels(
  universityId: string,
  rec: Pick<Examen, 'filiereId' | 'matiereId' | 'enseignantUid' | 'surveillantUid'>
): Promise<{ matiereNom: string; enseignantNom: string | undefined; surveillantNom: string | undefined }> {
  const [matieres, teachers] = await Promise.all([
    getMatieres(universityId, rec.filiereId),
    getUniversityMembers(universityId, 'teacher'),
  ])
  return {
    matiereNom: matieres.find((m) => m.id === rec.matiereId)?.nom ?? '',
    enseignantNom: rec.enseignantUid
      ? teachers.find((t) => t.uid === rec.enseignantUid)?.displayName
      : undefined,
    surveillantNom: rec.surveillantUid
      ? teachers.find((t) => t.uid === rec.surveillantUid)?.displayName
      : undefined,
  }
}

/** Tous les examens de l'université, filtrés en mémoire si `filters` est fourni. */
export async function getExamens(
  universityId: string,
  filters?: ExamenFilters
): Promise<Examen[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/examens`))
  if (!snapshot.exists()) return []
  const result: Examen[] = []
  snapshot.forEach((child) => {
    result.push({ id: child.key!, universityId, ...child.val() } as Examen)
  })
  if (!filters) return result
  return result.filter(
    (e) =>
      (!filters.filiereId || e.filiereId === filters.filiereId) &&
      (!filters.niveau || e.niveau === filters.niveau) &&
      (!filters.semestreId || e.semestreId === filters.semestreId) &&
      (!filters.typeSession || e.typeSession === filters.typeSession) &&
      (!filters.statut || e.statut === filters.statut)
  )
}

/** Vue simplifiée d'un étudiant : les examens de sa filière / niveau / semestre. */
export async function getExamensEtudiant(
  universityId: string,
  filiereId: string,
  niveau: string,
  semestreId: string
): Promise<Examen[]> {
  return getExamens(universityId, { filiereId, niveau, semestreId })
}

/**
 * Détecte les conflits d'un examen candidat (même salle / même personne, à la même
 * date et sur une plage qui se chevauche). Charge tous les examens puis délègue à
 * la fonction pure `findConflitsExamen`. `excludeId` exclut l'examen en cours d'édition.
 */
export async function detectConflitsExamen(
  universityId: string,
  examen: ExamenCandidat,
  excludeId?: string
): Promise<ConflitExamenInfo[]> {
  const all = await getExamens(universityId)
  return findConflitsExamen(all, examen, excludeId)
}

export async function createExamen(
  universityId: string,
  data: ExamenFormData
): Promise<string> {
  const [all, labels] = await Promise.all([
    getExamens(universityId),
    resolveExamenLabels(universityId, data),
  ])
  // Garde autoritaire (RÈGLE 3 adaptée) : on bloque avant toute écriture.
  const conflits = findConflitsExamen(all, { ...data, ...labels })
  if (conflits.length > 0) throw new ConflitExamenError(conflits)

  const newRef = push(ref(db, `universities/${universityId}/examens`))
  const now = Date.now()
  await set(newRef, stripUndefined({ ...data, ...labels, createdAt: now, updatedAt: now }))
  return newRef.key!
}

export async function updateExamen(
  universityId: string,
  examenId: string,
  data: Partial<ExamenFormData>
): Promise<void> {
  const all = await getExamens(universityId)
  const existing = all.find((e) => e.id === examenId)
  if (!existing) throw new Error('Examen introuvable.')

  const merged: Examen = { ...existing, ...data }
  const conflits = findConflitsExamen(all, merged, examenId)
  if (conflits.length > 0) throw new ConflitExamenError(conflits)

  // Ne re-résout les libellés que si un champ source a changé (évite deux lectures
  // inutiles pour une simple mise à jour de statut, ex : annulation).
  const touchesLabels =
    'filiereId' in data || 'matiereId' in data || 'enseignantUid' in data || 'surveillantUid' in data
  const full: Examen = touchesLabels
    ? { ...merged, ...(await resolveExamenLabels(universityId, merged)), updatedAt: Date.now() }
    : { ...merged, updatedAt: Date.now() }

  // `set` (remplacement complet) : garantit qu'aucun nom dénormalisé obsolète ne
  // subsiste. stripMeta retire id/universityId ; stripUndefined efface les optionnels vidés.
  await set(
    ref(db, `universities/${universityId}/examens/${examenId}`),
    stripUndefined(stripMeta(full))
  )
}

export async function deleteExamen(
  universityId: string,
  examenId: string
): Promise<void> {
  await remove(ref(db, `universities/${universityId}/examens/${examenId}`))
}

/**
 * Retire un enseignant (par UID) des examens où il figure comme responsable et/ou
 * surveillant, SANS supprimer les examens (ils restent valides, juste sans
 * personne assignée). Vide l'uid ET le nom dénormalisé du/des rôle(s) concerné(s).
 * Appelé par removeMember lors de la suppression d'un enseignant.
 */
async function clearEnseignantOnExamens(
  universityId: string,
  examens: Examen[],
  teacherUid: string
): Promise<void> {
  const now = Date.now()
  for (const e of examens) {
    const patch: Record<string, unknown> = {}
    if (e.enseignantUid === teacherUid) {
      // `null` supprime la clé côté RTDB → champ optionnel remis à l'état « absent ».
      patch.enseignantUid = null
      patch.enseignantNom = null
    }
    if (e.surveillantUid === teacherUid) {
      patch.surveillantUid = null
      patch.surveillantNom = null
    }
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = now
      await update(ref(db, `universities/${universityId}/examens/${e.id}`), patch)
    }
  }
}

// ─── Parcours annuel & redoublement (couche additive au-dessus des notes) ────────
//
// Nœud : /universities/{universityId}/parcours/{studentUid}__{anneeAcademique}
//
// EXTENSION STRICTEMENT ADDITIVE : on n'écrit ni ne supprime JAMAIS de note ici.
// Une entrée acte la décision de fin d'année (validé/redoublé) pour un niveau et
// une année donnés. Les notes de l'année clôturée restent à leur clé d'origine,
// consultables pour toujours. Un redoublement laisse le membre sur le même niveau
// (aucune écriture membre) ; une validation ne fait progresser le niveau que si un
// niveau suivant EXPLICITE est fourni (choisi/confirmé par l'admin) — on ne devine
// jamais côté serveur.

import {
  parcoursId,
  type AnneeAcademique,
  type InfosRedoublement,
  type ParcoursAnnuel,
  type StatutParcours,
} from '@/types/parcours'

export type { ParcoursAnnuel, InfosRedoublement, AnneeAcademique, StatutParcours }

/**
 * Clôture l'année d'un étudiant : crée/met à jour son `ParcoursAnnuel` avec la
 * décision actée, sans jamais toucher à ses notes.
 *
 * - `statutDecision === 'redouble'` → le membre reste sur le MÊME niveau (aucune
 *   écriture membre) ; ses notes de l'année clôturée restent intactes.
 * - `statutDecision === 'valide'` → si `niveauSuivant` est fourni (et différent du
 *   niveau actuel), le membre progresse vers ce niveau. Sans `niveauSuivant`
 *   (ex: diplômé, ou niveau suivant indéterminé), le niveau du membre reste
 *   inchangé — on ne déduit rien automatiquement.
 *
 * L'upsert est idempotent par (étudiant, année) : re-clôturer la même année écrase
 * proprement la décision précédente en préservant `createdAt`.
 */
export async function cloturerAnneeEtudiant(
  universityId: string,
  studentUid: string,
  filiereId: string,
  niveau: string,
  anneeAcademique: AnneeAcademique,
  moyenneGenerale: number | null,
  statutDecision: 'valide' | 'redouble',
  clotureParUid: string,
  clotureParNom: string,
  niveauSuivant?: string
): Promise<void> {
  const id = parcoursId(studentUid, anneeAcademique)
  const pRef = ref(db, `universities/${universityId}/parcours/${id}`)
  const now = Date.now()

  const snapshot = await get(pRef)
  const existing = snapshot.exists() ? (snapshot.val() as Partial<ParcoursAnnuel>) : null

  // L'id et universityId ne sont pas stockés (id = clé RTDB, universityId implicite).
  // stripUndefined évite qu'une moyenne absente (sans notes) fasse échouer l'écriture.
  const record = stripUndefined({
    studentUid,
    filiereId,
    niveau,
    anneeAcademique,
    statut: statutDecision as StatutParcours,
    moyenneGenerale: moyenneGenerale ?? undefined,
    dateCloture: now,
    clotureParUid,
    clotureParNom,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  })
  await set(pRef, record)

  if (statutDecision === 'valide' && niveauSuivant && niveauSuivant !== niveau) {
    await update(ref(db, `universities/${universityId}/members/${studentUid}`), {
      niveau: niveauSuivant,
      updatedAt: now,
    })
  }
}

/** Tous les parcours annuels de l'université (filtrage en mémoire). */
async function getAllParcours(universityId: string): Promise<ParcoursAnnuel[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/parcours`))
  if (!snapshot.exists()) return []
  const result: ParcoursAnnuel[] = []
  snapshot.forEach((child) => {
    result.push({ id: child.key!, universityId, ...child.val() } as ParcoursAnnuel)
  })
  return result
}

/** Compare deux années académiques ("2025/2026" < "2026/2027" en ordre lexical). */
function compareAnnees(a: ParcoursAnnuel, b: ParcoursAnnuel): number {
  if (a.anneeAcademique !== b.anneeAcademique) {
    return a.anneeAcademique < b.anneeAcademique ? -1 : 1
  }
  return a.createdAt - b.createdAt
}

/** Historique complet d'un étudiant, trié chronologiquement (plus ancien → récent). */
export async function getParcoursEtudiant(
  universityId: string,
  studentUid: string
): Promise<ParcoursAnnuel[]> {
  const all = await getAllParcours(universityId)
  return all.filter((p) => p.studentUid === studentUid).sort(compareAnnees)
}

/**
 * Calcule à partir de la liste d'historique déjà chargée. Le niveau ACTUEL est
 * celui de l'entrée la plus récente ; on compte les fois où CE niveau a été
 * clôturé « redoublé » (un étudiant qui a redoublé L1 puis validé et passé en L2
 * n'est plus « redoublant » de son niveau courant).
 */
function computeInfosRedoublement(parcours: ParcoursAnnuel[]): InfosRedoublement {
  if (parcours.length === 0) {
    return { niveauActuel: '', nombreRedoublements: 0, anneesRedoublees: [] }
  }
  const trie = [...parcours].sort(compareAnnees)
  const niveauActuel = trie[trie.length - 1].niveau
  const redoubles = trie.filter((p) => p.niveau === niveauActuel && p.statut === 'redouble')
  return {
    niveauActuel,
    nombreRedoublements: redoubles.length,
    anneesRedoublees: redoubles.map((p) => p.anneeAcademique),
  }
}

/** Synthèse de redoublement d'un étudiant (dérivée de son historique). */
export async function getInfosRedoublement(
  universityId: string,
  studentUid: string
): Promise<InfosRedoublement> {
  const parcours = await getParcoursEtudiant(universityId, studentUid)
  return computeInfosRedoublement(parcours)
}

/**
 * Vue d'ensemble administration : étudiants actuellement en situation de
 * redoublement (niveau courant clôturé « redoublé » au moins une fois). Filtrable
 * par filière / niveau. `niveau` est renvoyé en plus des champs demandés pour
 * afficher un badge informatif sans lecture supplémentaire.
 */
export async function getEtudiantsRedoublants(
  universityId: string,
  filiereId?: string,
  niveau?: string
): Promise<Array<{ studentUid: string; displayName: string; niveau: string; nombreRedoublements: number }>> {
  const [all, membres] = await Promise.all([
    getAllParcours(universityId),
    getUniversityMembers(universityId, 'student'),
  ])
  const nomByUid = new Map(membres.map((m) => [m.uid, m.displayName]))

  // Regroupe par étudiant pour dériver sa situation courante.
  const parUid = new Map<string, ParcoursAnnuel[]>()
  for (const p of all) {
    const list = parUid.get(p.studentUid) ?? []
    list.push(p)
    parUid.set(p.studentUid, list)
  }

  const result: Array<{ studentUid: string; displayName: string; niveau: string; nombreRedoublements: number }> = []
  for (const [studentUid, list] of parUid) {
    const infos = computeInfosRedoublement(list)
    if (infos.nombreRedoublements <= 0) continue
    const dernier = [...list].sort(compareAnnees)[list.length - 1]
    if (filiereId && dernier.filiereId !== filiereId) continue
    if (niveau && infos.niveauActuel !== niveau) continue
    result.push({
      studentUid,
      displayName: nomByUid.get(studentUid) ?? '—',
      niveau: infos.niveauActuel,
      nombreRedoublements: infos.nombreRedoublements,
    })
  }
  return result.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

/**
 * Parcours déjà enregistrés pour une année académique donnée (studentUid →
 * entrée). Sert à la page de clôture pour marquer « Traité » les étudiants dont
 * l'année a déjà été clôturée et éviter un double traitement accidentel.
 */
export async function getParcoursAnnee(
  universityId: string,
  anneeAcademique: AnneeAcademique
): Promise<Record<string, ParcoursAnnuel>> {
  const all = await getAllParcours(universityId)
  const map: Record<string, ParcoursAnnuel> = {}
  for (const p of all) {
    if (p.anneeAcademique === anneeAcademique) map[p.studentUid] = p
  }
  return map
}

// ─── Cours en ligne en direct (visioconférence Jitsi) ────────────────────────────
//
// Nœud : /universities/{universityId}/sessions_direct/{sessionId}
//
// Particularité vs le reste de l'app : un écouteur TEMPS RÉEL (onValue) est exposé
// côté étudiant — voir `ecouterSessionsActives`. Les autres accès restent des
// lectures ponctuelles get(), cohérentes avec le module examens.

import type { SessionEnLigne, SessionFormData, StatutSession } from '@/types/cours-en-ligne'

export type { SessionEnLigne, SessionFormData, StatutSession }

/**
 * Génère un nom de salle Jitsi imprévisible. C'est la SEULE protection d'accès sur
 * le service public gratuit meet.jit.si : un nom devinable (ex « gestuniv-algo-lundi »)
 * laisserait n'importe qui rejoindre le cours. On préfixe l'UUID pour éviter toute
 * collision avec d'autres salles publiques du même serveur.
 */
function genererRoomName(): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : // Repli défensif si randomUUID est indisponible : deux sources aléatoires
        // concaténées. Ne devrait pas survenir (Node 16+ / navigateurs modernes).
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  return `gestuniv-${uuid}`
}

/** Reconstruit une `SessionEnLigne` depuis un snapshot RTDB (id + universityId réinjectés). */
function toSessionEnLigne(universityId: string, id: string, val: Record<string, unknown>): SessionEnLigne {
  return { id, universityId, ...val } as SessionEnLigne
}

/**
 * Crée une session en statut « programmee ». `matiereNom` et l'identité de
 * l'enseignant sont résolus par l'appelant (la page connaît déjà ces libellés
 * dénormalisés) et stockés tels quels — cohérent avec le reste du module.
 * Le `roomName` aléatoire est généré ici, jamais côté UI.
 */
export async function createSessionEnLigne(
  universityId: string,
  data: SessionFormData,
  enseignantUid: string,
  enseignantNom: string,
  matiereNom: string
): Promise<string> {
  const newRef = push(ref(db, `universities/${universityId}/sessions_direct`))
  const now = Date.now()
  const record: Omit<SessionEnLigne, 'id' | 'universityId'> = {
    filiereId: data.filiereId,
    niveau: data.niveau,
    matiereId: data.matiereId,
    matiereNom,
    enseignantUid,
    enseignantNom,
    titre: data.titre,
    roomName: genererRoomName(),
    statut: 'programmee',
    createdAt: now,
  }
  await set(newRef, record)
  return newRef.key!
}

/** Passe une session à « en_direct » et horodate le démarrage. */
export async function demarrerSession(universityId: string, sessionId: string): Promise<void> {
  await update(ref(db, `universities/${universityId}/sessions_direct/${sessionId}`), {
    statut: 'en_direct' satisfies StatutSession,
    demarreeAt: Date.now(),
  })
}

/** Passe une session à « terminee » et horodate la fin. */
export async function terminerSession(universityId: string, sessionId: string): Promise<void> {
  await update(ref(db, `universities/${universityId}/sessions_direct/${sessionId}`), {
    statut: 'terminee' satisfies StatutSession,
    termineeAt: Date.now(),
  })
}

/** Toutes les sessions créées par un enseignant (lecture ponctuelle). */
export async function getSessionsEnseignant(
  universityId: string,
  enseignantUid: string
): Promise<SessionEnLigne[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/sessions_direct`))
  if (!snapshot.exists()) return []
  const result: SessionEnLigne[] = []
  snapshot.forEach((child) => {
    const s = toSessionEnLigne(universityId, child.key!, child.val())
    if (s.enseignantUid === enseignantUid) result.push(s)
  })
  return result
}

/** Sessions destinées à un groupe filière + niveau (lecture ponctuelle). */
export async function getSessionsEtudiant(
  universityId: string,
  filiereId: string,
  niveau: string
): Promise<SessionEnLigne[]> {
  const snapshot = await get(ref(db, `universities/${universityId}/sessions_direct`))
  if (!snapshot.exists()) return []
  const result: SessionEnLigne[] = []
  snapshot.forEach((child) => {
    const s = toSessionEnLigne(universityId, child.key!, child.val())
    if (s.filiereId === filiereId && s.niveau === niveau) result.push(s)
  })
  return result
}

/**
 * Écoute EN TEMPS RÉEL les sessions d'un groupe filière + niveau. Contrairement au
 * reste de l'app (get() ponctuels), on utilise onValue() : dès qu'une session passe
 * à « en_direct », le callback est rappelé et l'étudiant voit « Rejoindre » s'activer
 * sans rafraîchir sa page. Renvoie la fonction de désabonnement à appeler au
 * démontage du composant (useEffect cleanup) pour éviter toute fuite d'écouteur.
 */
export function ecouterSessionsActives(
  universityId: string,
  filiereId: string,
  niveau: string,
  callback: (sessions: SessionEnLigne[]) => void
): Unsubscribe {
  const node = ref(db, `universities/${universityId}/sessions_direct`)
  return onValue(node, (snapshot) => {
    const result: SessionEnLigne[] = []
    snapshot.forEach((child) => {
      const s = toSessionEnLigne(universityId, child.key!, child.val())
      if (s.filiereId === filiereId && s.niveau === niveau) result.push(s)
    })
    callback(result)
  })
}
