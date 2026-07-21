'use client'

import { useState, useEffect, useMemo } from 'react'
import { CalendarClock, CalendarX, Clock, MapPin, User, UserCog } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getUniversityMembers,
  getFilieres,
  getSemestres,
  getCreneaux,
  type UniversityMember,
} from '@/lib/db'
import type { Filiere, Semestre } from '@/lib/db'
import {
  JOURS,
  JOUR_LABEL,
  lundiDeLaSemaine,
  dateDuJour,
  estAnnuleLe,
  motifAnnulationLe,
  remplacantLe,
  type Creneau,
} from '@/types/emploi-du-temps'
import { ComingSoon } from '@/components/ui/coming-soon'
import { SelecteurSemaine } from '@/components/ui/selecteur-semaine'

export default function ParentSchedulePage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId

  const [loading, setLoading] = useState(true)
  const [children, setChildren] = useState<UniversityMember[]>([])
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [semestreId, setSemestreId] = useState('')
  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  // Semaine calendaire affichée : ancre les états datés (remplacement, annulation),
  // exactement comme la vue étudiant.
  const [lundiSemaine, setLundiSemaine] = useState(() => lundiDeLaSemaine(new Date()))

  useEffect(() => {
    if (!universityId || !user?.uid) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [students, fil, sem, cre] = await Promise.all([
          getUniversityMembers(universityId, 'student'),
          getFilieres(universityId),
          getSemestres(universityId),
          getCreneaux(universityId),
        ])
        if (!active) return
        const mine = students.filter((s) => s.parentUid === user.uid)
        setChildren(mine)
        setSelectedUid((prev) => prev ?? mine[0]?.uid ?? null)
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
  }, [universityId, user?.uid])

  const selectedChild = children.find((c) => c.uid === selectedUid) ?? null

  const childFiliereId = useMemo(() => {
    if (!selectedChild?.filiere) return null
    return filieres.find((f) => f.nom === selectedChild.filiere)?.id ?? null
  }, [selectedChild, filieres])

  const byDay = useMemo(() => {
    const filtered = creneaux.filter(
      (c) => c.filiereId === childFiliereId && c.niveau === selectedChild?.niveau && (!semestreId || c.semestreId === semestreId)
    )
    return JOURS.map((jour) => ({
      jour,
      items: filtered
        .filter((c) => c.jour === jour)
        .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut)),
    }))
  }, [creneaux, childFiliereId, selectedChild?.niveau, semestreId])

  const total = byDay.reduce((n, d) => n + d.items.length, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!selectedChild) {
    return (
      <ComingSoon
        icon={CalendarClock}
        title="Emploi du temps"
        description="Aucun enfant n'est rattaché à votre compte. Contactez l'administration de l'université pour lier votre enfant."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Sélecteur d'enfant */}
      {children.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-orange-200/40 mr-1">Enfant :</span>
          {children.map((c) => (
            <button
              key={c.uid}
              onClick={() => setSelectedUid(c.uid)}
              className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
                c.uid === selectedUid
                  ? 'bg-orange-500/20 border-orange-500/40 text-blue-700 dark:text-orange-300'
                  : 'bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-white/20'
              }`}
            >
              {c.displayName}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <CalendarClock size={22} className="text-blue-600 dark:text-orange-400" />
            Emploi du temps
          </h1>
          <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
            {selectedChild.displayName}
            {selectedChild.filiere && ` · ${selectedChild.filiere}`}
            {selectedChild.niveau && ` · ${selectedChild.niveau}`}
          </p>
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

      {!childFiliereId || !selectedChild.niveau ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
          La filière ou le niveau de votre enfant n’est pas encore renseigné. Contactez l’administration.
        </div>
      ) : total === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
          Aucun cours programmé pour ce semestre.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {byDay.map(({ jour, items }) => {
            const dISO = dateDuJour(lundiSemaine, jour)
            return (
            <div key={jour} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
              <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-orange-500/10 bg-zinc-50 dark:bg-black/30">
                <p className="text-xs font-semibold text-blue-700 dark:text-orange-300/80 uppercase tracking-wider">{JOUR_LABEL[jour]}</p>
              </div>
              <div className="p-2 space-y-2 min-h-16">
                {items.length === 0 ? (
                  <p className="text-center text-zinc-500 dark:text-orange-200/20 text-xs py-4">—</p>
                ) : (
                  items.map((c) => {
                    // États datés pour la date réelle de cette colonne. L'annulation
                    // PRIME sur le remplacement (cohérent avec la vue étudiant).
                    const annule = estAnnuleLe(c, dISO)
                    const motifAnnul = annule ? motifAnnulationLe(c, dISO) : null
                    const remplacant = !annule ? remplacantLe(c, dISO) : null
                    return (
                      <div
                        key={c.id}
                        className={`rounded-lg border p-2.5 ${
                          annule
                            ? 'bg-zinc-100 dark:bg-white/5 border-zinc-300 dark:border-white/10 opacity-70'
                            : remplacant
                              ? 'bg-teal-500/10 border-teal-500/40'
                              : 'bg-orange-500/5 border-orange-500/15'
                        }`}
                      >
                        {annule ? (
                          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                            <CalendarX size={9} /> Annulé
                          </span>
                        ) : remplacant ? (
                          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-teal-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                            <UserCog size={9} /> Remplacement
                          </span>
                        ) : null}
                        <span className={`inline-flex items-center gap-1 text-[11px] font-mono ${annule ? 'text-zinc-500' : 'text-blue-600 dark:text-orange-400'}`}>
                          <Clock size={10} /> {c.heureDebut}–{c.heureFin}
                        </span>
                        <p className={`text-sm font-medium mt-1 leading-snug ${annule ? 'text-zinc-500 line-through decoration-rose-500/60' : 'text-zinc-900 dark:text-white'}`}>{c.matiere}</p>
                        {c.salle && <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 flex items-center gap-1"><MapPin size={9} /> {c.salle}</p>}
                        {annule ? (
                          motifAnnul && <p className="text-[11px] text-zinc-500 mt-0.5">{motifAnnul}</p>
                        ) : remplacant ? (
                          <p className="text-[11px] text-teal-700 dark:text-teal-300 flex items-center gap-1"><User size={9} /> {remplacant}</p>
                        ) : (
                          c.enseignant && <p className="text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1"><User size={9} /> {c.enseignant}</p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
