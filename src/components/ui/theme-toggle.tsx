'use client'

import { useEffect, useState } from 'react'
import { Palette } from 'lucide-react'

const BLUE_VARS: Record<string, string> = {
  '--color-orange-50':  '#eff6ff',
  '--color-orange-100': '#dbeafe',
  '--color-orange-200': '#bfdbfe',
  '--color-orange-300': '#93c5fd',
  '--color-orange-400': '#60a5fa',
  '--color-orange-500': '#3b82f6',
  '--color-orange-600': '#2563eb',
  '--color-orange-700': '#1d4ed8',
  '--color-orange-800': '#1e40af',
  '--color-orange-900': '#1e3a8a',
  '--color-orange-950': '#172554',
  '--color-amber-50':   '#eef2ff',
  '--color-amber-100':  '#e0e7ff',
  '--color-amber-200':  '#c7d2fe',
  '--color-amber-300':  '#a5b4fc',
  '--color-amber-400':  '#818cf8',
  '--color-amber-500':  '#6366f1',
  '--color-amber-600':  '#4f46e5',
  '--color-amber-700':  '#4338ca',
  '--color-amber-800':  '#3730a3',
  '--color-amber-900':  '#312e81',
  '--color-amber-950':  '#1e1b4b',
  '--color-yellow-50':  '#f5f3ff',
  '--color-yellow-100': '#ede9fe',
  '--color-yellow-200': '#ddd6fe',
  '--color-yellow-300': '#c4b5fd',
  '--color-yellow-400': '#a78bfa',
  '--color-yellow-500': '#8b5cf6',
  '--color-yellow-600': '#7c3aed',
  '--color-yellow-700': '#6d28d9',
  '--color-yellow-800': '#5b21b6',
  '--color-yellow-900': '#4c1d95',
  '--color-yellow-950': '#2e1065',
}

function applyBlue() {
  const root = document.documentElement
  Object.entries(BLUE_VARS).forEach(([k, v]) => root.style.setProperty(k, v))
  window.dispatchEvent(new CustomEvent('gestuniv:theme', { detail: { blue: true } }))
}

function removeBlue() {
  const root = document.documentElement
  Object.keys(BLUE_VARS).forEach(k => root.style.removeProperty(k))
  window.dispatchEvent(new CustomEvent('gestuniv:theme', { detail: { blue: false } }))
}

export function ThemeToggle() {
  const [isBlue, setIsBlue] = useState(false)

  useEffect(() => {
    // Lecture du thème persisté au montage uniquement. L'init paresseuse de
    // useState est impossible (localStorage absent côté serveur → mismatch
    // d'hydratation), ce setState synchrone est donc le pattern idiomatique.
    if (localStorage.getItem('gestuniv-theme') === 'blue') {
      applyBlue()
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsBlue(true)
    }
  }, [])

  function toggle() {
    const next = !isBlue
    setIsBlue(next)
    if (next) {
      applyBlue()
      localStorage.setItem('gestuniv-theme', 'blue')
    } else {
      removeBlue()
      localStorage.setItem('gestuniv-theme', 'orange')
    }
  }

  return (
    <button
      onClick={toggle}
      title={isBlue ? 'Passer au thème orange' : 'Passer au thème bleu'}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
      style={{
        background: isBlue ? 'rgba(15, 23, 42, 0.85)' : 'rgba(9, 9, 11, 0.85)',
        borderColor: isBlue ? 'rgba(59, 130, 246, 0.4)' : 'rgba(249, 115, 22, 0.4)',
        boxShadow: isBlue ? '0 0 24px rgba(59,130,246,0.2)' : '0 0 24px rgba(249,115,22,0.2)',
      }}
    >
      <Palette size={15} style={{ color: isBlue ? '#60a5fa' : '#fb923c' }} />
      <span className="text-xs font-semibold tracking-wide" style={{ color: isBlue ? '#93c5fd' : '#fdba74' }}>
        {isBlue ? 'Thème Bleu' : 'Thème Orange'}
      </span>
      <div className="flex gap-1.5 ml-1">
        <div className="w-2.5 h-2.5 rounded-full transition-all duration-300" style={{
          background: '#fb923c',
          opacity: isBlue ? 0.3 : 1,
          boxShadow: isBlue ? 'none' : '0 0 6px rgba(249,115,22,0.8)',
        }} />
        <div className="w-2.5 h-2.5 rounded-full transition-all duration-300" style={{
          background: '#60a5fa',
          opacity: isBlue ? 1 : 0.3,
          boxShadow: isBlue ? '0 0 6px rgba(59,130,246,0.8)' : 'none',
        }} />
      </div>
    </button>
  )
}
