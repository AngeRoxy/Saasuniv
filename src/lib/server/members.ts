// ⚠️ Module SERVEUR UNIQUEMENT — ne jamais importer depuis un composant client.
// Contient la génération du mot de passe temporaire et la création de comptes
// par l'administration. La logique reste côté serveur (Route Handler) afin de
// protéger la génération du mot de passe (contrainte technique du cahier).
//
// Ce projet n'a PAS firebase-admin. On crée donc le compte Auth via l'API REST
// Identity Toolkit et on écrit dans la Realtime Database via son API REST. Cela
// évite de connecter l'admin en tant que nouvel utilisateur (effet de bord du
// SDK client `createUserWithEmailAndPassword`).

import type { CreatableRole, MemberStatus } from '@/types/member'
import { ROLE_LABELS_FR, type MemberRole } from '@/types/member'
import { sendAccessEmail } from './email'

const IDENTITY_BASE = 'https://identitytoolkit.googleapis.com/v1'

function apiKey(): string {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!key) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY manquante.')
  return key
}

function databaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_FIREBASE_DATABASE_URL manquante.')
  return url.replace(/\/$/, '')
}

// ─── Mot de passe temporaire ────────────────────────────────────────────────
//
// 10 caractères = 3 majuscules + 3 chiffres + 2 minuscules + 2 symboles,
// puis mélangés. Utilise crypto.getRandomValues (jamais Math.random).

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'
const SYMBOLS = '!@#$'

function pick(charset: string, count: number): string[] {
  const out: string[] = []
  const rand = new Uint32Array(count)
  crypto.getRandomValues(rand)
  for (let i = 0; i < count; i++) {
    out.push(charset[rand[i] % charset.length])
  }
  return out
}

function shuffle<T>(arr: T[]): T[] {
  const rand = new Uint32Array(arr.length)
  crypto.getRandomValues(rand)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand[i] % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function generateTempPassword(): string {
  const chars = [
    ...pick(UPPER, 3),
    ...pick(DIGITS, 3),
    ...pick(LOWER, 2),
    ...pick(SYMBOLS, 2),
  ]
  return shuffle(chars).join('')
}

// ─── Helpers REST ───────────────────────────────────────────────────────────

interface SignUpResult {
  uid: string
  idToken: string
}

async function authSignUp(email: string, password: string): Promise<SignUpResult> {
  const res = await fetch(`${IDENTITY_BASE}/accounts:signUp?key=${apiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const data = (await res.json()) as {
    localId?: string
    idToken?: string
    error?: { message?: string }
  }
  if (!res.ok || !data.localId || !data.idToken) {
    throw new Error(data.error?.message ?? 'AUTH_SIGNUP_FAILED')
  }
  return { uid: data.localId, idToken: data.idToken }
}

async function authDelete(idToken: string): Promise<void> {
  await fetch(`${IDENTITY_BASE}/accounts:delete?key=${apiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  }).catch(() => {
    /* best-effort rollback */
  })
}

/** Écriture RTDB REST (PUT = remplacement) authentifiée par un idToken. */
async function dbPut(path: string, idToken: string, value: unknown): Promise<void> {
  const res = await fetch(`${databaseUrl()}/${path}.json?auth=${idToken}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`DB_PUT_FAILED ${path}: ${res.status} ${detail}`)
  }
}

/** Mise à jour RTDB REST (PATCH = fusion) authentifiée par un idToken. */
async function dbPatch(path: string, idToken: string, value: object): Promise<void> {
  const res = await fetch(`${databaseUrl()}/${path}.json?auth=${idToken}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`DB_PATCH_FAILED ${path}: ${res.status} ${detail}`)
  }
}

async function dbGet<T>(path: string, idToken: string): Promise<T | null> {
  const res = await fetch(`${databaseUrl()}/${path}.json?auth=${idToken}`)
  if (!res.ok) return null
  return (await res.json()) as T | null
}

// ─── createMemberByAdmin ────────────────────────────────────────────────────

export interface CreateMemberByAdminParams {
  universityId: string
  email: string
  displayName: string
  role: CreatableRole
  filiere?: string // étudiant : filière unique (nom)
  filiereIds?: string[] // enseignant : IDs des filières où il intervient
  niveau?: string
  telephone?: string
  matricule?: string
  chargeHoraire?: number
  matieres?: string[]
  parentUid?: string
  enfantUids?: string[]
  nomUniversite: string
  loginUrl: string
  /** idToken de l'admin appelant : satisfait les règles d'écriture sur /members. */
  adminIdToken: string
}

export interface CreateMemberByAdminResult {
  uid: string
  tempPassword: string
  emailSent: boolean
}

