'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Mode = 'dark' | 'light'

const STORAGE_KEY = 'gestuniv-theme'

function applyMode(mode: Mode) {
  const root = document.documentElement
  root.classList.toggle('dark', mode === 'dark')
}

/**
 * Bascule clair / sombre. Le mode SOMBRE est le défaut du produit ; le clair
 * est une option additionnelle. Le choix est persisté dans localStorage et
 * appliqué avant l'hydratation par le script inline du layout racine (évite le
 * flash), ce composant ne fait que refléter/mettre à jour l'état.
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('dark')
  const pathname = usePathname()
  // Les dashboards ont une sidebar `fixed left-0 w-64` visible dès `md` : le
  // toggle se décale de sa largeur (+ la gouttière de 6) pour rester dans la
  // zone de contenu. Sur mobile la sidebar est hors-champ, left-6 suffit.
  const hasSidebar = pathname?.startsWith('/dashboard') ?? false

  useEffect(() => {
    // Lecture du thème persisté au montage uniquement. L'init paresseuse de
    // useState est impossible (localStorage/document absents côté serveur →
    // mismatch d'hydratation), ce setState synchrone est donc le pattern
    // idiomatique. La classe `.dark` est déjà posée par le script du layout.
    const stored = localStorage.getItem(STORAGE_KEY)
    const initial: Mode = stored === 'light' ? 'light' : 'dark'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(initial)
  }, [])

  function toggle() {
    const next: Mode = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    applyMode(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  const isDark = mode === 'dark'

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      className={cn(
        // Bas-GAUCHE : le bas-droite est occupé par le chatbot (bouton h-13, et
        // surtout son panneau ouvert h-130) et par les toasts des dashboards.
        // z-30 le place sous la sidebar (z-50) et son overlay mobile (z-40),
        // pour qu'il s'efface quand le drawer s'ouvre au lieu de flotter dessus.
        'fixed bottom-6 left-6 z-30 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 border-zinc-200 bg-white/85 text-zinc-700 dark:border-blue-500/40 dark:bg-zinc-950/85 dark:text-blue-200',
        hasSidebar && 'md:left-70'
      )}
    >
      {isDark ? (
        <Moon size={15} className="text-blue-600 dark:text-blue-400" />
      ) : (
        <Sun size={15} className="text-blue-600" />
      )}
      <span className="text-xs font-semibold tracking-wide">
        {isDark ? 'Mode sombre' : 'Mode clair'}
      </span>
    </button>
  )
}
