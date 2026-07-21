'use client'

import { useState, useEffect, useMemo } from 'react'
import { Users, CalendarClock, Layers, BookOpen } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getFilieres, getSemestres, getCreneaux, getUniversityMembers } from '@/lib/db'
import type { Filiere, Semestre, UniversityMember } from '@/lib/db'
import type { Creneau } from '@/types/emploi-du-temps'

// Une « classe » = un groupe (filière + niveau) auquel l'enseignant est assigné.
// Vue de consultation en LECTURE SEULE : aucune écriture, aucune action.
interface ClasseCard {
  key: string
  filiereId: string
  filiereNom: string
  niveau: string
  /** Matières distinctes que l'enseignant assure pour ce groupe. */
  matieres: string[]
  /** Nombre de créneaux hebdomadaires (borné au semestre sélectionné). */
  creneauxCount: number
  /** Effectif du groupe (étudiants de cette filière + niveau). */
  effectif: number
}

export default function TeacherClassesPage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId
  // Comme le reste de l'app, l'« assignation » de l'enseignant se lit dans ses
  // créneaux d'emploi du temps, appariés par NOM (cf. teacher/schedule, absences).
  const teacherName = profile?.displayName ?? user?.displayName ?? ''

  const [loading, setLoading] = useState(true)
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [semestreId, setSemestreId] = useState('')
  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  const [students, setStudents] = useState<UniversityMember[]>([])

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [fil, sem, cre, etu] = await Promise.all([
          getFilieres(universityId),
          getSemestres(universityId),
          getCreneaux(universityId),
          getUniversityMembers(universityId, 'student'),
        ])
        if (!active) return
        setFilieres(fil)
        setSemestres(sem)
        setCreneaux(cre)
        setStudents(etu)
        // Semestre en cours par défaut : « créneaux hebdomadaires » reste ainsi
        // le vrai rythme d'une semaine et n'additionne pas plusieurs semestres.
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

  // Regroupe les créneaux de l'enseignant (semestre courant) par classe unique.
  const classes = useMemo<ClasseCard[]>(() => {
    const mine = creneaux.filter(
      (c) => c.enseignant === teacherName && (!semestreId || c.semestreId === semestreId)
    )

    const groupes = new Map<string, { filiereId: string; niveau: string; matieres: Set<string>; count: number }>()
    for (const c of mine) {
      const key = `${c.filiereId}__${c.niveau}`
      let g = groupes.get(key)
      if (!g) {
        g = { filiereId: c.filiereId, niveau: c.niveau, matieres: new Set(), count: 0 }
        groupes.set(key, g)
      }
      g.count += 1
      const matiere = c.matiere?.trim()
      if (matiere) g.matieres.add(matiere)
    }

    return [...groupes.entries()]
      .map(([key, g]) => {
        const nom = filiereNom(g.filiereId)
        // Effectif : mêmes critères que teacher/moyennes (filière par NOM + niveau).
        const effectif = students.filter((s) => s.filiere === nom && s.niveau === g.niveau).length
        return {
          key,
          filiereId: g.filiereId,
          filiereNom: nom,
          niveau: g.niveau,
          matieres: [...g.matieres].sort((a, b) => a.localeCompare(b, 'fr')),
          creneauxCount: g.count,
          effectif,
        }
      })
      .sort((a, b) =>
        a.filiereNom.localeCompare(b.filiereNom, 'fr') || a.niveau.localeCompare(b.niveau, 'fr')
      )
  }, [creneaux, teacherName, semestreId, students, filiereNom])

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
            <Users size={22} className="text-blue-600 dark:text-orange-400" />
            Mes classes
          </h1>
          <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
            Les groupes que vous encadrez, d’après votre emploi du temps.
          </p>
        </div>
        {semestres.length > 0 && (
          <select
            value={semestreId}
            onChange={(e) => setSemestreId(e.target.value)}
            className="bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60"
          >
            {semestres.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        )}
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
          Aucune classe ne vous est assignée pour ce semestre. L’administration vous attribue les
          créneaux depuis l’emploi du temps ; vos groupes apparaîtront alors ici.
        </div>
      ) : (
        <>
          <p className="text-xs text-zinc-500 dark:text-orange-200/40">
            {classes.length} classe{classes.length > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {classes.map((c) => (
              <div
                key={c.key}
                className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-5 flex flex-col"
              >
                {/* En-tête : filière + niveau */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <Layers size={18} className="text-blue-600 dark:text-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-white leading-snug truncate">
                      {c.filiereNom}
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-orange-200/50 mt-0.5">{c.niveau}</p>
                  </div>
                </div>

                {/* Matières enseignées dans cette classe */}
                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-orange-300/40 mb-2 flex items-center gap-1.5">
                    <BookOpen size={12} /> Matière{c.matieres.length > 1 ? 's' : ''}
                  </p>
                  {c.matieres.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-orange-200/30">—</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {c.matieres.map((m) => (
                        <span
                          key={m}
                          className="inline-flex items-center rounded-lg bg-orange-500/5 border border-orange-500/15 px-2.5 py-1 text-xs text-zinc-700 dark:text-orange-100/80"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stats : effectif + créneaux hebdomadaires */}
                <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-orange-500/10 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Users size={15} className="text-blue-600 dark:text-orange-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-none">{c.effectif}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-orange-200/40 mt-1">
                        étudiant{c.effectif > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarClock size={15} className="text-blue-600 dark:text-orange-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-none">{c.creneauxCount}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-orange-200/40 mt-1">
                        créneau{c.creneauxCount > 1 ? 'x' : ''}/sem.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
