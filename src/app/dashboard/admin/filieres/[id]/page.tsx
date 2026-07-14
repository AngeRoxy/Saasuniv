'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, X, Pencil, Trash2,
  BookOpen, Clock, Hash, Star,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getFiliere, getMatieres, createMatiere, updateMatiere, deleteMatiere,
} from '@/lib/db'
import type { Filiere, Matiere, MatiereFormData, SemestreLabel } from '@/types/filiere'

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-zinc-500 dark:placeholder:text-orange-200/25'
const labelCls = 'text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5'

// Les semestres sont saisis librement par chaque université (texte libre).
// On attribue une couleur stable à partir du libellé plutôt que d'une liste figée.
const SEMESTRE_PALETTE = [
  'bg-sky-500/15 border-sky-500/30 text-blue-600 dark:text-sky-400',
  'bg-violet-500/15 border-violet-500/30 text-blue-600 dark:text-violet-400',
  'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  'bg-amber-500/15 border-amber-500/30 text-blue-600 dark:text-amber-400',
  'bg-rose-500/15 border-rose-500/30 text-rose-400',
  'bg-teal-500/15 border-teal-500/30 text-blue-600 dark:text-teal-400',
]

function semestreColor(semestre: SemestreLabel): string {
  let hash = 0
  for (let i = 0; i < semestre.length; i++) {
    hash = (hash * 31 + semestre.charCodeAt(i)) | 0
  }
  return SEMESTRE_PALETTE[Math.abs(hash) % SEMESTRE_PALETTE.length]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyMatiereForm(): MatiereFormData {
  return {
    nom: '', code: '', coefficient: 1, credits: 3,
    semestre: '', heuresTotal: 30, obligatoire: true,
  }
}

function slugCode(nom: string) {
  return nom
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 8)
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

export default function FiliereDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { profile } = useAuth()

  const [filiere, setFiliere] = useState<Filiere | null>(null)
  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [semestreFilter, setSemestreFilter] = useState<SemestreLabel | 'Tous'>('Tous')

  // Modal matière
  const [modalOpen, setModalOpen] = useState(false)
  const [editMatiereId, setEditMatiereId] = useState<string | null>(null)
  const [form, setForm] = useState<MatiereFormData>(emptyMatiereForm())
  const [saving, setSaving] = useState(false)

  // Suppression
  const [deleteMatiereId, setDeleteMatiereId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const uid = profile?.universityId

  useEffect(() => {
    if (!uid || !id) return
    let active = true
    Promise.all([getFiliere(uid, id), getMatieres(uid, id)])
      .then(([fil, mats]) => {
        if (!active) return
        if (!fil) { setError('Filière introuvable.'); return }
        setFiliere(fil)
        setMatieres(mats)
      })
      .catch(() => { if (active) setError('Impossible de charger les données.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [uid, id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !filiere) {
    return (
      <div className="text-center py-20 text-red-400 text-sm">
        {error ?? 'Filière introuvable.'}
      </div>
    )
  }

  // ─── Derived values ─────────────────────────────────────────────────────────

  const totalCredits = matieres.reduce((s, m) => s + m.credits, 0)
  const totalHeures = matieres.reduce((s, m) => s + m.heuresTotal, 0)
  const totalCoeff = matieres.reduce((s, m) => s + m.coefficient, 0)
  const progressPct = filiere.totalCreditsRequis > 0
    ? Math.min(100, Math.round((totalCredits / filiere.totalCreditsRequis) * 100))
    : 0

  const semestresUsed = Array.from(new Set(matieres.map(m => m.semestre))) as SemestreLabel[]
  const showSemestreFilter = semestresUsed.length > 1

  const filtered = semestreFilter === 'Tous'
    ? matieres
    : matieres.filter(m => m.semestre === semestreFilter)

  const totalFiltered = {
    coeff: filtered.reduce((s, m) => s + m.coefficient, 0),
    credits: filtered.reduce((s, m) => s + m.credits, 0),
    heures: filtered.reduce((s, m) => s + m.heuresTotal, 0),
  }

  // ─── Modal helpers ──────────────────────────────────────────────────────────

  function openAdd() {
    setForm(emptyMatiereForm())
    setEditMatiereId(null)
    setModalOpen(true)
  }

  function openEdit(m: Matiere) {
    setForm({
      nom: m.nom,
      code: m.code,
      coefficient: m.coefficient,
      credits: m.credits,
      semestre: m.semestre,
      heuresTotal: m.heuresTotal,
      obligatoire: m.obligatoire,
    })
    setEditMatiereId(m.id)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditMatiereId(null)
    setForm(emptyMatiereForm())
  }

  async function handleSaveMatiere() {
    if (!uid || !id || !form.nom.trim() || !form.code.trim()) return
    setSaving(true)
    try {
      if (editMatiereId) {
        await updateMatiere(uid, id, editMatiereId, form)
        setMatieres(prev => prev.map(m =>
          m.id === editMatiereId ? { ...m, ...form, updatedAt: Date.now() } : m
        ))
        setToast('Matière modifiée avec succès')
      } else {
        const newId = await createMatiere(uid, id, form)
        setMatieres(prev => [...prev, {
          id: newId, ...form,
          createdAt: Date.now(), updatedAt: Date.now(),
        }])
        setToast('Matière ajoutée avec succès')
      }
      closeModal()
    } catch {
      setToast('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteMatiere() {
    if (!uid || !id || !deleteMatiereId) return
    setDeleting(true)
    try {
      await deleteMatiere(uid, id, deleteMatiereId)
      setMatieres(prev => prev.filter(m => m.id !== deleteMatiereId))
      setToast('Matière supprimée')
    } catch {
      setToast('Erreur lors de la suppression')
    } finally {
      setDeleting(false)
      setDeleteMatiereId(null)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Back + Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/admin/filieres')}
          className="flex items-center gap-1.5 text-blue-600 dark:text-orange-400/70 hover:text-blue-900 dark:hover:text-orange-300 text-sm mb-4 transition-colors"
        >
          <ArrowLeft size={15} /> Retour aux filières
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-xs font-bold bg-orange-500/15 border border-orange-500/25 text-blue-600 dark:text-orange-400 rounded-lg px-2.5 py-1">
                {filiere.code}
              </span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                filiere.actif
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-zinc-200 dark:bg-zinc-700/30 border border-zinc-200 dark:border-white/10 text-zinc-500'
              }`}>
                {filiere.actif ? 'Active' : 'Inactive'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{filiere.nom}</h1>
            <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
              {filiere.dureeAns} an{filiere.dureeAns > 1 ? 's' : ''} · {filiere.totalCreditsRequis} crédits requis
            </p>
          </div>
          <button
            onClick={openAdd}
            className="shrink-0 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors"
          >
            <Plus size={16} /> Ajouter une matière
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Matières', value: matieres.length, icon: BookOpen, color: 'text-blue-600 dark:text-orange-400' },
          { label: 'Crédits définis', value: totalCredits, icon: Star, color: 'text-blue-600 dark:text-violet-400' },
          { label: 'Heures total', value: totalHeures, icon: Clock, color: 'text-blue-600 dark:text-sky-400' },
          { label: 'Σ Coefficients', value: totalCoeff, icon: Hash, color: 'text-blue-600 dark:text-amber-400' },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <k.icon size={15} className={k.color} />
              <p className="text-zinc-500 dark:text-orange-200/40 text-xs">{k.label}</p>
            </div>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Credits progress */}
      {filiere.totalCreditsRequis > 0 && (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-zinc-600 dark:text-orange-200/50">Crédits définis</span>
            <span className="text-blue-700 dark:text-orange-300 font-medium">{totalCredits} / {filiere.totalCreditsRequis} ({progressPct}%)</span>
          </div>
          <div className="h-2 bg-white dark:bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-orange-500'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Filtre semestre */}
      {showSemestreFilter && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setSemestreFilter('Tous')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              semestreFilter === 'Tous'
                ? 'bg-orange-500/20 border-orange-500/40 text-blue-700 dark:text-orange-300'
                : 'bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-white/20'
            }`}
          >
            Tous
          </button>
          {semestresUsed.map(s => (
            <button
              key={s}
              onClick={() => setSemestreFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                semestreFilter === s
                  ? `${semestreColor(s)} border-current`
                  : 'bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-white/20'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Tableau */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30">
          <BookOpen size={40} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm">Aucune matière enregistrée.</p>
          <button
            onClick={openAdd}
            className="mt-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
          >
            Ajouter la première matière
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-orange-200/40 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Matière</th>
                <th className="text-left px-4 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">Semestre</th>
                <th className="text-right px-4 py-3 font-medium">Coeff.</th>
                <th className="text-right px-4 py-3 font-medium">Crédits</th>
                <th className="text-right px-4 py-3 font-medium">Heures</th>
                <th className="text-center px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
              {filtered.map(m => (
                <tr key={m.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-zinc-900 dark:text-white font-medium">{m.nom}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-blue-600 dark:text-orange-400/80">{m.code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border ${semestreColor(m.semestre)}`}>
                      {m.semestre}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-600 dark:text-orange-200/70">{m.coefficient}</td>
                  <td className="px-4 py-3 text-right text-zinc-600 dark:text-orange-200/70">{m.credits}</td>
                  <td className="px-4 py-3 text-right text-zinc-600 dark:text-orange-200/70">{m.heuresTotal}h</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full ${
                      m.obligatoire
                        ? 'bg-orange-500/10 border border-orange-500/20 text-blue-600 dark:text-orange-400'
                        : 'bg-zinc-200 dark:bg-zinc-700/30 border border-zinc-200 dark:border-white/10 text-zinc-500'
                    }`}>
                      {m.obligatoire ? 'Obligatoire' : 'Optionnel'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(m)}
                        className="p-1.5 rounded-lg bg-orange-500/10 text-blue-600 dark:text-orange-400 hover:bg-orange-500/25 transition-colors"
                        title="Modifier"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteMatiereId(m.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/25 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-orange-200/50 text-xs font-semibold bg-white/[0.02]">
                <td className="px-4 py-3" colSpan={3}>Totaux</td>
                <td className="px-4 py-3 text-right text-blue-700 dark:text-orange-300">{totalFiltered.coeff}</td>
                <td className="px-4 py-3 text-right text-blue-700 dark:text-orange-300">{totalFiltered.credits}</td>
                <td className="px-4 py-3 text-right text-blue-700 dark:text-orange-300">{totalFiltered.heures}h</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Modal ajout / modification matière ───────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editMatiereId ? 'Modifier la matière' : 'Ajouter une matière'}
              </h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nom + Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Nom de la matière *</label>
                  <input
                    value={form.nom}
                    onChange={e => {
                      const nom = e.target.value
                      setForm(f => ({
                        ...f,
                        nom,
                        code: editMatiereId ? f.code : slugCode(nom),
                      }))
                    }}
                    placeholder="Ex: Algorithmique"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Code *</label>
                  <input
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="Ex: ALGO"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Semestre — saisie libre, propre à chaque université */}
              <div>
                <label className={labelCls}>Semestre</label>
                <input
                  value={form.semestre}
                  onChange={e => setForm(f => ({ ...f, semestre: e.target.value }))}
                  placeholder="Ex: Semestre 1, S1, Trimestre 1…"
                  className={inputCls}
                />
              </div>

              {/* Coefficient + Crédits + Heures */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Coefficient (1–10)</label>
                  <input
                    type="number" min={1} max={10}
                    value={form.coefficient}
                    onChange={e => setForm(f => ({ ...f, coefficient: +e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Crédits ECTS</label>
                  <input
                    type="number" min={0}
                    value={form.credits}
                    onChange={e => setForm(f => ({ ...f, credits: +e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Heures total</label>
                  <input
                    type="number" min={0}
                    value={form.heuresTotal}
                    onChange={e => setForm(f => ({ ...f, heuresTotal: +e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Obligatoire */}
              <div className="flex items-center gap-3">
                <input
                  id="obligatoire"
                  type="checkbox"
                  checked={form.obligatoire}
                  onChange={e => setForm(f => ({ ...f, obligatoire: e.target.checked }))}
                  className="w-4 h-4 accent-orange-500 cursor-pointer"
                />
                <label htmlFor="obligatoire" className="text-sm text-zinc-600 dark:text-orange-200/60 cursor-pointer">
                  Matière obligatoire
                </label>
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
                  onClick={handleSaveMatiere}
                  disabled={saving || !form.nom.trim() || !form.code.trim()}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
                >
                  {saving ? 'Enregistrement…' : editMatiereId ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog suppression matière ────────────────────────────────────────── */}
      {deleteMatiereId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-red-500/20 rounded-2xl p-7 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Supprimer cette matière&nbsp;?</h2>
            </div>
            <p className="text-zinc-800 dark:text-orange-100/55 text-sm mb-6">
              Cette action est irréversible. La matière sera définitivement supprimée de la filière.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteMatiereId(null)}
                className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteMatiere}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
