'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  Users,
  CalendarClock,
  CalendarX,
  ClipboardList,
  PenLine,
  Calculator,
  Upload,
  MessageSquare,
  Bell,
  LogOut,
  GraduationCap,
  User,
} from 'lucide-react'
import { logout } from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'
import { PremiereConnexionGuard } from '@/components/ui/premiere-connexion-guard'

const navLinks = [
  { href: '/dashboard/teacher', label: 'Accueil', icon: Home },
  { href: '/dashboard/teacher/classes', label: 'Mes classes', icon: Users },
  { href: '/dashboard/teacher/schedule', label: 'Emploi du temps', icon: CalendarClock },
  { href: '/dashboard/teacher/examens', label: 'Examens', icon: ClipboardList },
  { href: '/dashboard/teacher/absences', label: 'Absences', icon: CalendarX },
  { href: '/dashboard/teacher/grades', label: 'Saisie de notes', icon: PenLine },
  { href: '/dashboard/teacher/moyennes', label: 'Moyennes', icon: Calculator },
  { href: '/dashboard/teacher/resources', label: 'Ressources', icon: Upload },
  { href: '/dashboard/teacher/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/teacher/annonces', label: 'Annonces', icon: Bell },
  { href: '/dashboard/teacher/profile', label: 'Mon profil', icon: User },
]

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const loggingOut = useRef(false)

  useEffect(() => {
    if (!loading && !user && !loggingOut.current) {
      router.replace('/auth/login')
    }
  }, [loading, user, router])

  async function handleLogout() {
    loggingOut.current = true
    await logout()
    router.push('/')
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const displayName = profile?.displayName ?? user?.displayName ?? user?.email ?? 'Enseignant'
  const universityId = profile?.universityId ?? '—'

  return (
    <div className="min-h-screen bg-black">
      <aside className="w-64 bg-zinc-950 border-r border-orange-500/10 fixed h-full flex flex-col z-10">
        <div className="flex items-center gap-2 px-6 py-5 border-b border-orange-500/10">
          <GraduationCap className="h-6 w-6 text-orange-500" />
          <span className="text-lg font-bold text-white tracking-tight">GestUniv</span>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <p className="px-6 py-2 text-[10px] uppercase tracking-widest text-orange-300/30 mb-1">Enseignant</p>
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-orange-500/10 text-orange-400 border-r-2 border-orange-400'
                    : 'text-orange-200/40 hover:text-orange-200 hover:bg-orange-500/5'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-orange-500/10 px-6 py-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-orange-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-orange-100/80 truncate">{displayName}</p>
              <p className="text-xs text-orange-300/40 truncate">{universityId}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-orange-200/30 hover:text-orange-400 transition-colors">
            <LogOut className="h-3.5 w-3.5" />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="ml-64 p-8 bg-black min-h-screen">
        <PremiereConnexionGuard>{children}</PremiereConnexionGuard>
      </main>
    </div>
  )
}
