'use client'

import { useState, useEffect, useMemo } from 'react'
import { CalendarClock, Clock, MapPin, Layers } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getFilieres, getSemestres, getCreneaux } from '@/lib/db'
import type { Filiere, Semestre } from '@/lib/db'
import { JOURS, JOUR_LABEL, type Creneau } from '@/types/emploi-du-temps'

export default function TeacherSchedulePage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId
  const teacherName = profile?.displayName ?? user?.displayName ?? ''

  const [loading, setLoading] = useState(true)
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [semestreId, setSemestreId] = useState('')
  const [creneaux, setCreneaux] = useState<Creneau[]>([])

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
    const mine = creneaux.filter(
      (c) => c.enseignant === teacherName && (!semestreId || c.semestreId === semestreId)
    )
    return JOURS.map((jour) => ({
      jour,
      items: mine
        .filter((c) => c.jour === jour)
        .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut)),
    }))
  }, [creneaux, teacherName, semestreId])

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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarClock size={22} className="text-orange-400" />
            Mon emploi du temps
          </h1>
          <p className="text-orange-200/40 text-sm mt-1">Vos cours, tous niveaux confondus</p>
        </div>
        {semestres.length > 0 && (
          <select
            value={semestreId}
            onChange={(e) => setSemestreId(e.target.value)}
            className="bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-400/60"
          >
            {semestres.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        )}
      </div>

      {total === 0 ? (
        <div className="text-center py-16 text-orange-200/30 text-sm">
          Aucun cours ne vous est assigné pour ce semestre. L’administration vous attribue les créneaux depuis l’emploi du temps.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {byDay.map(({ jour, items }) => (
            <div key={jour} className="bg-zinc-950 border border-orange-500/10 rounded-xl overflow-hidden">
              <div className="px-3 py-2.5 border-b border-orange-500/10 bg-black/30">
                <p className="text-xs font-semibold text-orange-300/80 uppercase tracking-wider">{JOUR_LABEL[jour]}</p>
              </div>
              <div className="p-2 space-y-2 min-h-16">
                {items.length === 0 ? (
                  <p className="text-center text-orange-200/20 text-xs py-4">—</p>
                ) : (
                  items.map((c) => (
                    <div key={c.id} className="rounded-lg bg-orange-500/5 border border-orange-500/15 p-2.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-orange-400">
                        <Clock size={10} /> {c.heureDebut}–{c.heureFin}
                      </span>
                      <p className="text-sm font-medium text-white mt-1 leading-snug">{c.matiere}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1">
                        <Layers size={9} /> {filiereNom(c.filiereId)} · {c.niveau}
                      </p>
                      {c.salle && <p className="text-[11px] text-zinc-400 flex items-center gap-1"><MapPin size={9} /> {c.salle}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
