'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus,
  X,
  Pencil,
  Trash2,
  Ban,
  Clock,
  MapPin,
  User,
  UserCheck,
  ClipboardList,
  AlertTriangle,
  CalendarCheck,
  Info,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getFilieres,
  getSemestres,
  getMatieres,
  getUniversityMembers,
  getExamens,
  createExamen,
  updateExamen,
  deleteExamen,
  type Filiere,
  type Matiere,
  type Semestre,
  type UniversityMember,
} from '@/lib/db'
import {
  findConflitsExamen,
  ConflitExamenError,
  formatDateLong,
  compareExamens,
  todayISO,
  TYPE_SESSION_OPTIONS,
  TYPE_SESSION_LABELS,
  TYPE_SESSION_STYLES,
  STATUT_EXAMEN_LABELS,
  STATUT_EXAMEN_STYLES,
  type Examen,
  type ExamenFormData,
  type ExamenCandidat,
  type ConflitExamenInfo,
  type TypeSession,
} from '@/types/examen'

const inputCls = 'w-full bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-orange-200/25'
const selectCls = 'w-full bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-400/60'
const labelCls = 'text-orange-200/60 text-xs font-medium block mb-1.5'

interface FormState {
  filiereId: string
  niveau: string
  matiereId: string
  date: string
  heureDebut: string
  heureFin: string
  salle: string
  enseignantUid: string
  surveillantUid: string
  typeSession: TypeSession
  semestreId: string
  instructions: string
}