/**
 * Crée un compte membre (enseignant / étudiant / parent) avec un mot de passe
 * temporaire, écrit les noeuds Firebase, lie parent↔enfant, et envoie l'email
 * d'accès (non bloquant). Rollback complet (suppression du compte Auth) si une
 * écriture obligatoire échoue.
 */
export async function createMemberByAdmin(
  params: CreateMemberByAdminParams
): Promise<CreateMemberByAdminResult> {
  const tempPassword = generateTempPassword()
  const now = Date.now()

  // a. Création du compte Auth (REST, n'affecte pas la session admin).
  const { uid, idToken } = await authSignUp(params.email, tempPassword)

  try {
    // b. /users/{uid} — doit être écrit AVEC le token du nouvel utilisateur
    //    (règle : auth.uid === uid). statut première connexion.
    await dbPut(`users/${uid}`, idToken, {
      email: params.email,
      displayName: params.displayName,
      role: params.role as MemberRole,
      universityId: params.universityId,
      statut: 'premiere_connexion' as MemberStatus,
      premiereConnexion: true,
      createdAt: now,
    })

    // c. /universities/{id}/members/{uid} — écrit avec le token ADMIN
    //    (règle : admin_universite autorisé).
    const memberData: Record<string, unknown> = {
      email: params.email,
      displayName: params.displayName,
      role: params.role as MemberRole,
      statut: 'premiere_connexion' as MemberStatus,
      premiereConnexion: true,
      createdAt: now,
      updatedAt: now,
    }
    if (params.filiere) memberData.filiere = params.filiere
    // Enseignant : tableau complet d'IDs de filières (jamais un ajout partiel).
    if (params.filiereIds?.length) memberData.filiereIds = params.filiereIds
    if (params.niveau) memberData.niveau = params.niveau
    if (params.telephone) memberData.telephone = params.telephone
    if (params.matricule) memberData.matricule = params.matricule
    // 0 est une valeur valide → on teste `!== undefined`, pas la véracité.
    if (params.chargeHoraire !== undefined) memberData.chargeHoraire = params.chargeHoraire
    if (params.matieres?.length) memberData.matieres = params.matieres
    if (params.parentUid) memberData.parentUid = params.parentUid
    if (params.enfantUids?.length) memberData.enfantUids = params.enfantUids

    await dbPut(
      `universities/${params.universityId}/members/${uid}`,
      params.adminIdToken,
      memberData
    )

    // d. Liaison étudiant → parent : ajouter l'uid à enfantUids du parent.
    if (params.role === 'student' && params.parentUid) {
      const existing =
        (await dbGet<string[]>(
          `universities/${params.universityId}/members/${params.parentUid}/enfantUids`,
          params.adminIdToken
        )) ?? []
      if (!existing.includes(uid)) {
        await dbPatch(
          `universities/${params.universityId}/members/${params.parentUid}`,
          params.adminIdToken,
          { enfantUids: [...existing, uid], updatedAt: now }
        )
      }
    }

    // e. Liaison parent → enfants : poser parentUid sur chaque étudiant listé.
    if (params.role === 'parent' && params.enfantUids?.length) {
      for (const enfantUid of params.enfantUids) {
        await dbPatch(
          `universities/${params.universityId}/members/${enfantUid}`,
          params.adminIdToken,
          { parentUid: uid, updatedAt: now }
        )
      }
    }
  } catch (err) {
    // g. Rollback : supprimer le compte Auth créé pour éviter un orphelin.
    await authDelete(idToken)
    throw err
  }

  // f. Email d'accès (NON bloquant — n'échoue jamais la création).
  const { success: emailSent } = await sendAccessEmail({
    to: params.email,
    displayName: params.displayName,
    nomUniversite: params.nomUniversite,
    role: ROLE_LABELS_FR[params.role as MemberRole] ?? params.role,
    email: params.email,
    tempPassword,
    loginUrl: params.loginUrl,
  })

  return { uid, tempPassword, emailSent }
}

// ─── Vérification de l'appelant (admin) ─────────────────────────────────────

interface CallerProfile {
  role?: MemberRole
  universityId?: string
}

/**
 * Vérifie qu'un appelant (via son idToken) est bien admin_universite de
 * l'université ciblée (ou super_admin). Retourne son profil si autorisé.
 */
export async function assertAdminCaller(
  callerUid: string,
  callerIdToken: string,
  universityId: string
): Promise<CallerProfile | null> {
  const profile = await dbGet<CallerProfile>(`users/${callerUid}`, callerIdToken)
  if (!profile) return null
  if (profile.role === 'super_admin_plateforme') return profile
  if (profile.role === 'admin_universite' && profile.universityId === universityId) {
    return profile
  }
  return null
}
