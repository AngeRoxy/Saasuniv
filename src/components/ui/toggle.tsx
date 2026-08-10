'use client'

import { cn } from '@/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  ariaLabel?: string
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  trackActiveClassName?: string
  trackInactiveClassName?: string
  knobClassName?: string
  className?: string
}

/**
 * Curseur ancré explicitement en `left` (pas seulement `translate-x`) : les
 * <button> ont un text-align:center par défaut dans la feuille de style du
 * navigateur (jamais réinitialisé par le preflight Tailwind), donc un span
 * absolute sans `left` explicite part du CENTRE du bouton, pas de son bord —
 * en position active le curseur sort alors entièrement du cadre.
 */
const SIZES = {
  sm: { track: 'w-10 h-5', knob: 'w-4 h-4', inset: 'left-0.5 top-0.5', active: 'translate-x-5' },
  md: { track: 'w-11 h-6', knob: 'w-5 h-5', inset: 'left-0.5 top-0.5', active: 'translate-x-5' },
  lg: { track: 'w-12 h-6', knob: 'w-4 h-4', inset: 'left-1 top-1', active: 'translate-x-6' },
} as const

export function Toggle({
  checked,
  onChange,
  label,
  ariaLabel,
  size = 'sm',
  disabled = false,
  trackActiveClassName = 'bg-orange-500',
  trackInactiveClassName = 'bg-zinc-200 dark:bg-zinc-700',
  knobClassName = 'bg-white',
  className,
}: ToggleProps) {
  const s = SIZES[size]

  return (
    <label
      className={cn(
        'flex items-center gap-3',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        className
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative rounded-full transition-colors duration-200 shrink-0',
          s.track,
          checked ? trackActiveClassName : trackInactiveClassName
        )}
      >
        <span
          className={cn(
            'absolute rounded-full transition-transform duration-200',
            s.inset,
            s.knob,
            knobClassName,
            checked && s.active
          )}
        />
      </button>
      {label && <span className="text-sm text-zinc-600 dark:text-orange-200/60">{label}</span>}
    </label>
  )
}
