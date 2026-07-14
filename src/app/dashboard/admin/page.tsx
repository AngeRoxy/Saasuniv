'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  GraduationCap,
  BookOpen,
  Library,
  Users,
  UserPlus,
  Upload,
  ArrowRight,
  TrendingUp,
  PenLine,
  Bell,
  Clock,
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useTrial } from '@/hooks/useTrial'
import { SemestreEnCours } from '@/components/ui/semestre-en-cours'
import { FilterBar } from '@/components/ui/filter-bar'
import { useDashboardFilters } from '@/hooks/useDashboardFilters'
import { STATUT_OPTIONS, type FilterOption } from '@/types/filters'
import {
  getFilieres,
  getUniversityMembers,
  getManualStudents,
  type UniversityMember,
} from '@/lib/db'

const ChatbotWidget = dynamic(() => import('@/components/ui/chatbot-widget'), { ssr: false })

const quickActions = [
  { label: 'Ajouter un étudiant', icon: UserPlus, href: '/dashboard/admin/students', description: 'Inscrire un nouvel étudiant' },
  { label: 'Ajouter un enseignant', icon: Users, href: '/dashboard/admin/teachers', description: 'Créer un compte enseignant' },
  { label: 'Saisir des notes', icon: PenLine, href: '/dashboard/admin/grades', description: 'Saisir et publier des résultats' },
  { label: 'Importer des données', icon: Upload, href: '/dashboard/admin/import', description: 'Import CSV / Excel' },
]

