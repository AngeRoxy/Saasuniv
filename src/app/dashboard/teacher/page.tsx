'use client'

import dynamic from 'next/dynamic'
import { Users } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { SemestreEnCours } from '@/components/ui/semestre-en-cours'
import { ComingSoon } from '@/components/ui/coming-soon'

const ChatbotWidget = dynamic(() => import('@/components/ui/chatbot-widget'), { ssr: false })

export default function TeacherDashboard() {
  const { user, profile } = useAuth()
  const displayName = profile?.displayName ?? user?.displayName ?? user?.email ?? 'Enseignant'
  const universityId = profile?.universityId

  return (
    <div className="space-y-8">
      {/* Welcome — données réelles */}
      <div className="rounded-xl bg-orange-950/30 border border-orange-500/10 p-6">
        <p className="text-xs uppercase tracking-widest text-orange-300/40 mb-1">Tableau de bord</p>
        <h1 className="text-2xl font-bold text-white mb-1">{displayName}</h1>
        <p className="text-sm text-orange-200/50">Enseignant — {universityId ?? '—'}</p>
      </div>

      {/* Semestre en cours — données réelles */}
      {universityId && <SemestreEnCours universityId={universityId} variant="compact" />}

      {/* Modules pas encore connectés */}
      <div className="rounded-xl bg-zinc-950 border border-orange-500/10">
        <ComingSoon
          icon={Users}
          title="Classes, notes et ressources"
          description="Vos classes, la saisie des notes et le partage de ressources s'afficheront ici dès que ces modules seront connectés à la base de données. Aucune donnée fictive n'est affichée."
        />
      </div>

      {/* Assistant IA flottant */}
      {universityId && <ChatbotWidget universityId={universityId} />}
    </div>
  )
}
