'use client'

import { useState, useEffect } from 'react'
import { X, Eye } from 'lucide-react'
import { getAllUniversities, updateUniversityStatus, type UniversityEntry } from '@/lib/db'
import { PlanBadge } from '@/components/ui/plan-badge'
import type { PlanId } from '@/types/plan'

const plans = ['Tous', 'Standard', 'Premium', 'Enterprise']

const statColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
  inactive: 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30',
}

const statLabel: Record<string, string> = {
  active: 'Actif',
  suspended: 'Suspendu',
  inactive: 'Inactif',
}

export default function UniversitiesPage() {
  const [univ, setUniv] = useState<UniversityEntry[]>([])
  const [fbLoading, setFbLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('Tous')
  const [detail, setDetail] = useState<UniversityEntry | null>(null)

  useEffect(() => {
    getAllUniversities()
      .then((data) => setUniv(data))
      .catch(() => setUniv([]))
      .finally(() => setFbLoading(false))
  }, [])

  const filtered = univ.filter((u) =>
    (planFilter === 'Tous' || u.plan.toLowerCase() === planFilter.toLowerCase()) &&
    u.name.toLowerCase().includes(search.toLowerCase())
  )

  async function toggleStatut(u: UniversityEntry) {
    const next: 'active' | 'suspended' = u.status === 'suspended' ? 'active' : 'suspended'
    const label = next === 'suspended' ? 'Suspendre' : 'Réactiver'
    if (!confirm(`${label} "${u.name}" ?`)) return
    try { await updateUniversityStatus(u.id, next) } catch { /* fail silently */ }
    setUniv((prev) => prev.map((x) => x.id === u.id ? { ...x, status: next } : x))
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
          <h1 className="text-2xl font-bold text-white">Gestion des universités</h1>
          <p className="text-orange-200/40 text-sm mt-1">{univ.length} établissement{univ.length > 1 ? 's' : ''} sur la plateforme</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une université…"
          className="bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 text-sm w-72"
        />
        <div className="flex gap-2 flex-wrap">
          {plans.map((p) => (
            <button
              key={p}
              onClick={() => setPlanFilter(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                planFilter === p
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                  : 'bg-black/40 text-orange-200/60 border-orange-500/10 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-zinc-950 border border-orange-500/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-black/40 text-orange-300/60 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Université</th>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-center">Plan</th>
              <th className="px-4 py-3 text-left">Créé le</th>
              <th className="px-4 py-3 text-center">Statut</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-orange-200/30 text-sm">
                  Aucune université trouvée
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-t border-orange-500/5 hover:bg-orange-500/5 transition-colors">
                  <td className="px-4 py-3 text-orange-100/80 font-medium max-w-56 truncate">{u.name}</td>
                  <td className="px-4 py-3 text-orange-100/40 font-mono text-xs">{u.slug}</td>
                  <td className="px-4 py-3 text-center">
                    <PlanBadge plan={u.plan.toLowerCase() as PlanId} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-orange-100/50 text-xs">
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
                        className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => toggleStatut(u)}
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

      {detail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-orange-500/20 rounded-2xl p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{detail.name}</h2>
              <button onClick={() => setDetail(null)} className="text-zinc-500 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ['Code', detail.slug],
                ['Plan', detail.plan || '—'],
                ['Statut', statLabel[detail.status] ?? detail.status],
                ['Créé le', detail.createdAt ? new Date(detail.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'],
                ['ID admin', detail.adminUid || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-orange-500/5 pb-2">
                  <span className="text-orange-200/50">{k}</span>
                  <span className="text-white font-medium font-mono text-xs truncate max-w-48">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
