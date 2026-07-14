'use client'

import { useState, useEffect, useRef } from 'react'
import { FolderOpen, Plus, Trash2, ExternalLink, X, Link2, Upload, FileText, Download, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getFilieres, getRessources, createRessource, deleteRessource, type Filiere, type Ressource } from '@/lib/db'
import {
  uploadRessource,
  validerFichier,
  formatTaille,
  UploadError,
  STORAGE_ENABLED,
  RESSOURCE_ACCEPT,
  RESSOURCE_EXTENSIONS,
  RESSOURCE_MAX_BYTES,
} from '@/lib/storage'

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

  // Fichier joint (optionnel) : une ressource peut être un lien, un fichier, ou
  // les deux. `progress` reflète l'avancement RÉEL de l'upload Storage.
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setFile(null)
    setProgress(null)
    setError(null)
    setModalOpen(true)
  }

  /** Validation immédiate : l'enseignant sait tout de suite si le fichier passe. */
  function handleFileChange(selected: File | undefined) {
    setError(null)
    if (!selected) {
      setFile(null)
      return
    }
    try {
      validerFichier(selected, RESSOURCE_EXTENSIONS, RESSOURCE_MAX_BYTES)
      setFile(selected)
    } catch (e) {
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setError(e instanceof UploadError ? e.message : 'Fichier invalide.')
    }
  }

  // Une ressource doit porter au moins un contenu : un lien, un fichier, ou les deux.
  const contenuFourni = Boolean(form.url.trim() || file)

  async function handleSave() {
    if (!universityId || !form.titre.trim() || !contenuFourni || saving) return
    setSaving(true)
    setError(null)
    try {
      // 1. Upload d'abord : si le fichier échoue, aucune ressource n'est créée
      //    (pas d'entrée fantôme pointant vers un fichier inexistant).
      let fichier: { url: string; path: string; nom: string; taille: number } | null = null
      if (file) {
        setProgress(0)
        fichier = await uploadRessource(universityId, form.matiere, file, setProgress)
      }

      // 2. Puis l'entrée RTDB, une fois le fichier réellement disponible.
      await createRessource(universityId, {
        titre: form.titre.trim(),
        url: form.url.trim(),
        description: form.description.trim(),
        filiereId: form.filiereId,
        niveau: form.filiereId ? form.niveau : '',
        matiere: form.matiere.trim(),
        auteur: profile?.displayName ?? 'Enseignant',
        ...(fichier && {
          fichierUrl: fichier.url,
          fichierNom: fichier.nom,
          fichierTaille: fichier.taille,
          fichierPath: fichier.path,
        }),
      })
      await refresh()
      setModalOpen(false)
      setFile(null)
    } catch (e) {
      console.error('Publication de la ressource échouée', e)
      setError(
        e instanceof UploadError
          ? e.message
          : "Échec de la publication — vérifiez vos droits ou votre connexion."
      )
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  /** Supprime la ressource ET son fichier. Erreur explicite si l'écriture échoue. */
  async function handleDelete() {
    if (!universityId || !deleteTarget || deleting) return
    setDeleting(true)
    try {
      await deleteRessource(universityId, deleteTarget.id)
      await refresh()
      setDeleteTarget(null)
    } catch (e) {
      console.error('Suppression de la ressource échouée', e)
      setError("Échec de la suppression — la ressource est toujours en ligne.")
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
              <div className="mt-1 flex flex-wrap items-center gap-3">
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-orange-400 hover:text-blue-900 dark:hover:text-orange-300 transition-colors">
                    Ouvrir le lien <ExternalLink size={11} />
                  </a>
                )}
                {r.fichierUrl && (
                  <a href={r.fichierUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-orange-400 hover:text-blue-900 dark:hover:text-orange-300 transition-colors">
                    <Download size={11} /> {r.fichierNom ?? 'Fichier'}
                    {r.fichierTaille !== undefined && (
                      <span className="text-zinc-500">({formatTaille(r.fichierTaille)})</span>
                    )}
                  </a>
                )}
              </div>
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

              {/* Fichier joint — alternative OU complément au lien.
                  Masqué tant que Firebase Storage n'est pas activé
                  (STORAGE_ENABLED). Le code reste intact pour réactivation. */}
              {STORAGE_ENABLED ? (
                <div>
                  <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">
                    Fichier (option.)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={RESSOURCE_ACCEPT}
                    onChange={(e) => handleFileChange(e.target.files?.[0])}
                    className="hidden"
                  />
                  {!file ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 border border-dashed border-orange-500/30 rounded-xl px-4 py-3 text-sm text-zinc-600 dark:text-orange-200/60 hover:border-orange-500/60 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50"
                    >
                      <Upload size={15} /> Choisir un fichier
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-2.5">
                      <FileText size={15} className="shrink-0 text-blue-600 dark:text-orange-400" />
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-800 dark:text-orange-100/80">{file.name}</span>
                      <span className="shrink-0 text-xs text-zinc-500">{formatTaille(file.size)}</span>
                      {!saving && (
                        <button
                          type="button"
                          onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                          className="shrink-0 text-zinc-500 hover:text-red-400"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )}
                  <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-orange-200/30">
                    PDF, Word, PowerPoint, JPG ou PNG · {formatTaille(RESSOURCE_MAX_BYTES)} maximum
                  </p>

                  {/* Progression RÉELLE de l'upload (octets transférés). */}
                  {progress !== null && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-orange-500 transition-[width] duration-200"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500 dark:text-orange-200/40">
                        Envoi du fichier… {progress}%
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="flex items-center gap-1.5 rounded-xl border border-dashed border-zinc-300 dark:border-white/10 px-3 py-2.5 text-[11px] text-zinc-500 dark:text-orange-200/40">
                  <FileText size={13} className="shrink-0" />
                  L’envoi de fichiers sera bientôt disponible. En attendant, partagez un lien (Drive, PDF en ligne…).
                </p>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
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
                <button onClick={handleSave} disabled={saving || !form.titre.trim() || !contenuFourni} className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                  {saving && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  {saving ? 'Publication…' : 'Publier'}
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
            {deleteTarget.fichierUrl && (
              <p className="text-zinc-500 dark:text-orange-200/40 text-xs mb-4 -mt-3">
                Le fichier joint sera également supprimé.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50">Annuler</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">{deleting ? 'Suppression…' : 'Supprimer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
