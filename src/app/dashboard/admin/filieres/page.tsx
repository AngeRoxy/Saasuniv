'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, Pencil, Trash2, Search, GraduationCap,
  ToggleLeft, ToggleRight, ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usePlan } from '@/hooks/usePlan'
import { getPlanConfig } from '@/lib/plans'
import {
  getFilieres, createFiliere, updateFiliere, deleteFiliere,
} from '@/lib/db'
import type { Filiere, FiliereFormData } from '@/types/filiere'

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-orange-200/25'
const labelCls = 'text-orange-200/60 text-xs font-medium block mb-1.5'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugCode(nom: string): string {
  return nom
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 8)
}

function emptyForm(): FiliereFormData {
  return {
    nom: '', code: '', description: '',
    niveaux: [], dureeAns: 3, totalCreditsRequis: 180, actif: true,
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed bottom-6 right-6 z-100 bg-orange-500 text-black text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2">
      {message}
      <button onClick={onClose}><X size={14} /></button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FilieresPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const { plan, isWithinLimit } = usePlan(profile?.universityId ?? '')

  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  // Modal état
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FiliereFormData>(emptyForm())
  const [niveauInput, setNiveauInput] = useState('')
  const [saving, setSaving] = useState(false)

  // Suppression
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const uid = profile?.universityId

  useEffect(() => {
    if (!uid) return
    let active = true
    getFilieres(uid)
      .then((data) => { if (active) setFilieres(data) })
      .catch(() => { if (active) setError('Impossible de charger les filières.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [uid])

  // Auth guard
  if (profile && profile.role !== 'admin_universite' && profile.role !== 'super_admin_plateforme') {
    return (
      <div className="flex items-center justify-center h-64 text-orange-300/60 text-sm">
        Accès réservé aux administrateurs.
      </div>
    )
  }

  const filtered = filieres.filter(f =>
    f.nom.toLowerCase().includes(search.toLowerCase()) ||
    f.code.toLowerCase().includes(search.toLowerCase())
  )

  const totalActives = filieres.filter(f => f.actif).length
  const totalInactives = filieres.length - totalActives

  // ─── Modal helpers ──────────────────────────────────────────────────────────

  function openAdd() {
    if (!isWithinLimit('maxFilieres', filieres.length)) {
      const max = getPlanConfig(plan ?? undefined).features.maxFilieres
      setToast(`Limite de ${max} filières atteinte pour le plan ${getPlanConfig(plan ?? undefined).nom}. Passez au plan supérieur.`)
      return
    }
    setForm(emptyForm())
    setNiveauInput('')
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(f: Filiere) {
    setForm({
      nom: f.nom,
      code: f.code,
      description: f.description,
      niveaux: f.niveaux ?? [],
      dureeAns: f.dureeAns,
      totalCreditsRequis: f.totalCreditsRequis,
      actif: f.actif,
    })
    setEditId(f.id)
    setNiveauInput('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditId(null)
    setForm(emptyForm())
    setNiveauInput('')
  }

  function handleNomChange(nom: string) {
    setForm(prev => ({
      ...prev,
      nom,
      code: editId ? prev.code : slugCode(nom),
    }))
  }

  function addNiveau() {
    const n = niveauInput.trim()
    if (!n) return
    setForm(prev =>
      prev.niveaux.includes(n) ? prev : { ...prev, niveaux: [...prev.niveaux, n] }
    )
    setNiveauInput('')
  }

  function removeNiveau(n: string) {
    setForm(prev => ({ ...prev, niveaux: prev.niveaux.filter(x => x !== n) }))
  }

  async function handleSave() {
    if (!uid || !form.nom.trim() || !form.code.trim() || form.niveaux.length === 0) return
    setSaving(true)
    try {
      if (editId) {
        await updateFiliere(uid, editId, form)
        setFilieres(prev => prev.map(f =>
          f.id === editId ? { ...f, ...form, updatedAt: Date.now() } : f
        ))
        setToast('Filière modifiée avec succès')
      } else {
        const id = await createFiliere(uid, form)
        setFilieres(prev => [...prev, {
          id, universityId: uid, ...form,
          createdAt: Date.now(), updatedAt: Date.now(),
        }])
        setToast('Filière créée avec succès')
      }
      closeModal()
    } catch {
      setToast('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActif(f: Filiere) {
    if (!uid) return
    try {
      await updateFiliere(uid, f.id, { actif: !f.actif })
      setFilieres(prev => prev.map(x =>
        x.id === f.id ? { ...x, actif: !f.actif } : x
      ))
      setToast(f.actif ? 'Filière désactivée' : 'Filière activée')
    } catch {
      setToast('Erreur lors de la mise à jour')
    }
  }

  async function handleDelete() {
    if (!uid || !deleteId) return
    setDeleting(true)
    try {
      await deleteFiliere(uid, deleteId)
      setFilieres(prev => prev.filter(f => f.id !== deleteId))
      setToast('Filière et matières supprimées')
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
          <h1 className="text-2xl font-bold text-white">Filières & Matières</h1>
          <p className="text-orange-200/40 text-sm mt-1">{filieres.length} filière{filieres.length !== 1 ? 's' : ''} enregistrée{filieres.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-black rounded-xl px-4 py-2 font-semibold text-sm transition-colors"
        >
          <Plus size={16} /> Nouvelle filière
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total filières', value: filieres.length, color: 'text-orange-400' },
          { label: 'Actives', value: totalActives, color: 'text-emerald-400' },
          { label: 'Inactives', value: totalInactives, color: 'text-zinc-500' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-950 border border-orange-500/10 rounded-xl p-4">
            <p className="text-orange-200/40 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400/50" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou code…"
          className="bg-black/40 border border-orange-500/20 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 w-full max-w-sm text-sm"
        />
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
      ) : filtered.length === 0 ? (
        /* Empty state */
        <div className="text-center py-20 text-orange-200/30">
          <GraduationCap size={48} className="mx-auto mb-4 opacity-20" />
          {filieres.length === 0 ? (
            <>
              <p className="text-base font-medium mb-3">Aucune filière enregistrée</p>
              <button
                onClick={openAdd}
                className="bg-orange-500 hover:bg-orange-600 text-black font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                Créer la première filière
              </button>
            </>
          ) : (
            <p className="text-sm">Aucun résultat pour «&nbsp;{search}&nbsp;».</p>
          )}
        </div>
      ) : (
        /* List */
        <div className="space-y-3">
          {filtered.map(f => (
            <div
              key={f.id}
              className="group bg-zinc-950 border border-orange-500/10 hover:border-orange-500/25 rounded-xl px-5 py-4 flex items-center gap-4 transition-colors"
            >
              {/* Code badge */}
              <span className="shrink-0 font-mono text-xs font-bold bg-orange-500/15 border border-orange-500/25 text-orange-400 rounded-lg px-2.5 py-1">
                {f.code}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{f.nom}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="text-xs text-orange-200/40">{f.dureeAns} an{f.dureeAns > 1 ? 's' : ''}</span>
                  <span className="text-orange-200/20 text-xs">·</span>
                  <span className="text-xs text-orange-200/40">{f.totalCreditsRequis} crédits requis</span>
                  {(f.niveaux ?? []).map(n => (
                    <span key={n} className="text-xs bg-zinc-800 border border-white/10 text-zinc-400 rounded-full px-2 py-0.5">
                      {n}
                    </span>
                  ))}
                </div>
              </div>

              {/* Statut */}
              <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
                f.actif
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-zinc-700/30 border border-white/10 text-zinc-500'
              }`}>
                {f.actif ? 'Active' : 'Inactive'}
              </span>

              {/* Actions (hover) */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => router.push(`/dashboard/admin/filieres/${f.id}`)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/25 text-xs font-medium transition-colors"
                  title="Voir les matières"
                >
                  Matières <ChevronRight size={12} />
                </button>
                <button
                  onClick={() => handleToggleActif(f)}
                  className="p-1.5 rounded-lg bg-white/5 text-zinc-400 hover:text-orange-300 hover:bg-white/10 transition-colors"
                  title={f.actif ? 'Désactiver' : 'Activer'}
                >
                  {f.actif ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} />}
                </button>
                <button
                  onClick={() => openEdit(f)}
                  className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/25 transition-colors"
                  title="Modifier"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteId(f.id)}
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
          <div className="bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">
                {editId ? 'Modifier la filière' : 'Nouvelle filière'}
              </h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nom + Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Nom de la filière *</label>
                  <input
                    value={form.nom}
                    onChange={e => handleNomChange(e.target.value)}
                    placeholder="Ex: Licence Informatique"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Code (auto-généré) *</label>
                  <input
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="Ex: LINF"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Objectifs, débouchés…"
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Niveaux — saisie libre, propres à chaque université (obligatoire :
                  sans niveau, impossible d'inscrire un étudiant dans la filière) */}
              <div>
                <label className={labelCls}>Niveaux concernés *</label>
                <div className="flex gap-2">
                  <input
                    value={niveauInput}
                    onChange={e => setNiveauInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); addNiveau() }
                    }}
                    placeholder="Ex: L1, Master, BTS…"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={addNiveau}
                    disabled={!niveauInput.trim()}
                    className="shrink-0 flex items-center gap-1 bg-orange-500/15 border border-orange-500/30 text-orange-300 hover:bg-orange-500/25 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl px-3 text-sm font-medium transition-colors"
                  >
                    <Plus size={14} /> Ajouter
                  </button>
                </div>
                {form.niveaux.length === 0 && (
                  <p className="text-orange-200/40 text-xs mt-2">
                    Ajoutez au moins un niveau (ex: L1) — il sera proposé lors de l&apos;inscription des étudiants.
                  </p>
                )}
                {form.niveaux.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {form.niveaux.map(n => (
                      <span
                        key={n}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-300"
                      >
                        {n}
                        <button
                          type="button"
                          onClick={() => removeNiveau(n)}
                          className="text-orange-300/70 hover:text-white transition-colors"
                          title="Retirer ce niveau"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Durée + Crédits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Durée (années)</label>
                  <input
                    type="number" min={1} max={8}
                    value={form.dureeAns}
                    onChange={e => setForm(f => ({ ...f, dureeAns: +e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Crédits ECTS requis</label>
                  <input
                    type="number" min={0}
                    value={form.totalCreditsRequis}
                    onChange={e => setForm(f => ({ ...f, totalCreditsRequis: +e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Statut */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, actif: !f.actif }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.actif ? 'bg-orange-500' : 'bg-zinc-700'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.actif ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-orange-200/60">
                  {form.actif ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeModal}
                  className="flex-1 border border-orange-500/20 text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.nom.trim() || !form.code.trim() || form.niveaux.length === 0}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-xl py-2.5 text-sm transition-colors"
                >
                  {saving ? 'Enregistrement…' : editId ? 'Modifier' : 'Créer la filière'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog suppression ────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-red-500/20 rounded-2xl p-7 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <h2 className="text-base font-bold text-white">Supprimer cette filière&nbsp;?</h2>
            </div>
            <p className="text-orange-100/55 text-sm mb-6">
              Cette action est irréversible. La filière et <strong className="text-orange-300">toutes ses matières</strong> seront définitivement supprimées.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-orange-500/20 text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-white transition-colors"
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
