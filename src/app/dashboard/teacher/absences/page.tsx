'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, X, Check, AlertCircle, CalendarX } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getAbsences,
  createAbsence,
  getUniversityMembers,
  getFilieres,
  getCreneaux,
  type Absence,
  type UniversityMember,
  type Filiere,
} from '@/lib/db'
import { type Creneau } from '@/types/emploi-du-temps'

interface TForm {
  creneauId: string
  studentUid: string
  date: string
  motif: string
}

const inputCls = 'w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-zinc-500 dark:placeholder:text-orange-200/25'
const selectCls = 'w-full bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60'

export default function TeacherAbsencesPage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId
  const teacherName = profile?.displayName ?? user?.displayName ?? ''

  const [absences, setAbsences] = useState<Absence[]>([])
  const [students, setStudents] = useState<UniversityMember[]>([])
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<TForm>({ creneauId: '', studentUid: '', date: '', motif: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [abs, studs, fils, cres] = await Promise.all([
          getAbsences(universityId),
          getUniversityMembers(universityId, 'student'),
          getFilieres(universityId),
          getCreneaux(universityId),
        ])
        if (!active) return
        setAbsences(abs)
        setStudents(studs)
        setFilieres(fils)
        setCreneaux(cres)
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

  const filiereNom = useMemo(() => {
    const map = new Map(filieres.map((f) => [f.id, f.nom]))
    return (id: string) => map.get(id) ?? ''
  }, [filieres])

  // Créneaux de l'enseignant : appariés par nom (cf. emploi du temps).
  const mesCreneaux = useMemo(
    () => creneaux.filter((c) => c.enseignant && c.enseignant === teacherName),
    [creneaux, teacherName]
  )

  // Absences relevant de ses cours : liées à un de ses créneaux, marquées par lui,
  // ou portant l'une de ses matières (couvre les données antérieures sans creneauId).
  const mesAbsences = useMemo(() => {
    const ids = new Set(mesCreneaux.map((c) => c.id))
    const matieres = new Set(mesCreneaux.map((c) => c.matiere))
    return absences
      .filter((a) =>
        (a.creneauId && ids.has(a.creneauId)) ||
        a.marqueParUid === user?.uid ||
        (a.matiere && matieres.has(a.matiere))
      )
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [absences, mesCreneaux, user?.uid])

  const selectedCreneau = mesCreneaux.find((c) => c.id === form.creneauId) ?? null

  // Étudiants du groupe (filière + niveau) du créneau sélectionné.
  const groupeStudents = useMemo(() => {
    if (!selectedCreneau) return []
    const nom = filiereNom(selectedCreneau.filiereId)
    return students.filter((s) => s.filiere === nom && s.niveau === selectedCreneau.niveau)
  }, [selectedCreneau, students, filiereNom])

  function openAdd() {
    setForm({ creneauId: mesCreneaux[0]?.id ?? '', studentUid: '', date: new Date().toISOString().slice(0, 10), motif: '' })
    setFormError(null)
    setModalOpen(true)
  }
  function closeModal() { setModalOpen(false); setFormError(null) }

  async function handleSave() {
    if (!universityId) return
    const creneau = mesCreneaux.find((c) => c.id === form.creneauId)
    if (!creneau) { setFormError('Choisissez un créneau.'); return }
    const student = students.find((s) => s.uid === form.studentUid)
    if (!student) { setFormError('Choisissez un étudiant.'); return }
    if (!form.date) { setFormError('Renseignez la date.'); return }

    setSaving(true)
    setFormError(null)
    try {
      await createAbsence(universityId, {
        studentUid: student.uid,
        studentNom: student.displayName,
        matricule: student.matricule ?? '',
        date: form.date,
        matiere: creneau.matiere,
        justifiee: false,
        motif: form.motif,
        creneauId: creneau.id,
        marqueParUid: user?.uid ?? '',
        marqueParNom: teacherName || user?.email || '',
      })
      await refresh()
      closeModal()
    } catch {
      setFormError('Échec de l’enregistrement. Réessayez.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <CalendarX size={22} className="text-blue-600 dark:text-orange-400" />
            Absences
          </h1>
          <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">Les absences de vos cours. La justification est gérée par l’administration.</p>
        </div>
        {mesCreneaux.length > 0 && (
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shrink-0">
            <Plus size={15} /> Marquer une absence
          </button>
        )}
      </div>

      {mesCreneaux.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
          Aucun cours ne vous est assigné. L’administration vous attribue les créneaux depuis l’emploi du temps ; vous pourrez alors marquer les absences.
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-black/40 text-blue-700 dark:text-orange-300/60 text-xs uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">Étudiant</th>
                <th className="px-5 py-3 text-left">Matière</th>
                <th className="px-5 py-3 text-center">Statut</th>
                <th className="px-5 py-3 text-left">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {mesAbsences.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-zinc-600 text-sm">Aucune absence enregistrée pour vos cours.</td></tr>
              ) : mesAbsences.map((a) => (
                <tr key={a.id} className="border-t border-orange-500/5 hover:bg-orange-500/5 transition-colors">
                  <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{a.date ? new Date(a.date).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-5 py-3.5">
                    <p className="text-zinc-900 dark:text-white text-sm font-medium leading-none">{a.studentNom}</p>
                    {a.matricule && <p className="text-zinc-500 text-xs font-mono mt-0.5">{a.matricule}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400">{a.matiere || '—'}</td>
                  <td className="px-5 py-3.5 text-center">
                    {a.justifiee ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-green-500/15 text-green-400 border border-green-500/25"><Check size={11} /> Justifiée</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/25"><AlertCircle size={11} /> Non justifiée</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500 text-xs max-w-48 truncate">{a.motif || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal marquer une absence */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Marquer une absence</h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Créneau</label>
                <select value={form.creneauId} onChange={(e) => setForm((f) => ({ ...f, creneauId: e.target.value, studentUid: '' }))} className={selectCls}>
                  {mesCreneaux.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.matiere} — {filiereNom(c.filiereId)} · {c.niveau} ({c.jour} {c.heureDebut})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Étudiant</label>
                <select value={form.studentUid} onChange={(e) => setForm((f) => ({ ...f, studentUid: e.target.value }))} className={selectCls}>
                  <option value="">{groupeStudents.length ? 'Choisir…' : 'Aucun étudiant dans ce groupe'}</option>
                  {groupeStudents.map((s) => <option key={s.uid} value={s.uid}>{s.displayName}{s.matricule ? ` (${s.matricule})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={`${inputCls} scheme-dark`} />
              </div>
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Commentaire (option.)</label>
                <input value={form.motif} onChange={(e) => setForm((f) => ({ ...f, motif: e.target.value }))} placeholder="Précision libre" className={inputCls} />
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-orange-200/40">L’absence est enregistrée comme <span className="text-red-400/80">non justifiée</span>. Seule l’administration peut la justifier.</p>
              {formError && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={closeModal} disabled={saving} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50">Annuler</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                  {saving && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
