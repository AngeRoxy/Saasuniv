'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  BookMarked,
  BarChart3,
  CreditCard,
  Bell,
  Settings,
  LogOut,
  User,
  Upload,
  Shield,
  Archive,
  UserCircle,
  Library,
  CalendarDays,
  CalendarClock,
  CalendarX,
  ClipboardList,
  Users,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { logout } from '@/lib/auth'
import { getUniversity } from '@/lib/db'
import { usePlan } from '@/hooks/usePlan'
import { PlanBadge } from '@/components/ui/plan-badge'
import { TrialBanner } from '@/components/ui/trial-banner'

const navLinks = [
  { label: 'Tableau de bord', icon: LayoutDashboard, href: '/dashboard/admin' },
  { label: 'Étudiants', icon: GraduationCap, href: '/dashboard/admin/students' },
  { label: 'Enseignants', icon: BookOpen, href: '/dashboard/admin/teachers' },
  { label: 'Parents', icon: Users, href: '/dashboard/admin/parents' },
  { label: 'Cours', icon: BookMarked, href: '/dashboard/admin/courses' },
  { label: 'Filières & Matières', icon: Library, href: '/dashboard/admin/filieres' },
  { label: 'Semestres', icon: CalendarDays, href: '/dashboard/admin/semestres' },
  { label: 'Emploi du temps', icon: CalendarClock, href: '/dashboard/admin/schedule' },
  { label: 'Examens', icon: ClipboardList, href: '/dashboard/admin/examens' },
  { label: 'Notes', icon: BarChart3, href: '/dashboard/admin/grades' },
  { label: 'Absences', icon: CalendarX, href: '/dashboard/admin/absences' },
  { label: 'Finances', icon: CreditCard, href: '/dashboard/admin/finances' },
  { label: 'Import', icon: Upload, href: '/dashboard/admin/import' },
  { label: 'Notifications', icon: Bell, href: '/dashboard/admin/notifications' },
  { label: 'Audit', icon: Shield, href: '/dashboard/admin/audit' },
  { label: 'Facturation', icon: CreditCard, href: '/dashboard/admin/billing' },
  { label: 'Paramètres', icon: Settings, href: '/dashboard/admin/settings' },
  { label: 'Clôture', icon: Archive, href: '/dashboard/admin/closing' },
  { label: 'Mon profil', icon: UserCircle, href: '/dashboard/admin/profile' },
]

