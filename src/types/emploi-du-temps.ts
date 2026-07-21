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

  // ── Remplacement PONCTUEL d'enseignant ──────────────────────────────────────
  // Un titulaire absent est couvert par un autre enseignant pour UNE occurrence
  // seulement (le créneau reste récurrent, l'affectation normale n'est pas
  // touchée). Le remplacement ne vaut donc que pour `remplacantActifDate`, pas
  // pour tous les mardis. Tous optionnels : un créneau sans remplacement ne
  // porte simplement aucun de ces champs.
  /** Nom de l'enseignant remplaçant. */
  remplacantNom?: string
  /** Date précise du remplacement, « YYYY-MM-DD » (une seule occurrence). */
  remplacantActifDate?: string
  /** Motif du remplacement (maladie, formation…), libre et optionnel. */
  remplacantMotif?: string
}

// Les champs de remplacement sont pilotés par des écritures dédiées (voir
// db.ts : setRemplacement / clearRemplacement) et non par le formulaire
// d'édition standard : Omit les exclut donc du type du formulaire de base.
export type CreneauFormData = Omit<
  Creneau,
  'id' | 'createdAt' | 'updatedAt' | 'remplacantNom' | 'remplacantActifDate' | 'remplacantMotif'
>

/**
 * Prochain créneau à venir dans la semaine type, en partant de maintenant.
 * L'emploi du temps est hebdomadaire et se répète : on parcourt les jours à
 * partir d'aujourd'hui et on boucle sur la semaine suivante si nécessaire.
 * `null` si la liste ne contient aucun créneau.
 *
 * Fonction PURE, sans dépendance Firebase : utilisable côté client (hooks des
 * tableaux de bord) comme côté serveur (contexte du chatbot).
 */
export function trouverProchainCours(creneaux: Creneau[], now: Date): Creneau | null {
  if (creneaux.length === 0) return null

  // getDay() : 0 = dimanche. JOURS commence au lundi.
  const jourIndexAujourdhui = (now.getDay() + 6) % 7
  const heureActuelle = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  for (let offset = 0; offset < 7; offset++) {
    const idx = (jourIndexAujourdhui + offset) % 7
    const jour = JOURS[idx] as JourSemaine | undefined
    if (!jour) continue // dimanche : pas de cours dans la grille

    const duJour = creneaux
      .filter((c) => c.jour === jour)
      .filter((c) => offset > 0 || c.heureDebut > heureActuelle)
      .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))

    if (duJour.length > 0) return duJour[0]
  }
  return null
}

// ─── Ancrage calendaire de la semaine-type ──────────────────────────────────────
// L'emploi du temps est une grille récurrente SANS dates (jour + heures). Les cas
// datés (remplacement ponctuel, annulation) ont besoin d'une date réelle : on
// ancre la semaine affichée à un lundi concret, et chaque colonne-jour se résout
// alors en une date « YYYY-MM-DD » LOCALE. Fonctions PURES (aucune I/O) :
// réutilisables partout (grilles étudiant/enseignant, contexte serveur…).

/** Lundi à 00:00 heure locale de la semaine contenant `d`. */
export function lundiDeLaSemaine(d: Date): Date {
  const jourIndex = (d.getDay() + 6) % 7 // 0 = lundi … 6 = dimanche
  const lundi = new Date(d.getFullYear(), d.getMonth(), d.getDate() - jourIndex)
  lundi.setHours(0, 0, 0, 0)
  return lundi
}

/**
 * Formate une Date en « YYYY-MM-DD » en heure LOCALE. On n'utilise JAMAIS
 * `toISOString()` ici : il convertit en UTC et décalerait la date d'un jour pour
 * les fuseaux à l'ouest de Greenwich (le soir devient le lendemain).
 */
export function toDateISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const j = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${j}`
}

/** Date « YYYY-MM-DD » de la colonne `jour` pour une semaine ancrée à `lundi`. */
export function dateDuJour(lundi: Date, jour: JourSemaine): string {
  const idx = JOURS.indexOf(jour) // 0 = lundi … 5 = samedi
  const d = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + idx)
  return toDateISO(d)
}

/** JourSemaine (lundi…samedi) d'une date « YYYY-MM-DD », ou `null` si dimanche. */
export function jourDeDate(dateISO: string): JourSemaine | null {
  const [y, m, j] = dateISO.split('-').map(Number)
  if (!y || !m || !j) return null
  const idx = (new Date(y, m - 1, j).getDay() + 6) % 7
  return JOURS[idx] ?? null
}

/** La date « YYYY-MM-DD » tombe-t-elle dans la semaine ouvrée (lun→sam) ancrée à `lundi` ? */
export function estDansSemaine(dateISO: string, lundi: Date): boolean {
  const samedi = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + 5)
  return dateISO >= toDateISO(lundi) && dateISO <= toDateISO(samedi)
}

/** Nom du remplaçant si un remplacement est actif à cette date précise, sinon `null`. */
export function remplacantLe(c: Creneau, dateISO: string): string | null {
  return c.remplacantActifDate === dateISO && c.remplacantNom ? c.remplacantNom : null
}

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
