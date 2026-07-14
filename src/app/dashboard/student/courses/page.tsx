'use client'

import { useState, useEffect, useMemo } from 'react'
import { BookOpen, ExternalLink, Link2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getUniversityMember, getFilieres, getRessources, type Ressource } from '@/lib/db'

export default function StudentCoursesPage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId

  const [loading, setLoading] = useState(true)
  const [ressources, setRessources] = useState<Ressource[]>([])
  const [filiereId, setFiliereId] = useState<string | null>(null)
  const [niveau, setNiveau] = useState<string | null>(null)

  useEffect(() => {
    if (!universityId || !user?.uid) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [member, filieres, res] = await Promise.all([
          getUniversityMember(universityId, user.uid),
          getFilieres(universityId),
          getRessources(universityId),
        ])
        if (!active) return
        const fil = member?.filiere ? filieres.find((f) => f.nom === member.filiere) : undefined
        setFiliereId(fil?.id ?? null)
        setNiveau(member?.niveau ?? null)
        setRessources(res)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId, user?.uid])

  const visibles = useMemo(
    () =>
      ressources.filter((r) => {
        if (r.filiereId && r.filiereId !== filiereId) return false
        if (r.niveau && r.niveau !== niveau) return false
        return true
      }),
    [ressources, filiereId, niveau]
  )

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Mes cours & ressources</h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">Documents et liens partagés par vos enseignants.</p>
      </div>

      {visibles.length === 0 ? (
        <div className="text-center py-20 text-zinc-500 dark:text-orange-200/30 text-sm flex flex-col items-center gap-3">
          <BookOpen size={40} className="opacity-30" />
          Aucune ressource disponible pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibles.map((r) => (
            <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
              className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 hover:border-orange-500/25 rounded-xl p-5 flex flex-col gap-2 transition-colors group">
              <div className="flex items-center gap-2">
                <Link2 size={14} className="text-blue-600 dark:text-orange-400 shrink-0" />
                <h3 className="text-zinc-900 dark:text-white font-semibold text-sm truncate">{r.titre}</h3>
              </div>
              {r.description && <p className="text-zinc-800 dark:text-orange-100/50 text-xs line-clamp-2">{r.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                {r.matiere && <span className="text-[11px] bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 rounded-full px-2 py-0.5">{r.matiere}</span>}
              </div>
              <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-orange-400 group-hover:text-blue-900 dark:group-hover:text-orange-300">Ouvrir <ExternalLink size={11} /></span>
              <span className="text-[11px] text-zinc-500 dark:text-orange-200/30">Par {r.auteur}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
