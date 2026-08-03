'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useExamens } from '@/hooks/useExamens'
import { getCampusList } from '@/lib/db'
import { ExamensListe } from '@/components/examens/examens-liste'
import type { Examen } from '@/types/examen'
import type { Campus } from '@/types/campus'

export default function TeacherExamensPage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId

  // Aucun filtre filière/niveau : on charge tous les examens de l'université puis
  // on retient ceux où l'enseignant connecté intervient (responsable ou surveillant).
  const { examensAVenir, loading } = useExamens(universityId ?? '')

  const [campusList, setCampusList] = useState<Campus[]>([])
  const hasMultipleCampus = campusList.length > 1

  useEffect(() => {
    if (!universityId) return
    let active = true
    getCampusList(universityId).then((list) => { if (active) setCampusList(list) })
    return () => { active = false }
  }, [universityId])

  // Badge campus : visible seulement si l'enseignant intervient (potentiellement)
  // sur plusieurs campus — repère utile pour distinguer deux épreuves le même jour.
  const campusNom = useMemo(() => {
    const map = new Map(campusList.map((c) => [c.id, c.nom]))
    return (id: string) => map.get(id) ?? '—'
  }, [campusList])

  const mesExamens = useMemo(
    () =>
      examensAVenir.filter(
        (e) => e.enseignantUid === user?.uid || e.surveillantUid === user?.uid
      ),
    [examensAVenir, user?.uid]
  )

  function roleFor(e: Examen): string | null {
    const responsable = e.enseignantUid === user?.uid
    const surveillant = e.surveillantUid === user?.uid
    if (responsable && surveillant) return 'Responsable & surveillant'
    if (responsable) return 'Responsable'
    if (surveillant) return 'Surveillant'
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <ClipboardList size={22} className="text-blue-600 dark:text-orange-400" />
          Mes examens
        </h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
          Les épreuves à venir où vous êtes responsable ou surveillant.
        </p>
      </div>

      <ExamensListe
        examens={mesExamens}
        roleFor={roleFor}
        campusLabel={hasMultipleCampus ? (e) => campusNom(e.campusId) : undefined}
        emptyMessage="Aucun examen à venir ne vous est assigné."
      />
    </div>
  )
}
