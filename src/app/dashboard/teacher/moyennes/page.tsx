'use client'

import { useState, useEffect, useMemo } from 'react'
import { Save, CheckCircle, Calculator } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getFilieres,
  getSemestres,
  getUniversityMembers,
  getNotes,
  getMoyennesManuelles,
  saveMoyennes,
  type Filiere,
  type Semestre,
} from '@/lib/db'
import { getMention, getNoteRetenue } from '@/types/note'

interface Row {
  studentUid: string
  nom: string
  auto: number | null
  manuelle: string
}

const selectCls = 'w-full bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 disabled:opacity-50'

function parseMoy(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (Number.isNaN(n)) return null
  return Math.min(20, Math.max(0, n))
}

export default function TeacherMoyennesPage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId

  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [loading, setLoading] = useState(true)
  const [filiereId, setFiliereId] = useState('')
  const [niveau, setNiveau] = useState('')
  const [semestreId, setSemestreId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [fil, sem] = await Promise.all([getFilieres(universityId), getSemestres(universityId)])
        if (!active) return
        setFilieres(fil)
        setSemestres(sem)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId])

  const selectedFiliere = filieres.find((f) => f.id === filiereId)
  const niveauxOptions = selectedFiliere?.niveaux ?? []
  const ready = Boolean(filiereId && niveau && semestreId)

  function handleFiliereChange(id: string) {
    setFiliereId(id)
    const f = filieres.find((x) => x.id === id)
    if (!f?.niveaux?.includes(niveau)) setNiveau('')
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!universityId || !ready || !selectedFiliere) {
        if (active) setRows([])
        return
      }
      setRowsLoading(true)
      try {
        const [students, notes, manuelles] = await Promise.all([
          getUniversityMembers(universityId, 'student'),
          getNotes(universityId),
          getMoyennesManuelles(universityId, semestreId),
        ])
        if (!active) return
        const cohorte = students.filter((s) => s.filiere === selectedFiliere.nom && s.niveau === niveau)
        setRows(
          cohorte.map((s) => {
            const sien = notes.filter((n) => n.studentUid === s.uid && n.semestreId === semestreId)
            // Note retenue (rattrapage si présent) pour rester cohérent avec la vue étudiant.
            const auto = sien.length ? sien.reduce((a, n) => a + getNoteRetenue(n), 0) / sien.length : null
            const m = manuelles[s.uid]
            return { studentUid: s.uid, nom: s.displayName, auto, manuelle: m !== undefined ? String(m) : '' }
          })
        )
      } finally {
        if (active) setRowsLoading(false)
      }
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId, filiereId, niveau, semestreId])

  function updateManuelle(uid: string, value: string) {
    setRows((prev) => prev.map((r) => (r.studentUid === uid ? { ...r, manuelle: value } : r)))
  }

  async function handleSave() {
    if (!universityId || !ready) return
    setSaving(true)
    try {
      await saveMoyennes(universityId, semestreId, rows.map((r) => ({ studentUid: r.studentUid, moyenne: parseMoy(r.manuelle) })))
      setToast('Moyennes enregistrées.')
      setTimeout(() => setToast(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const stats = useMemo(() => ({ forcees: rows.filter((r) => parseMoy(r.manuelle) !== null).length }), [rows])

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Calculator size={22} className="text-blue-600 dark:text-orange-400" /> Moyennes générales</h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
          La moyenne est calculée automatiquement à partir des notes. Vous pouvez la <strong className="text-blue-700 dark:text-orange-300">forcer manuellement</strong> en cas de besoin (la valeur saisie prime).
        </p>
      </div>

      {filieres.length === 0 || semestres.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">Créez d’abord une filière (avec ses niveaux) et un semestre.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-4">
            <div>
              <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Filière</label>
              <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={selectCls}>
                <option value="">Choisir…</option>
                {filieres.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Niveau</label>
              <select value={niveau} onChange={(e) => setNiveau(e.target.value)} disabled={!filiereId} className={selectCls}>
                <option value="">{filiereId ? 'Choisir…' : 'Filière d’abord'}</option>
                {niveauxOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Semestre</label>
              <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)} className={selectCls}>
                <option value="">Choisir…</option>
                {semestres.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </div>
          </div>

          {!ready ? (
            <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">Sélectionnez filière, niveau et semestre.</div>
          ) : rowsLoading ? (
            <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">Aucun étudiant dans cette filière / niveau.</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">{rows.length} étudiant{rows.length > 1 ? 's' : ''} · {stats.forcees} moyenne{stats.forcees !== 1 ? 's' : ''} forcée{stats.forcees !== 1 ? 's' : ''}</p>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors">
                  {saving ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save size={15} />}
                  Enregistrer
                </button>
              </div>

              <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-black/40 text-blue-700 dark:text-orange-300/60 text-xs uppercase tracking-wider border-b border-zinc-200 dark:border-orange-500/10">
                      <th className="px-4 py-3 text-left">Étudiant</th>
                      <th className="px-4 py-3 text-center w-32">Moyenne auto</th>
                      <th className="px-4 py-3 text-center w-32">Moyenne forcée</th>
                      <th className="px-4 py-3 text-center w-36">Effective</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const manuelle = parseMoy(r.manuelle)
                      const effective = manuelle ?? r.auto
                      const mention = getMention(effective)
                      return (
                        <tr key={r.studentUid} className="border-t border-orange-500/5 hover:bg-orange-500/5 transition-colors">
                          <td className="px-4 py-2.5 text-zinc-800 dark:text-orange-100/80 font-medium">{r.nom}</td>
                          <td className="px-4 py-2.5 text-center text-zinc-600 dark:text-zinc-400">{r.auto === null ? '—' : `${r.auto.toFixed(2)}/20`}</td>
                          <td className="px-4 py-2.5 text-center">
                            <input type="number" min={0} max={20} step={0.01} value={r.manuelle}
                              onChange={(e) => updateManuelle(r.studentUid, e.target.value)} placeholder="auto"
                              className="w-24 bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-lg px-2 py-1 text-center text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-orange-400/60 placeholder:text-zinc-500 dark:placeholder:text-orange-200/20" />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {effective === null ? <span className="text-zinc-500 dark:text-orange-200/20">—</span> : (
                              <span className="inline-flex items-center gap-2">
                                <span className={`font-bold ${effective < 10 ? 'text-red-400' : 'text-zinc-900 dark:text-white'}`}>{effective.toFixed(2)}/20</span>
                                {mention && <span className={`text-[11px] font-semibold border rounded-full px-2 py-0.5 ${mention.cls}`}>{mention.abbr}</span>}
                                {manuelle !== null && <span className="text-[10px] text-blue-600 dark:text-amber-400 border border-amber-500/30 rounded px-1">forcée</span>}
                              </span>
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
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-white dark:bg-zinc-900 border border-orange-500/25 rounded-xl px-4 py-3 shadow-2xl">
          <CheckCircle size={16} className="text-blue-600 dark:text-orange-400 shrink-0" />
          <p className="text-zinc-800 dark:text-orange-100 text-sm">{toast}</p>
        </div>
      )}
    </div>
  )
}
