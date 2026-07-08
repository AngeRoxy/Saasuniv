import { AlertTriangle, Check } from 'lucide-react'

interface AbsenceAlertBadgeProps {
  nombreAbsences: number
  seuil: number
  /** Affiche un badge vert « Aucune absence » quand le compteur est à 0. */
  showZero?: boolean
}

/**
 * Badge d'assiduité (RÈGLE 3) :
 * - seuil atteint  → badge rouge pulsant + AlertTriangle
 * - > 0 mais < seuil → badge orange discret
 * - 0 → rien, sauf `showZero` (badge vert « Aucune absence »)
 */
export function AbsenceAlertBadge({ nombreAbsences, seuil, showZero = false }: AbsenceAlertBadgeProps) {
  if (nombreAbsences <= 0) {
    if (!showZero) return null
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-green-500/15 text-green-400 border border-green-500/25">
        <Check size={12} /> Aucune absence injustifiée
      </span>
    )
  }

  if (nombreAbsences >= seuil) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
        <AlertTriangle size={12} />
        {nombreAbsences} absence{nombreAbsences > 1 ? 's' : ''} injustifiée{nombreAbsences > 1 ? 's' : ''}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-orange-500/15 text-orange-300 border border-orange-500/25">
      {nombreAbsences} absence{nombreAbsences > 1 ? 's' : ''} injustifiée{nombreAbsences > 1 ? 's' : ''}
    </span>
  )
}

export default AbsenceAlertBadge
