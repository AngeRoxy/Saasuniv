'use client'

import dynamic from 'next/dynamic'
import { GraduationCap } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { SemestreEnCours } from '@/components/ui/semestre-en-cours'
import { ComingSoon } from '@/components/ui/coming-soon'

const ChatbotWidget = dynamic(() => import('@/components/ui/chatbot-widget'), { ssr: false })

export default function StudentDashboard() {
  const { user, profile } = useAuth()
  const displayName = profile?.displayName ?? user?.displayName ?? user?.email ?? 'Étudiant'
  const universityId = profile?.universityId

  return (
    <div className="space-y-8">
      {/* Welcome card — données réelles */}
      <div className="rounded-xl bg-orange-950/30 border border-zinc-200 dark:border-orange-500/10 p-6">
        <p className="text-xs uppercase tracking-widest text-zinc-500 dark:text-orange-300/40 mb-1">Bienvenue</p>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">{displayName}</h1>
        <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-orange-200/50">
          <span>Université : <span className="text-blue-600 dark:text-orange-400 font-mono">{universityId ?? '—'}</span></span>
          <span>·</span>
          <span>Email : <span className="text-blue-700 dark:text-orange-300/70">{user?.email}</span></span>
        </div>
      </div>

      {/* Semestre en cours — données réelles */}
      {universityId && <SemestreEnCours universityId={universityId} variant="full" />}

      {/* Modules académiques pas encore connectés */}
      <div className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10">
        <ComingSoon
          icon={GraduationCap}
          title="Notes, cours et paiements"
          description="Votre suivi académique (notes, emploi du temps, paiements) s'affichera ici dès que votre université aura activé ces modules. Aucune donnée fictive n'est affichée."
        />
      </div>

      {/* Assistant IA flottant */}
      {universityId && <ChatbotWidget universityId={universityId} />}
    </div>
  )
}
