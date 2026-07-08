'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { User, BarChart3 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getUniversityMembers, type UniversityMember } from '@/lib/db'
import { SemestreEnCours } from '@/components/ui/semestre-en-cours'
import { ComingSoon } from '@/components/ui/coming-soon'

const ChatbotWidget = dynamic(() => import('@/components/ui/chatbot-widget'), { ssr: false })

export default function ParentDashboard() {
  const { user, profile } = useAuth()
  const parentName = profile?.displayName ?? user?.displayName ?? user?.email ?? 'Parent'
  const universityId = profile?.universityId

  const [children, setChildren] = useState<UniversityMember[]>([])
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [loadingChildren, setLoadingChildren] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!universityId || !user?.uid) {
        if (active) setLoadingChildren(false)
        return
      }
      try {
        const students = await getUniversityMembers(universityId, 'student')
        if (!active) return
        const mine = students.filter((s) => s.parentUid === user.uid)
        setChildren(mine)
        setSelectedUid((prev) => prev ?? mine[0]?.uid ?? null)
      } catch {
        if (active) setChildren([])
      } finally {
        if (active) setLoadingChildren(false)
      }
    })()
    return () => { active = false }
  }, [universityId, user?.uid])

  const selectedChild = children.find((c) => c.uid === selectedUid) ?? null

  return (
    <div className="space-y-8">
      {/* Sélecteur d'enfant — données réelles */}
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

      {/* Fiche enfant — données réelles */}
      <div className="rounded-xl bg-orange-950/30 border border-orange-500/10 p-6 flex items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-orange-500/20 flex items-center justify-center shrink-0">
          <User className="h-8 w-8 text-orange-300/40" />
        </div>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-orange-300/40 mb-1">Bienvenue, {parentName}</p>
          {loadingChildren ? (
            <div className="h-6 w-48 animate-pulse rounded bg-white/5 mt-1" />
          ) : selectedChild ? (
            <>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold text-white">{selectedChild.displayName}</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  {selectedChild.statut ?? 'Actif'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-orange-200/50">
                {selectedChild.filiere && <span>{selectedChild.filiere}</span>}
                {selectedChild.filiere && selectedChild.niveau && <span>·</span>}
                {selectedChild.niveau && <span>{selectedChild.niveau}</span>}
                {selectedChild.matricule && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-orange-400/70">{selectedChild.matricule}</span>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-orange-200/40 mt-1">Aucun enfant rattaché à votre compte.</p>
          )}
        </div>
      </div>

      {/* Semestre en cours — données réelles */}
      {universityId && selectedChild && <SemestreEnCours universityId={universityId} variant="full" />}

      {/* Modules pas encore connectés */}
      <div className="rounded-xl bg-zinc-950 border border-orange-500/10">
        <ComingSoon
          icon={BarChart3}
          title="Notes, absences et paiements"
          description="Le suivi scolaire de votre enfant (notes, absences, paiements) s'affichera ici dès que l'université aura activé ces modules. Aucune donnée fictive n'est affichée."
        />
      </div>

      {/* Assistant IA flottant */}
      {universityId && <ChatbotWidget universityId={universityId} />}
    </div>
  )
}
