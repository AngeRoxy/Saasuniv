'use client'

import { useState, useEffect } from 'react'
import { FolderOpen, Plus, Trash2, ExternalLink, X, Link2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getFilieres, getRessources, createRessource, deleteRessource, type Filiere, type Ressource } from '@/lib/db'

const inputCls = 'w-full bg-[#fafafa]/40 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-zinc-500 dark:placeholder:text-orange-200/25'
const selectCls = 'w-full bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60'

export default function TeacherResourcesPage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId

  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [ressources, setRessources] = useState<Ressource[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ titre: '', url: '', description: '', filiereId: '', niveau: '', matiere: '' })
  const [deleteTarget, setDeleteTarget] = useState<Ressource | null>(null)

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [fil, res] = await Promise.all([getFilieres(universityId), getRessources(universityId)])
        if (!active) return
        setFilieres(fil)
        setRessources(res)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId])

  async function refresh() {
    if (!universityId) return
    setRessources(await getRessources(universityId))
  }

  const selectedFiliere = filieres.find((f) => f.id === form.filiereId)
  const niveauxOptions = selectedFiliere?.niveaux ?? []
  const filiereNom = (id: string) => filieres.find((f) => f.id === id)?.nom

  function openAdd() {
    setForm({ titre: '', url: '', description: '', filiereId: '', niveau: '', matiere: '' })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!universityId || !form.titre.trim() || !form.url.trim()) return
    setSaving(true)
    try {
      await createRessource(universityId, {
        titre: form.titre.trim(),
        url: form.url.trim(),
        description: form.description.trim(),
        filiereId: form.filiereId,
        niveau: form.filiereId ? form.niveau : '',
        matiere: form.matiere.trim(),
        auteur: profile?.displayName ?? 'Enseignant',
      })
      await refresh()
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!universityId || !deleteTarget) return
    await deleteRessource(universityId, deleteTarget.id)
    await refresh()
    setDeleteTarget(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Ressources pédagogiques</h1>
          <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">Partagez des documents et liens avec vos étudiants.</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {ressources.length === 0 ? (
        <div className="text-center py-20 text-zinc-500 dark:text-orange-200/30 text-sm flex flex-col items-center gap-3">
          <FolderOpen size={40} className="opacity-30" />
          Aucune ressource partagée. Cliquez sur « Ajouter ».
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ressources.map((r) => (
            <div key={r.id} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-5 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Link2 size={14} className="text-blue-600 dark:text-orange-400 shrink-0" />
                  <h3 className="text-zinc-900 dark:text-white font-semibold text-sm truncate">{r.titre}</h3>
                </div>
                <button onClick={() => setDeleteTarget(r)} className="shrink-0 text-zinc-500 hover:text-red-400"><Trash2 size={13} /></button>
              </div>
              {r.description && <p className="text-zinc-800 dark:text-orange-100/50 text-xs line-clamp-2">{r.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                {r.filiereId && <span className="text-[11px] bg-orange-500/10 border border-orange-500/20 text-blue-700 dark:text-orange-300 rounded-full px-2 py-0.5">{filiereNom(r.filiereId) ?? 'Filière'}{r.niveau ? ` · ${r.niveau}` : ''}</span>}
                {!r.filiereId && <span className="text-[11px] bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 rounded-full px-2 py-0.5">Toutes filières</span>}
                {r.matiere && <span className="text-[11px] bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 rounded-full px-2 py-0.5">{r.matiere}</span>}
              </div>
              <a href={r.url} target="_blank" rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-orange-400 hover:text-blue-900 dark:hover:text-orange-300 transition-colors">
                Ouvrir <ExternalLink size={11} />
              </a>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Nouvelle ressource</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Titre</label>
                <input value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))} placeholder="Ex: Cours Algorithmique - Chapitre 3" className={inputCls} />
              </div>
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Lien (URL)</label>
                <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://…" className={inputCls} />
              </div>
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Description (option.)</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Contenu…" className={`${inputCls} resize-none`} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Filière</label>
                  <select value={form.filiereId} onChange={(e) => setForm((f) => ({ ...f, filiereId: e.target.value, niveau: '' }))} className={selectCls}>
                    <option value="">Toutes</option>
                    {filieres.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Niveau</label>
                  <select value={form.niveau} onChange={(e) => setForm((f) => ({ ...f, niveau: e.target.value }))} disabled={!form.filiereId} className={`${selectCls} disabled:opacity-50`}>
                    <option value="">Tous</option>
                    {niveauxOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Matière</label>
                  <input value={form.matiere} onChange={(e) => setForm((f) => ({ ...f, matiere: e.target.value }))} placeholder="Option." className={inputCls} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalOpen(false)} disabled={saving} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50">Annuler</button>
                <button onClick={handleSave} disabled={saving || !form.titre.trim() || !form.url.trim()} className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                  {saving && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  Publier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-red-500/20 rounded-2xl p-7 w-full max-w-sm">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white mb-2">Supprimer cette ressource ?</h2>
            <p className="text-zinc-800 dark:text-orange-100/55 text-sm mb-6">« {deleteTarget.titre} »</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors">Annuler</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
