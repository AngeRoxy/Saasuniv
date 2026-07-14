'use client'

import { useAuth } from '@/context/AuthContext'
import { GradeEntry } from '@/components/grades/grade-entry'

export default function GradesPage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId

  if (profile && profile.role !== 'admin_universite' && profile.role !== 'super_admin_plateforme') {
    return (
      <div className="flex items-center justify-center h-64 text-blue-700 dark:text-orange-300/60 text-sm">
        Accès réservé aux administrateurs.
      </div>
    )
  }

  if (!universityId) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Consultation des notes</h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">Supervision des résultats. La saisie est réservée aux enseignants.</p>
      </div>
      <GradeEntry universityId={universityId} readOnly />
    </div>
  )
}
