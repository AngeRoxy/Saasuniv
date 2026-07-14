'use client'

import { CalendarX, Check, AlertCircle } from 'lucide-react'
import { useAbsences } from '@/hooks/useAbsences'
import { motifLabel } from '@/types/absence'
import { AbsenceAlertBadge } from '@/components/ui/absence-alert-badge'

/** Consultation des absences d'un étudiant (étudiant + parent), lecture seule. */
export function AbsencesView({ universityId, studentUid }: { universityId: string; studentUid: string }) {
  const { absences, loading, totalInjustifiees, seuil } = useAbsences(universityId, studentUid)

  const justifiees = absences.filter((a) => a.justifiee).length

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      {totalInjustifiees > 0 && (
        <div>
          <AbsenceAlertBadge nombreAbsences={totalInjustifiees} seuil={seuil} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total absences', value: absences.length, color: 'text-zinc-900 dark:text-white' },
          { label: 'Justifiées', value: justifiees, color: 'text-green-400' },
          { label: 'Non justifiées', value: totalInjustifiees, color: totalInjustifiees > 0 ? 'text-red-400' : 'text-green-400' },
        ].map((k) => (
          <div key={k.label} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-5">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {absences.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm flex flex-col items-center gap-3">
          <CalendarX size={32} className="opacity-30" />
          Aucune absence enregistrée. 🎉
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-black/40 text-blue-700 dark:text-orange-300/60 text-xs uppercase tracking-wider border-b border-zinc-200 dark:border-orange-500/10">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Matière</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-left">Motif</th>
              </tr>
            </thead>
            <tbody>
              {absences.map((a) => (
                <tr key={a.id} className="border-t border-orange-500/5">
                  <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/80 whitespace-nowrap">{a.date ? new Date(a.date).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/70">{a.matiere || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {a.justifiee ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-green-500/15 text-green-400 border border-green-500/25"><Check size={11} /> Justifiée</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/25"><AlertCircle size={11} /> Non justifiée</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/50 text-xs">
                    {a.justifiee
                      ? [motifLabel(a.motifCategorie), a.motif].filter(Boolean).join(' · ') || '—'
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AbsencesView
