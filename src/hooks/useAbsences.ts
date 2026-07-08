'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getAbsences,
  getAbsencesForStudent,
  getSeuilAlerteConfig,
  type Absence,
} from '@/lib/db'
import { DEFAULT_SEUIL_ABSENCES } from '@/types/absence'

interface UseAbsencesResult {
  absences: Absence[]
  loading: boolean
  /** Total d'absences injustifiées (toutes matières confondues). */
  totalInjustifiees: number
  /** Seuil d'alerte configuré par l'université. */
  seuil: number
  /**
   * true dès qu'UNE matière atteint le seuil d'injustifiées (RÈGLE 3 : le seuil
   * s'apprécie « pour une matière donnée », pas sur le cumul global).
   */
  alerteSeuilAtteint: boolean
  refetch: () => Promise<void>
}

/**
 * Plus grand nombre d'absences injustifiées sur une seule matière. Les absences
 * sans matière renseignée sont regroupées dans un même seau ('—').
 */
function maxInjustifieesParMatiere(absences: Absence[]): number {
  const parMatiere = new Map<string, number>()
  for (const a of absences) {
    if (a.justifiee) continue
    const key = a.matiere || '—'
    parMatiere.set(key, (parMatiere.get(key) ?? 0) + 1)
  }
  let max = 0
  for (const n of parMatiere.values()) if (n > max) max = n
  return max
}

/**
 * Charge les absences (d'un étudiant si `etudiantUid` est fourni, sinon toute
 * l'université) et le seuil d'alerte. Le filtrage par rôle reste à la charge de
 * la page appelante ; ce hook centralise le chargement + le calcul d'alerte.
 */
export function useAbsences(
  universityId: string,
  etudiantUid?: string
): UseAbsencesResult {
  const [absences, setAbsences] = useState<Absence[]>([])
  const [seuil, setSeuil] = useState(DEFAULT_SEUIL_ABSENCES)
  const [loading, setLoading] = useState(Boolean(universityId))

  // Réinitialisation au changement de cible (pattern « information from previous
  // renders » — évite un setState en effet, qui casse `next build`).
  const key = `${universityId}|${etudiantUid ?? ''}`
  const [prevKey, setPrevKey] = useState(key)
  if (key !== prevKey) {
    setPrevKey(key)
    setLoading(Boolean(universityId))
  }

  // Chargeur pur (pas de setState) réutilisé par l'effet et par refetch.
  const fetchAll = useCallback(async (): Promise<{ list: Absence[]; seuil: number }> => {
    if (!universityId) return { list: [], seuil: DEFAULT_SEUIL_ABSENCES }
    const [list, s] = await Promise.all([
      etudiantUid
        ? getAbsencesForStudent(universityId, etudiantUid)
        : getAbsences(universityId),
      getSeuilAlerteConfig(universityId),
    ])
    return {
      list: [...list].sort((a, b) => b.date.localeCompare(a.date)),
      seuil: s,
    }
  }, [universityId, etudiantUid])

  useEffect(() => {
    let active = true
    fetchAll()
      .then(({ list, seuil: s }) => {
        if (!active) return
        setAbsences(list)
        setSeuil(s)
        setLoading(false)
      })
      .catch(() => {
        // Lecture en échec : on retombe sur un état vide (aucune fausse alerte).
        if (!active) return
        setAbsences([])
        setSeuil(DEFAULT_SEUIL_ABSENCES)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [fetchAll])

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const { list, seuil: s } = await fetchAll()
      setAbsences(list)
      setSeuil(s)
    } finally {
      setLoading(false)
    }
  }, [fetchAll])

  const totalInjustifiees = absences.filter((a) => !a.justifiee).length
  const alerteSeuilAtteint = maxInjustifieesParMatiere(absences) >= seuil

  return { absences, loading, totalInjustifiees, seuil, alerteSeuilAtteint, refetch }
}

export default useAbsences
