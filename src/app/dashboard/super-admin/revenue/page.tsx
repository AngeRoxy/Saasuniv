'use client'

import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, DollarSign, Building2 } from 'lucide-react'
import { getAllUniversities, type UniversityEntry } from '@/lib/db'
import { PLANS_CONFIG, PLAN_ORDER } from '@/lib/plans'
import type { PlanId } from '@/types/plan'

function fmtFCFA(n: number): string {
  return n.toLocaleString('fr-FR') + ' FCFA'
}

function monthlyRevenue(plan: string): number {
  const key = plan.toLowerCase()
  if (key === 'trial') return 0
  if (key in PLANS_CONFIG) return PLANS_CONFIG[key as PlanId].prixMensuel
  return 0
}

function planLabel(plan: string): string {
  const key = plan.toLowerCase()
  if (key === 'trial') return 'Essai'
  if (key in PLANS_CONFIG) return PLANS_CONFIG[key as PlanId].nom
  return plan || '—'
}

const statLabel: Record<string, string> = { active: 'Actif', suspended: 'Suspendu', inactive: 'Inactif' }
const statColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
  inactive: 'bg-zinc-200 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-600/30',
}

export default function RevenuePage() {
  const [universities, setUniversities] = useState<UniversityEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const data = await getAllUniversities()
        if (active) setUniversities(data)
      } catch {
        if (active) setUniversities([])
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const actives = useMemo(() => universities.filter((u) => u.status === 'active'), [universities])
  const mrr = actives.reduce((s, u) => s + monthlyRevenue(u.plan ?? ''), 0)
  const arr = mrr * 12

  const repartition = useMemo(
    () =>
      PLAN_ORDER.map((planId) => {
        const subset = actives.filter((u) => (u.plan ?? '').toLowerCase() === planId)
        return { plan: PLANS_CONFIG[planId].nom, clients: subset.length, mrr: subset.length * PLANS_CONFIG[planId].prixMensuel }
      }),
    [actives]
  )
  const enEssai = universities.filter((u) => (u.plan ?? '').toLowerCase() === 'trial').length

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Revenus de la plateforme</h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">MRR / ARR estimés à partir des abonnements actifs réels.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'MRR (abonnements actifs)', value: fmtFCFA(mrr), icon: DollarSign, sub: `${actives.length} université·s active·s` },
          { label: 'ARR projeté', value: fmtFCFA(arr), icon: TrendingUp, sub: 'MRR × 12 mois' },
          { label: 'En période d’essai', value: String(enEssai), icon: Building2, sub: 'Non facturé·es' },
        ].map(({ label, value, icon: Icon, sub }) => (
          <div key={label} className="bg-orange-950/30 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-zinc-600 dark:text-orange-200/60 text-sm">{label}</p>
              <Icon size={18} className="text-blue-600 dark:text-orange-400/60" />
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">{value}</p>
            <p className="text-xs text-zinc-500 dark:text-orange-200/40 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-orange-500/10"><h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Revenus par université</h2></div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-black/40 text-blue-700 dark:text-orange-300/60 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Université</th>
                <th className="px-4 py-3 text-center">Plan</th>
                <th className="px-4 py-3 text-right">Mensuel</th>
                <th className="px-4 py-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody>
              {universities.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-zinc-500 dark:text-orange-200/30 text-sm">Aucune université inscrite.</td></tr>
              ) : universities.map((u) => (
                <tr key={u.id} className="border-t border-orange-500/5 hover:bg-orange-500/5 transition-colors">
                  <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/80 font-medium max-w-56 truncate">{u.name}</td>
                  <td className="px-4 py-3 text-center text-zinc-800 dark:text-orange-100/60">{planLabel(u.plan ?? '')}</td>
                  <td className="px-4 py-3 text-right text-zinc-800 dark:text-orange-100/70 whitespace-nowrap">{monthlyRevenue(u.plan ?? '') > 0 ? fmtFCFA(monthlyRevenue(u.plan ?? '')) : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium border rounded-full px-2.5 py-0.5 ${statColors[u.status] ?? statColors.inactive}`}>{statLabel[u.status] ?? u.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-6 h-fit">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Répartition par plan</h2>
          <div className="space-y-4">
            {repartition.map((r) => (
              <div key={r.plan} className="p-4 rounded-xl border border-zinc-200 dark:border-orange-500/10 bg-zinc-50 dark:bg-black/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-blue-700 dark:text-orange-300">{r.plan}</span>
                  <span className="text-zinc-800 dark:text-orange-100/60 text-xs">{r.clients} client{r.clients !== 1 ? 's' : ''}</span>
                </div>
                <p className="text-zinc-900 dark:text-white font-bold">{fmtFCFA(r.mrr)}</p>
                <p className="text-zinc-500 dark:text-orange-200/40 text-xs mt-0.5">/ mois</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
