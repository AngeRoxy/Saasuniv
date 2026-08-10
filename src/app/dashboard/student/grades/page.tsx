'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { GradeView } from '@/components/grades/grade-view'
import { RecommandationsIA } from '@/components/ui/recommandations-ia'
import { getNotesForStudent, getMatieres } from '@/lib/db'
import { getNoteRetenue } from '@/types/note'
import type { Matiere } from '@/types/filiere'

interface NoteInput {
  matiere: string
  note: number
  credits: number
  coefficient: number
}

/**
 * Notes de l'étudiant (toutes années confondues) formatées pour l'analyse IA,
 * enrichies des crédits/coefficient de chaque matière (absents de NoteEntry,
 * dénormalisés depuis les matières de la/des filière(s) traversées).
 */
function useNotesPourRecommandations(universityId: string, studentUid: string): NoteInput[] {
  const [notes, setNotes] = useState<NoteInput[]>([])

  useEffect(() => {
    if (!universityId || !studentUid) return
    let active = true
    ;(async () => {
      const entries = await getNotesForStudent(universityId, studentUid)
      if (entries.length === 0) {
        if (active) setNotes([])
        return
      }
      const filiereIds = Array.from(new Set(entries.map((n) => n.filiereId)))
      const matieresParFiliere = await Promise.all(
        filiereIds.map((fid) => getMatieres(universityId, fid))
      )
      const matiereById = new Map<string, Matiere>()
      matieresParFiliere.flat().forEach((m) => matiereById.set(m.id, m))
      if (!active) return
      setNotes(
        entries.map((n) => ({
          matiere: n.matiere,
          note: getNoteRetenue(n),
          credits: matiereById.get(n.matiereId)?.credits ?? 0,
          coefficient: matiereById.get(n.matiereId)?.coefficient ?? 1,
        }))
      )
    })()
    return () => {
      active = false
    }
  }, [universityId, studentUid])

  return notes
}

export default function StudentGradesPage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId
  const notesRecommandations = useNotesPourRecommandations(universityId ?? '', user?.uid ?? '')

  if (!universityId || !user?.uid) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Mes notes</h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">Vos résultats et moyennes par semestre.</p>
      </div>
      <GradeView universityId={universityId} studentUid={user.uid} />
      {notesRecommandations.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-orange-400" /> Suggestions personnalisées
          </h2>
          <RecommandationsIA universityId={universityId} etudiantUid={user.uid} notes={notesRecommandations} />
        </div>
      )}
    </div>
  )
}
