'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

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
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 border-zinc-200 bg-white/85 text-zinc-700 dark:border-blue-500/40 dark:bg-zinc-950/85 dark:text-blue-200"
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
