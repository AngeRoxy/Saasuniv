'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { User, BarChart3, CalendarX, CalendarClock, CreditCard } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getUniversityMembers, type UniversityMember } from '@/lib/db'
import { SemestreEnCours } from '@/components/ui/semestre-en-cours'
import { ComingSoon } from '@/components/ui/coming-soon'
import { KpiCard } from '@/components/ui/kpi-card'
import { useStudentSummary } from '@/hooks/useStudentSummary'
import { JOUR_LABEL } from '@/types/emploi-du-temps'
import { formatFCFA } from '@/types/paiement'

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

  // Même synthèse que l'espace étudiant, mais pour l'enfant sélectionné : le
  // parent voit exactement les chiffres que son enfant voit (source unique).
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
    loading: loadingSummary,
  } = useStudentSummary(universityId, selectedChild?.uid)

  const seuilDepasse = seuilAbsences > 0 && absencesInjustifiees >= seuilAbsences

  return (
    <div className="space-y-8">
      {/* Sélecteur d'enfant — données réelles */}
      {children.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-orange-200/40 mr-1">Enfant :</span>
          {children.map((c) => (
            <button
              key={c.uid}
              onClick={() => setSelectedUid(c.uid)}
              className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
                c.uid === selectedUid
                  ? 'bg-orange-500/20 border-orange-500/40 text-blue-700 dark:text-orange-300'
                  : 'bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-white/20'
              }`}
            >
              {c.displayName}
            </button>
          ))}
        </div>
      )}

      {/* Fiche enfant — données réelles */}
      <div className="rounded-xl bg-orange-950/30 border border-zinc-200 dark:border-orange-500/10 p-6 flex items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 border-2 border-orange-500/20 flex items-center justify-center shrink-0">
          <User className="h-8 w-8 text-zinc-500 dark:text-orange-300/40" />
        </div>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-zinc-500 dark:text-orange-300/40 mb-1">Bienvenue, {parentName}</p>
          {loadingChildren ? (
            <div className="h-6 w-48 animate-pulse rounded bg-white dark:bg-white/5 mt-1" />
          ) : selectedChild ? (
            <>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold text-zinc-900 dark:text-white">{selectedChild.displayName}</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-blue-600 dark:text-orange-400 border border-orange-500/20">
                  {selectedChild.statut ?? 'Actif'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-orange-200/50">
                {selectedChild.filiere && <span>{selectedChild.filiere}</span>}
                {selectedChild.filiere && selectedChild.niveau && <span>·</span>}
                {selectedChild.niveau && <span>{selectedChild.niveau}</span>}
                {selectedChild.matricule && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-blue-600 dark:text-orange-400/70">{selectedChild.matricule}</span>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-orange-200/40 mt-1">Aucun enfant rattaché à votre compte.</p>
          )}
        </div>
      </div>

      {/* Semestre en cours — données réelles */}
      {universityId && selectedChild && <SemestreEnCours universityId={universityId} variant="full" />}

      {/* Suivi scolaire de l'enfant — KPI réels (notes, absences, emploi du temps,
          paiements), identiques à ceux que voit l'étudiant lui-même. L'état vide
          honnête est conservé UNIQUEMENT quand aucun enfant n'est rattaché : ce
          n'est alors pas un module manquant, c'est une donnée manquante. */}
      {selectedChild ? (
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
            href="/dashboard/parent/grades"
            loading={loadingSummary}
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
            href="/dashboard/parent/absences"
            loading={loadingSummary}
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
            href="/dashboard/parent/schedule"
            loading={loadingSummary}
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
            href="/dashboard/parent/payments"
            loading={loadingSummary}
          />
        </div>
      ) : (
        !loadingChildren && (
          <div className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10">
            <ComingSoon
              icon={BarChart3}
              title="Suivi scolaire"
              description="Aucun enfant n'est rattaché à votre compte. Contactez l'administration de l'université pour lier votre enfant — son suivi (notes, absences, paiements) s'affichera alors ici."
              badge="En attente de rattachement"
            />
          </div>
        )
      )}

      {/* Assistant IA flottant */}
      {universityId && <ChatbotWidget universityId={universityId} />}
    </div>
  )
}
