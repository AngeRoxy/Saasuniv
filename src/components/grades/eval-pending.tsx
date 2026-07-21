import { Clock } from 'lucide-react'

/**
 * Cellule « évaluation pas encore saisie ». Volontairement NEUTRE (zinc), jamais
 * rouge : une évaluation en attente n'est ni un échec ni un 0/20 — elle n'a
 * simplement pas encore été notée. À distinguer d'un « — » (note historique
 * sans les 3 évaluations, où les colonnes ne s'appliquent pas) et d'une vraie
 * note faible (rouge).
 */
export function EvalPending() {
  return (
    <span className="inline-flex items-center gap-1 text-zinc-400 dark:text-zinc-500 text-[11px] font-medium whitespace-nowrap">
      <Clock size={11} className="opacity-70" />
      En attente
    </span>
  )
}

export default EvalPending
