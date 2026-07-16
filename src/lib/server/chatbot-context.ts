// ⚠️ Module SERVEUR UNIQUEMENT — ne jamais importer depuis un composant client.
//
// Construit le RÉSUMÉ TEXTE des vraies données Firebase de l'utilisateur, injecté
// dans le system prompt du chatbot pour que l'assistant réponde sur SES données
// (ses notes, son emploi du temps, ses absences…) plutôt qu'en généralités.
//
// Pourquoi ne pas appeler src/lib/db.ts ici ? db.ts s'appuie sur le SDK client
// Firebase, lié à une session navigateur : côté serveur aucun utilisateur n'est
// connecté, donc les règles RTDB rejetteraient chaque lecture. On lit donc via
// l'API REST authentifiée par l'idToken DE L'APPELANT — même mécanisme que
// lib/server/caller.ts et lib/server/members.ts. Conséquence voulue : le chatbot
// ne peut jamais lire plus que ce que l'utilisateur lui-même a le droit de lire.
//
// En revanche les RÈGLES MÉTIER sont réutilisées telles quelles depuis types/*
// (getNoteRetenue, statutAffiche, trouverProchainCours…) : les chiffres cités par
// l'assistant sont ceux des tableaux de bord, jamais un second calcul divergent.

import { getNoteRetenue, type NoteEntry } from '@/types/note'
import { statutAffiche, formatFCFA, type Paiement } from '@/types/paiement'
import { DEFAULT_SEUIL_ABSENCES, type Absence } from '@/types/absence'
import {
  JOUR_LABEL,
  trouverProchainCours,
  type Creneau,
} from '@/types/emploi-du-temps'
import type { Examen } from '@/types/examen'
import type { Semestre } from '@/types/semestre'
import type { Filiere } from '@/types/filiere'
// `import type` est effacé à la compilation : aucune dépendance Firebase client
// n'entre dans le bundle serveur.
import type { UniversityMember, Role } from '@/lib/db'
import type { CallerProfile } from './caller'

// ─── Lecture RTDB via REST ──────────────────────────────────────────────────────

function databaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_FIREBASE_DATABASE_URL manquante.')
  return url.replace(/\/$/, '')
}

/**
 * Lecture RTDB REST authentifiée par l'idToken de l'appelant. Une lecture refusée
 * ou absente renvoie `null` : le résumé dira « information indisponible » plutôt
 * que de faire échouer toute la conversation.
 */
async function dbGet<T>(path: string, idToken: string): Promise<T | null> {
  const res = await fetch(`${databaseUrl()}/${path}.json?auth=${idToken}`)
  if (!res.ok) return null
  return (await res.json()) as T | null
}

/**
 * Lecture d'une collection RTDB (objet indexé par clé) convertie en tableau, la
 * clé devenant `id` — même forme que les `get*` de db.ts, dont les types sont
 * réutilisés ici.
 */
async function dbList<T>(path: string, idToken: string): Promise<(T & { id: string })[]> {
  const data = await dbGet<Record<string, T>>(path, idToken)
  if (!data) return []
  return Object.entries(data).map(([id, value]) => ({ ...value, id }))
}

/** Membres de l'université : la clé est l'uid (et non `id`), comme dans db.ts. */
async function fetchMembers(
  universityId: string,
  idToken: string,
  role?: Role
): Promise<UniversityMember[]> {
  const data = await dbGet<Record<string, Omit<UniversityMember, 'uid'>>>(
    `universities/${universityId}/members`,
    idToken
  )
  if (!data) return []
  const members = Object.entries(data).map(([uid, value]) => ({ ...value, uid }))
  return role ? members.filter((m) => m.role === role) : members
}

/** Seuil d'absences configuré — même tolérance d'ancien format que db.ts. */
async function fetchSeuilAlerte(universityId: string, idToken: string): Promise<number> {
  const val = await dbGet<number | { seuilAbsencesInjustifiees?: number }>(
    `universities/${universityId}/config/seuilAlerte`,
    idToken
  )
  const seuil = typeof val === 'number' ? val : val?.seuilAbsencesInjustifiees
  return typeof seuil === 'number' && seuil > 0 ? seuil : DEFAULT_SEUIL_ABSENCES
}

// ─── Helpers de mise en forme ───────────────────────────────────────────────────

