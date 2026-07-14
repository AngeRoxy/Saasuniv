'use client'

import { useState, useEffect, useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { getNotesForStudent, getSemestres, getMoyennesManuelles } from '@/lib/db'
import type { Semestre, NoteEntry } from '@/lib/db'
import { getMention, getNoteRetenue, hasRattrapage, EVALUATIONS } from '@/types/note'

/** Consultation des notes d'un étudiant (réutilisée par l'étudiant et le parent). */
export function GradeView({ universityId, studentUid }: { universityId: string; studentUid: string }) {
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [semestreId, setSemestreId] = useState('')
  const [moyenneManuelle, setMoyenneManuelle] = useState<number | null>(null)

  useEffect(() => {
    if (!universityId || !studentUid) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [n, sem] = await Promise.all([
          getNotesForStudent(universityId, studentUid),
          getSemestres(universityId),
        ])
        if (!active) return
        setNotes(n)
        setSemestres(sem)
        const enCours = sem.find((s) => s.statut === 'en_cours')
        setSemestreId(enCours?.id ?? sem[0]?.id ?? '')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId, studentUid])

  // Charge la moyenne forcée (override) du semestre sélectionné, si elle existe.
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!universityId || !studentUid || !semestreId) {
        if (active) setMoyenneManuelle(null)
        return
      }
      const map = await getMoyennesManuelles(universityId, semestreId)
      if (active) setMoyenneManuelle(map[studentUid] ?? null)
    })()
    return () => { active = false }
  }, [universityId, studentUid, semestreId])

  const filtered = useMemo(
    () => notes.filter((n) => !semestreId || n.semestreId === semestreId).sort((a, b) => a.matiere.localeCompare(b.matiere)),
    [notes, semestreId]
  )

  // Moyenne automatique (calcul) ; la moyenne forcée prime si elle est définie.
  // Utilise la note RETENUE (rattrapage si présent, sinon note normale) pour
  // rester cohérent avec la note affichée par matière et les décisions admin.
  const moyenneAuto = useMemo(() => {
    if (filtered.length === 0) return null
    return filtered.reduce((a, n) => a + getNoteRetenue(n), 0) / filtered.length
  }, [filtered])

  const moyenne = moyenneManuelle ?? moyenneAuto
  const moyenneMention = moyenne !== null ? getMention(moyenne) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          {moyenne !== null && (
            <div className="flex items-center gap-2 rounded-xl bg-orange-500/10 border border-orange-500/20 px-4 py-2">
              <span className="text-xs text-zinc-600 dark:text-orange-200/60">Moyenne</span>
              <span className="text-lg font-bold text-zinc-900 dark:text-white">{moyenne.toFixed(2)}/20</span>
              {moyenneMention && (
                <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${moyenneMention.cls}`}>{moyenneMention.abbr}</span>
              )}
              {moyenneManuelle !== null && (
                <span className="text-[10px] text-blue-600 dark:text-amber-400 border border-amber-500/30 rounded px-1" title="Moyenne ajustée manuellement par l'enseignant">forcée</span>
              )}
            </div>
          )}
        </div>
        {semestres.length > 0 && (
          <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)}
            className="bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60">
            {semestres.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm flex flex-col items-center gap-3">
          <BarChart3 size={32} className="opacity-30" />
          Aucune note publiée pour ce semestre.
        </div>
      ) : (
        <>
        <p className="text-[11px] text-zinc-500 dark:text-orange-200/30">
          Moyenne d’une matière = (Interro 1 + Interro 2 + 2 × Examen) ÷ 4. Une évaluation non encore passée
          n’est pas comptée comme un zéro.
        </p>
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-black/40 text-blue-700 dark:text-orange-300/60 text-xs uppercase tracking-wider border-b border-zinc-200 dark:border-orange-500/10">
                <th className="px-4 py-3 text-left">Matière</th>
                {EVALUATIONS.map((e) => (
                  <th key={e.champ} className="px-3 py-3 text-center w-24 whitespace-nowrap">
                    {e.labelCourt}
                    <span className="ml-1 normal-case text-zinc-500 dark:text-orange-300/40">×{e.poids}</span>
                  </th>
                ))}
                <th className="px-4 py-3 text-center w-24">Moyenne</th>
                <th className="px-4 py-3 text-center w-28">Mention</th>
                <th className="px-4 py-3 text-left">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => {
                const retenue = getNoteRetenue(n)
                const rattrapee = hasRattrapage(n)
                const mention = getMention(retenue)
                return (
                  <tr key={n.id} className="border-t border-orange-500/5 hover:bg-orange-500/5 transition-colors">
                    <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/80 font-medium">{n.matiere}</td>

                    {/* Détail des 3 évaluations. Une note publiée avant leur mise
                        en place n'en a pas : les colonnes affichent « — » et la
                        moyenne reste la note d'origine. */}
                    {EVALUATIONS.map((e) => {
                      const v = n[e.champ]
                      return (
                        <td key={e.champ} className={`px-3 py-3 text-center text-sm ${
                          typeof v === 'number' && v < 10 ? 'text-red-400' : 'text-zinc-800 dark:text-orange-100/70'
                        }`}>
                          {typeof v === 'number' ? v : '—'}
                        </td>
                      )
                    })}

                    <td className={`px-4 py-3 text-center font-bold ${retenue < 10 ? 'text-red-400' : 'text-zinc-900 dark:text-white'}`}>
                      <span className="inline-flex items-center gap-1.5">
                        {retenue}/20
                        {rattrapee && (
                          <span
                            className="text-[10px] font-semibold text-blue-600 dark:text-amber-400 border border-amber-500/40 bg-amber-500/10 rounded px-1 py-0.5 cursor-help"
                            title={`Session normale: ${n.note}/20 → Rattrapage: ${n.noteRattrapage}/20`}
                          >
                            Rattrapage
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {mention && <span className={`inline-block text-xs font-semibold border rounded-full px-2.5 py-0.5 ${mention.cls}`}>{mention.abbr}</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/50 text-xs">{n.commentaire || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}

export default GradeView
