'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, X, Pencil, Trash2, CalendarDays, PlayCircle, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getSemestres, createSemestre, updateSemestre, deleteSemestre,
  setStatutSemestre, getFilieres,
} from '@/lib/db'
import type { Semestre, SemestreFormData } from '@/types/semestre'
import { STATUT_LABELS, STATUT_STYLES } from '@/types/semestre'
import type { Filiere } from '@/types/filiere'

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-zinc-500 dark:placeholder:text-orange-200/25'
const selectCls = 'w-full bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60'
const labelCls = 'text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultAnnee(): string {
  const y = new Date().getFullYear()
  // Avant septembre : année académique précédente.
  const start = new Date().getMonth() >= 8 ? y : y - 1
  return `${start}/${start + 1}`
}

function emptyForm(): SemestreFormData {
  const now = Date.now()
  return {
    nom: '',
    anneeAcademique: defaultAnnee(),
    numero: 1,
    dateDebut: now,
    dateFin: now + 1000 * 60 * 60 * 24 * 120, // ~4 mois
    statut: 'a_venir',
    filiereIds: [],
  }
}

function toDateInput(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

function fromDateInput(value: string): number {
  return new Date(value + 'T00:00:00').getTime()
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed bottom-6 right-6 z-[100] bg-orange-500 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2">
      {message}
      <button onClick={onClose}><X size={14} /></button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SemestresPage() {
  const { profile } = useAuth()

  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Modal état
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<SemestreFormData>(emptyForm())
  const [saving, setSaving] = useState(false)

  // Suppression
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Activation
  const [activatingId, setActivatingId] = useState<string | null>(null)

  const uid = profile?.universityId

  const load = useCallback(async () => {
    if (!uid) return
    try {
      setLoading(true)
      const [sems, fils] = await Promise.all([
        getSemestres(uid),
        getFilieres(uid),
      ])
      sems.sort((a, b) => a.dateDebut - b.dateDebut)
      setSemestres(sems)
      setFilieres(fils)
    } catch {
      setError('Impossible de charger les semestres.')
    } finally {
      setLoading(false)
    }
  }, [uid])

  // `load` est la source unique de chargement, réutilisée pour rafraîchir après
  // chaque mutation ; son appel au montage est intentionnel.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  // Auth guard
  if (profile && profile.role !== 'admin_universite' && profile.role !== 'super_admin_plateforme') {
    return (
      <div className="flex items-center justify-center h-64 text-blue-700 dark:text-orange-300/60 text-sm">
        Accès réservé aux administrateurs.
      </div>
    )
  }

  const filiereName = (id: string) => filieres.find(f => f.id === id)?.code ?? id
  const hasEnCours = semestres.some(s => s.statut === 'en_cours')

  // ─── Modal helpers ──────────────────────────────────────────────────────────

  function openAdd() {
    setForm(emptyForm())
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(s: Semestre) {
    const { id, universityId, createdAt, updatedAt, ...rest } = s
    setForm({ ...rest, filiereIds: rest.filiereIds ?? [] })
    setEditId(id)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditId(null)
    setForm(emptyForm())
  }

  function toggleFiliere(id: string) {
    setForm(prev => ({
      ...prev,
      filiereIds: prev.filiereIds.includes(id)
        ? prev.filiereIds.filter(x => x !== id)
        : [...prev.filiereIds, id],
    }))
  }

  async function handleSave() {
    if (!uid || !form.nom.trim() || form.dateFin <= form.dateDebut) return
    setSaving(true)
    try {
      if (editId) {
        await updateSemestre(uid, editId, form)
        setToast('Semestre modifié avec succès')
      } else {
        await createSemestre(uid, form)
        setToast('Semestre créé avec succès')
      }
      // Si le statut a été mis à "en_cours", garantir l'unicité côté DB.
      if (form.statut === 'en_cours') {
        const fresh = await getSemestres(uid)
        const target = editId ?? fresh.find(s =>
          s.nom === form.nom && s.statut === 'en_cours'
        )?.id
        if (target) await setStatutSemestre(uid, target, 'en_cours')
      }
      closeModal()
      await load()
    } catch {
      setToast('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate(s: Semestre) {
    if (!uid || s.statut === 'en_cours') return
    setActivatingId(s.id)
    try {
      await setStatutSemestre(uid, s.id, 'en_cours')
      setToast(`« ${s.nom} » est maintenant le semestre en cours`)
      await load()
    } catch {
      setToast('Erreur lors de l\'activation')
    } finally {
      setActivatingId(null)
    }
  }

  async function handleDelete() {
    if (!uid || !deleteId) return
    setDeleting(true)
    try {
      await deleteSemestre(uid, deleteId)
      setSemestres(prev => prev.filter(s => s.id !== deleteId))
      setToast('Semestre supprimé')
    } catch {
      setToast('Erreur lors de la suppression')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Semestres</h1>
          <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
            {semestres.length} semestre{semestres.length !== 1 ? 's' : ''} enregistré{semestres.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors"
        >
          <Plus size={16} /> Nouveau semestre
        </button>
      </div>

      {/* Avertissement : aucun semestre en cours */}
      {!loading && semestres.length > 0 && !hasEnCours && (
        <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-blue-600 dark:text-orange-400" />
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-orange-300">Aucun semestre en cours</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Activez un semestre pour qu&apos;il apparaisse dans les tableaux de bord.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : semestres.length === 0 ? (
        /* Empty state */
        <div className="text-center py-20 text-zinc-500 dark:text-orange-200/30">
          <CalendarDays size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium mb-3">Aucun semestre enregistré</p>
          <button
            onClick={openAdd}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
          >
            Créer le premier semestre
          </button>
        </div>
      ) : (
        /* List */
        <div className="space-y-3">
          {semestres.map(s => {
            const isEnCours = s.statut === 'en_cours'
            return (
              <div
                key={s.id}
                className="group bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 hover:border-orange-500/25 rounded-xl px-5 py-4 flex items-center gap-4 transition-colors"
              >
                {/* Numéro badge */}
                <span className="shrink-0 font-mono text-xs font-bold bg-orange-500/15 border border-orange-500/25 text-blue-600 dark:text-orange-400 rounded-lg px-2.5 py-1">
                  S{s.numero}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-900 dark:text-white font-medium text-sm truncate">{s.nom}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-xs text-zinc-500 dark:text-orange-200/40">{s.anneeAcademique}</span>
                    <span className="text-zinc-500 dark:text-orange-200/20 text-xs">·</span>
                    <span className="text-xs text-zinc-500 dark:text-orange-200/40">
                      {formatDate(s.dateDebut)} → {formatDate(s.dateFin)}
                    </span>
                    {(s.filiereIds ?? []).map(id => (
                      <span key={id} className="text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 rounded-full px-2 py-0.5">
                        {filiereName(id)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Statut */}
                <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${STATUT_STYLES[s.statut]}`}>
                  {STATUT_LABELS[s.statut]}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleActivate(s)}
                    disabled={isEnCours || activatingId === s.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500/10 text-blue-600 dark:text-orange-400 hover:bg-orange-500/25 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium transition-colors"
                    title={isEnCours ? 'Déjà en cours' : 'Passer ce semestre en cours'}
                  >
                    <PlayCircle size={13} />
                    {activatingId === s.id ? '…' : isEnCours ? 'En cours' : 'Activer'}
                  </button>
                  <button
                    onClick={() => openEdit(s)}
                    className="p-1.5 rounded-lg bg-orange-500/10 text-blue-600 dark:text-orange-400 hover:bg-orange-500/25 transition-colors opacity-0 group-hover:opacity-100"
                    title="Modifier"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteId(s.id)}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/25 transition-colors opacity-0 group-hover:opacity-100"
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal création / modification ─────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editId ? 'Modifier le semestre' : 'Nouveau semestre'}
              </h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nom */}
              <div>
                <label className={labelCls}>Nom du semestre *</label>
                <input
                  value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex: Semestre 1 — 2025/2026"
                  className={inputCls}
                />
              </div>

              {/* Année + Numéro */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Année académique *</label>
                  <input
                    value={form.anneeAcademique}
                    onChange={e => setForm(f => ({ ...f, anneeAcademique: e.target.value }))}
                    placeholder="Ex: 2025/2026"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Numéro</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.numero}
                    onChange={e => setForm(f => ({ ...f, numero: Number(e.target.value) }))}
                    placeholder="Ex: 1"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Date de début</label>
                  <input
                    type="date"
                    value={toDateInput(form.dateDebut)}
                    onChange={e => setForm(f => ({ ...f, dateDebut: fromDateInput(e.target.value) }))}
                    className={selectCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Date de fin</label>
                  <input
                    type="date"
                    value={toDateInput(form.dateFin)}
                    onChange={e => setForm(f => ({ ...f, dateFin: fromDateInput(e.target.value) }))}
                    className={selectCls}
                  />
                </div>
              </div>
              {form.dateFin <= form.dateDebut && (
                <p className="text-xs text-red-400">La date de fin doit être postérieure à la date de début.</p>
              )}

              {/* Statut */}
              <div>
                <label className={labelCls}>Statut</label>
                <select
                  value={form.statut}
                  onChange={e => setForm(f => ({ ...f, statut: e.target.value as SemestreFormData['statut'] }))}
                  className={selectCls}
                >
                  <option value="a_venir">À venir</option>
                  <option value="en_cours">En cours</option>
                  <option value="termine">Terminé</option>
                </select>
                {form.statut === 'en_cours' && (
                  <p className="text-xs text-blue-700 dark:text-orange-300/60 mt-1.5">
                    Les autres semestres seront automatiquement basculés selon leurs dates.
                  </p>
                )}
              </div>

              {/* Filières concernées */}
              <div>
                <label className={labelCls}>Filières concernées</label>
                {filieres.length === 0 ? (
                  <p className="text-xs text-zinc-500 dark:text-orange-200/30">Aucune filière disponible. Créez-en d&apos;abord.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {filieres.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFiliere(f.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          form.filiereIds.includes(f.id)
                            ? 'bg-orange-500/20 border-orange-500/40 text-blue-700 dark:text-orange-300'
                            : 'bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-white/20'
                        }`}
                      >
                        {f.code} — {f.nom}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeModal}
                  className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.nom.trim() || form.dateFin <= form.dateDebut}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
                >
                  {saving ? 'Enregistrement…' : editId ? 'Modifier' : 'Créer le semestre'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog suppression ────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-red-500/20 rounded-2xl p-7 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Supprimer ce semestre&nbsp;?</h2>
            </div>
            <p className="text-zinc-800 dark:text-orange-100/55 text-sm mb-6">
              Cette action est irréversible. Le semestre sera définitivement supprimé.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
