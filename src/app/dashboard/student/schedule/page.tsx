'use client'

import { useState, useEffect, useMemo } from 'react'
import { CalendarClock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getUniversityMember,
  getFilieres,
  getSemestres,
  getCreneaux,
} from '@/lib/db'
import type { Semestre } from '@/lib/db'
import { lundiDeLaSemaine, type Creneau } from '@/types/emploi-du-temps'
import { ComingSoon } from '@/components/ui/coming-soon'
import { EmploiDuTempsTable } from '@/components/ui/emploi-du-temps-table'
import { SelecteurSemaine } from '@/components/ui/selecteur-semaine'

export default function StudentSchedulePage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId

  const [loading, setLoading] = useState(true)
  const [filiereId, setFiliereId] = useState<string | null>(null)
  const [niveau, setNiveau] = useState<string | null>(null)
  const [filiereNom, setFiliereNom] = useState<string>('')
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [semestreId, setSemestreId] = useState('')
  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  // Semaine calendaire affichée (ancrée au lundi) — donne un sens aux états datés
  // (remplacement ponctuel, annulation) sur une grille par ailleurs récurrente.
  const [lundiSemaine, setLundiSemaine] = useState(() => lundiDeLaSemaine(new Date()))

  useEffect(() => {
    if (!universityId || !user?.uid) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [member, filieres, sems, cre] = await Promise.all([
          getUniversityMember(universityId, user.uid),
          getFilieres(universityId),
          getSemestres(universityId),
          getCreneaux(universityId),
        ])
        if (!active) return

        const filiere = member?.filiere ? filieres.find((f) => f.nom === member.filiere) : undefined
        setFiliereId(filiere?.id ?? null)
        setFiliereNom(member?.filiere ?? '')
        setNiveau(member?.niveau ?? null)
        setSemestres(sems)
        setCreneaux(cre)

        // Sélectionne le semestre en cours par défaut (sinon le premier).
        const enCours = sems.find((s) => s.statut === 'en_cours')
        setSemestreId(enCours?.id ?? sems[0]?.id ?? '')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId, user?.uid])

  const creneauxFiltres = useMemo(
    () =>
      creneaux.filter(
        (c) => c.filiereId === filiereId && c.niveau === niveau && (!semestreId || c.semestreId === semestreId)
      ),
    [creneaux, filiereId, niveau, semestreId]
  )

  // Bornes de la grille : tous les créneaux de l'université pour le semestre actif
  // (sans filtre filière/niveau), pour que la journée-type reflète les horaires
  // réels de tout l'établissement, pas seulement ceux de l'étudiant.
  const creneauxBornes = useMemo(
    () => (semestreId ? creneaux.filter((c) => c.semestreId === semestreId) : creneaux),
    [creneaux, semestreId]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Filière/niveau pas encore définis pour l'étudiant.
  if (!filiereId || !niveau) {
    return (
      <ComingSoon
        icon={CalendarClock}
        title="Mon emploi du temps"
        description="Votre filière et votre niveau ne sont pas encore renseignés. Contactez l'administration de votre université pour accéder à votre emploi du temps."
      />
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
          <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
            {filiereNom} · {niveau}
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

      <EmploiDuTempsTable creneaux={creneauxFiltres} creneauxPourBornes={creneauxBornes} lundiSemaine={lundiSemaine} />
    </div>
  )
}
