import Link from 'next/link'
import { ArrowRight, type LucideIcon } from 'lucide-react'

interface KpiCardProps {
  label: string
  /** Valeur principale. `null` = donnée absente → affiche « — » (jamais 0 inventé). */
  value: string | number | null
  icon: LucideIcon
  /** Ligne secondaire sous la valeur (contexte, pas de donnée inventée). */
  hint?: string
  /** Rend la carte cliquable vers le module correspondant. */
  href?: string
  /** Cadre + accent d'alerte (seuil dépassé, retard de paiement…). */
  tone?: 'default' | 'alert'
  loading?: boolean
}

/**
 * Carte KPI des tableaux de bord. Reprend à l'identique le style des cartes du
 * dashboard admin (`/dashboard/admin`) pour que les 5 espaces se ressemblent.
 *
 * Une valeur inconnue s'affiche « — » : on ne remplace jamais une donnée absente
 * par un zéro, qui se lirait comme une information.
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
  tone = 'default',
  loading = false,
}: KpiCardProps) {
  const border =
    tone === 'alert'
      ? 'border-red-500/30'
      : 'border-zinc-200 dark:border-orange-500/10'
  const iconBg = tone === 'alert' ? 'bg-red-500/10' : 'bg-orange-500/10'
  const iconColor =
    tone === 'alert' ? 'text-red-400' : 'text-blue-600 dark:text-orange-400'

  const content = (
    <div
      className={`bg-white dark:bg-zinc-950 border ${border} rounded-xl p-6 flex flex-col gap-4 h-full ${
        href ? 'transition-colors hover:border-orange-500/30' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon size={20} className={iconColor} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-zinc-900 dark:text-white">
          {loading ? '—' : (value ?? '—')}
        </p>
        {hint && (
          <p
            className={`text-xs mt-1 ${
              tone === 'alert' ? 'text-red-400' : 'text-zinc-600 dark:text-zinc-500'
            }`}
          >
            {hint}
          </p>
        )}
        {href && !loading && (
          <span className="text-xs mt-1 inline-flex items-center gap-1 text-blue-600 dark:text-orange-400">
            Voir <ArrowRight size={12} />
          </span>
        )}
      </div>
    </div>
  )

  return href ? (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  )
}

export default KpiCard
