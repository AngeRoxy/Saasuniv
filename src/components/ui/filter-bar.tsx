'use client'

import { X, SlidersHorizontal, RotateCcw } from 'lucide-react'
import {
  defaultFilterValue,
  type DashboardFilters,
  type FilterKey,
  type FilterOption,
} from '@/types/filters'

interface FilterBarOptions {
  semestres?: FilterOption[]
  filieres?: FilterOption[]
  matieres?: FilterOption[]
  enseignants?: FilterOption[]
  statuts?: FilterOption[]
  groupes?: FilterOption[]
}

interface FilterBarProps {
  filters: DashboardFilters
  onFilterChange: (key: FilterKey, value: string) => void
  options: FilterBarOptions
  activeCount?: number
  className?: string
}

/** Configuration d'affichage : ordre + libellés + placeholder « tout ». */
const CONFIG: {
  key: FilterKey
  optionsKey: keyof FilterBarOptions
  label: string
  placeholder: string
}[] = [
  { key: 'semestre', optionsKey: 'semestres', label: 'Semestre', placeholder: 'Tous les semestres' },
  { key: 'filiere', optionsKey: 'filieres', label: 'Filière', placeholder: 'Toutes les filières' },
  { key: 'matiere', optionsKey: 'matieres', label: 'Matière', placeholder: 'Toutes les matières' },
  { key: 'enseignant', optionsKey: 'enseignants', label: 'Enseignant', placeholder: 'Tous les enseignants' },
  { key: 'groupe', optionsKey: 'groupes', label: 'Groupe', placeholder: 'Tous les groupes' },
  { key: 'statut', optionsKey: 'statuts', label: 'Statut', placeholder: 'Tous' },
]

/**
 * Barre de filtres contextuels réutilisable (PROMPT 07).
 * Affiche un select par groupe d'options fourni. Un filtre actif (≠ défaut)
 * passe en accent orange et expose une croix de réinitialisation.
 */
export function FilterBar({
  filters,
  onFilterChange,
  options,
  activeCount,
  className = '',
}: FilterBarProps) {
  const visible = CONFIG.filter((c) => (options[c.optionsKey]?.length ?? 0) > 0)
  if (visible.length === 0) return null

  const count =
    activeCount ??
    visible.reduce((n, c) => {
      const v = filters[c.key]
      return v && v !== defaultFilterValue(c.key) ? n + 1 : n
    }, 0)

  function resetAll() {
    for (const c of visible) onFilterChange(c.key, defaultFilterValue(c.key))
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 ${className}`}
    >
      <div className="flex items-center gap-1.5 pr-1 text-xs font-medium text-zinc-500">
        <SlidersHorizontal size={14} className="text-orange-400/70" />
        <span className="hidden sm:inline">Filtres</span>
      </div>

      {visible.map((c) => {
        const opts = options[c.optionsKey]!
        const fallback = defaultFilterValue(c.key)
        const value = filters[c.key] ?? fallback
        const active = value !== fallback

        return (
          <div
            key={c.key}
            className={`group relative flex items-center rounded-lg border transition-colors ${
              active
                ? 'border-orange-500/40 bg-orange-500/20'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <select
              aria-label={c.label}
              value={value}
              onChange={(e) => onFilterChange(c.key, e.target.value)}
              className={`cursor-pointer appearance-none rounded-lg bg-transparent py-1.5 pl-3 text-sm focus:outline-none ${
                active ? 'pr-7 text-orange-300' : 'pr-3 text-zinc-300'
              }`}
            >
              <option value={fallback} className="bg-zinc-900 text-zinc-300">
                {c.placeholder}
              </option>
              {opts.map((o) => (
                <option key={o.value} value={o.value} className="bg-zinc-900 text-zinc-200">
                  {o.label}
                </option>
              ))}
            </select>

            {active && (
              <button
                type="button"
                onClick={() => onFilterChange(c.key, fallback)}
                aria-label={`Réinitialiser ${c.label}`}
                className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-orange-300/80 hover:bg-orange-500/30 hover:text-orange-200"
              >
                <X size={11} />
              </button>
            )}
          </div>
        )
      })}

      {count > 0 && (
        <button
          type="button"
          onClick={resetAll}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-orange-500/30 hover:text-orange-300"
        >
          <RotateCcw size={12} />
          Réinitialiser
          <span className="rounded-full bg-orange-500/20 px-1.5 text-orange-300">{count}</span>
        </button>
      )}
    </div>
  )
}

export default FilterBar
