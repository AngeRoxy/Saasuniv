'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { LayoutDashboard, Building2, TrendingUp, Settings, LogOut } from 'lucide-react'
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
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-orange-300/60 text-sm">Chargement…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-black text-white">
      <aside className="fixed top-0 left-0 h-screen w-64 bg-zinc-950 border-r border-orange-500/10 flex flex-col z-40">
        <div className="px-6 py-6 border-b border-orange-500/10">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-orange-500">Gest</span>
            <span className="text-white">Univ</span>
          </span>
          <div className="mt-2">
            <span className="text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2.5 py-1">
              Super Admin
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navLinks.map(({ label, icon: Icon, href }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-orange-400' : 'text-zinc-500'} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-orange-500/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="ml-64 flex-1 flex flex-col min-h-screen">
        <main className="flex-1 p-8 bg-black">{children}</main>
      </div>
    </div>
  )
}
