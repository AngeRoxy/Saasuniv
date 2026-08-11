'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Pencil, Trash2, Building2, GraduationCap, Users, BookOpen, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { PlanGate } from '@/components/ui/plan-gate'
import {
  getCampusList, createCampus, updateCampus, deleteCampus, migrerVersMultiCampus,
  getFilieres, getUniversityMembers,
} from '@/lib/db'
import type { Campus, CampusFormData } from '@/types/campus'
import type { Filiere } from '@/types/filiere'
import type { UniversityMember } from '@/lib/db'

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-zinc-500 dark:placeholder:text-orange-200/25'
const labelCls = 'text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5'
const CONTACT_EMAIL = 'contact@gestuniv.com'

// ─── Upgrade fallback (page réservée au plan Enterprise) ───────────────────────

function MultiCampusUpgradeFallback() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 dark:border-white/20 bg-white/3 px-6 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-white/5 text-zinc-600 dark:text-zinc-400">
        <Building2 className="h-5 w-5" />
      </div>
      <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        Le multi-campus est disponible à partir du plan{' '}
        <span className="font-medium text-zinc-800 dark:text-zinc-200">Enterprise</span>. Contactez-nous
        pour en savoir plus.
      </p>
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="rounded-lg border border-zinc-200 dark:border-white/10 bg-orange-500/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500"
      >
        Nous contacter
      </a>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyForm(): CampusFormData {
  return { nom: '', adresse: '', ville: '' }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed bottom-6 right-6 z-100 bg-orange-500 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2">
      {message}
      <button onClick={onClose}><X size={14} /></button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function CampusPageContent() {
  const { profile } = useAuth()
  const uid = profile?.universityId

  const [campusList, setCampusList] = useState<Campus[]>([])
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [members, setMembers] = useState<UniversityMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Modal état
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<CampusFormData>(emptyForm())
  const [saving, setSaving] = useState(false)

  // Suppression
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return
    let active = true
    ;(async () => {
      try {
        // Garantit qu'au moins le campus principal existe (migration idempotente),
        // même si l'admin n'est jamais passé par la page Filières avant celle-ci.
        await migrerVersMultiCampus(uid)
        const [campus, fils, mems] = await Promise.all([
          getCampusList(uid),
          getFilieres(uid),
          getUniversityMembers(uid),
        ])
        if (!active) return
        setCampusList(campus)
        setFilieres(fils)
        setMembers(mems)
      } catch {
        if (active) setError('Impossible de charger les campus.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [uid])

  // Auth guard
  if (profile && profile.role !== 'admin_universite' && profile.role !== 'super_admin_plateforme') {
    return (
      <div className="flex items-center justify-center h-64 text-blue-700 dark:text-orange-300/60 text-sm">
        Accès réservé aux administrateurs.
      </div>
    )
  }

  function countFilieres(campusId: string): number {
    return filieres.filter((f) => f.campusId === campusId).length
  }
  function countStudents(campusId: string): number {
    return members.filter((m) => m.role === 'student' && m.campusId === campusId).length
  }
  function countTeachers(campusId: string): number {
    return members.filter((m) => m.role === 'teacher' && (m.campusIds ?? []).includes(campusId)).length
  }

  // ─── Modal helpers ──────────────────────────────────────────────────────────

  function openAdd() {
    setForm(emptyForm())
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(c: Campus) {
    setForm({ nom: c.nom, adresse: c.adresse ?? '', ville: c.ville ?? '' })
    setEditId(c.id)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditId(null)
    setForm(emptyForm())
  }

  async function handleSave() {
    if (!uid || !form.nom.trim()) return
    setSaving(true)
    try {
      const data: CampusFormData = {
        nom: form.nom.trim(),
        adresse: form.adresse?.trim() || undefined,
        ville: form.ville?.trim() || undefined,
      }
      if (editId) {
        await updateCampus(uid, editId, data)
        setCampusList((prev) => prev.map((c) => (c.id === editId ? { ...c, ...data } : c)))
        setToast('Campus modifié avec succès')
      } else {
        const id = await createCampus(uid, data)
        setCampusList((prev) => [...prev, { id, universityId: uid, createdAt: Date.now(), ...data }])
        setToast('Campus créé avec succès')
      }
      closeModal()
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!uid || !deleteId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteCampus(uid, deleteId)
      setCampusList((prev) => prev.filter((c) => c.id !== deleteId))
      setToast('Campus supprimé')
      setDeleteId(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    } finally {
      setDeleting(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Campus</h1>
          <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
            {campusList.length} campus enregistré{campusList.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors"
        >
          <Plus size={16} /> Ajouter un campus
        </button>
      </div>

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
      ) : campusList.length === 0 ? (
        <div className="text-center py-20 text-zinc-500 dark:text-orange-200/30">
          <Building2 size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium mb-3">Aucun campus enregistré</p>
          <button
            onClick={openAdd}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
          >
            Créer le premier campus
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campusList.map((c) => (
            <div
              key={c.id}
              className="group bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 hover:border-orange-500/25 rounded-xl px-5 py-4 flex items-center gap-4 transition-colors"
            >
              <span className="shrink-0 w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
                <Building2 size={18} className="text-blue-600 dark:text-orange-400" />
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-zinc-900 dark:text-white font-medium text-sm truncate">{c.nom}</p>
                <div className="flex flex-wrap gap-1.5 mt-1 text-xs text-zinc-500 dark:text-orange-200/40">
                  {c.ville && <span>{c.ville}</span>}
                  {c.ville && c.adresse && <span>·</span>}
                  {c.adresse && <span className="truncate">{c.adresse}</span>}
                  {!c.ville && !c.adresse && <span>Aucune localisation renseignée</span>}
                </div>
              </div>

              {/* Compteurs */}
              <div className="hidden sm:flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400" title="Filières rattachées">
                  <BookOpen size={13} className="text-blue-600 dark:text-orange-400" />
                  {countFilieres(c.id)}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400" title="Étudiants rattachés">
                  <GraduationCap size={13} className="text-blue-600 dark:text-orange-400" />
                  {countStudents(c.id)}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400" title="Enseignants rattachés">
                  <Users size={13} className="text-blue-600 dark:text-orange-400" />
                  {countTeachers(c.id)}
                </div>
              </div>

              {/* Actions (toujours visibles sur mobile/tablette — pas de hover tactile ; hover-to-reveal dès lg) */}
              <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => openEdit(c)}
                  className="p-1.5 rounded-lg bg-orange-500/10 text-blue-600 dark:text-orange-400 hover:bg-orange-500/25 transition-colors"
                  title="Modifier"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => { setDeleteId(c.id); setDeleteError(null) }}
                  className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/25 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal création / modification ─────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editId ? 'Modifier le campus' : 'Nouveau campus'}
              </h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
                <div>
                  <label className={labelCls}>Nom du campus *</label>
                  <input
                    value={form.nom}
                    onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                    placeholder="Ex: Campus de Cocody"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Ville</label>
                  <input
                    value={form.ville ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, ville: e.target.value }))}
                    placeholder="Ex: Abidjan"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Adresse</label>
                  <input
                    value={form.adresse ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
                    placeholder="Ex: Boulevard Latrille, Cocody"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-6 shrink-0">
                <button
                  onClick={closeModal}
                  className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.nom.trim()}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
                >
                  {saving ? 'Enregistrement…' : editId ? 'Modifier' : 'Créer le campus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog suppression ────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-red-500/20 rounded-2xl p-7 w-full max-w-sm flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Supprimer ce campus&nbsp;?</h2>
            </div>
            <p className="text-zinc-800 dark:text-orange-100/55 text-sm mb-4 flex-1 min-h-0 overflow-y-auto">
              Cette action est irréversible.
            </p>
            {deleteError && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400 leading-relaxed">{deleteError}</p>
              </div>
            )}
            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => { setDeleteId(null); setDeleteError(null) }}
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

export default function CampusPage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId ?? ''
  return (
    <PlanGate
      feature="multiCampus"
      universityId={universityId}
      showUpgradePrompt={false}
      fallback={<MultiCampusUpgradeFallback />}
    >
      {universityId ? <CampusPageContent /> : null}
    </PlanGate>
  )
}
