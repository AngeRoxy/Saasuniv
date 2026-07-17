'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Plus, X, Pencil, Trash2, Clock, MapPin, User, CalendarClock, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getFilieres,
  getSemestres,
  getMatieres,
  getUniversityMembers,
  getCreneaux,
  createCreneau,
  updateCreneau,
  deleteCreneau,
} from '@/lib/db'
import type { Filiere, Matiere, Semestre } from '@/lib/db'
import {
  JOURS,
  JOUR_LABEL,
  findConflits,
  ConflitError,
  type Creneau,
  type CreneauFormData,
  type ConflitInfo,
  type JourSemaine,
} from '@/types/emploi-du-temps'

const inputCls = 'w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-zinc-500 dark:placeholder:text-orange-200/25'
const selectCls = 'w-full bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60'
const labelCls = 'text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5'

function emptyForm(): { jour: JourSemaine; heureDebut: string; heureFin: string; matiere: string; salle: string; enseignant: string } {
  return { jour: 'lundi', heureDebut: '08:00', heureFin: '10:00', matiere: '', salle: '', enseignant: '' }
}

type FormState = ReturnType<typeof emptyForm>

export default function SchedulePage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId

  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [teachers, setTeachers] = useState<string[]>([])
  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [loading, setLoading] = useState(true)

  // Sélection courante
  const [filiereId, setFiliereId] = useState('')
  const [niveau, setNiveau] = useState('')
  const [semestreId, setSemestreId] = useState('')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [conflits, setConflits] = useState<ConflitInfo[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Creneau | null>(null)

  // Chargement initial
  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [fil, sem, prof, cre] = await Promise.all([
          getFilieres(universityId),
          getSemestres(universityId),
          getUniversityMembers(universityId, 'teacher'),
          getCreneaux(universityId),
        ])
        if (!active) return
        setFilieres(fil)
        setSemestres(sem)
        setTeachers(prof.map((p) => p.displayName))
        setCreneaux(cre)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId])

  // Matières de la filière sélectionnée
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!universityId || !filiereId) {
        if (active) setMatieres([])
        return
      }
      const list = await getMatieres(universityId, filiereId)
      if (active) setMatieres(list)
    })()
    return () => { active = false }
  }, [universityId, filiereId])

  const selectedFiliere = filieres.find((f) => f.id === filiereId)
  const niveauxOptions = selectedFiliere?.niveaux ?? []
  const ready = Boolean(filiereId && niveau && semestreId)

  // Réinitialise le niveau si on change de filière et qu'il n'existe plus.
  function handleFiliereChange(id: string) {
    setFiliereId(id)
    const f = filieres.find((x) => x.id === id)
    if (!f?.niveaux?.includes(niveau)) setNiveau('')
  }

  const filtered = useMemo(
    () => creneaux.filter((c) => c.filiereId === filiereId && c.niveau === niveau && c.semestreId === semestreId),
    [creneaux, filiereId, niveau, semestreId]
  )

  const byDay = useMemo(
    () =>
      JOURS.map((jour) => ({
        jour,
        items: filtered
          .filter((c) => c.jour === jour)
          .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut)),
      })),
    [filtered]
  )

  async function refreshCreneaux() {
    if (!universityId) return
    setCreneaux(await getCreneaux(universityId))
  }

  function openAdd() {
    setEditId(null)
    setForm(emptyForm())
    setFormError(null)
    setConflits([])
    setModalOpen(true)
  }

  function openEdit(c: Creneau) {
    setEditId(c.id)
    setForm({ jour: c.jour, heureDebut: c.heureDebut, heureFin: c.heureFin, matiere: c.matiere, salle: c.salle, enseignant: c.enseignant })
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
    if (!universityId || !ready) return
    if (!form.matiere) { setFormError('Choisissez une matière.'); return }
    if (form.heureFin <= form.heureDebut) { setFormError('L’heure de fin doit être après l’heure de début.'); return }

    // RÈGLE 3 — détection de conflit instantanée sur les créneaux déjà chargés :
    // salle, enseignant ou groupe (filière + niveau) qui se chevauchent.
    const candidat = { filiereId, niveau, semestreId, ...form }
    const found = findConflits(creneaux, candidat, editId ?? undefined)
    if (found.length > 0) {
      setConflits(found)
      setFormError(null)
      return
    }

    setSaving(true)
    setFormError(null)
    setConflits([])
    try {
      if (editId) {
        await updateCreneau(universityId, editId, { ...form })
      } else {
        const data: CreneauFormData = { filiereId, niveau, semestreId, ...form }
        await createCreneau(universityId, data)
      }
      await refreshCreneaux()
      closeModal()
    } catch (err) {
      // Garde autoritaire de db.ts (ex : créneau ajouté par un autre admin
      // depuis le dernier chargement).
      if (err instanceof ConflitError) {
        setConflits(err.conflits)
      } else {
        setFormError('Échec de l’enregistrement. Réessayez.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!universityId || !deleteTarget) return
    try {
      await deleteCreneau(universityId, deleteTarget.id)
      await refreshCreneaux()
    } catch { /* silencieux */ }
    setDeleteTarget(null)
  }

  // Garde d'accès
  if (profile && profile.role !== 'admin_universite' && profile.role !== 'super_admin_plateforme') {
    return (
      <div className="flex items-center justify-center h-64 text-blue-700 dark:text-orange-300/60 text-sm">
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
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <CalendarClock size={22} className="text-blue-600 dark:text-orange-400" />
          Emploi du temps
        </h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
          Construisez la grille hebdomadaire par filière, niveau et semestre.
        </p>
      </div>

      {filieres.length === 0 || semestres.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20 px-4 py-3">
          <AlertTriangle size={15} className="text-blue-600 dark:text-orange-400 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-600 dark:text-orange-200/70 leading-relaxed">
            Vous devez d’abord créer au moins une{' '}
            <Link href="/dashboard/admin/filieres" className="text-blue-600 dark:text-orange-400 underline hover:text-blue-900 dark:hover:text-orange-300">filière</Link>{' '}
            (avec ses niveaux) et un{' '}
            <Link href="/dashboard/admin/semestres" className="text-blue-600 dark:text-orange-400 underline hover:text-blue-900 dark:hover:text-orange-300">semestre</Link>{' '}
            avant de construire un emploi du temps.
          </p>
        </div>
      ) : (
        <>
          {/* Sélecteurs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-4">
            <div>
              <label className={labelCls}>Filière</label>
              <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={selectCls}>
                <option value="">Choisir…</option>
                {filieres.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Niveau</label>
              <select value={niveau} onChange={(e) => setNiveau(e.target.value)} disabled={!filiereId} className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}>
                <option value="">{filiereId ? 'Choisir…' : 'Choisir une filière d’abord'}</option>
                {niveauxOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Semestre</label>
              <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)} className={selectCls}>
                <option value="">Choisir…</option>
                {semestres.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </div>
          </div>

          {!ready ? (
            <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
              Sélectionnez une filière, un niveau et un semestre pour afficher la grille.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">{filtered.length} créneau{filtered.length !== 1 ? 'x' : ''}</p>
                <button
                  onClick={openAdd}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors"
                >
                  <Plus size={16} /> Ajouter un créneau
                </button>
              </div>

              {/* Grille hebdomadaire */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {byDay.map(({ jour, items }) => (
                  <div key={jour} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-orange-500/10 bg-zinc-50 dark:bg-black/30">
                      <p className="text-xs font-semibold text-blue-700 dark:text-orange-300/80 uppercase tracking-wider">{JOUR_LABEL[jour]}</p>
                    </div>
                    <div className="p-2 space-y-2 min-h-16">
                      {items.length === 0 ? (
                        <p className="text-center text-zinc-500 dark:text-orange-200/20 text-xs py-4">—</p>
                      ) : (
                        items.map((c) => (
                          <div key={c.id} className="group rounded-lg bg-orange-500/5 border border-orange-500/15 p-2.5">
                            <div className="flex items-start justify-between gap-1">
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-600 dark:text-orange-400">
                                <Clock size={10} /> {c.heureDebut}–{c.heureFin}
                              </span>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(c)} className="p-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-blue-800 dark:hover:text-orange-400" title="Modifier"><Pencil size={11} /></button>
                                <button onClick={() => setDeleteTarget(c)} className="p-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-red-400" title="Supprimer"><Trash2 size={11} /></button>
                              </div>
                            </div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-white mt-1 leading-snug">{c.matiere}</p>
                            {c.salle && <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 flex items-center gap-1"><MapPin size={9} /> {c.salle}</p>}
                            {c.enseignant ? (
                              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1"><User size={9} /> {c.enseignant}</p>
                            ) : (
                              <p className="text-[11px] text-zinc-600 italic flex items-center gap-1"><User size={9} /> Aucun enseignant assigné</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Modal ajout / édition */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{editId ? 'Modifier le créneau' : 'Ajouter un créneau'}</h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"><X size={20} /></button>
            </div>

            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Jour</label>
                  <select value={form.jour} onChange={(e) => setForm((f) => ({ ...f, jour: e.target.value as JourSemaine }))} className={selectCls}>
                    {JOURS.map((j) => <option key={j} value={j}>{JOUR_LABEL[j]}</option>)}
                  </select>
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

              <div>
                <label className={labelCls}>Matière</label>
                <select value={form.matiere} onChange={(e) => setForm((f) => ({ ...f, matiere: e.target.value }))} className={selectCls}>
                  <option value="">{matieres.length ? 'Choisir une matière…' : 'Aucune matière dans cette filière'}</option>
                  {matieres.map((m) => <option key={m.id} value={m.nom}>{m.nom}</option>)}
                </select>
                {matieres.length === 0 && (
                  <p className="text-[11px] text-zinc-500 dark:text-orange-200/40 mt-1.5">
                    Ajoutez des matières dans{' '}
                    <Link href={`/dashboard/admin/filieres/${filiereId}`} className="text-blue-600 dark:text-orange-400 underline hover:text-blue-900 dark:hover:text-orange-300">cette filière</Link>.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Salle</label>
                  <input value={form.salle} onChange={(e) => setForm((f) => ({ ...f, salle: e.target.value }))} placeholder="Ex: Amphi A" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Enseignant</label>
                  <select value={form.enseignant} onChange={(e) => setForm((f) => ({ ...f, enseignant: e.target.value }))} className={selectCls}>
                    <option value="">{teachers.length ? 'Optionnel…' : 'Aucun enseignant'}</option>
                    {teachers.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
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
                    Modifiez l’horaire, la salle, l’enseignant ou le groupe pour continuer.
                  </p>
                </div>
              )}

              {formError && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{formError}</p>
              )}

              </div>

              <div className="flex gap-3 pt-6 shrink-0">
                <button onClick={closeModal} disabled={saving} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                  {saving && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  {editId ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-red-500/20 rounded-2xl p-7 w-full max-w-sm flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Supprimer ce créneau ?</h2>
            </div>
            <p className="text-zinc-800 dark:text-orange-100/55 text-sm mb-6 flex-1 min-h-0 overflow-y-auto">
              {deleteTarget.matiere} — {JOUR_LABEL[deleteTarget.jour]} {deleteTarget.heureDebut}–{deleteTarget.heureFin}
            </p>
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
