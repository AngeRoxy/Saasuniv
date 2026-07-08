'use client'

import { useAuth } from '@/context/AuthContext'
import { AbsencesView } from '@/components/absences/absences-view'

export default function StudentAbsencesPage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId

  if (!universityId || !user?.uid) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mes absences</h1>
        <p className="text-orange-200/40 text-sm mt-1">Suivi de votre assiduité.</p>
      </div>
      <AbsencesView universityId={universityId} studentUid={user.uid} />
    </div>
  )
}
