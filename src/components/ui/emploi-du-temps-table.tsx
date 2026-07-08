'use client'

import { CalendarX, MapPin, User } from 'lucide-react'
import { JOURS, JOUR_LABEL, type Creneau, type JourSemaine } from '@/types/emploi-du-temps'

interface EmploiDuTempsTableProps {
  /** Créneaux affichés dans les cellules (déjà filtrés pour la personne concernée). */
  creneaux: Creneau[]
  /**
   * Créneaux servant à calculer les bornes horaires de la grille (heureMin/heureMax).
   * Y passer l'ensemble complet des créneaux de l'université pour le semestre actif,
   * afin que la journée-type reflète les horaires réels de tout l'établissement et
   * non le seul sous-ensemble de la personne. Si omis : fallback sur `creneaux`.
   */
  creneauxPourBornes?: Creneau[]
}

/** Largeur fixe de la colonne « Horaire ». */
const LARGEUR_HORAIRE = 64
/** Largeur maximale du bloc de cours à l'intérieur d'une cellule. */
const LARGEUR_BLOC = 110
/**
 * Hauteur (px) d'une ligne horaire d'une heure. DOIT rester synchronisée avec la
 * classe `h-15` (60px) des cellules horaire/vides ci-dessous. Sert à donner au bloc
 * de cours une hauteur EXPLICITE (`span × HAUTEUR_LIGNE`) : dans une cellule
 * fusionnée par `rowSpan`, `height:100%` ne se résout pas et le bloc s'effondrerait
 * à la hauteur de son contenu. 60px (et non 46) pour qu'un cours d'1h affiche
 * confortablement ses 3 lignes d'info (matière + salle + enseignant).
 */
const HAUTEUR_LIGNE = 60
/** Padding vertical total (haut + bas) du <td> contenant un cours (`4px` × 2). */
const PADDING_VERTICAL = 8

