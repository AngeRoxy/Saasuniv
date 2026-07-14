'use client'

/**
 * Tableau de notes réutilisable — respecte l'ordre de colonnes OBLIGATOIRE
 * imposé pour tous les dashboards : Date | Étudiant | Matière | Note | Mention.
 */

export interface NoteRow {
  id: string
  date: number // timestamp ms
  etudiant: string
  matiere: string
  note: number // /20
  // Champs de filtrage (facultatifs)
  semestreId?: string
  filiereId?: string
  matiereId?: string
  enfantUid?: string
}

interface Mention {
  label: string
  className: string
}

/** Mention calculée dynamiquement depuis la note (barème /20). */
export function getMention(note: number): Mention {
  if (note >= 16) return { label: 'Très Bien', className: 'text-green-400' }
  if (note >= 14) return { label: 'Bien', className: 'text-blue-600 dark:text-blue-400' }
  if (note >= 12) return { label: 'Assez Bien', className: 'text-blue-600 dark:text-cyan-400' }
  if (note >= 10) return { label: 'Passable', className: 'text-blue-600 dark:text-yellow-400' }
  return { label: 'Insuffisant', className: 'text-red-400' }
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** Formate un timestamp au format "DD/MM/YYYY". */
export function formatNoteDate(ts: number): string {
  return dateFormatter.format(new Date(ts))
}

interface NotesTableProps {
  rows: NoteRow[]
  /** Masque la colonne Étudiant si une seule personne est concernée. */
  hideEtudiant?: boolean
  emptyLabel?: string
  className?: string
}

export function NotesTable({
  rows,
  hideEtudiant = false,
  emptyLabel = 'Aucune note ne correspond aux filtres sélectionnés.',
  className = '',
}: NotesTableProps) {
  return (
    <div
      className={`overflow-x-auto rounded-xl border border-zinc-200 dark:border-orange-500/10 bg-white dark:bg-zinc-950 ${className}`}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-orange-500/10 bg-zinc-50 dark:bg-black/40 text-xs uppercase tracking-wider text-blue-700 dark:text-orange-300/60">
            <th className="px-4 py-3 text-left">Date</th>
            {!hideEtudiant && <th className="px-4 py-3 text-left">Étudiant</th>}
            <th className="px-4 py-3 text-left">Matière</th>
            <th className="px-4 py-3 text-center">Note</th>
            <th className="px-4 py-3 text-left">Mention</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={hideEtudiant ? 4 : 5}
                className="px-4 py-8 text-center text-sm text-zinc-500"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const mention = getMention(row.note)
              const failing = row.note < 10
              return (
                <tr
                  key={row.id}
                  className="border-t border-orange-500/5 transition-colors hover:bg-orange-500/5"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {formatNoteDate(row.date)}
                  </td>
                  {!hideEtudiant && (
                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-orange-100/80">{row.etudiant}</td>
                  )}
                  <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/70">{row.matiere}</td>
                  <td
                    className={`px-4 py-3 text-center font-mono font-semibold ${
                      failing ? 'text-red-400' : 'text-zinc-900 dark:text-white'
                    }`}
                  >
                    {row.note.toFixed(2)}/20
                  </td>
                  <td className={`px-4 py-3 font-medium ${mention.className}`}>{mention.label}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

export default NotesTable
