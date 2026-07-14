'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getAnnonces, type Annonce } from '@/lib/db'
import { annonceVisiblePour } from '@/types/annonce'

/** Liste des annonces visibles par le rôle de l'utilisateur courant. */
export function AnnoncesView() {
  const { profile } = useAuth()
  const universityId = profile?.universityId
  const [annonces, setAnnonces] = useState<Annonce[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const list = await getAnnonces(universityId)
        if (active) setAnnonces(list.filter((a) => annonceVisiblePour(a, profile?.role)))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId, profile?.role])

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  if (annonces.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm flex flex-col items-center gap-3">
        <Bell size={32} className="opacity-30" />
        Aucune annonce pour le moment.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {annonces.map((a) => (
        <div key={a.id} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0"><Bell size={16} className="text-blue-600 dark:text-orange-400" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-zinc-900 dark:text-white font-semibold text-sm">{a.titre}</p>
              <p className="text-zinc-800 dark:text-orange-100/60 text-sm leading-relaxed mt-1">{a.message}</p>
              <p className="text-zinc-500 dark:text-orange-200/30 text-xs mt-2">{a.auteur} · {new Date(a.createdAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default AnnoncesView
