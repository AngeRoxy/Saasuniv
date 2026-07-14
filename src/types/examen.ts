// Examens : épreuves datées, distinctes de l'emploi du temps de cours régulier.
//
// Différences clés avec un créneau de cours (emploi-du-temps.ts) :
// - un examen a une DATE précise ('YYYY-MM-DD'), pas une récurrence hebdomadaire ;
// - il peut mobiliser un SURVEILLANT en plus de l'enseignant responsable ;
// - il porte un TYPE DE SESSION (normale / rattrapage) et un STATUT de cycle de vie.
// Nœud Firebase dédié : /universities/{universityId}/examens/{examenId}
// (aucun lien avec emploi_du_temps — système complètement séparé).

export type TypeSession = 'normale' | 'rattrapage'

export type StatutExamen = 'planifie' | 'en_cours' | 'termine' | 'annule'

export interface Examen {
  id: string
  universityId: string
  filiereId: string
  niveau: string
  matiereId: string
  /** Nom de la matière dénormalisé (résolu à l'écriture, pas saisi). */
  matiereNom: string
  /** Date de l'épreuve au format 'YYYY-MM-DD'. */
  date: string
  /** Heure de début 'HH:mm'. */
  heureDebut: string
  /** Heure de fin 'HH:mm'. */
  heureFin: string
  /** Salle saisie librement par l'administration (souvent un amphi). */
  salle: string
  enseignantUid?: string
  /** Nom de l'enseignant responsable, dénormalisé. */
  enseignantNom?: string
  surveillantUid?: string
  /** Nom du surveillant, dénormalisé. */
  surveillantNom?: string
  typeSession: TypeSession
  semestreId: string
  statut: StatutExamen
  /** Consignes particulières (matériel autorisé, documents, etc.). */
  instructions?: string
  createdAt: number
  updatedAt: number
}

/**
 * Données saisies dans le formulaire admin : l'`Examen` sans son id, son
 * universityId, ses timestamps NI ses champs dénormalisés (matiereNom /
 * enseignantNom / surveillantNom), qui sont résolus côté db.ts à l'écriture.
 */
export type ExamenFormData = Omit<
  Examen,
  'id' | 'universityId' | 'createdAt' | 'updatedAt' | 'matiereNom' | 'enseignantNom' | 'surveillantNom'
>

// ─── Libellés d'affichage (source unique, aucun hardcode dispersé dans l'UI) ─────

export const TYPE_SESSION_LABELS: Record<TypeSession, string> = {
  normale: 'Session normale',
  rattrapage: 'Rattrapage',
}

export const TYPE_SESSION_OPTIONS: { value: TypeSession; label: string }[] = [
  { value: 'normale', label: 'Session normale' },
  { value: 'rattrapage', label: 'Rattrapage' },
]

export const TYPE_SESSION_STYLES: Record<TypeSession, string> = {
  normale: 'bg-orange-500/15 border-orange-500/30 text-blue-700 dark:text-orange-300',
  rattrapage: 'bg-purple-500/15 border-purple-500/30 text-blue-700 dark:text-purple-300',
}

export const STATUT_EXAMEN_LABELS: Record<StatutExamen, string> = {
  planifie: 'Planifié',
  en_cours: 'En cours',
  termine: 'Terminé',
  annule: 'Annulé',
}

export const STATUT_EXAMEN_STYLES: Record<StatutExamen, string> = {
  planifie: 'bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300',
  en_cours: 'bg-orange-500/15 border-orange-500/30 text-blue-700 dark:text-orange-300',
  termine: 'bg-zinc-700/30 border-white/10 text-zinc-600 dark:text-zinc-400',
  annule: 'bg-red-500/15 border-red-500/30 text-red-300',
}

