'use client'

import { useState, useEffect } from 'react'
import { Send, Trash2, Bell, Users, CheckCircle2, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { createAnnonce, getAnnonces, deleteAnnonce, type Annonce } from '@/lib/db'
import { CIBLE_LABEL, type AnnonceCible } from '@/types/annonce'

const CIBLES: AnnonceCible[] = ['tous', 'student', 'teacher', 'parent']

export default function NotificationsPage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId

  const [annonces, setAnnonces] = useState<Annonce[]>([])
  const [loading, setLoading] = useState(true)
  const [titre, setTitre] = useState('')
  const [message, setMessage] = useState('')
  const [cible, setCible] = useState<AnnonceCible>('tous')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Annonce | null>(null)

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const list = await getAnnonces(universityId)
        if (active) setAnnonces(list)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId])

  async function refresh() {
    if (!universityId) return
    setAnnonces(await getAnnonces(universityId))
  }

  async function handleSend() {
    if (!universityId || !titre.trim() || !message.trim()) return
    setSending(true)
    try {
      await createAnnonce(universityId, {
        titre: titre.trim(),
        message: message.trim(),
        destinataire: cible,
        auteur: profile?.displayName ?? 'Administration',
      })
      await refresh()
      setTitre('')
      setMessage('')
      setCible('tous')
      setToast('Annonce publiée avec succès.')
      setTimeout(() => setToast(null), 3000)
    } finally {
      setSending(false)
    }
  }

  async function handleDelete() {
    if (!universityId || !deleteTarget) return
    await deleteAnnonce(universityId, deleteTarget.id)
    await refresh()
    setDeleteTarget(null)
  }

  if (profile && profile.role !== 'admin_universite' && profile.role !== 'super_admin_plateforme') {
    return <div className="flex items-center justify-center h-64 text-orange-300/60 text-sm">Accès réservé aux administrateurs.</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Liste des annonces */}
      <div className="lg:col-span-2 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Bell size={15} className="text-orange-400" /> Annonces publiées</h2>
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : annonces.length === 0 ? (
          <div className="text-center py-16 text-orange-200/30 text-sm">Aucune annonce publiée pour l’instant.</div>
        ) : (
          annonces.map((a) => (
            <div key={a.id} className="bg-zinc-950 border border-orange-500/10 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold text-sm">{a.titre}</p>
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300"><Users size={9} /> {CIBLE_LABEL[a.destinataire]}</span>
                  </div>
                  <p className="text-orange-100/60 text-xs leading-relaxed mt-1.5">{a.message}</p>
                  <p className="text-orange-200/30 text-[11px] mt-2">{a.auteur} · {new Date(a.createdAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <button onClick={() => setDeleteTarget(a)} title="Supprimer" className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Formulaire d'envoi */}
      <div className="bg-zinc-950 border border-orange-500/10 rounded-xl p-6 h-fit">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Send size={15} className="text-orange-400" /> Nouvelle annonce</h2>
        <div className="space-y-4">
          <div>
            <label className="text-orange-200/60 text-xs font-medium block mb-1.5">Titre</label>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Objet de l'annonce"
              className="w-full bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-orange-200/25" />
          </div>
          <div>
            <label className="text-orange-200/60 text-xs font-medium block mb-1.5">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Contenu…"
              className="w-full bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-400/60 resize-none placeholder:text-orange-200/25" />
          </div>
          <div>
            <label className="text-orange-200/60 text-xs font-medium block mb-1.5">Destinataires</label>
            <select value={cible} onChange={(e) => setCible(e.target.value as AnnonceCible)}
              className="w-full bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-400/60">
              {CIBLES.map((c) => <option key={c} value={c}>{CIBLE_LABEL[c]}</option>)}
            </select>
          </div>
          <button onClick={handleSend} disabled={sending || !titre.trim() || !message.trim()}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-black font-semibold rounded-xl py-3 text-sm transition-colors">
            {sending ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Send size={14} />}
            Publier l’annonce
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-zinc-900 border border-orange-500/25 rounded-xl px-4 py-3 shadow-2xl">
          <CheckCircle2 size={16} className="text-orange-400 shrink-0" />
          <p className="text-orange-100 text-sm">{toast}</p>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-red-500/20 rounded-2xl p-7 w-full max-w-sm">
            <h2 className="text-base font-bold text-white mb-2">Supprimer cette annonce ?</h2>
            <p className="text-orange-100/55 text-sm mb-6">« {deleteTarget.titre} »</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-orange-500/20 text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-white transition-colors">Annuler</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2"><X size={14} /> Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
