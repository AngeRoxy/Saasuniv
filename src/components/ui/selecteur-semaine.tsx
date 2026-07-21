'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { lundiDeLaSemaine } from '@/types/emploi-du-temps'

interface SelecteurSemaineProps {
  /** Lundi (00:00 local) de la semaine affichée. */
  lundi: Date
  /** Appelé avec le lundi de la nouvelle semaine choisie. */
  onChange: (lundi: Date) => void
}

/** Décale un lundi de `deltaJours` jours (conserve 00:00 local). */
function decaler(lundi: Date, deltaJours: number): Date {
  return new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + deltaJours)
}

/** « lun. 13 » — jour + numéro, sans l'année (compact). */
function labelJour(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
}

/**
 * Navigateur de semaine calendaire. L'emploi du temps reste une grille récurrente ;
 * ce sélecteur ancre simplement la semaine affichée à un lundi réel, ce qui donne
 * un sens aux états datés (remplacement ponctuel, annulation). Semaine ouvrée
 * lundi→samedi, cohérente avec `JOURS`.
 */
export function SelecteurSemaine({ lundi, onChange }: SelecteurSemaineProps) {
  const samedi = decaler(lundi, 5)
  const lundiCourant = lundiDeLaSemaine(new Date())
  const estSemaineCourante = lundi.getTime() === lundiCourant.getTime()

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(decaler(lundi, -7))}
        className="p-2 rounded-lg border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors"
        aria-label="Semaine précédente"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="min-w-[11rem] text-center">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-tight">
          {labelJour(lundi)} – {samedi.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-orange-200/40 leading-tight">
          {lundi.toLocaleDateString('fr-FR', { year: 'numeric' })}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onChange(decaler(lundi, 7))}
        className="p-2 rounded-lg border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors"
        aria-label="Semaine suivante"
      >
        <ChevronRight size={16} />
      </button>

      {!estSemaineCourante && (
        <button
          type="button"
          onClick={() => onChange(lundiCourant)}
          className="ml-1 text-xs px-2.5 py-1.5 rounded-lg border border-orange-500/20 text-blue-600 dark:text-orange-400 hover:border-orange-500/40 transition-colors"
        >
          Cette semaine
        </button>
      )}
    </div>
  )
}

export default SelecteurSemaine