function getTodayString() {
  return new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

/** True si le timestamp (ms) tombe dans le mois calendaire courant. */
function isThisMonth(ts: number | undefined, ref: Date): boolean {
  if (!ts) return false
  const d = new Date(ts)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

/** Étudiant normalisé (membre Auth ou fiche manuelle) pour le tableau filtrable. */
interface StudentEntry {
  id: string
  nom: string
  filiere: string
  niveau: string
  statut: 'Actif' | 'Inactif'
}

interface DashboardCounts {
  students: number
  teachers: number
  parents: number
  filieres: number
  studentsThisMonth: number
  teachersThisMonth: number
  parentsThisMonth: number
  filieresThisMonth: number
}

const EMPTY_COUNTS: DashboardCounts = {
  students: 0, teachers: 0, parents: 0, filieres: 0,
  studentsThisMonth: 0, teachersThisMonth: 0, parentsThisMonth: 0, filieresThisMonth: 0,
}

function AdminDashboardContent() {
  const { user, profile } = useAuth()
  const displayName = profile?.displayName ?? user?.email ?? 'Administrateur'
  const universityId = profile?.universityId
  const { isTrialActive, daysRemaining } = useTrial(universityId ?? '')

  const [counts, setCounts] = useState<DashboardCounts>(EMPTY_COUNTS)
  const [filiereOptions, setFiliereOptions] = useState<FilterOption[]>([])
  const [students, setStudents] = useState<StudentEntry[]>([])
  const [loading, setLoading] = useState(true)

  const { filters, setFilter, activeCount } = useDashboardFilters()

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      const [filieres, studentMembers, teacherMembers, parentMembers, manual] = await Promise.all([
        getFilieres(universityId),
        getUniversityMembers(universityId, 'student'),
        getUniversityMembers(universityId, 'teacher'),
        getUniversityMembers(universityId, 'parent'),
        getManualStudents(universityId),
      ])
      if (!active) return

      const now = new Date()
      const studentsTotal = studentMembers.length + manual.length
      const studentsNew =
        studentMembers.filter((m) => isThisMonth(m.createdAt, now)).length +
        manual.filter((m) => isThisMonth(m.createdAt, now)).length

      setCounts({
        students: studentsTotal,
        teachers: teacherMembers.length,
        parents: parentMembers.length,
        filieres: filieres.length,
        studentsThisMonth: studentsNew,
        teachersThisMonth: teacherMembers.filter((m) => isThisMonth(m.createdAt, now)).length,
        parentsThisMonth: parentMembers.filter((m) => isThisMonth(m.createdAt, now)).length,
        filieresThisMonth: filieres.filter((f) => isThisMonth(f.createdAt, now)).length,
      })

      setFiliereOptions(filieres.map((f) => ({ label: f.nom, value: f.nom })))

      const normalize = (m: UniversityMember | (typeof manual)[number], id: string): StudentEntry => ({
        id,
        nom: m.displayName ?? '—',
        filiere: m.filiere ?? '—',
        niveau: m.niveau ?? '—',
        statut: m.statut === 'Inactif' || m.statut === 'inactif' ? 'Inactif' : 'Actif',
      })

      setStudents([
        ...studentMembers.map((m) => normalize(m, m.uid)),
        ...manual.map((m) => normalize(m, m.key)),
      ])
      setLoading(false)
    })()
    return () => { active = false }
  }, [universityId])

  const filteredStudents = useMemo(
    () =>
      students.filter((s) => {
        if (filters.filiere && s.filiere !== filters.filiere) return false
        if (filters.statut === 'actif' && s.statut !== 'Actif') return false
        if (filters.statut === 'inactif' && s.statut !== 'Inactif') return false
        return true
      }),
    [students, filters.filiere, filters.statut]
  )

  const kpiCards = [
    { label: 'Total étudiants', value: counts.students, icon: GraduationCap, newCount: counts.studentsThisMonth },
    { label: 'Total enseignants', value: counts.teachers, icon: BookOpen, newCount: counts.teachersThisMonth },
    { label: 'Total parents', value: counts.parents, icon: Users, newCount: counts.parentsThisMonth },
    { label: 'Filières', value: counts.filieres, icon: Library, newCount: counts.filieresThisMonth },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Bonjour, <span className="text-blue-600 dark:text-orange-400">{displayName}</span>
          </h2>
          <p className="text-zinc-500 mt-1 capitalize">{getTodayString()}</p>
        </div>
        {universityId && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 self-start sm:self-auto">
            <Bell size={13} className="text-blue-600 dark:text-orange-400" />
            <span className="text-xs text-blue-700 dark:text-orange-300 font-mono">{universityId}</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isTrialActive && (
          <div className="bg-white dark:bg-zinc-950 border border-amber-500/20 rounded-xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700 dark:text-amber-300/80">Essai Premium</span>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Clock size={20} className="text-blue-600 dark:text-amber-400" />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                {daysRemaining} <span className="text-lg font-medium text-zinc-600 dark:text-zinc-400">jour{daysRemaining > 1 ? 's' : ''}</span>
              </p>
              <Link href="/dashboard/admin/billing" className="text-xs mt-1 inline-flex items-center gap-1 text-blue-600 dark:text-amber-400 hover:text-blue-900 dark:hover:text-amber-300 transition-colors">
                Choisir un plan
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        )}
        {kpiCards.map(({ label, value, icon: Icon, newCount }) => (
          <div key={label} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Icon size={20} className="text-blue-600 dark:text-orange-400" />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-zinc-900 dark:text-white">{loading ? '—' : value}</p>
              {newCount > 0 ? (
                <p className="text-xs mt-1 flex items-center gap-1 text-green-400">
                  <TrendingUp size={12} />
                  +{newCount} ce mois
                </p>
              ) : (
                <p className="text-xs mt-1 text-zinc-600">Aucun ajout ce mois</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Semestre en cours */}
      {universityId && <SemestreEnCours universityId={universityId} variant="full" />}

      {/* Filtres contextuels (filière + statut — données réelles) */}
      <FilterBar
        filters={filters}
        onFilterChange={setFilter}
        activeCount={activeCount}
        options={{
          filieres: filiereOptions,
          statuts: STATUT_OPTIONS,
        }}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Étudiants (filtrable) — données réelles */}
        <div className="xl:col-span-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-orange-500/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <GraduationCap size={15} className="text-blue-600 dark:text-orange-400" />
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Étudiants</h3>
            </div>
            <span className="text-xs text-zinc-500">{filteredStudents.length} affiché·s</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-black/40 text-xs uppercase tracking-wider text-blue-700 dark:text-orange-300/60">
                  <th className="px-4 py-3 text-left">Étudiant</th>
                  <th className="px-4 py-3 text-left">Filière</th>
                  <th className="px-4 py-3 text-left">Niveau</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-500">
                      Chargement…
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-zinc-500">
                      {students.length === 0 ? (
                        <>
                          Aucun étudiant inscrit.{' '}
                          <Link href="/dashboard/admin/students" className="text-blue-600 dark:text-orange-400 hover:text-blue-900 dark:hover:text-orange-300 underline">
                            Ajouter un étudiant
                          </Link>
                        </>
                      ) : (
                        'Aucun étudiant ne correspond aux filtres.'
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr key={s.id} className="border-t border-orange-500/5 hover:bg-orange-500/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-800 dark:text-orange-100/80">{s.nom}</td>
                      <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/70">{s.filiere}</td>
                      <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/70">{s.niveau}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.statut === 'Actif'
                              ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                              : 'bg-zinc-200 dark:bg-zinc-700/30 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/10'
                          }`}
                        >
                          {s.statut}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Accès rapide */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden h-fit">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-orange-500/10">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Actions rapides</h3>
          </div>
          <div className="p-4 space-y-2">
            {quickActions.map(({ label, icon: Icon, href, description }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-orange-500/5 border border-transparent hover:border-orange-500/10 transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-blue-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{label}</p>
                  <p className="text-xs text-zinc-500">{description}</p>
                </div>
                <ArrowRight size={14} className="text-zinc-600 group-hover:text-blue-800 dark:group-hover:text-orange-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Assistant IA flottant */}
      {universityId && <ChatbotWidget universityId={universityId} />}
    </div>
  )
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={null}>
      <AdminDashboardContent />
    </Suspense>
  )
}
