'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, History, Check, X, ChevronRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getCreneaux,
  getFilieres,
  getAppels,
  type Appel,
  type Filiere,
} from '@/lib/db'
import { type Creneau, JOUR_LABEL } from '@/types/emploi-du-temps'
import { compterPresences } from '@/types/absence'

const filterCls = 'bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-orange-500/60'

export default function HistoriqueAppelsPage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId

  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [appels, setAppels] = useState<Appel[]>([])
  const [loading, setLoading] = useState(true)

  const [filterCreneauId, setFilterCreneauId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [selected, setSelected] = useState<Appel | null>(null)

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [cres, fils, aps] = await Promise.all([
          getCreneaux(universityId),
          getFilieres(universityId),
          getAppels(universityId),
        ])
        if (!active) return
        setCreneaux(cres)
        setFilieres(fils)
        setAppels(aps)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId])

  const filiereNom = useMemo(() => {
    const map = new Map(filieres.map((f) => [f.id, f.nom]))
    return (id: string) => map.get(id) ?? ''
  }, [filieres])

  const creneauById = useMemo(() => new Map(creneaux.map((c) => [c.id, c])), [creneaux])

  function creneauLabel(creneauId: string): string {
    const c = creneauById.get(creneauId)
    if (!c) return 'Créneau supprimé'
    return `${c.matiere} — ${filiereNom(c.filiereId)} · ${c.niveau}`
  }

  // Uniquement les appels faits par CET enseignant — jamais ceux d'un collègue
  // (même règle métier que la justification/suppression d'absences).
  const mesAppels = useMemo(
    () => appels
      .filter((a) => a.faitParUid === user?.uid)
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt),
    [appels, user?.uid]
  )

  // Options du filtre créneau : dérivées des appels réellement présents (pas de
  // mesCreneaux du prof, car un appel passé peut référencer un créneau depuis
  // réassigné ou supprimé — on veut pouvoir filtrer dessus quand même).
  const creneauOptions = useMemo(() => {
    const ids = [...new Set(mesAppels.map((a) => a.creneauId))]
    return ids
      .map((id) => {
        const c = creneauById.get(id)
        const label = c ? `${c.matiere} — ${filiereNom(c.filiereId)} · ${c.niveau}` : 'Créneau supprimé'
        return { id, label }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [mesAppels, creneauById, filiereNom])

  const filtered = useMemo(
    () => mesAppels.filter((a) =>
      (!filterCreneauId || a.creneauId === filterCreneauId) &&
      (!dateFrom || a.date >= dateFrom) &&
      (!dateTo || a.date <= dateTo)
    ),
    [mesAppels, filterCreneauId, dateFrom, dateTo]
  )

  const selectedCreneau = selected ? creneauById.get(selected.creneauId) ?? null : null
  const selectedCompte = useMemo(() => compterPresences(selected?.etudiants), [selected])
  const selectedEtudiants = useMemo(
    () => [...(selected?.etudiants ?? [])].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [selected]
  )

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/teacher/absences" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-orange-200/40 hover:text-blue-800 dark:hover:text-orange-400 transition-colors mb-2">
          <ArrowLeft size={13} /> Retour aux absences
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <History size={22} className="text-blue-600 dark:text-orange-400" />
          Historique des appels
        </h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">Consultation en lecture seule de vos appels passés. Pour corriger une séance, refaites l’appel depuis cette date.</p>
      </div>

      {mesAppels.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
          Aucun appel enregistré pour l’instant.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select value={filterCreneauId} onChange={(e) => setFilterCreneauId(e.target.value)} className={filterCls}>
              <option value="">Tous mes créneaux</option>
              {creneauOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-orange-200/40">
              du
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${filterCls} scheme-dark`} />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-orange-200/40">
              au
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${filterCls} scheme-dark`} />
            </label>
          </div>

          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-black/40 text-blue-700 dark:text-orange-300/60 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Créneau</th>
                  <th className="px-5 py-3 text-center">Présents</th>
                  <th className="px-5 py-3 text-center">Absents</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-zinc-600 text-sm">Aucun appel pour ces filtres.</td></tr>
                ) : filtered.map((a) => {
                  const { presents, absents } = compterPresences(a.etudiants)
                  const c = creneauById.get(a.creneauId)
                  return (
                    <tr key={a.id} onClick={() => setSelected(a)}
                      className="border-t border-orange-500/5 hover:bg-orange-500/5 transition-colors cursor-pointer">
                      <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{new Date(a.date).toLocaleDateString('fr-FR')}</td>
                      <td className="px-5 py-3.5">
                        <p className="text-zinc-900 dark:text-white text-sm font-medium leading-none">{creneauLabel(a.creneauId)}</p>
                        {c && <p className="text-zinc-500 text-xs mt-1">{JOUR_LABEL[c.jour]} {c.heureDebut}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-center text-green-500 font-medium">{presents}</td>
                      <td className="px-5 py-3.5 text-center text-red-400 font-medium">{absents}</td>
                      <td className="px-5 py-3.5 text-right"><ChevronRight size={15} className="text-zinc-400 inline-block" /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Détail (lecture seule) */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between mb-4 shrink-0 gap-3">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{creneauLabel(selected.creneauId)}</h2>
                <p className="text-zinc-500 dark:text-orange-200/40 text-xs mt-1">
                  {new Date(selected.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {selectedCreneau && <> · {selectedCreneau.heureDebut}–{selectedCreneau.heureFin}</>}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white shrink-0"><X size={20} /></button>
            </div>

            <div className="flex items-center gap-3 text-xs mb-4 shrink-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium bg-green-500/15 text-green-400 border border-green-500/25">
                <Check size={11} /> {selectedCompte.presents} présent{selectedCompte.presents > 1 ? 's' : ''}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium bg-red-500/15 text-red-400 border border-red-500/25">
                <X size={11} /> {selectedCompte.absents} absent{selectedCompte.absents > 1 ? 's' : ''}
              </span>
            </div>

            <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-orange-500/5 -mx-7 px-7">
              {selectedEtudiants.map((e) => (
                <li key={e.uid} className="flex items-center justify-between gap-2 py-2.5">
                  <span className="text-zinc-900 dark:text-white text-sm">{e.displayName}</span>
                  {e.statut === 'present' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-green-500/15 text-green-400 border border-green-500/25 shrink-0">
                      <Check size={10} /> Présent
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/25">
                        <X size={10} /> Absent
                      </span>
                      {e.justifie && (
                        <span className="text-[11px] text-green-500">Justifié</span>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <div className="pt-5 shrink-0">
              <button onClick={() => setSelected(null)} className="w-full border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
