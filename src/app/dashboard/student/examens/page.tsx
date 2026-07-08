'use client'

import { useState, useEffect } from 'react'
import { ClipboardList } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getUniversityMember, getFilieres, getSemestres, type Semestre } from '@/lib/db'
import { useExamens } from '@/hooks/useExamens'
import { ComingSoon } from '@/components/ui/coming-soon'
import { ExamensListe } from '@/components/examens/examens-liste'

export default function StudentExamensPage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId

  const [metaLoading, setMetaLoading] = useState(true)
  const [filiereId, setFiliereId] = useState<string | undefined>()
  const [niveau, setNiveau] = useState<string | undefined>()
  const [filiereNom, setFiliereNom] = useState('')
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [semestreId, setSemestreId] = useState<string | undefined>()

  useEffect(() => {
    if (!universityId || !user?.uid) return
    let active = true
    ;(async () => {
      setMetaLoading(true)
      try {
        const [member, filieres, sems] = await Promise.all([
          getUniversityMember(universityId, user.uid),
          getFilieres(universityId),
          getSemestres(universityId),
        ])
        if (!active) return
        const filiere = member?.filiere ? filieres.find((f) => f.nom === member.filiere) : undefined
        setFiliereId(filiere?.id)
        setFiliereNom(member?.filiere ?? '')
        setNiveau(member?.niveau ?? undefined)
        setSemestres(sems)
        const enCours = sems.find((s) => s.statut === 'en_cours')
        setSemestreId(enCours?.id ?? sems[0]?.id)
      } finally {
        if (active) setMetaLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId, user?.uid])

  const ready = !metaLoading && Boolean(filiereId && niveau)

  // Tant que la filière/niveau ne sont pas résolus, on ne lance aucune lecture
  // (universityId vide → hook inactif) : évite d'afficher les examens de toute
  // l'université avant de connaître le groupe de l'étudiant.
  const { examensAVenir, loading: examLoading } = useExamens(
    ready ? (universityId ?? '') : '',
    { filiereId, niveau, semestreId }
  )

  if (metaLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!filiereId || !niveau) {
    return (
      <ComingSoon
        icon={ClipboardList}
        title="Mes examens"
        description="Votre filière et votre niveau ne sont pas encore renseignés. Contactez l'administration de votre université pour accéder à votre calendrier d'examens."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList size={22} className="text-orange-400" />
            Mes examens
          </h1>
          <p className="text-orange-200/40 text-sm mt-1">
            {filiereNom}{filiereNom && niveau ? ' · ' : ''}{niveau}
          </p>
        </div>
        {semestres.length > 0 && (
          <select
            value={semestreId ?? ''}
            onChange={(e) => setSemestreId(e.target.value)}
            className="bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-400/60"
          >
            {semestres.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        )}
      </div>

      {examLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <ExamensListe
          examens={examensAVenir}
          emptyMessage="Aucun examen à venir pour ce semestre."
        />
      )}
    </div>
  )
}
