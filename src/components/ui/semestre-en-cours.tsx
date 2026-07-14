'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CalendarOff } from 'lucide-react'
import { getSemestreEnCours } from '@/lib/db'
import type { Semestre, StatutSemestre } from '@/types/semestre'

interface SemestreEnCoursProps {
  universityId: string
  className?: string
  variant?: 'full' | 'compact' | 'badge'
}

const statutColors: Record<StatutSemestre, {
  text: string
  bar: string
  dot: string
  border: string
  bg: string
  label: string
}> = {
  en_cours: {
    text: 'text-blue-600 dark:text-orange-400',
    bar: 'bg-orange-500',
    dot: 'bg-orange-400',
    border: 'border-orange-500/20',
    bg: 'bg-orange-500/10',
    label: 'En cours',
  },
  termine: {
    text: 'text-zinc-600 dark:text-zinc-400',
    bar: 'bg-zinc-500',
    dot: 'bg-zinc-400',
    border: 'border-zinc-200 dark:border-white/10',
    bg: 'bg-zinc-700/20',
    label: 'Terminé',
  },
  a_venir: {
    text: 'text-blue-600 dark:text-blue-400',
    bar: 'bg-blue-500',
    dot: 'bg-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/10',
    label: 'À venir',
  },
}

function formatDate(ts: number, short = false): string {
  return new Date(ts).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: short ? 'short' : 'long',
    year: 'numeric',
  })
}

/** % de temps écoulé du semestre (0–100), borné. */
function computeProgress(debut: number, fin: number): number {
  const now = Date.now()
  if (now <= debut) return 0
  if (now >= fin) return 100
  if (fin <= debut) return 100
  return Math.round(((now - debut) / (fin - debut)) * 100)
}

export function SemestreEnCours({
  universityId,
  className = '',
  variant = 'full',
}: SemestreEnCoursProps) {
  const [semestre, setSemestre] = useState<Semestre | null>(null)
  // Init dérivée du prop : pas de spinner s'il n'y a aucune université à charger
  // (évite un setState synchrone dans l'effet).
  const [loading, setLoading] = useState(() => Boolean(universityId))

  useEffect(() => {
    if (!universityId) return
    let active = true
    getSemestreEnCours(universityId)
      .then((s) => {
        if (active) setSemestre(s)
      })
      .catch(() => {
        if (active) setSemestre(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [universityId])

  const progress = useMemo(
    () => (semestre ? computeProgress(semestre.dateDebut, semestre.dateFin) : 0),
    [semestre]
  )

  // ─── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    if (variant === 'badge') {
      return (
        <span
          className={`inline-block h-6 w-40 animate-pulse rounded-full bg-white dark:bg-white/5 ${className}`}
        />
      )
    }
    if (variant === 'compact') {
      return (
        <div
          className={`flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 px-4 py-3 ${className}`}
        >
          <div className="h-8 w-8 animate-pulse rounded-lg bg-white dark:bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 animate-pulse rounded bg-white dark:bg-white/5" />
            <div className="h-2.5 w-28 animate-pulse rounded bg-white dark:bg-white/5" />
          </div>
        </div>
      )
    }
    return (
      <div
        className={`rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 ${className}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="h-4 w-48 animate-pulse rounded bg-white dark:bg-white/5" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-white dark:bg-white/5" />
        </div>
        <div className="mb-4 h-3 w-56 animate-pulse rounded bg-white dark:bg-white/5" />
        <div className="h-2 w-full animate-pulse rounded-full bg-white dark:bg-white/5" />
      </div>
    )
  }

  // ─── Aucun semestre actif ─────────────────────────────────────────────────────
  if (!semestre) {
    if (variant === 'badge') {
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1 text-xs text-zinc-500 ${className}`}
        >
          <CalendarOff size={12} />
          Aucun semestre actif
        </span>
      )
    }
    if (variant === 'compact') {
      return (
        <div
          className={`flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-500 ${className}`}
        >
          <CalendarOff size={16} className="text-zinc-600" />
          Aucun semestre actif
        </div>
      )
    }
    return (
      <div
        className={`flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 px-6 py-5 text-sm text-zinc-500 ${className}`}
      >
        <CalendarOff size={18} className="text-zinc-600" />
        Aucun semestre actif pour le moment.
      </div>
    )
  }

  const c = statutColors[semestre.statut]

  // ─── Badge ────────────────────────────────────────────────────────────────────
  if (variant === 'badge') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${c.bg} ${c.border} ${c.text} ${className}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
        {semestre.nom}
      </span>
    )
  }

  // ─── Compact ──────────────────────────────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <div
        className={`flex items-center gap-3 rounded-xl border bg-white dark:bg-zinc-950 px-4 py-3 ${c.border} ${className}`}
      >
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg}`}>
          <CalendarDays size={16} className={c.text} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">{semestre.nom}</p>
          <p className="text-xs text-zinc-500">
            {formatDate(semestre.dateDebut, true)} – {formatDate(semestre.dateFin, true)}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-medium ${c.text}`}>{c.label}</span>
      </div>
    )
  }

  // ─── Full ─────────────────────────────────────────────────────────────────────
  return (
    <div
      className={`rounded-xl border bg-white dark:bg-zinc-950 p-6 ${c.border} ${className}`}
    >
      <div className="mb-1 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${c.bg}`}>
            <CalendarDays size={18} className={c.text} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{semestre.nom}</h3>
            <p className="text-xs text-zinc-500">
              Année académique {semestre.anneeAcademique}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${c.bg} ${c.border} ${c.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
          {c.label}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
        <span>Début : {formatDate(semestre.dateDebut)}</span>
        <span>Fin : {formatDate(semestre.dateFin)}</span>
      </div>

      {/* Barre de progression temporelle */}
      <div className="mt-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-white dark:bg-white/5">
          <div
            className={`h-full rounded-full transition-all ${c.bar}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1.5 text-right text-xs text-zinc-500">
          {progress}% écoulé
        </p>
      </div>
    </div>
  )
}

export default SemestreEnCours
