'use client'

import { useState, useEffect, useMemo } from 'react'
import { CalendarClock, CalendarX, Clock, MapPin, Layers, UserCog } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getFilieres, getSemestres, getCreneaux } from '@/lib/db'
import type { Filiere, Semestre } from '@/lib/db'
import {
  JOURS,
  JOUR_LABEL,
  lundiDeLaSemaine,
  dateDuJour,
  jourDeDate,
  estDansSemaine,
  estAnnuleLe,
  motifAnnulationLe,
  remplacantLe,
  type Creneau,
  type JourSemaine,
} from '@/types/emploi-du-temps'
import { SelecteurSemaine } from '@/components/ui/selecteur-semaine'

// Élément d'emploi du temps enseignant : soit un créneau dont il est titulaire
// (récurrent), soit une occurrence ponctuelle où il est remplaçant.
type TeacherItem = {
  creneau: Creneau
  role: 'titulaire' | 'remplacant'
  /** Pour un titulaire : nom du remplaçant qui le couvre CE jour précis, sinon null. */
  couvertPar: string | null
  /** Cette occurrence est-elle annulée (jour férié, grève…) ? Prime sur tout le reste. */
  annule: boolean
  /** Motif d'annulation, si renseigné. */
  motifAnnul: string | null
}

export default function TeacherSchedulePage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId
  const teacherName = profile?.displayName ?? user?.displayName ?? ''

  const [loading, setLoading] = useState(true)
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [semestreId, setSemestreId] = useState('')
  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  // Semaine calendaire affichée : ancre les états datés (remplacements ponctuels).
  const [lundiSemaine, setLundiSemaine] = useState(() => lundiDeLaSemaine(new Date()))

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [fil, sem, cre] = await Promise.all([
          getFilieres(universityId),
          getSemestres(universityId),
          getCreneaux(universityId),
        ])
        if (!active) return
        setFilieres(fil)
        setSemestres(sem)
        setCreneaux(cre)
        const enCours = sem.find((s) => s.statut === 'en_cours')
        setSemestreId(enCours?.id ?? sem[0]?.id ?? '')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId])

  const filiereNom = useMemo(() => {
    const map = new Map(filieres.map((f) => [f.id, f.nom]))
    return (id: string) => map.get(id) ?? '—'
  }, [filieres])

  const byDay = useMemo(() => {
    const parJour = new Map<JourSemaine, TeacherItem[]>()
    for (const j of JOURS) parJour.set(j, [])

    // 1. Mes créneaux TITULAIRES (récurrents, du semestre sélectionné), placés sur
    //    leur jour habituel. Marqués « remplacé ce jour » si un autre enseignant me
    //    couvre à la date réelle de cette colonne.
    for (const c of creneaux) {
      if (c.enseignant !== teacherName) continue
      if (semestreId && c.semestreId !== semestreId) continue
      const dISO = dateDuJour(lundiSemaine, c.jour)
      const rempl = remplacantLe(c, dISO)
      parJour.get(c.jour)!.push({
        creneau: c,
        role: 'titulaire',
        couvertPar: rempl && rempl !== teacherName ? rempl : null,
        annule: estAnnuleLe(c, dISO),
        motifAnnul: motifAnnulationLe(c, dISO),
      })
    }

    // 2. Occurrences ponctuelles où JE suis le remplaçant, pour une date tombant
    //    dans la semaine affichée — placées sur le jour réel de cette date. Non
    //    filtrées par semestre : c'est un évènement daté concret, pas un modèle.
    for (const c of creneaux) {
      if (c.remplacantNom !== teacherName || !c.remplacantActifDate) continue
      if (!estDansSemaine(c.remplacantActifDate, lundiSemaine)) continue
      const jour = jourDeDate(c.remplacantActifDate)
      if (jour) {
        parJour.get(jour)!.push({
          creneau: c,
          role: 'remplacant',
          couvertPar: null,
          annule: estAnnuleLe(c, c.remplacantActifDate),
          motifAnnul: motifAnnulationLe(c, c.remplacantActifDate),
        })
      }
    }

    for (const j of JOURS) {
      parJour.get(j)!.sort((a, b) => a.creneau.heureDebut.localeCompare(b.creneau.heureDebut))
    }
    return JOURS.map((jour) => ({ jour, items: parJour.get(jour)! }))
  }, [creneaux, teacherName, semestreId, lundiSemaine])

  const total = byDay.reduce((n, d) => n + d.items.length, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <CalendarClock size={22} className="text-blue-600 dark:text-orange-400" />
            Mon emploi du temps
          </h1>
          <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">Vos cours, tous niveaux confondus</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-3">
          {semestres.length > 0 && (
            <select
              value={semestreId}
              onChange={(e) => setSemestreId(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60"
            >
              {semestres.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          )}
          <SelecteurSemaine lundi={lundiSemaine} onChange={setLundiSemaine} />
        </div>
      </div>

      {total === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
          Aucun cours ne vous est assigné pour ce semestre. L’administration vous attribue les créneaux depuis l’emploi du temps.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {byDay.map(({ jour, items }) => (
            <div key={jour} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
              <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-orange-500/10 bg-[#fafafa]/30 dark:bg-black/30">
                <p className="text-xs font-semibold text-blue-700 dark:text-orange-300/80 uppercase tracking-wider">{JOUR_LABEL[jour]}</p>
              </div>
              <div className="p-2 space-y-2 min-h-16">
                {items.length === 0 ? (
                  <p className="text-center text-zinc-500 dark:text-orange-200/20 text-xs py-4">—</p>
                ) : (
                  items.map(({ creneau: c, role, couvertPar, annule, motifAnnul }) => {
                    const estRemplacement = role === 'remplacant'
                    return (
                      <div
                        key={`${role}-${c.id}`}
                        className={`rounded-lg border p-2.5 ${
                          annule
                            ? 'bg-zinc-100 dark:bg-white/5 border-zinc-300 dark:border-white/10 opacity-70'
                            : estRemplacement
                              ? 'bg-teal-500/10 border-teal-500/40'
                              : 'bg-orange-500/5 border-orange-500/15'
                        }`}
                      >
                        {/* L'annulation prime : on la signale d'abord, peu importe le rôle. */}
                        {annule ? (
                          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                            <CalendarX size={9} /> Annulé
                          </span>
                        ) : estRemplacement ? (
                          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-teal-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                            <UserCog size={9} /> Remplacement
                          </span>
                        ) : null}
                        <span className={`inline-flex items-center gap-1 text-[11px] font-mono ${annule ? 'text-zinc-500' : 'text-blue-600 dark:text-orange-400'}`}>
                          <Clock size={10} /> {c.heureDebut}–{c.heureFin}
                        </span>
                        <p className={`text-sm font-medium mt-1 leading-snug ${annule ? 'text-zinc-500 line-through decoration-rose-500/60' : 'text-zinc-900 dark:text-white'}`}>{c.matiere}</p>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
                          <Layers size={9} /> {filiereNom(c.filiereId)} · {c.niveau}
                        </p>
                        {c.salle && <p className="text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1"><MapPin size={9} /> {c.salle}</p>}
                        {/* Priorité d'affichage : annulé > remplacement > couvert par un tiers. */}
                        {annule ? (
                          motifAnnul && <p className="text-[11px] text-zinc-500 mt-0.5">{motifAnnul}</p>
                        ) : estRemplacement ? (
                          <p className="text-[11px] text-teal-700 dark:text-teal-300/80 mt-0.5">
                            Vous remplacez {c.enseignant || 'le titulaire'}
                          </p>
                        ) : couvertPar ? (
                          <p className="text-[11px] text-teal-700 dark:text-teal-300/80 mt-0.5 flex items-center gap-1">
                            <UserCog size={9} /> Remplacé ce jour par {couvertPar}
                          </p>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
