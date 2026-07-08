'use client'

import { useCallback, useEffect, useState } from 'react'
import { getExamens, type Examen } from '@/lib/db'
import { compareExamens, todayISO } from '@/types/examen'

interface UseExamensFilters {
  filiereId?: string
  niveau?: string
  semestreId?: string
}

interface UseExamensResult {
  examens: Examen[]
  loading: boolean
  /** Examens dont la date est aujourd'hui ou postérieure, triés chronologiquement. */
  examensAVenir: Examen[]
  refetch: () => Promise<void>
}

/**
 * Charge les examens d'une université, éventuellement restreints à une filière /
 * niveau / semestre. Centralise le chargement + le tri chronologique + le calcul
 * des examens à venir. Le filtrage par rôle (ex : uid enseignant) reste à la charge
 * de la page appelante. Calqué sur useAbsences pour rester compatible `next build`
 * (réinitialisation en phase de rendu, pas via un setState dans un effet).
 */
export function useExamens(
  universityId: string,
  filters?: UseExamensFilters
): UseExamensResult {
  const { filiereId, niveau, semestreId } = filters ?? {}

  const [examens, setExamens] = useState<Examen[]>([])
  const [loading, setLoading] = useState(Boolean(universityId))

  // Réinitialisation au changement de cible (pattern « information from previous
  // renders » — évite un setState en effet, qui casse `next build`).
  const key = `${universityId}|${filiereId ?? ''}|${niveau ?? ''}|${semestreId ?? ''}`
  const [prevKey, setPrevKey] = useState(key)
  if (key !== prevKey) {
    setPrevKey(key)
    setLoading(Boolean(universityId))
  }

  const fetchAll = useCallback(async (): Promise<Examen[]> => {
    if (!universityId) return []
    const list = await getExamens(universityId, { filiereId, niveau, semestreId })
    return [...list].sort(compareExamens)
  }, [universityId, filiereId, niveau, semestreId])

  useEffect(() => {
    let active = true
    fetchAll()
      .then((list) => {
        if (!active) return
        setExamens(list)
        setLoading(false)
      })
      .catch(() => {
        // Lecture en échec : état vide (aucun faux affichage d'examens).
        if (!active) return
        setExamens([])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [fetchAll])

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      setExamens(await fetchAll())
    } finally {
      setLoading(false)
    }
  }, [fetchAll])

  const today = todayISO()
  const examensAVenir = examens.filter((e) => e.date >= today)

  return { examens, loading, examensAVenir, refetch }
}

export default useExamens
