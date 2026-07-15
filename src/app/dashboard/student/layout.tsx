'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  Calendar,
  CalendarX,
  ClipboardList,
  BookOpen,
  Video,
  FileText,
  CreditCard,
  Bell,
  User,
  LogOut,
  GraduationCap,
  Menu,
  X,
} from 'lucide-react'
import { logout } from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'
import { PremiereConnexionGuard } from '@/components/ui/premiere-connexion-guard'
import { MemberAvatar } from '@/components/ui/member-avatar'
import { useMemberPhoto } from '@/hooks/useMemberPhoto'

const navLinks = [
  { href: '/dashboard/student', label: 'Accueil', icon: Home },
  { href: '/dashboard/student/schedule', label: 'Emploi du temps', icon: Calendar },
  { href: '/dashboard/student/examens', label: 'Examens', icon: ClipboardList },
  { href: '/dashboard/student/courses', label: 'Mes cours', icon: BookOpen },
  { href: '/dashboard/student/cours-en-ligne', label: 'Cours en ligne', icon: Video },
  { href: '/dashboard/student/grades', label: 'Notes & Bulletins', icon: FileText },
  { href: '/dashboard/student/absences', label: 'Absences', icon: CalendarX },
  { href: '/dashboard/student/payments', label: 'Paiements', icon: CreditCard },
  { href: '/dashboard/student/annonces', label: 'Annonces', icon: Bell },
  { href: '/dashboard/student/profile', label: 'Profil', icon: User },
]

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const loggingOut = useRef(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  // Appelé AVANT tout retour anticipé : un hook doit s'exécuter à chaque rendu
  // dans le même ordre (react-hooks/rules-of-hooks).
  const photoUrl = useMemberPhoto(profile?.universityId, user?.uid)

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
      <div className="min-h-screen bg-[#fafafa] dark:bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const displayName = profile?.displayName ?? user?.displayName ?? user?.email ?? 'Étudiant'
  const universityId = profile?.universityId ?? '—'

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-black">
      {/* Overlay (mobile uniquement, quand la sidebar est ouverte) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`w-64 max-w-[85%] bg-white border-r border-zinc-200 dark:bg-zinc-950 dark:border-orange-500/10 fixed top-0 left-0 h-full flex flex-col z-50 transform transition-transform duration-300 md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-orange-500/10">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-orange-500" />
            <span className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">GestUniv</span>
          </div>
          {/* Bouton fermer (mobile uniquement) */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors -mr-1"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <p className="px-6 py-2 text-[10px] uppercase tracking-widest text-zinc-500 dark:text-orange-300/30 mb-1">Étudiant</p>
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link key={href} href={href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-orange-500/10 text-blue-600 dark:text-orange-400 border-r-2 border-orange-400'
                    : 'text-zinc-500 dark:text-orange-200/40 hover:text-zinc-900 dark:hover:text-orange-200 hover:bg-orange-500/5'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-zinc-200 dark:border-orange-500/10 px-6 py-4">
          <div className="flex items-center gap-2.5 mb-3">
            <MemberAvatar photoUrl={photoUrl} name={displayName} size={32} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-800 dark:text-orange-100/80 truncate">{displayName}</p>
              <p className="text-xs text-zinc-500 dark:text-orange-300/40 truncate">{universityId}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-zinc-500 dark:text-orange-200/30 hover:text-blue-800 dark:hover:text-orange-400 transition-colors">
            <LogOut className="h-3.5 w-3.5" />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="md:ml-64 flex flex-col min-h-screen min-w-0">
        {/* Top bar mobile (hamburger + logo + avatar) */}
        <header className="md:hidden sticky top-0 z-30 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-200 dark:border-orange-500/10 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-orange-500" />
            <span className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">GestUniv</span>
          </div>
          <MemberAvatar photoUrl={photoUrl} name={displayName} size={32} />
        </header>

        <main className="flex-1 p-4 md:p-8 bg-[#fafafa] dark:bg-black min-w-0">
          <PremiereConnexionGuard>{children}</PremiereConnexionGuard>
        </main>
      </div>
    </div>
  )
}
