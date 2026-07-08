'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Building2, CheckCircle, Clock, TrendingUp, ArrowRight } from 'lucide-react'
import { getAllUniversities, type UniversityEntry } from '@/lib/db'
import { PLANS_CONFIG } from '@/lib/plans'
import type { PlanId } from '@/types/plan'

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

function fmtFCFA(n: number): string {
  return n.toLocaleString('fr-FR') + ' FCFA'
}

/** MRR d'une université selon son plan (essai = 0 ; enterprise = sur devis = 0). */
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

export default function SuperAdminPage() {
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

  const total = universities.length
  const actives = universities.filter((u) => u.status === 'active').length
  const enEssai = universities.filter((u) => u.plan?.toLowerCase() === 'trial').length
  const mrr = universities
    .filter((u) => u.status === 'active')
    .reduce((sum, u) => sum + monthlyRevenue(u.plan ?? ''), 0)

  const recent = [...universities]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, 6)

  const kpis = [
    { label: 'Universités', value: loading ? '—' : String(total), icon: Building2, sub: 'Sur la plateforme' },
    { label: 'Actives', value: loading ? '—' : String(actives), icon: CheckCircle, sub: `${total - actives} inactive·s/suspendue·s` },
    { label: 'En essai', value: loading ? '—' : String(enEssai), icon: Clock, sub: 'Période d’essai en cours' },
    { label: 'MRR (abonnements actifs)', value: loading ? '—' : fmtFCFA(mrr), icon: TrendingUp, sub: 'Mensuel récurrent estimé' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Vue d&apos;ensemble</h1>
        <p className="text-orange-200/40 text-sm mt-1">Tableau de bord de la plateforme GestUniv</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map(({ label, value, icon: Icon, sub }) => (
          <div key={label} className="bg-orange-950/30 border border-orange-500/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-orange-200/60 text-sm">{label}</p>
              <Icon size={18} className="text-orange-400/60" />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-orange-200/40 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-zinc-950 border border-orange-500/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-orange-500/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Universités récentes</h2>
          <Link
            href="/dashboard/super-admin/universities"
            className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors"
          >
            Tout gérer <ArrowRight size={12} />
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-black/40 text-orange-300/60 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Créé le</th>
              <th className="px-4 py-3 text-center">Statut</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-orange-200/30 text-sm">Chargement…</td>
              </tr>
            ) : recent.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-orange-200/30 text-sm">
                  Aucune université inscrite pour l’instant.
                </td>
              </tr>
            ) : (
              recent.map((u) => (
                <tr key={u.id} className="border-t border-orange-500/5 hover:bg-orange-500/5 transition-colors">
                  <td className="px-4 py-3 text-orange-100/80 font-medium max-w-56 truncate">{u.name}</td>
                  <td className="px-4 py-3 text-orange-100/60">{planLabel(u.plan ?? '')}</td>
                  <td className="px-4 py-3 text-orange-100/50 text-xs">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium border rounded-full px-2.5 py-0.5 ${statColors[u.status] ?? statColors.inactive}`}>
                      {statLabel[u.status] ?? u.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
