'use client'

import dynamic from 'next/dynamic'
import { Layers, CalendarX, CalendarClock, PenLine } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { SemestreEnCours } from '@/components/ui/semestre-en-cours'
import { KpiCard } from '@/components/ui/kpi-card'
import { useTeacherSummary } from '@/hooks/useTeacherSummary'
import { JOUR_LABEL } from '@/types/emploi-du-temps'

const ChatbotWidget = dynamic(() => import('@/components/ui/chatbot-widget'), { ssr: false })

export default function TeacherDashboard() {
  const { user, profile } = useAuth()
  const displayName = profile?.displayName ?? user?.displayName ?? user?.email ?? 'Enseignant'
  const universityId = profile?.universityId
  // Même clé d'affectation que /teacher/schedule : le nom porté par le créneau.
  const teacherName = profile?.displayName ?? user?.displayName ?? ''

  const {
    classes,
    matieres,
    absencesATraiter,
    prochainCours,
    notesEnAttente,
    etudiantsConcernes,
    loading,
  } = useTeacherSummary(universityId, teacherName)

  return (
    <div className="space-y-8">
      {/* Welcome — données réelles */}
      <div className="rounded-xl bg-orange-950/30 border border-zinc-200 dark:border-orange-500/10 p-6">
        <p className="text-xs uppercase tracking-widest text-zinc-500 dark:text-orange-300/40 mb-1">Tableau de bord</p>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">{displayName}</h1>
        <p className="text-sm text-zinc-600 dark:text-orange-200/50">Enseignant — {universityId ?? '—'}</p>
      </div>

      {/* Semestre en cours — données réelles */}
      {universityId && <SemestreEnCours universityId={universityId} variant="compact" />}

      {/* KPI réels : créneaux, absences et notes viennent de Firebase. Les cours
          sont rattachés à l'enseignant par son NOM (convention des créneaux,
          identique à /teacher/schedule). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Mes classes"
          value={classes}
          icon={Layers}
          hint={
            classes === 0
              ? 'Aucun créneau ne vous est assigné'
              : `${matieres} matière${matieres > 1 ? 's' : ''} · ${etudiantsConcernes} étudiant${etudiantsConcernes > 1 ? 's' : ''}`
          }
          href="/dashboard/teacher/schedule"
          loading={loading}
        />

        <KpiCard
          label="Notes à saisir"
          value={notesEnAttente}
          icon={PenLine}
          tone={notesEnAttente > 0 ? 'alert' : 'default'}
          hint={
            notesEnAttente > 0
              ? 'Étudiants sans note ce semestre'
              : classes === 0
                ? 'Aucune classe assignée'
                : 'Toutes vos notes sont saisies'
          }
          href="/dashboard/teacher/grades"
          loading={loading}
        />

        <KpiCard
          label="Absences à traiter"
          value={absencesATraiter}
          icon={CalendarX}
          tone={absencesATraiter > 0 ? 'alert' : 'default'}
          hint={
            absencesATraiter > 0
              ? 'Injustifiées dans vos matières'
              : 'Aucune absence injustifiée'
          }
          href="/dashboard/teacher/absences"
          loading={loading}
        />

        <KpiCard
          label="Prochain cours"
          value={prochainCours ? prochainCours.matiere : null}
          icon={CalendarClock}
          hint={
            prochainCours
              ? `${JOUR_LABEL[prochainCours.jour]} ${prochainCours.heureDebut} · ${prochainCours.salle || 'salle non précisée'}`
              : 'Aucun cours planifié'
          }
          href="/dashboard/teacher/schedule"
          loading={loading}
        />
      </div>

      {/* Assistant IA flottant */}
      {universityId && <ChatbotWidget universityId={universityId} />}
    </div>
  )
}