function emptyForm(): FormState {
  return {
    filiereId: '',
    niveau: '',
    matiereId: '',
    date: todayISO(),
    heureDebut: '08:00',
    heureFin: '10:00',
    salle: '',
    enseignantUid: '',
    surveillantUid: '',
    typeSession: 'normale',
    semestreId: '',
    instructions: '',
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed bottom-6 right-6 z-[100] bg-orange-500 text-black text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2">
      {message}
      <button onClick={onClose}><X size={14} /></button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExamensAdminPage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId

  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [teachers, setTeachers] = useState<UniversityMember[]>([])
  const [examens, setExamens] = useState<Examen[]>([])
  const [loading, setLoading] = useState(true)

  // Filtres du haut (filtrent la liste affichée uniquement)
  const [fFiliereId, setFFiliereId] = useState('')
  const [fNiveau, setFNiveau] = useState('')
  const [fSemestreId, setFSemestreId] = useState('')
  const [fTypeSession, setFTypeSession] = useState<TypeSession | ''>('')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [formMatieres, setFormMatieres] = useState<Matiere[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [conflits, setConflits] = useState<ConflitExamenInfo[]>([])

  const [cancelTarget, setCancelTarget] = useState<Examen | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Examen | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    if (!universityId) return
    const [fil, sem, prof, exa] = await Promise.all([
      getFilieres(universityId),
      getSemestres(universityId),
      getUniversityMembers(universityId, 'teacher'),
      getExamens(universityId),
    ])
    setFilieres(fil)
    setSemestres(sem)
    setTeachers(prof)
    setExamens(exa)
  }, [universityId])

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        await loadAll()
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId, loadAll])

  const refreshExamens = useCallback(async () => {
    if (!universityId) return
    setExamens(await getExamens(universityId))
  }, [universityId])

  // Matières de la filière choisie DANS LE FORMULAIRE (indépendante des filtres).
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!universityId || !form.filiereId) {
        if (active) setFormMatieres([])
        return
      }
      const list = await getMatieres(universityId, form.filiereId)
      if (active) setFormMatieres(list)
    })()
    return () => { active = false }
  }, [universityId, form.filiereId])

  const teacherName = useCallback(
    (uid: string) => teachers.find((t) => t.uid === uid)?.displayName ?? '',
    [teachers]
  )

  // Liste filtrée + groupée par date (ordre chronologique croissant).
  const groupes = useMemo(() => {
    const filtered = examens.filter(
      (e) =>
        (!fFiliereId || e.filiereId === fFiliereId) &&
        (!fNiveau || e.niveau === fNiveau) &&
        (!fSemestreId || e.semestreId === fSemestreId) &&
        (!fTypeSession || e.typeSession === fTypeSession)
    )
    const map = new Map<string, Examen[]>()
    for (const e of [...filtered].sort(compareExamens)) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return [...map.entries()]
  }, [examens, fFiliereId, fNiveau, fSemestreId, fTypeSession])

  const filterFiliere = filieres.find((f) => f.id === fFiliereId)
  const filterNiveaux = filterFiliere?.niveaux ?? []

  const formFiliere = filieres.find((f) => f.id === form.filiereId)
  const formNiveaux = formFiliere?.niveaux ?? []

  const totalFiltres = groupes.reduce((n, [, items]) => n + items.length, 0)

  function handleFilterFiliere(id: string) {
    setFFiliereId(id)
    const f = filieres.find((x) => x.id === id)
    if (!f?.niveaux?.includes(fNiveau)) setFNiveau('')
  }

  function setFormFiliere(id: string) {
    setForm((f) => ({ ...f, filiereId: id, niveau: '', matiereId: '' }))
  }

  function openAdd() {
    setEditId(null)
    // Pré-remplit avec les filtres courants pour aller plus vite.
    setForm({
      ...emptyForm(),
      filiereId: fFiliereId,
      niveau: fNiveau,
      semestreId: fSemestreId,
    })
    setFormError(null)
    setConflits([])
    setModalOpen(true)
  }

  function openEdit(e: Examen) {
    setEditId(e.id)
    setForm({
      filiereId: e.filiereId,
      niveau: e.niveau,
      matiereId: e.matiereId,
      date: e.date,
      heureDebut: e.heureDebut,
      heureFin: e.heureFin,
      salle: e.salle,
      enseignantUid: e.enseignantUid ?? '',
      surveillantUid: e.surveillantUid ?? '',
      typeSession: e.typeSession,
      semestreId: e.semestreId,
      instructions: e.instructions ?? '',
    })
    setFormError(null)
    setConflits([])
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditId(null)
    setForm(emptyForm())
    setFormError(null)
    setConflits([])
  }

  async function handleSave() {
    if (!universityId) return
    if (!form.filiereId || !form.niveau || !form.semestreId) {
      setFormError('Filière, niveau et semestre sont obligatoires.')
      return
    }
    if (!form.matiereId) { setFormError('Choisissez une matière.'); return }
    if (!form.date) { setFormError('Choisissez une date.'); return }
    if (form.heureFin <= form.heureDebut) { setFormError('L’heure de fin doit être après l’heure de début.'); return }
    if (form.surveillantUid && form.surveillantUid === form.enseignantUid) {
      setFormError('Le surveillant doit être différent de l’enseignant responsable.')
      return
    }

    // Détection de conflit instantanée sur les examens déjà chargés.
    const candidat: ExamenCandidat = {
      date: form.date,
      heureDebut: form.heureDebut,
      heureFin: form.heureFin,
      salle: form.salle,
      enseignantUid: form.enseignantUid || undefined,
      surveillantUid: form.surveillantUid || undefined,
      enseignantNom: form.enseignantUid ? teacherName(form.enseignantUid) : undefined,
      surveillantNom: form.surveillantUid ? teacherName(form.surveillantUid) : undefined,
    }
    const found = findConflitsExamen(examens, candidat, editId ?? undefined)
    if (found.length > 0) {
      setConflits(found)
      setFormError(null)
      return
    }

    setSaving(true)
    setFormError(null)
    setConflits([])
    try {
      const base = {
        filiereId: form.filiereId,
        niveau: form.niveau,
        matiereId: form.matiereId,
        date: form.date,
        heureDebut: form.heureDebut,
        heureFin: form.heureFin,
        salle: form.salle.trim(),
        enseignantUid: form.enseignantUid || undefined,
        surveillantUid: form.surveillantUid || undefined,
        typeSession: form.typeSession,
        semestreId: form.semestreId,
        instructions: form.instructions.trim() || undefined,
      }
      if (editId) {
        await updateExamen(universityId, editId, base)
        setToast('Examen mis à jour')
      } else {
        const data: ExamenFormData = { ...base, statut: 'planifie' }
        await createExamen(universityId, data)
        setToast('Examen planifié')
      }
      await refreshExamens()
      closeModal()
    } catch (err) {
      // Garde autoritaire de db.ts (ex : examen ajouté par un autre admin depuis
      // le dernier chargement) — jamais de faux succès.
      if (err instanceof ConflitExamenError) {
        setConflits(err.conflits)
      } else {
        // Jamais de faux succès : on remonte la vraie cause (souvent un refus de
        // règle Firebase tant que le nœud « examens » n'est pas déployé).
        const msg = err instanceof Error ? err.message : String(err)
        setFormError(
          /permission_denied/i.test(msg)
            ? 'Écriture refusée par Firebase (PERMISSION_DENIED). La règle « examens » n’est pas encore déployée — lancez « firebase deploy --only database », puis réessayez.'
            : `Échec de l’enregistrement : ${msg}`
        )
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    if (!universityId || !cancelTarget) return
    setActionError(null)
    try {
      await updateExamen(universityId, cancelTarget.id, { statut: 'annule' })
      await refreshExamens()
      setCancelTarget(null)
      setToast('Examen annulé')
    } catch {
      setActionError('Échec de l’annulation. Réessayez.')
    }
  }

  async function handleDelete() {
    if (!universityId || !deleteTarget) return
    setActionError(null)
    try {
      await deleteExamen(universityId, deleteTarget.id)
      await refreshExamens()
      setDeleteTarget(null)
      setToast('Examen supprimé définitivement')
    } catch {
      setActionError('Échec de la suppression. Réessayez.')
    }
  }

  // Garde d'accès
  if (profile && profile.role !== 'admin_universite' && profile.role !== 'super_admin_plateforme') {
    return (
      <div className="flex items-center justify-center h-64 text-orange-300/60 text-sm">
        Accès réservé aux administrateurs.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList size={22} className="text-orange-400" />
            Examens
          </h1>
          <p className="text-orange-200/40 text-sm mt-1">
            Planifiez les épreuves : date, salle, surveillance, session normale ou rattrapage.
          </p>
        </div>
        {filieres.length > 0 && semestres.length > 0 && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-black rounded-xl px-4 py-2.5 font-semibold text-sm transition-colors shrink-0"
          >
            <Plus size={16} /> Planifier un examen
          </button>
        )}
      </div>

      {filieres.length === 0 || semestres.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20 px-4 py-3">
          <AlertTriangle size={15} className="text-orange-400 shrink-0 mt-0.5" />
          <p className="text-xs text-orange-200/70 leading-relaxed">
            Vous devez d’abord créer au moins une{' '}
            <Link href="/dashboard/admin/filieres" className="text-orange-400 underline hover:text-orange-300">filière</Link>{' '}
            (avec ses niveaux) et un{' '}
            <Link href="/dashboard/admin/semestres" className="text-orange-400 underline hover:text-orange-300">semestre</Link>{' '}
            avant de planifier des examens.
          </p>
        </div>
      ) : (
        <>
          {/* Filtres */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-zinc-950 border border-orange-500/10 rounded-xl p-4">
            <div>
              <label className={labelCls}>Filière</label>
              <select value={fFiliereId} onChange={(e) => handleFilterFiliere(e.target.value)} className={selectCls}>
                <option value="">Toutes</option>
                {filieres.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Niveau</label>
              <select value={fNiveau} onChange={(e) => setFNiveau(e.target.value)} disabled={!fFiliereId} className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}>
                <option value="">{fFiliereId ? 'Tous' : 'Choisir une filière'}</option>
                {filterNiveaux.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Semestre</label>
              <select value={fSemestreId} onChange={(e) => setFSemestreId(e.target.value)} className={selectCls}>
                <option value="">Tous</option>
                {semestres.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Session</label>
              <select value={fTypeSession} onChange={(e) => setFTypeSession(e.target.value as TypeSession | '')} className={selectCls}>
                <option value="">Toutes</option>
                {TYPE_SESSION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <p className="text-xs text-zinc-500">{totalFiltres} examen{totalFiltres !== 1 ? 's' : ''}</p>

          {/* Liste chronologique groupée par date */}
          {totalFiltres === 0 ? (
            <div className="text-center py-16 text-orange-200/30 text-sm">
              Aucun examen ne correspond à ces filtres. Cliquez sur « Planifier un examen » pour en créer un.
            </div>
          ) : (
            <div className="space-y-8">
              {groupes.map(([date, items]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarCheck size={15} className="text-orange-400 shrink-0" />
                    <h3 className="text-sm font-semibold text-orange-200/80">{capitalize(formatDateLong(date))}</h3>
                  </div>
                  <div className="space-y-2.5">
                    {items.map((e) => {
                      const annule = e.statut === 'annule'
                      const filiereNom = filieres.find((f) => f.id === e.filiereId)?.nom ?? ''
                      return (
                        <div
                          key={e.id}
                          className={`group rounded-xl border p-4 ${
                            annule ? 'border-white/10 bg-white/[0.02] opacity-60' : 'border-orange-500/15 bg-zinc-950'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-orange-400">
                                <Clock size={12} /> {e.heureDebut} – {e.heureFin}
                              </span>
                              <p className={`text-base font-semibold mt-1 leading-snug ${annule ? 'text-zinc-500 line-through' : 'text-white'}`}>
                                {e.matiereNom || 'Matière'}
                              </p>
                              <p className="text-[11px] text-zinc-500 mt-0.5">
                                {filiereNom}{filiereNom && e.niveau ? ' · ' : ''}{e.niveau}
                              </p>
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button onClick={() => openEdit(e)} className="p-1.5 rounded text-zinc-400 hover:text-orange-400" title="Modifier"><Pencil size={14} /></button>
                              {!annule && (
                                <button onClick={() => setCancelTarget(e)} className="p-1.5 rounded text-zinc-400 hover:text-amber-400" title="Annuler l’examen"><Ban size={14} /></button>
                              )}
                              <button onClick={() => setDeleteTarget(e)} className="p-1.5 rounded text-zinc-400 hover:text-red-400" title="Supprimer définitivement"><Trash2 size={14} /></button>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-zinc-400">
                            {e.salle && <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-zinc-500" /> {e.salle}</span>}
                            {e.enseignantNom ? (
                              <span className="inline-flex items-center gap-1.5"><User size={13} className="text-zinc-500" /> {e.enseignantNom}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-zinc-600 italic"><User size={13} className="text-zinc-600" /> Aucun enseignant assigné</span>
                            )}
                            {e.surveillantNom && <span className="inline-flex items-center gap-1.5"><UserCheck size={13} className="text-zinc-500" /> Surveillant : {e.surveillantNom}</span>}
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${TYPE_SESSION_STYLES[e.typeSession]}`}>
                              {TYPE_SESSION_LABELS[e.typeSession]}
                            </span>
                            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${STATUT_EXAMEN_STYLES[e.statut]}`}>
                              {STATUT_EXAMEN_LABELS[e.statut]}
                            </span>
                          </div>

                          {e.instructions && (
                            <p className="mt-2.5 flex items-start gap-1.5 text-[13px] text-orange-100/60 leading-relaxed">
                              <Info size={13} className="text-orange-400/70 shrink-0 mt-0.5" />
                              {e.instructions}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal ajout / édition */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editId ? 'Modifier l’examen' : 'Planifier un examen'}</h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Filière</label>
                  <select value={form.filiereId} onChange={(e) => setFormFiliere(e.target.value)} className={selectCls}>
                    <option value="">Choisir…</option>
                    {filieres.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Niveau</label>
                  <select value={form.niveau} onChange={(e) => setForm((f) => ({ ...f, niveau: e.target.value }))} disabled={!form.filiereId} className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}>
                    <option value="">{form.filiereId ? 'Choisir…' : 'Choisir une filière d’abord'}</option>
                    {formNiveaux.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Matière</label>
                <select value={form.matiereId} onChange={(e) => setForm((f) => ({ ...f, matiereId: e.target.value }))} disabled={!form.filiereId} className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}>
                  <option value="">{!form.filiereId ? 'Choisir une filière d’abord' : formMatieres.length ? 'Choisir une matière…' : 'Aucune matière dans cette filière'}</option>
                  {formMatieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
                {form.filiereId && formMatieres.length === 0 && (
                  <p className="text-[11px] text-orange-200/40 mt-1.5">
                    Ajoutez des matières dans{' '}
                    <Link href={`/dashboard/admin/filieres/${form.filiereId}`} className="text-orange-400 underline hover:text-orange-300">cette filière</Link>.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={`${inputCls} scheme-dark`} />
                </div>
                <div>
                  <label className={labelCls}>Début</label>
                  <input type="time" value={form.heureDebut} onChange={(e) => setForm((f) => ({ ...f, heureDebut: e.target.value }))} className={`${inputCls} scheme-dark`} />
                </div>
                <div>
                  <label className={labelCls}>Fin</label>
                  <input type="time" value={form.heureFin} onChange={(e) => setForm((f) => ({ ...f, heureFin: e.target.value }))} className={`${inputCls} scheme-dark`} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Salle</label>
                  <input value={form.salle} onChange={(e) => setForm((f) => ({ ...f, salle: e.target.value }))} placeholder="Ex: Amphi A" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Session</label>
                  <select value={form.typeSession} onChange={(e) => setForm((f) => ({ ...f, typeSession: e.target.value as TypeSession }))} className={selectCls}>
                    {TYPE_SESSION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Enseignant responsable</label>
                  <select value={form.enseignantUid} onChange={(e) => setForm((f) => ({ ...f, enseignantUid: e.target.value }))} className={selectCls}>
                    <option value="">{teachers.length ? 'Optionnel…' : 'Aucun enseignant'}</option>
                    {teachers.map((t) => <option key={t.uid} value={t.uid}>{t.displayName}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Surveillant</label>
                  <select value={form.surveillantUid} onChange={(e) => setForm((f) => ({ ...f, surveillantUid: e.target.value }))} className={selectCls}>
                    <option value="">{teachers.length ? 'Optionnel…' : 'Aucun enseignant'}</option>
                    {teachers.map((t) => <option key={t.uid} value={t.uid}>{t.displayName}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Semestre</label>
                <select value={form.semestreId} onChange={(e) => setForm((f) => ({ ...f, semestreId: e.target.value }))} className={selectCls}>
                  <option value="">Choisir…</option>
                  {semestres.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Instructions particulières (optionnel)</label>
                <textarea
                  value={form.instructions}
                  onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                  placeholder="Ex: Calculatrice autorisée, documents interdits…"
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {conflits.length > 0 && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-red-300">
                    <AlertTriangle size={15} className="shrink-0" />
                    Conflit{conflits.length > 1 ? 's' : ''} détecté{conflits.length > 1 ? 's' : ''}
                  </p>
                  <ul className="mt-2 space-y-1 list-disc pl-5">
                    {conflits.map((c, i) => (
                      <li key={i} className="text-xs text-red-200/80 leading-relaxed">{c.message}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-red-200/50 mt-2">
                    Modifiez la date, l’horaire, la salle ou la surveillance pour continuer.
                  </p>
                </div>
              )}

              {formError && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={closeModal} disabled={saving} className="flex-1 border border-orange-500/20 text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-white transition-colors disabled:opacity-50">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-black font-semibold rounded-xl py-2.5 text-sm transition-colors">
                  {saving && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  {editId ? 'Enregistrer' : 'Planifier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation ANNULATION (garde une trace, statut → annulé) */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-amber-500/20 rounded-2xl p-7 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Ban size={18} className="text-amber-400" />
              </div>
              <h2 className="text-base font-bold text-white">Annuler cet examen ?</h2>
            </div>
            <p className="text-orange-100/55 text-sm mb-2">
              {cancelTarget.matiereNom} — {capitalize(formatDateLong(cancelTarget.date))} {cancelTarget.heureDebut}–{cancelTarget.heureFin}
            </p>
            <p className="text-xs text-zinc-500 mb-6">
              L’examen reste visible (statut « Annulé ») pour informer les étudiants — il n’est pas supprimé.
            </p>
            {actionError && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-3">{actionError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setCancelTarget(null); setActionError(null) }} className="flex-1 border border-orange-500/20 text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-white transition-colors">Retour</button>
              <button onClick={handleCancel} className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl py-2.5 text-sm transition-colors">Annuler l’examen</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation SUPPRESSION définitive */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-red-500/20 rounded-2xl p-7 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <h2 className="text-base font-bold text-white">Supprimer définitivement ?</h2>
            </div>
            <p className="text-orange-100/55 text-sm mb-2">
              {deleteTarget.matiereNom} — {capitalize(formatDateLong(deleteTarget.date))} {deleteTarget.heureDebut}–{deleteTarget.heureFin}
            </p>
            <p className="text-xs text-zinc-500 mb-6">
              Cette action est irréversible. Pour garder une trace, préférez « Annuler l’examen ».
            </p>
            {actionError && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-3">{actionError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setDeleteTarget(null); setActionError(null) }} className="flex-1 border border-orange-500/20 text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-white transition-colors">Retour</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