function todayISO(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** Note /20 lisible, sans décimales parasites (14.20 → « 14.2 »). */
function fmtNote(n: number): string {
  return `${Math.round(n * 100) / 100}/20`
}

function fmtCreneau(c: Creneau): string {
  const salle = c.salle ? `, ${c.salle}` : ''
  const ens = c.enseignant ? `, avec ${c.enseignant}` : ''
  return `${c.matiere}, ${JOUR_LABEL[c.jour]} ${c.heureDebut}-${c.heureFin}${salle}${ens}`
}

function fmtExamen(e: Examen): string {
  const salle = e.salle ? `, ${e.salle}` : ''
  return `${e.matiereNom} le ${e.date} ${e.heureDebut}-${e.heureFin}${salle}`
}

/** Examens à venir (date >= aujourd'hui), non annulés, les plus proches d'abord. */
function examensAVenir(examens: Examen[], today: string, limite = 5): Examen[] {
  return examens
    .filter((e) => e.statut !== 'annule' && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.heureDebut.localeCompare(b.heureDebut))
    .slice(0, limite)
}

/** Semestre de référence : celui en cours, sinon le premier déclaré (cf. useStudentSummary). */
function semestreDeReference(semestres: Semestre[]): Semestre | undefined {
  return semestres.find((s) => s.statut === 'en_cours') ?? semestres[0]
}

// ─── Résumé : étudiant (réutilisé tel quel pour l'enfant d'un parent) ───────────

/**
 * Reprend exactement les règles de `useStudentSummary` (semestre de référence,
 * moyenne forcée prioritaire, note retenue = rattrapage si présent, prochain
 * cours résolu par filière + niveau). Une donnée absente est annoncée comme
 * absente — jamais remplacée par un zéro ni par une valeur plausible.
 */
async function resumeEtudiant(
  universityId: string,
  studentUid: string,
  idToken: string,
  now: Date,
  /** Désigne le titulaire du dossier : « de l'étudiant » ou « de votre enfant ». */
  possessif: string
): Promise<string[]> {
  const [member, filieres, semestres, creneaux, notesAll, absencesAll, paiementsAll, seuil, examensAll] =
    await Promise.all([
      dbGet<Omit<UniversityMember, 'uid'>>(`universities/${universityId}/members/${studentUid}`, idToken),
      dbList<Filiere>(`universities/${universityId}/filieres`, idToken),
      dbList<Semestre>(`universities/${universityId}/semestres`, idToken),
      dbList<Creneau>(`universities/${universityId}/emploi_du_temps`, idToken),
      dbList<NoteEntry>(`universities/${universityId}/notes`, idToken),
      dbList<Absence>(`universities/${universityId}/absences`, idToken),
      dbList<Paiement>(`universities/${universityId}/paiements`, idToken),
      fetchSeuilAlerte(universityId, idToken),
      dbList<Examen>(`universities/${universityId}/examens`, idToken),
    ])

  const lignes: string[] = []
  const today = todayISO(now)

  const semestre = semestreDeReference(semestres)
  const semestreId = semestre?.id ?? ''
  lignes.push(`Semestre en cours : ${semestre?.nom ?? 'aucun semestre déclaré par l’université'}.`)

  const filiere = member?.filiere ? filieres.find((f) => f.nom === member.filiere) : undefined
  const niveau = member?.niveau
  lignes.push(
    `Filière / niveau : ${member?.filiere ?? 'non renseignée'} / ${niveau ?? 'non renseigné'}.`
  )

  // ── Notes et moyenne du semestre ──
  const notes = notesAll.filter((n) => n.studentUid === studentUid)
  const notesSemestre = semestreId ? notes.filter((n) => n.semestreId === semestreId) : notes

  if (notesSemestre.length === 0) {
    lignes.push(`Notes : aucune note saisie pour le moment.`)
  } else {
    const moyenneAuto =
      notesSemestre.reduce((a, n) => a + getNoteRetenue(n), 0) / notesSemestre.length

    // Moyenne forcée par un enseignant : prioritaire sur le calcul automatique.
    const moyennesManuelles = semestreId
      ? await dbGet<Record<string, number>>(
          `universities/${universityId}/moyennes/${semestreId}`,
          idToken
        )
      : null
    const moyenneManuelle = moyennesManuelles?.[studentUid] ?? null

    const moyenne = moyenneManuelle ?? moyenneAuto
    lignes.push(
      `Moyenne générale du semestre : ${fmtNote(moyenne)}${
        moyenneManuelle !== null ? ' (moyenne fixée par un enseignant)' : ''
      }, calculée sur ${notesSemestre.length} matière(s).`
    )

    const detail = notesSemestre
      .map((n) => {
        const retenue = fmtNote(getNoteRetenue(n))
        // La note de rattrapage remplace la normale, mais on garde la trace.
        const rattrapage =
          typeof n.noteRattrapage === 'number'
            ? ` (rattrapage, note initiale ${fmtNote(n.note)})`
            : ''
        return `${n.matiere} ${retenue}${rattrapage}`
      })
      .join(' ; ')
    lignes.push(`Détail des notes : ${detail}.`)
  }

  // ── Emploi du temps ──
  if (!filiere || !niveau) {
    lignes.push(
      `Emploi du temps : indisponible, la filière ou le niveau ${possessif} n’est pas renseigné dans le dossier.`
    )
  } else {
    const mesCreneaux = creneaux.filter(
      (c) =>
        c.filiereId === filiere.id &&
        c.niveau === niveau &&
        (!semestreId || c.semestreId === semestreId)
    )
    if (mesCreneaux.length === 0) {
      lignes.push(`Emploi du temps : aucun cours programmé pour cette classe.`)
    } else {
      const prochain = trouverProchainCours(mesCreneaux, now)
      lignes.push(`Prochain cours : ${prochain ? fmtCreneau(prochain) : 'aucun à venir cette semaine'}.`)
      lignes.push(
        `Emploi du temps de la semaine : ${mesCreneaux.map(fmtCreneau).join(' ; ')}.`
      )
    }
  }

  // ── Absences ──
  const absences = absencesAll.filter((a) => a.studentUid === studentUid)
  const injustifiees = absences.filter((a) => !a.justifiee).length
  if (absences.length === 0) {
    lignes.push(`Absences : aucune absence enregistrée.`)
  } else {
    const alerte =
      injustifiees >= seuil
        ? ` Le seuil d’alerte de l’université (${seuil} absences injustifiées) est atteint.`
        : ''
    lignes.push(
      `Absences : ${absences.length} au total, dont ${injustifiees} injustifiée(s).${alerte}`
    )
  }

  // ── Examens à venir ──
  if (!filiere || !niveau) {
    lignes.push(`Examens à venir : indisponibles (filière ou niveau non renseigné).`)
  } else {
    const mesExamens = examensAVenir(
      examensAll.filter(
        (e) =>
          e.filiereId === filiere.id &&
          e.niveau === niveau &&
          (!semestreId || e.semestreId === semestreId)
      ),
      today
    )
    lignes.push(
      mesExamens.length === 0
        ? `Examens à venir : aucun examen programmé.`
        : `Examens à venir : ${mesExamens.map(fmtExamen).join(' ; ')}.`
    )
  }

  // ── Paiements ──
  const paiements = paiementsAll.filter((p) => p.studentUid === studentUid)
  if (paiements.length === 0) {
    lignes.push(`Paiements : aucune échéance enregistrée.`)
  } else {
    const impayes = paiements.filter((p) => p.statut !== 'Payé')
    const soldeDu = impayes.reduce((a, p) => a + p.montant, 0)
    const enRetard = paiements.filter((p) => statutAffiche(p, today) === 'En retard').length
    lignes.push(
      `Paiements : solde dû ${formatFCFA(soldeDu)} sur ${impayes.length} échéance(s) non réglée(s), dont ${enRetard} en retard.`
    )
  }

  return lignes.map((l) => `- ${l}`)
}

// ─── Résumé : enseignant ────────────────────────────────────────────────────────

/**
 * Reprend les règles de `useTeacherSummary` : l'affectation enseignant ↔ cours se
 * fait par NOM dans les créneaux (`creneau.enseignant === displayName`), comme
 * partout ailleurs dans l'app. Un enseignant dont le nom ne correspond à aucun
 * créneau voit des compteurs à zéro — c'est la vérité, pas une erreur.
 */
async function resumeEnseignant(
  universityId: string,
  teacherUid: string,
  idToken: string,
  now: Date
): Promise<string[]> {
  const [member, semestres, creneaux, absencesAll, examensAll] = await Promise.all([
    dbGet<Omit<UniversityMember, 'uid'>>(`universities/${universityId}/members/${teacherUid}`, idToken),
    dbList<Semestre>(`universities/${universityId}/semestres`, idToken),
    dbList<Creneau>(`universities/${universityId}/emploi_du_temps`, idToken),
    dbList<Absence>(`universities/${universityId}/absences`, idToken),
    dbList<Examen>(`universities/${universityId}/examens`, idToken),
  ])

  const lignes: string[] = []
  const today = todayISO(now)
  const teacherName = member?.displayName ?? ''

  const semestre = semestreDeReference(semestres)
  const semestreId = semestre?.id ?? ''
  lignes.push(`Semestre en cours : ${semestre?.nom ?? 'aucun semestre déclaré par l’université'}.`)

  const mesCreneaux = creneaux.filter(
    (c) => c.enseignant === teacherName && (!semestreId || c.semestreId === semestreId)
  )

  if (mesCreneaux.length === 0) {
    lignes.push(`Cours assignés : aucun créneau ne vous est assigné pour ce semestre.`)
  } else {
    const matieres = [...new Set(mesCreneaux.map((c) => c.matiere))]
    const classes = new Set(mesCreneaux.map((c) => `${c.filiereId}__${c.niveau}`))
    lignes.push(
      `Charge : ${matieres.length} matière(s) — ${matieres.join(', ')} — sur ${classes.size} classe(s).`
    )
    const prochain = trouverProchainCours(mesCreneaux, now)
    lignes.push(`Prochain cours : ${prochain ? fmtCreneau(prochain) : 'aucun à venir cette semaine'}.`)
    lignes.push(`Emploi du temps de la semaine : ${mesCreneaux.map(fmtCreneau).join(' ; ')}.`)

    // Absences à traiter : injustifiées, sur une matière que l'enseignant assure.
    const mesMatieres = new Set(matieres)
    const aTraiter = absencesAll.filter(
      (a) => !a.justifiee && a.matiere && mesMatieres.has(a.matiere)
    ).length
    lignes.push(
      aTraiter === 0
        ? `Absences à traiter : aucune absence injustifiée sur vos matières.`
        : `Absences à traiter : ${aTraiter} absence(s) injustifiée(s) sur vos matières.`
    )
  }

  // Examens où l'enseignant est responsable ou surveillant.
  const mesExamens = examensAVenir(
    examensAll.filter(
      (e) => e.enseignantUid === teacherUid || e.surveillantUid === teacherUid
    ),
    today
  )
  lignes.push(
    mesExamens.length === 0
      ? `Examens à venir : aucun examen où vous êtes responsable ou surveillant.`
      : `Examens à venir (responsable ou surveillant) : ${mesExamens.map(fmtExamen).join(' ; ')}.`
  )

  return lignes.map((l) => `- ${l}`)
}

// ─── Résumé : admin ─────────────────────────────────────────────────────────────

async function resumeAdmin(
  universityId: string,
  idToken: string,
  now: Date
): Promise<string[]> {
  const [members, filieres, semestres, absencesAll, examensAll, seuil] = await Promise.all([
    fetchMembers(universityId, idToken),
    dbList<Filiere>(`universities/${universityId}/filieres`, idToken),
    dbList<Semestre>(`universities/${universityId}/semestres`, idToken),
    dbList<Absence>(`universities/${universityId}/absences`, idToken),
    dbList<Examen>(`universities/${universityId}/examens`, idToken),
    fetchSeuilAlerte(universityId, idToken),
  ])

  const lignes: string[] = []
  const today = todayISO(now)

  const semestre = semestreDeReference(semestres)
  lignes.push(`Semestre en cours : ${semestre?.nom ?? 'aucun semestre déclaré'}.`)

  const etudiants = members.filter((m) => m.role === 'student')
  const enseignants = members.filter((m) => m.role === 'teacher')
  const parents = members.filter((m) => m.role === 'parent')
  lignes.push(
    `Effectifs : ${etudiants.length} étudiant(s), ${enseignants.length} enseignant(s), ${parents.length} parent(s), ${filieres.length} filière(s).`
  )
  lignes.push(
    filieres.length === 0
      ? `Filières : aucune filière créée.`
      : `Filières : ${filieres.map((f) => f.nom).join(', ')}.`
  )

  // Alerte absences : étudiants au-delà du seuil d'injustifiées.
  const injustifieesParEtudiant = new Map<string, number>()
  for (const a of absencesAll) {
    if (a.justifiee) continue
    injustifieesParEtudiant.set(a.studentUid, (injustifieesParEtudiant.get(a.studentUid) ?? 0) + 1)
  }
  const nomParUid = new Map(etudiants.map((e) => [e.uid, e.displayName]))
  const enAlerte = [...injustifieesParEtudiant.entries()]
    .filter(([, n]) => n >= seuil)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([uid, n]) => `${nomParUid.get(uid) ?? uid} (${n})`)

  lignes.push(
    enAlerte.length === 0
      ? `Alertes absences : aucun étudiant au-dessus du seuil de ${seuil} absences injustifiées.`
      : `Alertes absences (seuil ${seuil} injustifiées) : ${enAlerte.join(', ')}.`
  )

  const prochains = examensAVenir(examensAll, today)
  lignes.push(
    prochains.length === 0
      ? `Examens à venir : aucun examen programmé.`
      : `Examens à venir : ${prochains.map(fmtExamen).join(' ; ')}.`
  )

  return lignes.map((l) => `- ${l}`)
}

