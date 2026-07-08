'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles,
  AlertTriangle,
  Compass,
  BookOpen,
  Trophy,
  RefreshCw,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { ref, get } from 'firebase/database'
import { auth, db } from '@/lib/firebase'
import { PlanGate } from '@/components/ui/plan-gate'
import type { RecommandationIA, RecommandationType } from '@/types/chatbot'

interface NoteInput {
  matiere: string
  note: number
  credits: number
  coefficient: number
}

interface RecommandationsIAProps {
  universityId: string
  etudiantUid: string
  notes: NoteInput[]
  className?: string
}

/** Style (icône + couleurs) par type de recommandation. */
const typeStyles: Record<RecommandationType, { icon: LucideIcon; border: string; text: string }> = {
  alerte_echec: { icon: AlertTriangle, border: 'border-red-500/30', text: 'text-red-400' },
  orientation: { icon: Compass, border: 'border-blue-500/30', text: 'text-blue-400' },
  revision: { icon: BookOpen, border: 'border-orange-500/30', text: 'text-orange-400' },
  encouragement: { icon: Trophy, border: 'border-green-500/30', text: 'text-green-400' },
}

export function RecommandationsIA({
  universityId,
  etudiantUid,
  notes,
  className,
}: RecommandationsIAProps) {
  const [isEnterprise, setIsEnterprise] = useState(false)
  const [planChecked, setPlanChecked] = useState(false)

  const [recommandations, setRecommandations] = useState<RecommandationIA[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasGenerated, setHasGenerated] = useState(false)

  // Vérifie le plan de l'université : visible uniquement en « enterprise ».
  useEffect(() => {
    let active = true
    async function checkPlan() {
      try {
        const snap = await get(ref(db, `universities/${universityId}/plan`))
        const plan = snap.val()
        if (active) setIsEnterprise(plan === 'enterprise')
      } catch {
        if (active) setIsEnterprise(false)
      } finally {
        if (active) setPlanChecked(true)
      }
    }
    if (universityId) checkPlan()
    return () => {
      active = false
    }
  }, [universityId])

  async function analyser() {
    setLoading(true)
    setError(null)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        setError('Vous devez être connecté.')
        return
      }

      const res = await fetch('/api/recommandations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ etudiantUid, universityId, notes }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data?.error ?? "Une erreur est survenue lors de l'analyse.")
        return
      }

      setRecommandations(data.recommandations ?? [])
      setHasGenerated(true)
    } catch {
      setError("Impossible de générer les recommandations pour le moment.")
    } finally {
      setLoading(false)
    }
  }

  // Plan non vérifié ou non « enterprise » → composant masqué.
  if (!planChecked || !isEnterprise) return null

  return (
    <PlanGate feature="recommandationsIA" universityId={universityId}>
      <div className={className}>
      {!hasGenerated && (
        <button
          onClick={analyser}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyse en cours…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Analyser mes résultats
            </>
          )}
        </button>
      )}

      {loading && hasGenerated && (
        <div className="flex items-center gap-2 text-sm text-orange-200/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyse en cours…
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {hasGenerated && !loading && recommandations.length === 0 && !error && (
        <p className="text-sm text-zinc-500">Aucune recommandation pour le moment.</p>
      )}

      {recommandations.length > 0 && (
        <div className="mt-2 space-y-3">
          {recommandations.map((reco, i) => {
            const style = typeStyles[reco.type] ?? typeStyles.revision
            const Icon = style.icon
            return (
              <motion.div
                key={reco.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.06 }}
                className={`flex items-start gap-3 rounded-xl bg-zinc-950 border ${style.border} p-4`}
              >
                <div className="rounded-lg bg-black/40 p-2 shrink-0">
                  <Icon className={`h-5 w-5 ${style.text}`} />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm leading-relaxed text-orange-100/80">{reco.contenu}</p>
                  {reco.matieresImpactees.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {reco.matieresImpactees.map((m) => (
                        <span
                          key={m}
                          className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-xs text-zinc-300"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}

          <button
            onClick={analyser}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-400 transition-colors hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Rafraîchir l&apos;analyse
          </button>
        </div>
      )}
      </div>
    </PlanGate>
  )
}