const pageTitles: Record<string, string> = {
  '/dashboard/admin': 'Tableau de bord',
  '/dashboard/admin/students': 'Gestion des étudiants',
  '/dashboard/admin/teachers': 'Gestion des enseignants',
  '/dashboard/admin/courses': 'Gestion des cours',
  '/dashboard/admin/filieres': 'Filières & Matières',
  '/dashboard/admin/semestres': 'Semestres',
  '/dashboard/admin/schedule': 'Emploi du temps',
  '/dashboard/admin/examens': 'Gestion des examens',
  '/dashboard/admin/grades': 'Consultation des notes',
  '/dashboard/admin/absences': 'Gestion des absences',
  '/dashboard/admin/finances': 'Gestion financière',
  '/dashboard/admin/import': 'Import CSV / Excel',
  '/dashboard/admin/notifications': 'Notifications',
  '/dashboard/admin/audit': 'Audit Logs',
  '/dashboard/admin/billing': 'Facturation',
  '/dashboard/admin/settings': 'Paramètres',
  '/dashboard/admin/closing': 'Clôture annuelle',
  '/dashboard/admin/profile': 'Mon profil',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const { plan: currentPlan } = usePlan(profile?.universityId ?? '')
  const loggingOut = useRef(false)
  const [universityName, setUniversityName] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const currentTitle = pageTitles[pathname] ?? 'Administration'

  useEffect(() => {
    if (!loading && !user && !loggingOut.current) {
      router.replace('/auth/login')
    }
  }, [loading, user, router])

  // Vrai nom de l'université du tenant courant (sidebar) — scopé par uid via
  // profile.universityId. Fallback silencieux sur l'ID si la lecture échoue.
  useEffect(() => {
    const universityId = profile?.universityId
    if (!universityId) return
    let active = true
    getUniversity(universityId)
      .then((u) => { if (active) setUniversityName(u?.name ?? null) })
      .catch(() => { /* on garde le fallback sur l'ID brut */ })
    return () => { active = false }
  }, [profile?.universityId])

  async function handleLogout() {
    loggingOut.current = true
    await logout()
    router.push('/')
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-blue-700 dark:text-orange-300/60 text-sm">Chargement…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#fafafa] text-zinc-900 dark:bg-black dark:text-white">
      {/* Overlay (mobile uniquement, quand la sidebar est ouverte) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen w-64 max-w-[85%] bg-white border-r border-zinc-200 dark:bg-zinc-950 dark:border-orange-500/10 flex flex-col z-50 transform transition-transform duration-300 md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="px-6 py-6 border-b border-zinc-200 dark:border-orange-500/10 flex items-start justify-between">
          <div>
            <span className="text-xl font-bold tracking-tight">
              <span className="text-orange-500">Gest</span>
              <span className="text-zinc-900 dark:text-white">Univ</span>
            </span>
            <p className="text-xs text-zinc-500 mt-1">Panneau administrateur</p>
          </div>
          {/* Bouton fermer (mobile uniquement) */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors -mr-1"
            aria-label="Fermer le menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navLinks.map(({ label, icon: Icon, href }) => {
            const isActive = href === '/dashboard/admin'
            ? pathname === href
            : pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? href === '/dashboard/admin/closing'
                      ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                      : 'bg-orange-500/15 text-blue-600 dark:text-orange-400 border border-orange-500/20'
                    : href === '/dashboard/admin/closing'
                      ? 'text-red-400/70 hover:text-red-400 hover:bg-red-500/10'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5'
                }`}
              >
                <Icon size={18} className={isActive ? (href === '/dashboard/admin/closing' ? 'text-red-400' : 'text-blue-600 dark:text-orange-400') : href === '/dashboard/admin/closing' ? 'text-red-400/60' : 'text-zinc-500'} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: university name + logout */}
        <div className="px-4 py-4 border-t border-zinc-200 dark:border-orange-500/10 space-y-3">
          <div className="px-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Université</p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium mt-0.5 truncate">
              {universityName ?? profile?.universityId ?? 'Mon université'}
            </p>
            {currentPlan && (
              <div className="mt-1.5">
                <PlanBadge plan={currentPlan} size="sm" />
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="md:ml-64 flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top bar mobile (hamburger + logo + avatar) */}
        <header className="md:hidden sticky top-0 z-30 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-200 dark:border-orange-500/10 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu size={22} />
          </button>
          <span className="text-lg font-bold tracking-tight">
            <span className="text-orange-500">Gest</span>
            <span className="text-zinc-900 dark:text-white">Univ</span>
          </span>
          <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
            <User size={15} className="text-blue-600 dark:text-orange-400" />
          </div>
        </header>

        {/* Top bar desktop */}
        <header className="hidden md:flex sticky top-0 z-30 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-200 dark:border-orange-500/10 px-8 py-4 items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">{currentTitle}</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-zinc-200 shadow-sm dark:bg-white/5 dark:border-orange-500/10 dark:shadow-none rounded-xl px-3 py-2">
              <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                <User size={14} className="text-blue-600 dark:text-orange-400" />
              </div>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {profile?.displayName ?? user?.email ?? 'Admin'}
              </span>
            </div>
          </div>
        </header>

        {/* Bannière d'essai gratuit (sous la topbar) */}
        {profile?.universityId && (
          <div className="px-4 md:px-8 pt-6">
            <TrialBanner universityId={profile.universityId} />
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-4 md:p-8 bg-[#fafafa] dark:bg-black min-w-0">{children}</main>
      </div>
    </div>
  )
}
