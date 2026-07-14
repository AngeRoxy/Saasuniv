'use client'

import dynamic from 'next/dynamic'
import { BarChart3, CalendarX, CalendarClock, CreditCard } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { SemestreEnCours } from '@/components/ui/semestre-en-cours'
import { KpiCard } from '@/components/ui/kpi-card'
import { useStudentSummary } from '@/hooks/useStudentSummary'
import { JOUR_LABEL } from '@/types/emploi-du-temps'
import { formatFCFA } from '@/types/paiement'

const ChatbotWidget = dynamic(() => import('@/components/ui/chatbot-widget'), { ssr: false })

export default function StudentDashboard() {
  const { user, profile } = useAuth()
  const displayName = profile?.displayName ?? user?.displayName ?? user?.email ?? 'Étudiant'
  const universityId = profile?.universityId

  const {
    moyenne,
    moyenneForcee,
    nbNotes,
    absencesTotal,
    absencesInjustifiees,
    seuilAbsences,
    prochainCours,
    soldeDu,
    paiementsEnRetard,
    scolariteIncomplete,
    loading,
  } = useStudentSummary(universityId, user?.uid)

  const seuilDepasse = seuilAbsences > 0 && absencesInjustifiees >= seuilAbsences

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

      {/* KPI réels : notes, absences, emploi du temps et paiements viennent tous
          de Firebase, via les mêmes fonctions db.ts que les pages détaillées.
          Une donnée absente s'affiche « — », jamais un 0 qui se lirait comme une
          information. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Moyenne générale"
          value={moyenne !== null ? `${moyenne.toFixed(2)}/20` : null}
          icon={BarChart3}
          hint={
            moyenne === null
              ? 'Aucune note publiée'
              : `${nbNotes} note${nbNotes > 1 ? 's' : ''} ce semestre${moyenneForcee ? ' · moyenne forcée' : ''}`
          }
          href="/dashboard/student/grades"
          loading={loading}
        />

        <KpiCard
          label="Absences"
          value={absencesTotal}
          icon={CalendarX}
          tone={seuilDepasse ? 'alert' : 'default'}
          hint={
            absencesInjustifiees > 0
              ? `${absencesInjustifiees} injustifiée${absencesInjustifiees > 1 ? 's' : ''}${seuilDepasse ? ` · seuil de ${seuilAbsences} atteint` : ''}`
              : 'Aucune absence injustifiée'
          }
          href="/dashboard/student/absences"
          loading={loading}
        />

        <KpiCard
          label="Prochain cours"
          value={prochainCours ? prochainCours.matiere : null}
          icon={CalendarClock}
          hint={
            prochainCours
              ? `${JOUR_LABEL[prochainCours.jour]} ${prochainCours.heureDebut} · ${prochainCours.salle || 'salle non précisée'}`
              : scolariteIncomplete
                ? 'Filière ou niveau non renseigné'
                : 'Aucun cours planifié'
          }
          href="/dashboard/student/schedule"
          loading={loading}
        />

        <KpiCard
          label="Solde à payer"
          value={formatFCFA(soldeDu)}
          icon={CreditCard}
          tone={paiementsEnRetard > 0 ? 'alert' : 'default'}
          hint={
            paiementsEnRetard > 0
              ? `${paiementsEnRetard} échéance${paiementsEnRetard > 1 ? 's' : ''} en retard`
              : soldeDu > 0
                ? 'Aucune échéance dépassée'
                : 'Vous êtes à jour'
          }
          href="/dashboard/student/payments"
          loading={loading}
        />
      </div>

      {/* Assistant IA flottant */}
      {universityId && <ChatbotWidget universityId={universityId} />}
    </div>
  )
}
