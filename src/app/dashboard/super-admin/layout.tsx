'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { LayoutDashboard, Building2, TrendingUp, Settings, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { logout } from '@/lib/auth'

const navLinks = [
  { label: 'Vue globale', icon: LayoutDashboard, href: '/dashboard/super-admin' },
  { label: 'Universités', icon: Building2, href: '/dashboard/super-admin/universities' },
  { label: 'Revenus', icon: TrendingUp, href: '/dashboard/super-admin/revenue' },
  { label: 'Paramètres', icon: Settings, href: '/dashboard/super-admin/settings' },
]

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()
  const loggingOut = useRef(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

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
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-blue-700 dark:text-orange-300/60 text-sm">Chargement…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#fafafa] dark:bg-black text-zinc-900 dark:text-white">
      {/* Overlay (mobile uniquement, quand la sidebar est ouverte) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-screen w-64 max-w-[85%] bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-orange-500/10 flex flex-col z-50 transform transition-transform duration-300 md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-6 border-b border-zinc-200 dark:border-orange-500/10 flex items-start justify-between">
          <div>
            <span className="text-xl font-bold tracking-tight">
              <span className="text-orange-500">Gest</span>
              <span className="text-zinc-900 dark:text-white">Univ</span>
            </span>
            <div className="mt-2">
              <span className="text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2.5 py-1">
                Super Admin
              </span>
            </div>
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

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navLinks.map(({ label, icon: Icon, href }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-500/15 text-blue-600 dark:text-orange-400 border border-orange-500/20'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-blue-600 dark:text-orange-400' : 'text-zinc-500'} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-zinc-200 dark:border-orange-500/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="md:ml-64 flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top bar mobile (hamburger + logo + badge) */}
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
          <span className="text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-1">
            Super Admin
          </span>
        </header>

        <main className="flex-1 p-4 md:p-8 bg-[#fafafa] dark:bg-black min-w-0">{children}</main>
      </div>
    </div>
  )
}