// ─── Helpers de date ─────────────────────────────────────────────────────────────
// Les dates d'examen sont des chaînes 'YYYY-MM-DD'. On les parse en date LOCALE
// (et non UTC via `new Date('YYYY-MM-DD')`) pour éviter tout décalage d'un jour à
// l'affichage selon le fuseau.

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** Date du jour au format 'YYYY-MM-DD' (fuseau local). */
export function todayISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Libellé long et lisible d'une date d'examen (ex: « jeudi 15 janvier 2026 »). */
export function formatDateLong(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Nombre de jours (entier) entre aujourd'hui et la date de l'examen.
 * 0 = aujourd'hui, valeur négative = déjà passé.
 */
export function joursRestants(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = parseLocalDate(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

/**
 * Un examen est « imminent » s'il a lieu dans les 7 prochains jours (aujourd'hui
 * inclus) et n'est pas annulé — sert à créer un sentiment d'urgence côté étudiant.
 */
export function estImminent(examen: Pick<Examen, 'date' | 'statut'>): boolean {
  if (examen.statut === 'annule') return false
  const j = joursRestants(examen.date)
  return j >= 0 && j <= 7
}

/** Tri chronologique stable : par date puis par heure de début. */
export function compareExamens(a: Examen, b: Examen): number {
  return a.date.localeCompare(b.date) || a.heureDebut.localeCompare(b.heureDebut)
}

// ─── Détection de conflits ───────────────────────────────────────────────────────
// Adaptée de la RÈGLE 3 de l'emploi du temps (emploi-du-temps.ts), mais bornée à
// une DATE précise plutôt qu'à un jour de semaine récurrent. Deux examens sont en
// conflit quand ils se chevauchent LE MÊME JOUR et partagent : la même salle, ou
// une même personne (l'enseignant OU le surveillant du candidat déjà mobilisé sur
// l'autre épreuve, quel que soit son rôle). Un examen annulé ne bloque jamais.

export type ConflitExamenType = 'salle' | 'enseignant' | 'surveillant'

export interface ConflitExamenInfo {
  type: ConflitExamenType
  examenExistant: Examen
  message: string
}

/** Champs strictement nécessaires pour tester un examen candidat. */
export type ExamenCandidat = Pick<
  Examen,
  'date' | 'heureDebut' | 'heureFin' | 'salle' | 'enseignantUid' | 'surveillantUid' | 'enseignantNom' | 'surveillantNom'
>

/** Deux plages « HH:mm » se chevauchent si l'une commence avant que l'autre finisse. */
function seChevauchent(aDebut: string, aFin: string, bDebut: string, bFin: string): boolean {
  return aDebut < bFin && aFin > bDebut
}

/**
 * Détection pure (sans I/O) : compare un examen candidat à une liste déjà chargée.
 * Réutilisable côté UI (feedback instantané) et côté db.ts (garde autoritaire
 * avant écriture). `excludeId` ignore l'examen en cours d'édition.
 */
export function findConflitsExamen(
  examens: Examen[],
  candidat: ExamenCandidat,
  excludeId?: string
): ConflitExamenInfo[] {
  const conflits: ConflitExamenInfo[] = []
  const salle = candidat.salle.trim().toLowerCase()

  for (const e of examens) {
    if (e.id === excludeId) continue
    if (e.statut === 'annule') continue // une épreuve annulée libère salle & personnes
    if (e.date !== candidat.date) continue
    if (!seChevauchent(candidat.heureDebut, candidat.heureFin, e.heureDebut, e.heureFin)) continue

    const plage = `le ${e.date} de ${e.heureDebut} à ${e.heureFin}`
    const personnesExistant = [e.enseignantUid, e.surveillantUid].filter(Boolean) as string[]

    if (salle && e.salle.trim().toLowerCase() === salle) {
      conflits.push({
        type: 'salle',
        examenExistant: e,
        message: `Salle « ${e.salle} » déjà réservée pour l'examen de « ${e.matiereNom} » ${plage}.`,
      })
    }
    if (candidat.enseignantUid && personnesExistant.includes(candidat.enseignantUid)) {
      conflits.push({
        type: 'enseignant',
        examenExistant: e,
        message: `${candidat.enseignantNom ?? "L'enseignant responsable"} est déjà mobilisé sur l'examen de « ${e.matiereNom} » ${plage}.`,
      })
    }
    if (candidat.surveillantUid && personnesExistant.includes(candidat.surveillantUid)) {
      conflits.push({
        type: 'surveillant',
        examenExistant: e,
        message: `${candidat.surveillantNom ?? 'Le surveillant'} est déjà mobilisé sur l'examen de « ${e.matiereNom} » ${plage}.`,
      })
    }
  }

  return conflits
}

/** Erreur levée par db.ts quand une écriture violerait la détection de conflits. */
export class ConflitExamenError extends Error {
  readonly conflits: ConflitExamenInfo[]
  constructor(conflits: ConflitExamenInfo[]) {
    super(conflits[0]?.message ?? "Conflit d'examen détecté.")
    this.name = 'ConflitExamenError'
    this.conflits = conflits
  }
}
