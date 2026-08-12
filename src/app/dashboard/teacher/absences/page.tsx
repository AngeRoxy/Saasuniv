'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { X, Pencil, Trash2, Check, AlertCircle, CalendarX, ClipboardCheck, History } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getAbsences,
  updateAbsence,
  deleteAbsence,
  getCreneaux,
  type Absence,
} from '@/lib/db'
import { MOTIFS, motifLabel, type MotifAbsence } from '@/types/absence'
import { Toggle } from '@/components/ui/toggle'
import { type Creneau } from '@/types/emploi-du-temps'

interface JustifyForm {
  justifiee: boolean
  motifCategorie: MotifAbsence | ''
  referenceJustificatif: string
  motif: string
}

const inputCls = 'w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-zinc-500 dark:placeholder:text-orange-200/25'
const selectCls = 'w-full bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60'

export default function TeacherAbsencesPage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId
  const teacherName = profile?.displayName ?? user?.displayName ?? ''

  const [absences, setAbsences] = useState<Absence[]>([])
  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  const [loading, setLoading] = useState(true)

  // Justification (uniquement sur les absences que CET enseignant a lui-même marquées).
  const [justifyTarget, setJustifyTarget] = useState<Absence | null>(null)
  const [justifyForm, setJustifyForm] = useState<JustifyForm>({ justifiee: false, motifCategorie: '', referenceJustificatif: '', motif: '' })
  const [justifySaving, setJustifySaving] = useState(false)
  const [justifyError, setJustifyError] = useState<string | null>(null)

  // Suppression (idem : réservée au créateur de l'absence).
  const [deleteTarget, setDeleteTarget] = useState<Absence | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [abs, cres] = await Promise.all([
          getAbsences(universityId),
          getCreneaux(universityId),
        ])
        if (!active) return
        setAbsences(abs)
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

  function openJustify(a: Absence) {
    setJustifyTarget(a)
    setJustifyForm({
      justifiee: a.justifiee,
      motifCategorie: a.motifCategorie ?? '',
      referenceJustificatif: a.referenceJustificatif ?? '',
      motif: a.motif ?? '',
    })
    setJustifyError(null)
  }
  function closeJustify() { setJustifyTarget(null); setJustifyError(null) }

  async function handleJustify() {
    if (!universityId || !justifyTarget) return
    setJustifySaving(true)
    setJustifyError(null)
    try {
      await updateAbsence(universityId, justifyTarget.id, {
        justifiee: justifyForm.justifiee,
        motif: justifyForm.motif,
        ...(justifyForm.justifiee && justifyForm.motifCategorie ? { motifCategorie: justifyForm.motifCategorie } : {}),
        ...(justifyForm.justifiee && justifyForm.referenceJustificatif ? { referenceJustificatif: justifyForm.referenceJustificatif } : {}),
      })
      await refresh()
      closeJustify()
    } catch {
      setJustifyError('Échec de l’enregistrement. Réessayez.')
    } finally {
      setJustifySaving(false)
    }
  }

  async function handleDeleteOwn() {
    if (!universityId || !deleteTarget) return
    setDeleting(true)
    try {
      await deleteAbsence(universityId, deleteTarget.id)
      await refresh()
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
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
          <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">Consultation des absences de vos cours, créées via l’appel. Vous pouvez justifier ou supprimer celles que vous avez vous-même marquées.</p>
        </div>
        {mesCreneaux.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Link href="/dashboard/teacher/absences/historique" className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-orange-500/30 text-blue-700 dark:text-orange-300 hover:bg-orange-500/10 text-sm font-semibold transition-colors">
              <History size={15} /> Historique des appels
            </Link>
            <Link href="/dashboard/teacher/absences/appel" className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors">
              <ClipboardCheck size={15} /> Faire l’appel
            </Link>
          </div>
        )}
      </div>

      {mesCreneaux.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
          Aucun cours ne vous est assigné. L’administration vous attribue les créneaux depuis l’emploi du temps ; vous pourrez alors faire l’appel.
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
                <th className="px-5 py-3 text-left">Motif</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mesAbsences.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-zinc-600 text-sm">Aucune absence enregistrée pour vos cours. Faites l’appel pour commencer.</td></tr>
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
                  <td className="px-5 py-3.5 text-zinc-500 text-xs max-w-48">
                    {a.justifiee ? (
                      <div className="truncate">
                        {a.motifCategorie && <span className="text-zinc-600 dark:text-orange-200/70">{motifLabel(a.motifCategorie)}</span>}
                        {a.motif && <span>{a.motifCategorie ? ' · ' : ''}{a.motif}</span>}
                        {a.referenceJustificatif && <span className="text-zinc-600"> · réf. {a.referenceJustificatif}</span>}
                        {!a.motifCategorie && !a.motif && !a.referenceJustificatif && '—'}
                      </div>
                    ) : (a.motif || '—')}
                  </td>
                  <td className="px-5 py-3.5">
                    {a.marqueParUid === user?.uid ? (
                      <div className="flex items-center gap-1 justify-center">
                        <button onClick={() => openJustify(a)} title="Justifier / modifier" className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-blue-800 dark:hover:text-orange-400 hover:bg-orange-500/10"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteTarget(a)} title="Supprimer" className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                      </div>
                    ) : (
                      <span className="block text-center text-zinc-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal justification (absences que CET enseignant a lui-même marquées) */}
      {justifyTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Justifier l’absence</h2>
              <button onClick={closeJustify} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
                <p className="text-zinc-600 dark:text-orange-200/60 text-sm">{justifyTarget.studentNom} — {justifyTarget.date ? new Date(justifyTarget.date).toLocaleDateString('fr-FR') : ''}</p>
                <Toggle
                  checked={justifyForm.justifiee}
                  onChange={(justifiee) => setJustifyForm((f) => ({ ...f, justifiee }))}
                  label="Absence justifiée"
                  trackActiveClassName="bg-green-500"
                />
                {justifyForm.justifiee && (
                  <div className="space-y-4 border-l-2 border-green-500/30 pl-4">
                    <div>
                      <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Motif</label>
                      <select value={justifyForm.motifCategorie} onChange={(e) => setJustifyForm((f) => ({ ...f, motifCategorie: e.target.value as MotifAbsence | '' }))} className={selectCls}>
                        <option value="">Choisir…</option>
                        {MOTIFS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Référence du justificatif (option.)</label>
                      <input value={justifyForm.referenceJustificatif} onChange={(e) => setJustifyForm((f) => ({ ...f, referenceJustificatif: e.target.value }))} placeholder="Ex: Certificat n°2024-118" className={inputCls} />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Commentaire (option.)</label>
                  <input value={justifyForm.motif} onChange={(e) => setJustifyForm((f) => ({ ...f, motif: e.target.value }))} placeholder="Précision libre" className={inputCls} />
                </div>
                {justifyError && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{justifyError}</p>}
              </div>
              <div className="flex gap-3 pt-6 shrink-0">
                <button onClick={closeJustify} disabled={justifySaving} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50">Annuler</button>
                <button onClick={handleJustify} disabled={justifySaving} className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                  {justifySaving && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suppression (idem : réservée au créateur) */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-red-500/20 rounded-2xl p-7 w-full max-w-sm flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0"><CalendarX size={18} className="text-red-400" /></div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Supprimer cette absence ?</h2>
            </div>
            <p className="text-zinc-800 dark:text-orange-100/55 text-sm mb-6 flex-1 min-h-0 overflow-y-auto">{deleteTarget.studentNom} — {deleteTarget.date ? new Date(deleteTarget.date).toLocaleDateString('fr-FR') : ''}</p>
            <div className="flex gap-3 shrink-0">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50">Annuler</button>
              <button onClick={handleDeleteOwn} disabled={deleting} className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
