'use client'

import { useMemo } from 'react'
import { Clock, MapPin, Info, CalendarCheck } from 'lucide-react'
import {
  type Examen,
  TYPE_SESSION_LABELS,
  TYPE_SESSION_STYLES,
  STATUT_EXAMEN_LABELS,
  STATUT_EXAMEN_STYLES,
  formatDateLong,
  joursRestants,
  estImminent,
  compareExamens,
} from '@/types/examen'

interface ExamensListeProps {
  examens: Examen[]
  /**
   * Rôle de l'utilisateur pour cet examen (ex : « Responsable » / « Surveillant »
   * côté enseignant). Retourne null pour ne rien afficher.
   */
  roleFor?: (examen: Examen) => string | null
  emptyMessage?: string
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Libellé d'urgence : « Aujourd'hui », « Demain » ou « Dans N jours ». */
function urgenceLabel(dateStr: string): string {
  const j = joursRestants(dateStr)
  if (j <= 0) return "Aujourd'hui"
  if (j === 1) return 'Demain'
  return `Dans ${j} jours`
}

/**
 * Liste chronologique d'examens, groupée par date, en LECTURE SEULE. Partagée par
 * les vues étudiant / parent / enseignant. Met en avant les examens imminents
 * (≤ 7 jours) et affiche les examens annulés barrés plutôt que de les masquer.
 */
export function ExamensListe({ examens, roleFor, emptyMessage }: ExamensListeProps) {
  const groupes = useMemo(() => {
    const map = new Map<string, Examen[]>()
    for (const e of [...examens].sort(compareExamens)) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return [...map.entries()] // déjà trié : les dates ont été insérées dans l'ordre
  }, [examens])

  if (examens.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
        {emptyMessage ?? 'Aucun examen programmé.'}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {groupes.map(([date, items]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-3">
            <CalendarCheck size={15} className="text-blue-600 dark:text-orange-400 shrink-0" />
            <h3 className="text-sm font-semibold text-zinc-600 dark:text-orange-200/80">{capitalize(formatDateLong(date))}</h3>
          </div>
          <div className="space-y-2.5">
            {items.map((e) => {
              const annule = e.statut === 'annule'
              const imminent = estImminent(e)
              return (
                <div
                  key={e.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    annule
                      ? 'border-zinc-200 dark:border-white/10 bg-white/[0.02] opacity-60'
                      : imminent
                        ? 'border-orange-500/40 bg-orange-500/[0.07]'
                        : 'border-orange-500/15 bg-white dark:bg-zinc-950'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-blue-600 dark:text-orange-400">
                        <Clock size={12} /> {e.heureDebut} – {e.heureFin}
                      </span>
                      <p
                        className={`text-base font-semibold mt-1 leading-snug ${
                          annule ? 'text-zinc-500 line-through' : 'text-zinc-900 dark:text-white'
                        }`}
                      >
                        {e.matiereNom || 'Matière'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 justify-end">
                      {!annule && imminent && (
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-orange-500 text-white">
                          {urgenceLabel(e.date)}
                        </span>
                      )}
                      <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${TYPE_SESSION_STYLES[e.typeSession]}`}>
                        {TYPE_SESSION_LABELS[e.typeSession]}
                      </span>
                      {(annule || e.statut === 'termine' || e.statut === 'en_cours') && (
                        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${STATUT_EXAMEN_STYLES[e.statut]}`}>
                          {STATUT_EXAMEN_LABELS[e.statut]}
                        </span>
                      )}
                      {roleFor?.(e) && (
                        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-white/15 bg-white dark:bg-white/5 text-zinc-700 dark:text-zinc-300">
                          {roleFor(e)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-zinc-600 dark:text-zinc-400">
                    {e.salle && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={13} className="text-zinc-500" /> {e.salle}
                      </span>
                    )}
                  </div>

                  {e.instructions && (
                    <p className="mt-2.5 flex items-start gap-1.5 text-[13px] text-zinc-800 dark:text-orange-100/60 leading-relaxed">
                      <Info size={13} className="text-blue-600 dark:text-orange-400/70 shrink-0 mt-0.5" />
                      {e.instructions}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default ExamensListe
