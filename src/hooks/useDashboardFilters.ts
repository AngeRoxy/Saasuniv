'use client'

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FILTER_KEYS,
  defaultFilterValue,
  type DashboardFilters,
  type FilterKey,
} from '@/types/filters'

interface UseDashboardFiltersResult {
  filters: DashboardFilters
  setFilter: (key: FilterKey, value: string) => void
  resetFilters: () => void
  /** Nombre de filtres actifs (≠ valeur par défaut). */
  activeCount: number
}

/**
 * Gère l'état des filtres contextuels d'un dashboard en le persistant dans la
 * query string de l'URL (survit au refresh, partageable par lien).
 *
 * La synchronisation passe par `window.history.replaceState`, qui s'intègre au
 * routeur Next.js (App Router) et met à jour `useSearchParams` sans recharger la
 * page ni relancer le rendu serveur — c'est l'équivalent "shallow" recommandé en
 * Next.js 16. `replaceState` (et non `pushState`) évite d'empiler une entrée
 * d'historique à chaque changement de filtre.
 *
 * Les filtres à leur valeur par défaut ("tous" ou "") ne sont pas écrits dans
 * l'URL.
 *
 * Doit être appelé sous un `<Suspense>` (contrainte de `useSearchParams`).
 */
export function useDashboardFilters(
  initialFilters?: Partial<DashboardFilters>
): UseDashboardFiltersResult {
  const searchParams = useSearchParams()

  // Sérialisation stable des valeurs initiales pour éviter de recalculer
  // `filters` à chaque rendu lorsqu'un objet littéral est passé en paramètre.
  const initialKey = JSON.stringify(initialFilters ?? {})

  const filters = useMemo<DashboardFilters>(() => {
    const initial = (initialKey ? JSON.parse(initialKey) : {}) as Partial<DashboardFilters>
    const result: DashboardFilters = {}

    for (const key of FILTER_KEYS) {
      const fallback = defaultFilterValue(key)
      const value = searchParams.get(key) ?? initial[key] ?? fallback
      // On ne conserve dans l'objet que les valeurs non par défaut,
      // sauf `statut` qui reste toujours défini (sa valeur par défaut "tous"
      // est une valeur sélectionnable dans le select).
      if (value !== fallback) {
        result[key] = value
      } else if (key === 'statut') {
        result[key] = fallback
      }
    }

    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, initialKey])

  /** Écrit la nouvelle query string sans navigation ni rechargement. */
  const commit = useCallback((params: URLSearchParams) => {
    const qs = params.toString()
    const url = qs ? `?${qs}` : window.location.pathname
    window.history.replaceState(null, '', url)
  }, [])

  const setFilter = useCallback(
    (key: FilterKey, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (!value || value === defaultFilterValue(key)) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      commit(params)
    },
    [searchParams, commit]
  )

  const resetFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    // On ne supprime que les clés de filtre (préserve d'éventuels autres params).
    for (const key of FILTER_KEYS) params.delete(key)
    commit(params)
  }, [searchParams, commit])

  const activeCount = useMemo(
    () =>
      FILTER_KEYS.reduce((count, key) => {
        const value = filters[key]
        return value && value !== defaultFilterValue(key) ? count + 1 : count
      }, 0),
    [filters]
  )

  return { filters, setFilter, resetFilters, activeCount }
}
