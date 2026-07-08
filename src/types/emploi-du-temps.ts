// Emploi du temps : créneaux de cours liés à une filière + niveau + semestre.
// Modèle « classe » : tous les étudiants d'une même filière/niveau partagent
// la même grille (saisie une seule fois par l'admin).

export type JourSemaine = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi'

/** Jours ouvrés, dans l'ordre d'affichage de la grille. */
export const JOURS: JourSemaine[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

export const JOUR_LABEL: Record<JourSemaine, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
  samedi: 'Samedi',
}

export interface Creneau {
  id: string
  filiereId: string
  niveau: string
  semestreId: string
  jour: JourSemaine
  /** Heure de début au format 'HH:MM'. */
  heureDebut: string
  /** Heure de fin au format 'HH:MM'. */
  heureFin: string
  /** Nom de la matière (issu des matières de la filière). */
  matiere: string
  salle: string
  /** Nom de l'enseignant (optionnel). */
  enseignant: string
  createdAt: number
  updatedAt: number
}

export type CreneauFormData = Omit<Creneau, 'id' | 'createdAt' | 'updatedAt'>

// ─── Détection de conflits (RÈGLE 3) ────────────────────────────────────────────
// Deux créneaux entrent en conflit lorsqu'ils se chevauchent le même jour DANS LE
// MÊME SEMESTRE et partagent : la même salle, le même enseignant, ou le même
// groupe (filière + niveau). Le semestre borne la comparaison car deux semestres
// couvrent des périodes distinctes de l'année — une salle réutilisée en S1 et S2
// au même horaire n'est donc pas un vrai conflit.

export type ConflitType = 'salle' | 'enseignant' | 'groupe'

export interface ConflitInfo {
  type: ConflitType
  creneauExistant: Creneau
  message: string
}

/** Champs strictement nécessaires pour tester un créneau candidat. */
export type CreneauCandidat = Pick<
  Creneau,
  'jour' | 'heureDebut' | 'heureFin' | 'salle' | 'enseignant' | 'filiereId' | 'niveau' | 'semestreId'
>

/**
 * Deux plages « HH:MM » se chevauchent si l'une commence avant que l'autre ne
 * finisse (comparaison de chaînes fiable car le format est constant).
 */
function seChevauchent(aDebut: string, aFin: string, bDebut: string, bFin: string): boolean {
  return aDebut < bFin && aFin > bDebut
}

/**
 * Détection pure (sans I/O) : compare un créneau candidat à une liste déjà
 * chargée. Réutilisable côté UI (feedback instantané) et côté db.ts (garde
 * autoritaire avant écriture). `excludeId` ignore le créneau en cours d'édition.
 */
export function findConflits(
  creneaux: Creneau[],
  candidat: CreneauCandidat,
  excludeId?: string
): ConflitInfo[] {
  const conflits: ConflitInfo[] = []
  const salle = candidat.salle.trim().toLowerCase()
  const enseignant = candidat.enseignant.trim().toLowerCase()

  for (const c of creneaux) {
    if (c.id === excludeId) continue
    if (c.jour !== candidat.jour) continue
    if (c.semestreId !== candidat.semestreId) continue
    if (!seChevauchent(candidat.heureDebut, candidat.heureFin, c.heureDebut, c.heureFin)) continue

    const plage = `${JOUR_LABEL[c.jour]} ${c.heureDebut}–${c.heureFin}`

    if (salle && c.salle.trim().toLowerCase() === salle) {
      conflits.push({
        type: 'salle',
        creneauExistant: c,
        message: `Salle « ${c.salle} » déjà occupée par « ${c.matiere} » (${plage}).`,
      })
    }
    if (enseignant && c.enseignant.trim().toLowerCase() === enseignant) {
      conflits.push({
        type: 'enseignant',
        creneauExistant: c,
        message: `${c.enseignant} a déjà « ${c.matiere} » (${plage}).`,
      })
    }
    if (c.filiereId === candidat.filiereId && c.niveau === candidat.niveau) {
      conflits.push({
        type: 'groupe',
        creneauExistant: c,
        message: `Ce groupe a déjà « ${c.matiere} » (${plage}).`,
      })
    }
  }

  return conflits
}

/** Erreur levée par db.ts quand une écriture violerait la RÈGLE 3. */
export class ConflitError extends Error {
  readonly conflits: ConflitInfo[]
  constructor(conflits: ConflitInfo[]) {
    super(conflits[0]?.message ?? 'Conflit d’emploi du temps détecté.')
    this.name = 'ConflitError'
    this.conflits = conflits
  }
}
