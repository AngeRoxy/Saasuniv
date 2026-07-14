import type { LucideIcon } from 'lucide-react'

interface ComingSoonProps {
  icon: LucideIcon
  title: string
  description: string
  /** Libellé du badge (défaut : « Bientôt disponible »). */
  badge?: string
}

/**
 * État vide honnête pour un module pas encore connecté à la base de données.
 * Aucune donnée fictive : on annonce clairement que la fonctionnalité arrive,
 * plutôt que d'afficher des chiffres ou des lignes inventés.
 */
export function ComingSoon({ icon: Icon, title, description, badge = 'Bientôt disponible' }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-4">
      <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-5">
        <Icon className="h-7 w-7 text-blue-600 dark:text-orange-400" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-zinc-500 leading-relaxed">{description}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
        {badge}
      </span>
    </div>
  )
}

export default ComingSoon
