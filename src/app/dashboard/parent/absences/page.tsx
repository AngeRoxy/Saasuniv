'use client'

import { useState, useEffect } from 'react'
import { CalendarX } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getUniversityMembers, type UniversityMember } from '@/lib/db'
import { AbsencesView } from '@/components/absences/absences-view'
import { ComingSoon } from '@/components/ui/coming-soon'

export default function ParentAbsencesPage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId

  const [children, setChildren] = useState<UniversityMember[]>([])
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!universityId || !user?.uid) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const students = await getUniversityMembers(universityId, 'student')
        if (!active) return
        const mine = students.filter((s) => s.parentUid === user.uid)
        setChildren(mine)
        setSelectedUid((prev) => prev ?? mine[0]?.uid ?? null)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId, user?.uid])

  const selectedChild = children.find((c) => c.uid === selectedUid) ?? null

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  if (!selectedChild || !universityId) {
    return (
      <ComingSoon
        icon={CalendarX}
        title="Absences"
        description="Aucun enfant n'est rattaché à votre compte. Contactez l'administration de l'université pour lier votre enfant."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Absences</h1>
        <p className="text-orange-200/40 text-sm mt-1">{selectedChild.displayName}</p>
      </div>

      {children.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-orange-200/40 mr-1">Enfant :</span>
          {children.map((c) => (
            <button key={c.uid} onClick={() => setSelectedUid(c.uid)}
              className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
                c.uid === selectedUid ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/20'
              }`}>{c.displayName}</button>
          ))}
        </div>
      )}

      <AbsencesView universityId={universityId} studentUid={selectedChild.uid} />
    </div>
  )
}
