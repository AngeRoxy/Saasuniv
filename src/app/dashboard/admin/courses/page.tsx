'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, X, Pencil, Trash2, BookOpen, Search } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getFilieres, getUniversityMembers } from '@/lib/db'
import type { Filiere } from '@/types/filiere'

type Course = {
  id: number
  code: string
  intitule: string
  enseignant: string
  filiere: string
  niveau: string
  credits: number
  semestre: number
  description: string
  salle: string
}

function emptyForm(): Omit<Course, 'id'> {
  return { code: '', intitule: '', enseignant: '', filiere: '', niveau: '', credits: 3, semestre: 1, description: '', salle: '' }
}

// Préfixe de code dérivé du libellé de la filière (saisi par l'université),
// jamais d'une table de correspondance figée.
function filierePrefix(filiere: string): string {
  const slug = filiere
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
  return slug.slice(0, 3) || 'CRS'
}

function autoCode(filiere: string, existingCodes: string[]): string {
  const prefix = filierePrefix(filiere)
  let n = 1
  while (existingCodes.includes(`${prefix}-${String(n).padStart(3, '0')}`)) n++
  return `${prefix}-${String(n).padStart(3, '0')}`
}

const inputCls = 'w-full bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-orange-200/25'
const selectCls = 'w-full bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-400/60'
const labelCls = 'text-orange-200/60 text-xs font-medium block mb-1.5'

