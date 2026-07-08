import { cn } from '@/lib/utils'
import { getPlanConfig } from '@/lib/plans'
import type { PlanId } from '@/types/plan'

interface PlanBadgeProps {
  plan: PlanId
  size?: 'sm' | 'md'
  className?: string
}

const STYLES: Record<PlanId, { pill: string; icon?: string }> = {
  standard: { pill: 'bg-zinc-600/40 text-zinc-300' },
  premium: { pill: 'bg-orange-500/20 text-orange-300', icon: '★' },
  enterprise: { pill: 'bg-violet-500/20 text-violet-300', icon: '◆' },
}

/** Pill colorée affichant le plan tarifaire d'une université. */
export function PlanBadge({ plan, size = 'md', className }: PlanBadgeProps) {
  const { pill, icon } = STYLES[plan] ?? STYLES.standard
  const nom = getPlanConfig(plan).nom

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        pill,
        className
      )}
    >
      {icon && <span aria-hidden>{icon}</span>}
      {nom}
    </span>
  )
}

export default PlanBadge