/** Convertit une heure « HH:mm » en minutes depuis minuit. */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Formate un nombre de minutes depuis minuit en « HH:mm ». */
function minutesToLabel(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

interface Placement {
  span: number
  creneau: Creneau
}

/**
 * Tableau croisé (lecture seule) d'un emploi du temps, façon emploi du temps
 * scolaire classique : une ligne <tr> par heure pleine, un cours occupe un
 * `rowSpan` correspondant au nombre d'heures qu'il traverse.
 *
 * L'arrondi à l'heure pleine sert UNIQUEMENT au positionnement graphique
 * (quelle ligne de départ, combien de lignes fusionner). L'heure de début et
 * de fin EXACTE saisie par l'administration reste affichée en texte (mobile)
 * et dans l'attribut `title` du bloc — jamais perdue ni modifiée.
 *
 * Composant strictement en lecture seule : il ne fait qu'afficher `creneaux`.
 */
export function EmploiDuTempsTable({ creneaux, creneauxPourBornes }: EmploiDuTempsTableProps) {
  // État totalement vide : message centré, pas de tableau.
  if (creneaux.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 text-zinc-500">
        <CalendarX className="h-10 w-10 mb-3 text-zinc-600" />
        <p className="text-sm">Aucun cours programmé pour le moment</p>
      </div>
    )
  }

  // Bornes de la grille dérivées des créneaux RÉELS de l'établissement (semestre
  // actif) via `creneauxPourBornes` — jamais une valeur inventée. `creneaux` ne
  // sert qu'à remplir les cellules avec les cours de la personne. Un étudiant dont
  // le premier cours est à midi voit quand même les heures du matin si une autre
  // filière a cours plus tôt. Fallback 08:00–18:00 uniquement si l'administration
  // n'a encore créé AUCUN créneau nulle part. Ces bornes ne concernent que
  // l'affichage : les horaires exacts des créneaux ne sont jamais modifiés.
  const sourceBornes = creneauxPourBornes ?? creneaux
  const debuts = sourceBornes.map((c) => timeToMinutes(c.heureDebut))
  const fins = sourceBornes.map((c) => timeToMinutes(c.heureFin))
  const heureMin = debuts.length ? Math.floor(Math.min(...debuts) / 60) * 60 : 8 * 60
  let heureMax = fins.length ? Math.ceil(Math.max(...fins) / 60) * 60 : 18 * 60
  if (heureMax <= heureMin) heureMax = heureMin + 60

  const nbLignes = (heureMax - heureMin) / 60
  const lignes = Array.from({ length: nbLignes }, (_, i) => heureMin + i * 60)

  // Pré-calcul du placement par jour : pour chaque colonne, on répartit les
  // créneaux sur les lignes horaires en gérant la fusion (rowSpan). Une matrice
  // `occupied` évite les collisions ; un créneau qui tomberait sur une ligne déjà
  // prise glisse vers la première ligne libre (aucun cours n'est perdu).
  const placementParJour = new Map<
    JourSemaine,
    { occupied: boolean[]; starts: Map<number, Placement> }
  >()

  for (const jour of JOURS) {
    const occupied = new Array<boolean>(nbLignes).fill(false)
    const starts = new Map<number, Placement>()

    const duJour = creneaux
      .filter((c) => c.jour === jour)
      .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))

    for (const c of duJour) {
      const dureeMin = timeToMinutes(c.heureFin) - timeToMinutes(c.heureDebut)
      let span = Math.max(1, Math.round(dureeMin / 60))

      // Ligne de départ idéale : heure de début arrondie à l'heure pleine inférieure.
      const ideal = Math.min(
        nbLignes - 1,
        Math.max(0, Math.floor((timeToMinutes(c.heureDebut) - heureMin) / 60))
      )

      // Trouve la première ligne libre à partir de l'idéal (évite les collisions).
      let start = ideal
      while (start < nbLignes && occupied[start]) start++
      if (start >= nbLignes) start = ideal // repli : données dégénérées

      // Ne dépasse pas le bas du tableau.
      span = Math.min(span, nbLignes - start)

      for (let k = 0; k < span; k++) occupied[start + k] = true
      starts.set(start, { span, creneau: c })
    }

    placementParJour.set(jour, { occupied, starts })
  }

  return (
    <>
      {/* ── Desktop : tableau croisé classique ──────────────────────── */}
      <div className="hidden md:block">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col style={{ width: LARGEUR_HORAIRE }} />
            {JOURS.map((j) => (
              <col key={j} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky top-0 z-10 border border-white/10 border-b-orange-500/30 bg-zinc-950" />
              {JOURS.map((jour) => (
                <th
                  key={jour}
                  className="sticky top-0 z-10 border border-white/10 border-b-orange-500/30 bg-zinc-950 py-2 text-center text-xs font-medium uppercase tracking-wider text-orange-400"
                >
                  {JOUR_LABEL[jour]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((minute, i) => (
              <tr key={minute}>
                <td className="h-15 border border-white/10 bg-white/5 text-center align-middle font-mono text-[10px] text-zinc-500">
                  {/* Intervalle COMPLET de cette ligne d'1h : début → fin (fin = début + 60 min).
                      Reste affiché sur chaque ligne, y compris celles traversées par un cours
                      en rowSpan — seul le contenu de la cellule du jour est fusionné. */}
                  {`${minutesToLabel(minute)}-${minutesToLabel(minute + 60)}`}
                </td>
                {JOURS.map((jour) => {
                  const data = placementParJour.get(jour)!
                  const p = data.starts.get(i)

                  if (p) {
                    const { creneau: c, span } = p
                    const titre = [
                      c.matiere,
                      c.salle,
                      c.enseignant,
                      `${c.heureDebut}-${c.heureFin}`,
                    ]
                      .filter(Boolean)
                      .join(' — ')

                    return (
                      <td
                        key={jour}
                        rowSpan={span}
                        className="border border-white/10 align-middle"
                        style={{ padding: '4px 10px' }}
                      >
                        <div
                          title={titre}
                          className="mx-auto flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border border-orange-500/20 bg-orange-500/10 px-1.5 py-1 text-center"
                          style={{
                            maxWidth: LARGEUR_BLOC,
                            // Hauteur EXPLICITE = nombre de lignes fusionnées × hauteur de ligne
                            // (moins le padding vertical du <td>). Corrige l'effondrement de
                            // `h-full` dans une cellule `rowSpan`, qui centrait le bloc au lieu
                            // de le laisser occuper toute la plage horaire du cours.
                            height: span * HAUTEUR_LIGNE - PADDING_VERTICAL,
                          }}
                        >
                          {/* Matière + salle + enseignant TOUJOURS affichés, quelle que soit la
                              durée du cours (même 1h) : la ligne fait désormais 60px pour que les
                              3 infos tiennent. Polices compactes + line-clamp/truncate empêchent
                              tout débordement quand le nom ou l'intitulé est long. */}
                          <p className="line-clamp-2 max-w-full break-words text-[10px] font-semibold leading-[1.2] text-white">
                            {c.matiere}
                          </p>
                          {c.salle && (
                            <span className="flex max-w-full items-center justify-center gap-0.5 text-[9px] leading-tight text-orange-300">
                              <MapPin className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{c.salle}</span>
                            </span>
                          )}
                          {c.enseignant && (
                            <span className="flex max-w-full items-center justify-center gap-0.5 text-[9px] leading-tight text-orange-300/80">
                              <User className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{c.enseignant}</span>
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  }

                  // Cellule recouverte par un rowSpan démarré plus haut : on l'omet.
                  if (data.occupied[i]) return null

                  // Cellule libre : simple case de grille.
                  return <td key={jour} className="h-15 border border-white/10" />
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile : liste par jour, horaires EXACTS (6 jours listés) ── */}
      <div className="space-y-5 md:hidden">
        {JOURS.map((jour) => {
          const items = creneaux
            .filter((c) => c.jour === jour)
            .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))
          return (
            <div key={jour}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-orange-400">
                {JOUR_LABEL[jour]}
              </h3>
              {items.length === 0 ? (
                <p className="text-xs italic text-zinc-600">Aucun cours</p>
              ) : (
                <div className="space-y-2">
                  {items.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-3"
                    >
                      <p className="font-mono text-xs text-orange-400">
                        {c.heureDebut} - {c.heureFin}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">{c.matiere}</p>
                      {c.salle && <p className="mt-1 text-xs text-zinc-400">{c.salle}</p>}
                      {c.enseignant && <p className="mt-0.5 text-xs text-zinc-400">{c.enseignant}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export default EmploiDuTempsTable