export default function CoursesPage() {
  const { profile } = useAuth()

  const [courses, setCourses] = useState<Course[]>([])
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [enseignants, setEnseignants] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [filterFiliere, setFilterFiliere] = useState('')
  const [filterEnseignant, setFilterEnseignant] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<Omit<Course, 'id'>>(emptyForm())

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  // Filières et enseignants chargés depuis Firebase (propres à l'université).
  useEffect(() => {
    const universityId = profile?.universityId
    if (!universityId) return
    getFilieres(universityId)
      .then(setFilieres)
      .catch(() => setFilieres([]))
    getUniversityMembers(universityId, 'teacher')
      .then((members) => setEnseignants(members.map((m) => m.displayName)))
      .catch(() => setEnseignants([]))
  }, [profile?.universityId])

  // Niveaux disponibles = ceux de la filière choisie dans le formulaire.
  const niveauxForm = filieres.find((f) => f.nom === form.filiere)?.niveaux ?? []

  const filtered = courses.filter(c => {
    const matchSearch =
      c.intitule.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
    const matchFiliere = filterFiliere ? c.filiere === filterFiliere : true
    const matchEnseignant = filterEnseignant ? c.enseignant === filterEnseignant : true
    return matchSearch && matchFiliere && matchEnseignant
  })

  function openAdd() {
    const base = emptyForm()
    base.code = autoCode(base.filiere, courses.map(c => c.code))
    setForm(base)
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(course: Course) {
    const { id, ...rest } = course
    setForm(rest)
    setEditId(id)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditId(null)
    setForm(emptyForm())
  }

  function handleFiliereChange(value: string) {
    // Changer de filière réinitialise le niveau (les niveaux dépendent de la filière).
    const next = { ...form, filiere: value, niveau: '' }
    next.code = autoCode(next.filiere, courses.filter(c => c.id !== editId).map(c => c.code))
    setForm(next)
  }

  function handleSave() {
    if (!form.intitule.trim() || !form.code.trim()) return
    if (editId !== null) {
      setCourses(prev => prev.map(c => c.id === editId ? { id: editId, ...form } : c))
    } else {
      setCourses(prev => [...prev, { id: Date.now(), ...form }])
    }
    closeModal()
  }

  function confirmDelete(id: number) {
    setConfirmDeleteId(id)
  }

  function handleDelete() {
    if (confirmDeleteId === null) return
    setCourses(prev => prev.filter(c => c.id !== confirmDeleteId))
    setConfirmDeleteId(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Catalogue des cours</h1>
          <p className="text-orange-200/40 text-sm mt-1">{courses.length} cours enregistrés</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-black rounded-xl px-4 py-2 font-semibold text-sm transition-colors"
        >
          <Plus size={16} /> Ajouter un cours
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400/50" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un cours…"
            className="bg-black/40 border border-orange-500/20 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 w-64 text-sm"
          />
        </div>
        <select
          value={filterFiliere}
          onChange={e => setFilterFiliere(e.target.value)}
          className="bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-400/60"
        >
          <option value="">Toutes les filières</option>
          {filieres.map(f => <option key={f.id} value={f.nom}>{f.nom}</option>)}
        </select>
        <select
          value={filterEnseignant}
          onChange={e => setFilterEnseignant(e.target.value)}
          className="bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-400/60"
        >
          <option value="">Tous les enseignants</option>
          {enseignants.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        {(search || filterFiliere || filterEnseignant) && (
          <button
            onClick={() => { setSearch(''); setFilterFiliere(''); setFilterEnseignant('') }}
            className="text-orange-400/70 text-sm hover:text-orange-300 transition-colors px-2"
          >
            Réinitialiser
          </button>
        )}
        <span className="ml-auto text-orange-200/40 text-sm self-center">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-orange-200/30">
          <BookOpen size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">Aucun cours ne correspond aux filtres.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="bg-zinc-950 border border-orange-500/10 rounded-xl p-5 flex flex-col gap-3 hover:border-orange-500/25 transition-colors">
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-orange-400 font-mono text-xs font-semibold">{c.code}</span>
                  <h3 className="text-white font-semibold text-sm mt-0.5 leading-snug">{c.intitule}</h3>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => openEdit(c)}
                    className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/25 transition-colors"
                    title="Modifier"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => confirmDelete(c.id)}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/25 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Card fields */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div>
                  <span className="text-orange-200/35 block">Filière</span>
                  <span className="text-orange-100/70">{c.filiere}</span>
                </div>
                <div>
                  <span className="text-orange-200/35 block">Niveau</span>
                  <span className="text-orange-100/70">{c.niveau}</span>
                </div>
                <div>
                  <span className="text-orange-200/35 block">Enseignant</span>
                  <span className="text-orange-100/70">{c.enseignant}</span>
                </div>
                <div>
                  <span className="text-orange-200/35 block">Salle</span>
                  <span className="text-orange-100/70">{c.salle || '—'}</span>
                </div>
              </div>

              {/* Badges */}
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs bg-orange-500/10 border border-orange-500/20 text-orange-300 rounded-full px-2.5 py-0.5">
                  {c.credits} ECTS
                </span>
                <span className="text-xs bg-orange-500/10 border border-orange-500/20 text-orange-300 rounded-full px-2.5 py-0.5">
                  Sem. {c.semestre}
                </span>
              </div>

              {/* Description */}
              {c.description && (
                <p className="text-orange-100/45 text-xs leading-relaxed line-clamp-2">{c.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">
                {editId !== null ? 'Modifier le cours' : 'Ajouter un cours'}
              </h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Row 1: Intitulé + Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Intitulé du cours</label>
                  <input
                    value={form.intitule}
                    onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))}
                    placeholder="Ex: Algorithmique Avancée"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Code cours (auto-généré)</label>
                  <input
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    placeholder="Ex: INF-301"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Row 2: Enseignant responsable */}
              <div>
                <label className={labelCls}>Enseignant responsable</label>
                <select
                  value={form.enseignant}
                  onChange={e => setForm(f => ({ ...f, enseignant: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">{enseignants.length ? 'Choisir un enseignant…' : 'Aucun enseignant enregistré'}</option>
                  {enseignants.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              {/* Row 3: Filière + Niveau — chargés depuis Firebase */}
              {filieres.length === 0 ? (
                <p className="text-xs text-orange-200/60 bg-orange-500/5 border border-orange-500/20 rounded-xl px-4 py-3">
                  Aucune filière disponible — créez d&apos;abord vos filières dans{' '}
                  <Link href="/dashboard/admin/filieres" className="text-orange-400 underline hover:text-orange-300">
                    Filières &amp; Matières
                  </Link>
                  .
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Filière</label>
                    <select
                      value={form.filiere}
                      onChange={e => handleFiliereChange(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Choisir une filière…</option>
                      {filieres.map(f => <option key={f.id} value={f.nom}>{f.nom}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Niveau</label>
                    <select
                      value={form.niveau}
                      onChange={e => setForm(f => ({ ...f, niveau: e.target.value }))}
                      disabled={!form.filiere}
                      className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <option value="">{form.filiere ? 'Choisir un niveau…' : 'Choisir une filière d’abord'}</option>
                      {niveauxForm.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Row 4: Crédits ECTS + Semestre */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Crédits ECTS</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.credits}
                    onChange={e => setForm(f => ({ ...f, credits: +e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Semestre</label>
                  <select
                    value={form.semestre}
                    onChange={e => setForm(f => ({ ...f, semestre: +e.target.value }))}
                    className={selectCls}
                  >
                    <option value={1}>Semestre 1</option>
                    <option value={2}>Semestre 2</option>
                  </select>
                </div>
              </div>

              {/* Row 5: Salle */}
              <div>
                <label className={labelCls}>Salle</label>
                <input
                  value={form.salle}
                  onChange={e => setForm(f => ({ ...f, salle: e.target.value }))}
                  placeholder="Ex: Amphi A, Salle 204…"
                  className={inputCls}
                />
              </div>

              {/* Row 6: Description */}
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Contenu et objectifs du cours…"
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeModal}
                  className="flex-1 border border-orange-500/20 text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.intitule.trim() || !form.code.trim()}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-xl py-2.5 text-sm transition-colors"
                >
                  {editId !== null ? 'Enregistrer les modifications' : 'Ajouter le cours'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-red-500/20 rounded-2xl p-7 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <h2 className="text-base font-bold text-white">Supprimer ce cours ?</h2>
            </div>
            <p className="text-orange-100/55 text-sm mb-6">
              Cette action est irréversible. Le cours sera définitivement supprimé du catalogue.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 border border-orange-500/20 text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