// ─── Point d'entrée ─────────────────────────────────────────────────────────────

/**
 * Enfant d'un parent, VÉRIFIÉ côté serveur : on ne fait jamais confiance à l'uid
 * envoyé par le client. `enfantUid` n'est retenu que s'il désigne bien un étudiant
 * rattaché à ce parent ; sinon on retombe sur le premier enfant lié (même ordre
 * que le sélecteur du tableau de bord parent).
 */
async function resoudreEnfant(
  universityId: string,
  parentUid: string,
  idToken: string,
  enfantUid?: string
): Promise<UniversityMember | null> {
  const students = await fetchMembers(universityId, idToken, 'student')
  const mine = students.filter((s) => s.parentUid === parentUid)
  if (enfantUid) {
    const demande = mine.find((c) => c.uid === enfantUid)
    if (demande) return demande
  }
  return mine[0] ?? null
}

/** Contexte en cache : le résumé texte et sa date de péremption. */
interface CacheEntry {
  resume: string
  expiresAt: number
}

/**
 * Le résumé est stable à l'échelle d'une conversation : on ne relit pas Firebase à
 * chaque message. Cache en mémoire, TTL court (les notes/absences peuvent changer
 * pendant la session). Volontairement « best effort » : en environnement
 * serverless chaque instance a son propre cache, un défaut de cache ne coûte
 * qu'une relecture.
 */
