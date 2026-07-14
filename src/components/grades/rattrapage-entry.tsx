'use client'

import { useState, useEffect, useMemo } from 'react'
import { RotateCcw, Save, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getEtudiantsEligiblesRattrapage, saveNoteRattrapage } from '@/lib/db'
import { getMention } from '@/types/note'

interface Row {
  studentUid: string
  displayName: string
  noteNormale: number
  /** Valeur éditable de la note de rattrapage (chaîne du champ). */
  rattrapage: string
  /** Valeur initiale (pour ne saisir que les lignes réellement modifiées). */
  initial: string
}

function parseNote(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (Number.isNaN(n)) return null
  return Math.min(20, Math.max(0, n))
}

/**
 * Saisie des notes de RATTRAPAGE (enseignant/admin). Volontairement séparé de
 * <GradeEntry> pour éviter toute confusion avec la saisie normale : bandeau
 * d'avertissement, cohorte limitée aux étudiants non validés (note < 10), et
 * accent visuel ambre/rouge distinct de l'orange standard.
 */
export function RattrapageEntry({
  universityId,
  semestreId,
  matiereId,
  filiereId,
  niveau,
  matiereNom,
}: {
  universityId: string
  semestreId: string
  matiereId: string
  filiereId: string
  niveau: string
  matiereNom?: string
}) {
  const { user, profile } = useAuth()

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null)

  const ready = Boolean(universityId && semestreId && matiereId && filiereId && niveau)

  // Charge les étudiants éligibles (note normale < seuil) pour la cohorte.
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!ready) {
        if (active) setRows([])
        return
      }
      setLoading(true)
      try {
        const eligibles = await getEtudiantsEligiblesRattrapage(
          universityId,
          semestreId,
          matiereId,
          filiereId,
          niveau
        )
        if (!active) return
        setRows(
          eligibles.map((e) => {
            const initial = e.noteRattrapageActuelle !== null ? String(e.noteRattrapageActuelle) : ''
            return {
              studentUid: e.studentUid,
              displayName: e.displayName,
              noteNormale: e.noteNormale,
              rattrapage: initial,
              initial,
            }
          })
        )
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId, semestreId, matiereId, filiereId, niveau, ready])

  function updateRow(uid: string, value: string) {
    setRows((prev) => prev.map((r) => (r.studentUid === uid ? { ...r, rattrapage: value } : r)))
  }

  // Lignes réellement modifiées avec une note de rattrapage valide.
  const modified = useMemo(
    () =>
      rows
        .map((r) => ({ row: r, note: parseNote(r.rattrapage) }))
        .filter((x) => x.note !== null && x.row.rattrapage.trim() !== x.row.initial.trim()),
    [rows]
  )

  async function handleSave() {
    if (!ready || modified.length === 0) return
    if (!user?.uid) {
      setToast({ msg: 'Session expirée : reconnectez-vous pour enregistrer.', error: true })
      return
    }
    setSaving(true)
    try {
      await Promise.all(
        modified.map((x) =>
          saveNoteRattrapage(
            universityId,
            semestreId,
            matiereId,
            x.row.studentUid,
            x.note as number,
            user.uid,
            profile?.displayName ?? user.uid
          )
        )
      )
      // Les valeurs saisies deviennent la nouvelle référence (plus « modifiées »).
      setRows((prev) => prev.map((r) => ({ ...r, initial: r.rattrapage })))
      setToast({ msg: `${modified.length} note${modified.length > 1 ? 's' : ''} de rattrapage enregistrée${modified.length > 1 ? 's' : ''}.` })
      setTimeout(() => setToast(null), 3000)
    } catch {
      // Pas de faux succès : l'écriture Firebase a échoué, on le dit clairement.
      setToast({ msg: 'Échec de l’enregistrement des notes de rattrapage.', error: true })
      setTimeout(() => setToast(null), 4000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Bandeau d'avertissement distinctif (ambre/rouge). */}
      <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3">
        <RotateCcw size={18} className="text-blue-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-600 dark:text-amber-200">
            Saisie des notes de RATTRAPAGE{matiereNom ? ` — ${matiereNom}` : ''}
          </p>
          <p className="text-xs text-zinc-600 dark:text-amber-200/60 mt-0.5 leading-relaxed">
            Seuls les étudiants n’ayant pas validé (note normale &lt; 10/20) apparaissent ici. La note
            de rattrapage remplace la note normale dans la moyenne, mais l’originale reste conservée.
          </p>
        </div>
      </div>

      {!ready ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
          Sélectionnez filière, niveau, semestre et matière pour saisir les rattrapages.
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm flex flex-col items-center gap-3">
          <CheckCircle size={30} className="text-green-500/40" />
          Aucun étudiant n’a besoin de rattrapage pour cette matière.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              {rows.length} étudiant{rows.length > 1 ? 's' : ''} éligible{rows.length > 1 ? 's' : ''}
              {modified.length > 0 && (
                <span className="text-blue-600 dark:text-amber-400"> · {modified.length} à enregistrer</span>
              )}
            </p>
            <button
              onClick={handleSave}
              disabled={saving || modified.length === 0}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <Save size={15} />
              )}
              Enregistrer les notes de rattrapage
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-950 border border-amber-500/15 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-black/40 text-blue-700 dark:text-amber-300/60 text-xs uppercase tracking-wider border-b border-amber-500/15">
                  <th className="px-4 py-3 text-left">Étudiant</th>
                  <th className="px-4 py-3 text-center w-32">Note normale</th>
                  <th className="px-4 py-3 text-center w-40">Note de rattrapage</th>
                  <th className="px-4 py-3 text-center w-28">Mention (retenue)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ratt = parseNote(r.rattrapage)
                  const retenue = ratt ?? r.noteNormale
                  const mention = getMention(retenue)
                  return (
                    <tr key={r.studentUid} className="border-t border-amber-500/5 hover:bg-amber-500/5 transition-colors">
                      <td className="px-4 py-2.5 text-zinc-800 dark:text-orange-100/80 font-medium whitespace-nowrap">{r.displayName}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="font-semibold text-red-400" title="Note obtenue en session normale (échec)">
                          {r.noteNormale}/20
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          max={20}
                          step={0.25}
                          value={r.rattrapage}
                          onChange={(e) => updateRow(r.studentUid, e.target.value)}
                          placeholder="—"
                          className="w-24 bg-zinc-50 dark:bg-black/40 border border-amber-500/30 rounded-lg px-2 py-1 text-center text-sm font-semibold text-zinc-600 dark:text-amber-200 focus:outline-none focus:border-amber-400/70 placeholder:text-zinc-500 dark:placeholder:text-amber-200/20"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {mention ? (
                          <span className={`inline-block text-xs font-semibold border rounded-full px-2.5 py-0.5 ${mention.cls}`}>{mention.abbr}</span>
                        ) : (
                          <span className="text-zinc-500 dark:text-orange-200/20 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-white dark:bg-zinc-900 border border-amber-500/30 rounded-xl px-5 py-3.5 shadow-2xl">
          {toast.error ? (
            <AlertTriangle size={17} className="text-red-400 shrink-0" />
          ) : (
            <CheckCircle size={17} className="text-blue-600 dark:text-amber-400 shrink-0" />
          )}
          <span className="text-zinc-900 dark:text-white text-sm font-medium">{toast.msg}</span>
        </div>
      )}
    </div>
  )
}

export default RattrapageEntry
