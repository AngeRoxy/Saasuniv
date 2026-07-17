'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Plus, X, Pencil, Trash2, Search, Check, AlertCircle, AlertTriangle, CalendarX, Save } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getAbsences,
  createAbsence,
  updateAbsence,
  deleteAbsence,
  getUniversityMembers,
  getSeuilAlerteConfig,
  setSeuilAlerteConfig,
  type Absence,
  type AbsenceFormData,
  type UniversityMember,
} from '@/lib/db'
import { MOTIFS, motifLabel, DEFAULT_SEUIL_ABSENCES, type MotifAbsence } from '@/types/absence'

interface FormState {
  studentUid: string
  date: string
  matiere: string
  justifiee: boolean
  motif: string
  motifCategorie: MotifAbsence | ''
  referenceJustificatif: string
}

type StatutFilter = 'toutes' | 'justifiees' | 'injustifiees'

const inputCls = 'w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-zinc-500 dark:placeholder:text-orange-200/25'
const selectCls = 'w-full bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60'
const filterCls = 'bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-orange-500/60'

export default function AdminAbsencesPage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId

  const [absences, setAbsences] = useState<Absence[]>([])
  const [students, setStudents] = useState<UniversityMember[]>([])
  const [seuil, setSeuil] = useState(DEFAULT_SEUIL_ABSENCES)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState<StatutFilter>('toutes')
  const [filiereFilter, setFiliereFilter] = useState('')
  const [niveauFilter, setNiveauFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ studentUid: '', date: '', matiere: '', justifiee: false, motif: '', motifCategorie: '', referenceJustificatif: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Absence | null>(null)

  // Configuration du seuil d'alerte.
  const [seuilInput, setSeuilInput] = useState('')
  const [seuilSaving, setSeuilSaving] = useState(false)
  const [seuilMsg, setSeuilMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [abs, studs, s] = await Promise.all([
          getAbsences(universityId),
          getUniversityMembers(universityId, 'student'),
          getSeuilAlerteConfig(universityId),
        ])
        if (!active) return
        setAbsences(abs)
        setStudents(studs)
        setSeuil(s)
        setSeuilInput(String(s))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId])

  async function refresh() {
    if (!universityId) return
    setAbsences(await getAbsences(universityId))
  }

  const studentById = useMemo(() => new Map(students.map((s) => [s.uid, s])), [students])

  const filiereOptions = useMemo(
    () => [...new Set(students.map((s) => s.filiere).filter((f): f is string => Boolean(f)))].sort(),
    [students]
  )
  const niveauOptions = useMemo(
    () => [...new Set(students.map((s) => s.niveau).filter((n): n is string => Boolean(n)))].sort(),
    [students]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return absences
      .filter((a) => {
        if (q && !a.studentNom.toLowerCase().includes(q) && !a.matricule.toLowerCase().includes(q)) return false
        if (statutFilter === 'justifiees' && !a.justifiee) return false
        if (statutFilter === 'injustifiees' && a.justifiee) return false
        const s = studentById.get(a.studentUid)
        if (filiereFilter && s?.filiere !== filiereFilter) return false
        if (niveauFilter && s?.niveau !== niveauFilter) return false
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [absences, search, statutFilter, filiereFilter, niveauFilter, studentById])

  // Étudiants ayant atteint le seuil (RÈGLE 3 : seuil apprécié par matière).
  const alertes = useMemo(() => {
    // studentUid → (matiere → nb injustifiées)
    const parEtudiant = new Map<string, Map<string, number>>()
    for (const a of absences) {
      if (a.justifiee) continue
      const parMatiere = parEtudiant.get(a.studentUid) ?? new Map<string, number>()
      const key = a.matiere || '—'
      parMatiere.set(key, (parMatiere.get(key) ?? 0) + 1)
      parEtudiant.set(a.studentUid, parMatiere)
    }
    const result: { uid: string; nom: string; matricule: string; matiere: string; count: number }[] = []
    for (const [uid, parMatiere] of parEtudiant) {
      let topMatiere = ''
      let topCount = 0
      for (const [m, n] of parMatiere) {
        if (n > topCount) { topCount = n; topMatiere = m }
      }
      if (topCount >= seuil) {
        const s = studentById.get(uid)
        const nom = s?.displayName ?? absences.find((a) => a.studentUid === uid)?.studentNom ?? uid
        result.push({ uid, nom, matricule: s?.matricule ?? '', matiere: topMatiere, count: topCount })
      }
    }
    return result.sort((a, b) => b.count - a.count)
  }, [absences, seuil, studentById])

  function openAdd() {
    setEditId(null)
    setForm({ studentUid: '', date: new Date().toISOString().slice(0, 10), matiere: '', justifiee: false, motif: '', motifCategorie: '', referenceJustificatif: '' })
    setFormError(null)
    setModalOpen(true)
  }
  function openEdit(a: Absence) {
    setEditId(a.id)
    setForm({
      studentUid: a.studentUid,
      date: a.date,
      matiere: a.matiere,
      justifiee: a.justifiee,
      motif: a.motif,
      motifCategorie: a.motifCategorie ?? '',
      referenceJustificatif: a.referenceJustificatif ?? '',
    })
    setFormError(null)
    setModalOpen(true)
  }
  function closeModal() { setModalOpen(false); setEditId(null); setFormError(null) }

  async function handleSave() {
    if (!universityId) return
    const student = students.find((s) => s.uid === form.studentUid)
    if (!student) { setFormError('Choisissez un étudiant.'); return }
    if (!form.date) { setFormError('Renseignez la date.'); return }

    setSaving(true)
    setFormError(null)
    try {
      const base: AbsenceFormData = {
        studentUid: student.uid,
        studentNom: student.displayName,
        matricule: student.matricule ?? '',
        date: form.date,
        matiere: form.matiere,
        justifiee: form.justifiee,
        motif: form.motif,
        // Champs de justification : ne sont écrits que si l'absence est justifiée.
        ...(form.justifiee && form.motifCategorie ? { motifCategorie: form.motifCategorie } : {}),
        ...(form.justifiee && form.referenceJustificatif ? { referenceJustificatif: form.referenceJustificatif } : {}),
      }
      if (editId) {
        await updateAbsence(universityId, editId, base)
      } else {
        // Traçabilité : on mémorise qui a marqué l'absence (uniquement à la création).
        await createAbsence(universityId, {
          ...base,
          marqueParUid: user?.uid ?? '',
          marqueParNom: profile?.displayName ?? user?.email ?? '',
        })
      }
      await refresh()
      closeModal()
    } catch {
      setFormError('Échec de l’enregistrement. Réessayez.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!universityId || !deleteTarget) return
    await deleteAbsence(universityId, deleteTarget.id)
    await refresh()
    setDeleteTarget(null)
  }

  async function handleSaveSeuil() {
    if (!universityId) return
    const n = Number(seuilInput)
    if (!Number.isInteger(n) || n < 1) { setSeuilMsg('Le seuil doit être un entier ≥ 1.'); return }
    setSeuilSaving(true)
    setSeuilMsg(null)
    try {
      await setSeuilAlerteConfig(universityId, n)
      setSeuil(n)
      setSeuilMsg('Seuil enregistré.')
    } catch {
      setSeuilMsg('Échec de l’enregistrement du seuil.')
    } finally {
      setSeuilSaving(false)
    }
  }

  if (profile && profile.role !== 'admin_universite' && profile.role !== 'super_admin_plateforme') {
    return <div className="flex items-center justify-center h-64 text-blue-700 dark:text-orange-300/60 text-sm">Accès réservé aux administrateurs.</div>
  }
  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Alertes seuil (RÈGLE 3) */}
      {alertes.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/25 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-400" />
            <h2 className="text-sm font-semibold text-red-300">Seuil d’absences injustifiées atteint ({seuil}+ sur une matière)</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertes.map((al) => (
              <Link key={al.uid} href="/dashboard/admin/students"
                className="group inline-flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-1.5 transition-colors">
                <span className="text-sm text-zinc-900 dark:text-white font-medium">{al.nom}</span>
                <span className="text-[11px] text-red-300/80">{al.count} × {al.matiere}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Barre de filtres + action */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un étudiant…"
              className="w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/60" />
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shrink-0 sm:ml-auto">
            <Plus size={15} /> Marquer une absence
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value as StatutFilter)} className={filterCls}>
            <option value="toutes">Tous les statuts</option>
            <option value="justifiees">Justifiées</option>
            <option value="injustifiees">Injustifiées</option>
          </select>
          <select value={filiereFilter} onChange={(e) => setFiliereFilter(e.target.value)} className={filterCls}>
            <option value="">Toutes filières</option>
            {filiereOptions.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={niveauFilter} onChange={(e) => setNiveauFilter(e.target.value)} className={filterCls}>
            <option value="">Tous niveaux</option>
            {niveauOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-black/40 text-blue-700 dark:text-orange-300/60 text-xs uppercase tracking-wider">
              <th className="px-5 py-3 text-left">Étudiant</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Matière</th>
              <th className="px-5 py-3 text-center">Statut</th>
              <th className="px-5 py-3 text-left">Motif</th>
              <th className="px-5 py-3 text-left">Marquée par</th>
              <th className="px-5 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-zinc-600 text-sm">
                {absences.length === 0 ? 'Aucune absence enregistrée.' : 'Aucun résultat.'}
              </td></tr>
            ) : filtered.map((a) => (
              <tr key={a.id} className="border-t border-orange-500/5 hover:bg-orange-500/5 transition-colors">
                <td className="px-5 py-3.5">
                  <p className="text-zinc-900 dark:text-white text-sm font-medium leading-none">{a.studentNom}</p>
                  {a.matricule && <p className="text-zinc-500 text-xs font-mono mt-0.5">{a.matricule}</p>}
                </td>
                <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{a.date ? new Date(a.date).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400">{a.matiere || '—'}</td>
                <td className="px-5 py-3.5 text-center">
                  {a.justifiee ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-green-500/15 text-green-400 border border-green-500/25"><Check size={11} /> Justifiée</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/25"><AlertCircle size={11} /> Non justifiée</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-zinc-500 text-xs max-w-48">
                  {a.justifiee ? (
                    <div className="truncate">
                      {a.motifCategorie && <span className="text-zinc-600 dark:text-orange-200/70">{motifLabel(a.motifCategorie)}</span>}
                      {a.motif && <span>{a.motifCategorie ? ' · ' : ''}{a.motif}</span>}
                      {a.referenceJustificatif && <span className="text-zinc-600"> · réf. {a.referenceJustificatif}</span>}
                      {!a.motifCategorie && !a.motif && !a.referenceJustificatif && '—'}
                    </div>
                  ) : '—'}
                </td>
                <td className="px-5 py-3.5 text-zinc-500 text-xs">{a.marqueParNom || '—'}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1 justify-center">
                    <button onClick={() => openEdit(a)} title={a.justifiee ? 'Modifier' : 'Justifier / modifier'} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-blue-800 dark:hover:text-orange-400 hover:bg-orange-500/10"><Pencil size={13} /></button>
                    <button onClick={() => setDeleteTarget(a)} title="Supprimer" className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paramètre : seuil d'alerte */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">Seuil d’alerte</h2>
        <p className="text-xs text-zinc-500 mb-4">Nombre d’absences injustifiées sur une même matière déclenchant une alerte (admin + parent).</p>
        <div className="flex flex-wrap items-center gap-3">
          <input type="number" min={1} value={seuilInput} onChange={(e) => { setSeuilInput(e.target.value); setSeuilMsg(null) }}
            className="w-24 bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-orange-500/60" />
          <button onClick={handleSaveSeuil} disabled={seuilSaving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/90 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
            {seuilSaving ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save size={14} />}
            Enregistrer
          </button>
          {seuilMsg && <span className={`text-xs ${seuilMsg.includes('Échec') || seuilMsg.includes('entier') ? 'text-red-400' : 'text-green-400'}`}>{seuilMsg}</span>}
        </div>
      </div>

      {/* Modal ajout / justification */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{editId ? 'Modifier l’absence' : 'Marquer une absence'}</h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Étudiant</label>
                <select value={form.studentUid} onChange={(e) => setForm((f) => ({ ...f, studentUid: e.target.value }))} className={selectCls}>
                  <option value="">{students.length ? 'Choisir…' : 'Aucun étudiant inscrit'}</option>
                  {students.map((s) => <option key={s.uid} value={s.uid}>{s.displayName}{s.matricule ? ` (${s.matricule})` : ''}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={`${inputCls} scheme-dark`} />
                </div>
                <div>
                  <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Matière (option.)</label>
                  <input value={form.matiere} onChange={(e) => setForm((f) => ({ ...f, matiere: e.target.value }))} placeholder="Ex: Maths" className={inputCls} />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <button type="button" onClick={() => setForm((f) => ({ ...f, justifiee: !f.justifiee }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.justifiee ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.justifiee ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-zinc-600 dark:text-orange-200/70">Absence justifiée</span>
              </label>

              {/* Champs de justification (RÈGLE 2) — visibles seulement si justifiée */}
              {form.justifiee && (
                <div className="space-y-4 border-l-2 border-green-500/30 pl-4">
                  <div>
                    <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Motif</label>
                    <select value={form.motifCategorie} onChange={(e) => setForm((f) => ({ ...f, motifCategorie: e.target.value as MotifAbsence | '' }))} className={selectCls}>
                      <option value="">Choisir…</option>
                      {MOTIFS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Référence du justificatif (option.)</label>
                    <input value={form.referenceJustificatif} onChange={(e) => setForm((f) => ({ ...f, referenceJustificatif: e.target.value }))} placeholder="Ex: Certificat n°2024-118" className={inputCls} />
                  </div>
                </div>
              )}

              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Commentaire (option.)</label>
                <input value={form.motif} onChange={(e) => setForm((f) => ({ ...f, motif: e.target.value }))} placeholder="Précision libre" className={inputCls} />
              </div>
              {formError && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{formError}</p>}
              </div>

              <div className="flex gap-3 pt-6 shrink-0">
                <button onClick={closeModal} disabled={saving} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50">Annuler</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                  {saving && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  {editId ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-red-500/20 rounded-2xl p-7 w-full max-w-sm flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0"><CalendarX size={18} className="text-red-400" /></div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Supprimer cette absence ?</h2>
            </div>
            <p className="text-zinc-800 dark:text-orange-100/55 text-sm mb-6 flex-1 min-h-0 overflow-y-auto">{deleteTarget.studentNom} — {deleteTarget.date ? new Date(deleteTarget.date).toLocaleDateString('fr-FR') : ''}</p>
            <div className="flex gap-3 shrink-0">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors">Annuler</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