const CACHE_TTL_MS = 5 * 60 * 1000
const MAX_CACHE_ENTRIES = 500
const cache = new Map<string, CacheEntry>()

function cacheGet(key: string, now: number): string | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= now) {
    cache.delete(key)
    return null
  }
  return entry.resume
}

function cacheSet(key: string, resume: string, now: number): void {
  // Garde-fou mémoire : purge la plus ancienne entrée insérée (Map = ordre d'insertion).
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { resume, expiresAt: now + CACHE_TTL_MS })
}

/**
 * Résumé texte des vraies données de l'appelant, selon son rôle, prêt à être
 * injecté dans le system prompt. Renvoie `null` si le rôle n'a pas de données
 * personnelles à charger (super admin) — l'assistant reste alors utilisable pour
 * les questions générales sur le fonctionnement de l'application.
 *
 * Ne lève jamais : un échec de lecture renvoie `null` plutôt que de casser le
 * chatbot. Le system prompt indique alors explicitement au modèle qu'il ne
 * dispose d'aucune donnée personnelle, ce qui l'empêche d'en inventer.
 */
export async function buildUserDataSummary(
  caller: CallerProfile,
  idToken: string,
  options: { enfantUid?: string } = {}
): Promise<string | null> {
  const now = new Date()
  const cacheKey = `${caller.uid}:${caller.universityId}:${options.enfantUid ?? ''}`
  const cached = cacheGet(cacheKey, now.getTime())
  if (cached !== null) return cached

  try {
    let lignes: string[] | null = null

    switch (caller.role) {
      case 'student':
        lignes = await resumeEtudiant(
          caller.universityId,
          caller.uid,
          idToken,
          now,
          'de l’étudiant'
        )
        break

      case 'teacher':
        lignes = await resumeEnseignant(caller.universityId, caller.uid, idToken, now)
        break

      case 'parent': {
        const enfant = await resoudreEnfant(
          caller.universityId,
          caller.uid,
          idToken,
          options.enfantUid
        )
        if (!enfant) {
          lignes = ['- Aucun enfant n’est rattaché à votre compte pour le moment.']
          break
        }
        const detail = await resumeEtudiant(
          caller.universityId,
          enfant.uid,
          idToken,
          now,
          'de votre enfant'
        )
        lignes = [
          `- Les données ci-dessous concernent votre enfant ${enfant.displayName}.`,
          ...detail,
        ]
        break
      }

      case 'admin_universite':
        lignes = await resumeAdmin(caller.universityId, idToken, now)
        break

      default:
        // super_admin_plateforme (ou rôle inconnu) : aucune donnée scolaire propre.
        return null
    }

    const resume = lignes.join('\n')
    cacheSet(cacheKey, resume, now.getTime())
    return resume
  } catch (err) {
    // Pas de faux contexte : mieux vaut aucune donnée qu'un résumé partiel qui
    // pousserait le modèle à combler les trous.
    console.error('chatbot-context : chargement des données utilisateur échoué', err)
    return null
  }
}
