'use client'

import { useState, useEffect, useMemo } from 'react'
import { ClipboardList } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getUniversityMembers,
  getFilieres,
  getSemestres,
  type UniversityMember,
  type Filiere,
  type Semestre,
} from '@/lib/db'
import { useExamens } from '@/hooks/useExamens'
import { ComingSoon } from '@/components/ui/coming-soon'
import { ExamensListe } from '@/components/examens/examens-liste'

export default function ParentExamensPage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId

  const [metaLoading, setMetaLoading] = useState(true)
  const [children, setChildren] = useState<UniversityMember[]>([])
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [semestreId, setSemestreId] = useState<string | undefined>()

  useEffect(() => {
    if (!universityId || !user?.uid) return
    let active = true
    ;(async () => {
      setMetaLoading(true)
      try {
        const [students, fil, sems] = await Promise.all([
          getUniversityMembers(universityId, 'student'),
          getFilieres(universityId),
          getSemestres(universityId),
        ])
        if (!active) return
        const mine = students.filter((s) => s.parentUid === user.uid)
        setChildren(mine)
        setSelectedUid((prev) => prev ?? mine[0]?.uid ?? null)
        setFilieres(fil)
        setSemestres(sems)
        const enCours = sems.find((s) => s.statut === 'en_cours')
        setSemestreId(enCours?.id ?? sems[0]?.id)
      } finally {
        if (active) setMetaLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId, user?.uid])

  const selectedChild = children.find((c) => c.uid === selectedUid) ?? null

  const childFiliereId = useMemo(() => {
    if (!selectedChild?.filiere) return undefined
    return filieres.find((f) => f.nom === selectedChild.filiere)?.id
  }, [selectedChild, filieres])
  const niveau = selectedChild?.niveau ?? undefined

  const ready = !metaLoading && Boolean(childFiliereId && niveau)

  const { examensAVenir, loading: examLoading } = useExamens(
    ready ? (universityId ?? '') : '',
    { filiereId: childFiliereId, niveau, semestreId }
  )

  if (metaLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!selectedChild) {
    return (
      <ComingSoon
        icon={ClipboardList}
        title="Examens"
        description="Aucun enfant n'est rattaché à votre compte. Contactez l'administration de l'université pour lier votre enfant."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Sélecteur d'enfant */}
      {children.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-orange-200/40 mr-1">Enfant :</span>
          {children.map((c) => (
            <button
              key={c.uid}
              onClick={() => setSelectedUid(c.uid)}
              className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
                c.uid === selectedUid
                  ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/20'
              }`}
            >
              {c.displayName}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList size={22} className="text-orange-400" />
            Examens
          </h1>
          <p className="text-orange-200/40 text-sm mt-1">
            {selectedChild.displayName}
            {selectedChild.filiere && ` · ${selectedChild.filiere}`}
            {selectedChild.niveau && ` · ${selectedChild.niveau}`}
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

      {!childFiliereId || !niveau ? (
        <div className="text-center py-16 text-orange-200/30 text-sm">
          La filière ou le niveau de votre enfant n’est pas encore renseigné. Contactez l’administration.
        </div>
      ) : examLoading ? (
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
