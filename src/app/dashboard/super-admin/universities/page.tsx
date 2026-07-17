'use client'

import { useState, useEffect } from 'react'
import { X, Eye, AlertTriangle } from 'lucide-react'
import {
  getAllUniversities,
  updateUniversityStatus,
  getUniversityStudentCount,
  type UniversityEntry,
} from '@/lib/db'
import { PlanBadge } from '@/components/ui/plan-badge'
import type { PlanId } from '@/types/plan'

const plans = ['Tous', 'Standard', 'Premium', 'Enterprise']

const statColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
  inactive: 'bg-zinc-200 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-600/30',
}

const statLabel: Record<string, string> = {
  active: 'Actif',
  suspended: 'Suspendu',
  inactive: 'Inactif',
}

export default function UniversitiesPage() {
  const [univ, setUniv] = useState<UniversityEntry[]>([])
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({})
  const [fbLoading, setFbLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('Tous')
  const [detail, setDetail] = useState<UniversityEntry | null>(null)

  // Suspension / réactivation : confirmation via modal, écriture Firebase
  // ATTENDUE, puis refetch depuis la source — aucune mise à jour optimiste du
  // state avant confirmation, aucune erreur avalée silencieusement.
  const [confirmTarget, setConfirmTarget] = useState<UniversityEntry | null>(null)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const data = await getAllUniversities()
        if (!active) return
        setUniv(data)
        try {
          const counts = await Promise.all(data.map((u) => getUniversityStudentCount(u.id)))
          if (!active) return
          const map: Record<string, number> = {}
          data.forEach((u, i) => { map[u.id] = counts[i] })
          setStudentCounts(map)
        } catch {
          /* comptage indisponible : la colonne affichera "—" (pas de faux 0) */
        }
      } catch {
        if (active) setUniv([])
      } finally {
        if (active) setFbLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const filtered = univ.filter((u) =>
    (planFilter === 'Tous' || u.plan.toLowerCase() === planFilter.toLowerCase()) &&
    u.name.toLowerCase().includes(search.toLowerCase())
  )

  /** Recharge la liste + les comptages depuis Firebase (source de vérité). */
  async function refetch() {
    const data = await getAllUniversities()
    setUniv(data)
    // Comptages best-effort : un échec de comptage ne doit pas faire croire à un
    // échec de l'action de statut (déjà confirmée par Firebase à ce stade).
    const counts = await Promise.all(data.map((u) => getUniversityStudentCount(u.id).catch(() => 0)))
    const map: Record<string, number> = {}
    data.forEach((u, i) => { map[u.id] = counts[i] })
    setStudentCounts(map)
  }

  async function confirmToggle() {
    if (!confirmTarget) return
    const u = confirmTarget
    const next: 'active' | 'suspended' = u.status === 'suspended' ? 'active' : 'suspended'
    setActing(true)
    setActionError(null)
    try {
      await updateUniversityStatus(u.id, next)
    } catch {
      // L'écriture a échoué : on l'affiche clairement, aucune modification locale.
      setActionError('Échec de la mise à jour du statut. Aucune modification enregistrée.')
      setActing(false)
      return
    }
    // Écriture confirmée par Firebase → rafraîchissement depuis la source.
    try {
      await refetch()
    } catch {
      /* écriture réussie mais rafraîchissement impossible : sans conséquence */
    }
    setActing(false)
    setConfirmTarget(null)
  }

  if (fbLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Gestion des universités</h1>
          <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">{univ.length} établissement{univ.length > 1 ? 's' : ''} sur la plateforme</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une université…"
          className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 text-sm w-72"
        />
        <div className="flex gap-2 flex-wrap">
          {plans.map((p) => (
            <button
              key={p}
              onClick={() => setPlanFilter(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                planFilter === p
                  ? 'bg-orange-500/20 text-blue-600 dark:text-orange-400 border-orange-500/30'
                  : 'bg-zinc-50 dark:bg-black/40 text-zinc-600 dark:text-orange-200/60 border-zinc-200 dark:border-orange-500/10 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-black/40 text-blue-700 dark:text-orange-300/60 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Université</th>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-center">Plan</th>
              <th className="px-4 py-3 text-center">Étudiants</th>
              <th className="px-4 py-3 text-left">Créé le</th>
              <th className="px-4 py-3 text-center">Statut</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-500 dark:text-orange-200/30 text-sm">
                  Aucune université trouvée
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-t border-orange-500/5 hover:bg-orange-500/5 transition-colors">
                  <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/80 font-medium max-w-56 truncate">{u.name}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/40 font-mono text-xs">{u.slug}</td>
                  <td className="px-4 py-3 text-center">
                    <PlanBadge plan={u.plan.toLowerCase() as PlanId} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-800 dark:text-orange-100/60">
                    {u.id in studentCounts ? studentCounts[u.id] : '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/50 text-xs">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium border rounded-full px-2.5 py-0.5 ${statColors[u.status] ?? statColors.inactive}`}>
                      {statLabel[u.status] ?? u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => setDetail(u)}
                        className="p-1.5 rounded-lg bg-orange-500/10 text-blue-600 dark:text-orange-400 hover:bg-orange-500/20 transition-colors"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => { setActionError(null); setConfirmTarget(u) }}
                        className={`text-xs rounded-lg px-2 py-1 font-medium transition-colors border ${
                          u.status === 'suspended'
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}
                      >
                        {u.status === 'suspended' ? 'Activer' : 'Susp.'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-8 w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{detail.name}</h2>
              <button onClick={() => setDetail(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 text-sm flex-1 min-h-0 overflow-y-auto">
              {[
                ['Code', detail.slug],
                ['Plan', detail.plan || '—'],
                ['Statut', statLabel[detail.status] ?? detail.status],
                ['Étudiants', detail.id in studentCounts ? String(studentCounts[detail.id]) : '—'],
                ['Créé le', detail.createdAt ? new Date(detail.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'],
                ['ID admin', detail.adminUid || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-orange-500/5 pb-2">
                  <span className="text-zinc-600 dark:text-orange-200/50">{k}</span>
                  <span className="text-zinc-900 dark:text-white font-medium font-mono text-xs truncate max-w-48">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {confirmTarget && (() => {
        const next = confirmTarget.status === 'suspended' ? 'active' : 'suspended'
        const label = next === 'suspended' ? 'Suspendre' : 'Réactiver'
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-8 w-full max-w-md flex flex-col max-h-[90vh]">
              <div className="flex items-start gap-3 mb-5 flex-1 min-h-0 overflow-y-auto">
                <div className={`p-2 rounded-xl shrink-0 ${next === 'suspended' ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}`}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{label} l’université&nbsp;?</h2>
                  <p className="text-sm text-zinc-600 dark:text-orange-200/50 mt-1">
                    {next === 'suspended'
                      ? <>«&nbsp;{confirmTarget.name}&nbsp;» perdra l’accès à la plateforme jusqu’à réactivation.</>
                      : <>«&nbsp;{confirmTarget.name}&nbsp;» retrouvera l’accès à la plateforme.</>}
                  </p>
                </div>
              </div>

              {actionError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4 shrink-0">
                  {actionError}
                </p>
              )}

              <div className="flex gap-3 justify-end shrink-0">
                <button
                  onClick={() => { setConfirmTarget(null); setActionError(null) }}
                  disabled={acting}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-orange-200/70 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-orange-500/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmToggle}
                  disabled={acting}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50 ${
                    next === 'suspended'
                      ? 'bg-red-500/15 text-red-400 border-red-500/20 hover:bg-red-500/25'
                      : 'bg-green-500/15 text-green-400 border-green-500/20 hover:bg-green-500/25'
                  }`}
                >
                  {acting ? 'En cours…' : label}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
