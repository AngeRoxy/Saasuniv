'use client'

import { Mail } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { MessagesView } from '@/components/messages/messages-view'
import { PlanGate } from '@/components/ui/plan-gate'
import { ComingSoon } from '@/components/ui/coming-soon'

export default function ParentMessagesPage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId ?? ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Messagerie</h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">Échangez avec les enseignants et l’administration.</p>
      </div>

      {/* Fonctionnalité Premium. L'encart d'upgrade par défaut renvoie vers la
          facturation, page réservée à l'admin : un parent n'y a pas accès. On
          affiche donc un message qui le renvoie vers son administration. */}
      <PlanGate
        feature="messagerieInterne"
        universityId={universityId}
        showUpgradePrompt={false}
        fallback={
          <ComingSoon
            icon={Mail}
            title="Messagerie interne"
            description="Cette fonctionnalité n'est pas incluse dans le plan souscrit par votre université. Contactez son administration pour y avoir accès."
            badge="Non incluse dans le plan"
          />
        }
      >
        <MessagesView />
      </PlanGate>
    </div>
  )
}
