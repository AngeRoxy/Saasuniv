'use client'

import { useState, useEffect, useMemo } from 'react'
import { Video, Radio, Clock, History } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getUniversityMember, getFilieres, ecouterSessionsActives, type SessionEnLigne } from '@/lib/db'
import { compareSessionsRecentes } from '@/types/cours-en-ligne'
import { ComingSoon } from '@/components/ui/coming-soon'
import { JitsiVideoCall } from '@/components/ui/jitsi-video-call'

export default function StudentCoursEnLignePage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId
  const displayName = profile?.displayName ?? user?.displayName ?? user?.email ?? 'Étudiant'

  const [metaLoading, setMetaLoading] = useState(true)
  const [filiereId, setFiliereId] = useState<string | undefined>()
  const [niveau, setNiveau] = useState<string | undefined>()
  const [filiereNom, setFiliereNom] = useState('')

  // `null` = écouteur pas encore initialisé / premier snapshot non reçu.
  const [sessions, setSessions] = useState<SessionEnLigne[] | null>(null)
  const [activeSession, setActiveSession] = useState<SessionEnLigne | null>(null)

  // Étape 1 — résoudre le groupe (filière + niveau) de l'étudiant.
  useEffect(() => {
    if (!universityId || !user?.uid) return
    let active = true
    ;(async () => {
      setMetaLoading(true)
      try {
        const [member, filieres] = await Promise.all([
          getUniversityMember(universityId, user.uid),
          getFilieres(universityId),
        ])
        if (!active) return
        const filiere = member?.filiere ? filieres.find((f) => f.nom === member.filiere) : undefined
        setFiliereId(filiere?.id)
        setFiliereNom(member?.filiere ?? '')
        setNiveau(member?.niveau ?? undefined)
      } finally {
        if (active) setMetaLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [universityId, user?.uid])

  // Étape 2 — écoute TEMPS RÉEL : le bouton « Rejoindre » s'active dès que
  // l'enseignant démarre, sans rafraîchir la page. L'écouteur est désabonné au
  // démontage (ou si le groupe change) pour éviter toute fuite.
  useEffect(() => {
    if (!universityId || !filiereId || !niveau) return
    const unsubscribe = ecouterSessionsActives(universityId, filiereId, niveau, (list) => {
      setSessions(list)
    })
    return () => unsubscribe()
  }, [universityId, filiereId, niveau])

  const { enDirect, programmees, terminees } = useMemo(() => {
    const all = [...(sessions ?? [])].sort(compareSessionsRecentes)
    return {
      enDirect: all.filter((s) => s.statut === 'en_direct'),
      programmees: all.filter((s) => s.statut === 'programmee'),
      terminees: all.filter((s) => s.statut === 'terminee'),
    }
  }, [sessions])

  if (metaLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!filiereId || !niveau) {
    return (
      <ComingSoon
        icon={Video}
        title="Cours en ligne"
        description="Votre filière et votre niveau ne sont pas encore renseignés. Contactez l'administration de votre université pour accéder aux cours en direct de votre groupe."
      />
    )
  }

  return (
    <div className="space-y-6">
      {activeSession && (
        <JitsiVideoCall
          roomName={activeSession.roomName}
          displayName={displayName}
          leaveLabel="Quitter le cours"
          sousTitre={`${activeSession.matiereNom} · ${activeSession.enseignantNom}`}
          onCallEnd={() => setActiveSession(null)}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <Video size={22} className="text-blue-600 dark:text-orange-400" />
          Cours en ligne
        </h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
          {filiereNom}
          {filiereNom && niveau ? ' · ' : ''}
          {niveau}
        </p>
      </div>

      {sessions === null ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* En direct maintenant — mis en avant, bordure orange pulsante */}
          <section className="space-y-3">
            {enDirect.length === 0 ? (
              <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl px-5 py-8 text-center text-zinc-500 dark:text-orange-200/30 text-sm">
                Aucun cours en direct pour l’instant. Cette page se met à jour automatiquement dès
                qu’un enseignant démarre un cours.
              </div>
            ) : (
              enDirect.map((s) => (
                <div key={s.id} className="relative rounded-xl p-5 border border-orange-500/40 bg-orange-500/5">
                  {/* Anneau orange pulsant (superposé, ne touche pas la lisibilité du contenu). */}
                  <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-orange-500/60 animate-pulse" />
                  <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-red-400 text-xs font-semibold uppercase tracking-wider">
                          En direct maintenant
                        </span>
                      </div>
                      <h3 className="text-zinc-900 dark:text-white font-semibold mt-2 flex items-center gap-2">
                        <Video size={17} className="text-blue-600 dark:text-orange-400 shrink-0" />
                        <span className="truncate">{s.titre}</span>
                      </h3>
                      <p className="text-zinc-600 dark:text-orange-200/60 text-sm mt-1">
                        {s.matiereNom} — avec {s.enseignantNom}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveSession(s)}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shrink-0"
                    >
                      <Radio size={16} /> Rejoindre le cours
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>

          {/* Programmés — pas encore commencés, grisés */}
          {programmees.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-600 dark:text-orange-200/50 flex items-center gap-2">
                <Clock size={15} /> À venir
              </h2>
              <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl divide-y divide-zinc-200 dark:divide-white/5">
                {programmees.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5 opacity-60">
                    <div className="min-w-0">
                      <p className="text-zinc-900 dark:text-white text-sm font-medium truncate">{s.titre}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">
                        {s.matiereNom} — {s.enseignantNom}
                      </p>
                    </div>
                    <span className="text-zinc-500 text-xs shrink-0">Pas encore commencé</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Historique — terminés, non rejoignables */}
          {terminees.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-600 dark:text-orange-200/50 flex items-center gap-2 pt-2">
                <History size={15} /> Historique
              </h2>
              <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl divide-y divide-zinc-200 dark:divide-white/5">
                {terminees.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-zinc-700 dark:text-zinc-300 text-sm font-medium truncate">{s.titre}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">
                        {s.matiereNom} — {s.enseignantNom}
                      </p>
                    </div>
                    <span className="text-zinc-600 text-xs shrink-0">
                      {s.demarreeAt ? new Date(s.demarreeAt).toLocaleDateString('fr-FR') : 'Terminé'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-orange-200/30">
                Ces sessions sont terminées. Aucun enregistrement n’est disponible (limitation du
                service gratuit Jitsi).
              </p>
            </section>
          )}
        </>
      )}
    </div>
  )
}
