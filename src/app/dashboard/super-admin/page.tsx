'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Building2,
  GraduationCap,
  TrendingUp,
  Percent,
  AlertTriangle,
  Clock,
  Ban,
  ArrowRight,
} from 'lucide-react'
import {
  getAllUniversities,
  getUniversityStudentCount,
  getDaysRemaining,
  type UniversityEntry,
} from '@/lib/db'
import { PLANS_CONFIG } from '@/lib/plans'
import type { PlanId } from '@/types/plan'

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
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const data = await getAllUniversities()
        if (!active) return
        setUniversities(data)
        // Comptage des étudiants en parallèle (Promise.all) — indépendant du
        // reste de l'affichage : si le comptage échoue, les totaux affichent "—"
        // plutôt qu'un faux 0.
        try {
          const counts = await Promise.all(data.map((u) => getUniversityStudentCount(u.id)))
          if (!active) return
          const map: Record<string, number> = {}
          data.forEach((u, i) => { map[u.id] = counts[i] })
          setStudentCounts(map)
        } catch {
          /* comptage indisponible : "—" */
        }
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
  const enEssai = universities.filter((u) => u.trialStatus === 'active').length
  const suspended = universities.filter((u) => u.status === 'suspended')

  // MRR réel : universités actives ET hors période d'essai (un essai ne facture rien).
  const mrr = universities
    .filter((u) => u.status === 'active' && u.trialStatus !== 'active')
    .reduce((sum, u) => sum + monthlyRevenue(u.plan ?? ''), 0)

  // Total étudiants — null tant que tous les comptages ne sont pas connus (affiche "—").
  const countsReady = universities.every((u) => u.id in studentCounts)
  const totalStudents = countsReady
    ? universities.reduce((sum, u) => sum + (studentCounts[u.id] ?? 0), 0)
    : null

  // Taux de conversion : converti / (converti + expiré). "Donnée insuffisante"
  // tant qu'aucun essai n'est terminé (on n'invente pas de pourcentage).
  const converted = universities.filter((u) => u.trialStatus === 'converted').length
  const finishedTrial = universities.filter(
    (u) => u.trialStatus === 'converted' || u.trialStatus === 'expired'
  ).length
  const conversionRate = finishedTrial > 0 ? Math.round((converted / finishedTrial) * 100) : null

  // Alertes réelles.
  const trialExpiringSoon = universities.filter(
    (u) =>
      u.trialStatus === 'active' &&
      typeof u.trialEndsAt === 'number' &&
      getDaysRemaining(u.trialEndsAt) <= 3
  )

  const recent = [...universities]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, 6)

  const kpis = [
    {
      label: 'Universités actives',
      value: loading ? '—' : String(actives),
      icon: Building2,
      sub: loading ? '—' : `${total} au total · ${enEssai} en essai`,
    },
    {
      label: 'Étudiants',
      value: loading || totalStudents === null ? '—' : totalStudents.toLocaleString('fr-FR'),
      icon: GraduationCap,
      sub: 'Tous établissements confondus',
    },
    {
      label: 'MRR (abonnements actifs)',
      value: loading ? '—' : fmtFCFA(mrr),
      icon: TrendingUp,
      sub: 'Mensuel récurrent · essais exclus',
    },
    {
      label: 'Taux de conversion',
      value: loading ? '—' : conversionRate === null ? 'Insuffisant' : `${conversionRate}%`,
      icon: Percent,
      sub:
        conversionRate === null
          ? 'Aucun essai terminé'
          : `${converted}/${finishedTrial} essais convertis`,
    },
  ]

  const noAlerts = !loading && trialExpiringSoon.length === 0 && suspended.length === 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Vue d&apos;ensemble</h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">Tableau de bord de la plateforme GestUniv</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map(({ label, value, icon: Icon, sub }) => (
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

      {/* Alertes réelles */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-blue-600 dark:text-orange-400" />
          Alertes
        </h2>
        {loading ? (
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl px-5 py-4 text-sm text-zinc-500 dark:text-orange-200/30">
            Chargement…
          </div>
        ) : noAlerts ? (
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl px-5 py-4 text-sm text-zinc-600 dark:text-orange-200/50">
            Aucune alerte actuellement.
          </div>
        ) : (
          <div className="space-y-2">
            {trialExpiringSoon.map((u) => {
              const jours = getDaysRemaining(u.trialEndsAt!)
              return (
                <div
                  key={`trial-${u.id}`}
                  className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-3"
                >
                  <Clock size={16} className="text-blue-600 dark:text-amber-400 shrink-0" />
                  <p className="text-sm text-zinc-800 dark:text-amber-100/80">
                    <span className="font-semibold">{u.name}</span> — essai{' '}
                    {jours <= 0 ? 'expirant aujourd’hui' : `expirant dans ${jours} jour${jours > 1 ? 's' : ''}`}.
                  </p>
                </div>
              )
            })}
            {suspended.map((u) => (
              <div
                key={`susp-${u.id}`}
                className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-3"
              >
                <Ban size={16} className="text-red-400 shrink-0" />
                <p className="text-sm text-red-100/80">
                  <span className="font-semibold">{u.name}</span> est actuellement suspendue.
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-orange-500/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Universités récentes</h2>
          <Link
            href="/dashboard/super-admin/universities"
            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-orange-400 hover:text-blue-900 dark:hover:text-orange-300 transition-colors"
          >
            Tout gérer <ArrowRight size={12} />
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-black/40 text-blue-700 dark:text-orange-300/60 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-center">Étudiants</th>
              <th className="px-4 py-3 text-left">Créé le</th>
              <th className="px-4 py-3 text-center">Statut</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500 dark:text-orange-200/30 text-sm">Chargement…</td>
              </tr>
            ) : recent.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-zinc-500 dark:text-orange-200/30 text-sm">
                  Aucune université inscrite pour l’instant.
                </td>
              </tr>
            ) : (
              recent.map((u) => (
                <tr key={u.id} className="border-t border-orange-500/5 hover:bg-orange-500/5 transition-colors">
                  <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/80 font-medium max-w-56 truncate">{u.name}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/60">{planLabel(u.plan ?? '')}</td>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
