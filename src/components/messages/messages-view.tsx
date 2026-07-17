'use client'

import { useState, useEffect, useMemo } from 'react'
import { Send, Inbox, X, Mail, MailOpen, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getMessagesForUser,
  sendMessage,
  markMessageRead,
  deleteMessage,
  getUniversityMembers,
  type Message,
  type UniversityMember,
} from '@/lib/db'

const inputCls = 'w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-zinc-500 dark:placeholder:text-orange-200/25'
const selectCls = 'w-full bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60'

/** Messagerie interne (enseignant, parent, étudiant). */
export function MessagesView() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId
  const myUid = user?.uid
  const myNom = profile?.displayName ?? user?.email ?? 'Moi'

  const [messages, setMessages] = useState<Message[]>([])
  const [contacts, setContacts] = useState<UniversityMember[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'recus' | 'envoyes'>('recus')
  const [open, setOpen] = useState<Message | null>(null)

  const [composeOpen, setComposeOpen] = useState(false)
  const [form, setForm] = useState({ toUid: '', sujet: '', corps: '' })
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!universityId || !myUid) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [msgs, students, teachers, parents] = await Promise.all([
          getMessagesForUser(universityId, myUid),
          getUniversityMembers(universityId, 'student'),
          getUniversityMembers(universityId, 'teacher'),
          getUniversityMembers(universityId, 'parent'),
        ])
        if (!active) return
        setMessages(msgs)
        setContacts([...teachers, ...parents, ...students].filter((m) => m.uid !== myUid))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId, myUid])

  async function refresh() {
    if (!universityId || !myUid) return
    setMessages(await getMessagesForUser(universityId, myUid))
  }

  const recus = useMemo(() => messages.filter((m) => m.toUid === myUid), [messages, myUid])
  const envoyes = useMemo(() => messages.filter((m) => m.fromUid === myUid), [messages, myUid])
  const nonLus = recus.filter((m) => !m.lu).length
  const displayed = tab === 'recus' ? recus : envoyes

  async function openMessage(m: Message) {
    setOpen(m)
    if (universityId && tab === 'recus' && !m.lu) {
      await markMessageRead(universityId, m.id)
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, lu: true } : x)))
    }
  }

  async function handleSend() {
    if (!universityId || !myUid || !form.toUid || !form.sujet.trim() || !form.corps.trim()) return
    const dest = contacts.find((c) => c.uid === form.toUid)
    if (!dest) return
    setSending(true)
    try {
      await sendMessage(universityId, {
        fromUid: myUid, fromNom: myNom,
        toUid: dest.uid, toNom: dest.displayName,
        sujet: form.sujet.trim(), corps: form.corps.trim(),
      })
      await refresh()
      setForm({ toUid: '', sujet: '', corps: '' })
      setComposeOpen(false)
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(m: Message) {
    if (!universityId) return
    await deleteMessage(universityId, m.id)
    setMessages((prev) => prev.filter((x) => x.id !== m.id))
    if (open?.id === m.id) setOpen(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <button onClick={() => setTab('recus')} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${tab === 'recus' ? 'bg-orange-500/20 text-blue-600 dark:text-orange-400 border-orange-500/30' : 'bg-zinc-50 dark:bg-black/40 text-zinc-600 dark:text-orange-200/60 border-zinc-200 dark:border-orange-500/10 hover:text-zinc-900 dark:hover:text-white'}`}>
            Reçus {nonLus > 0 && <span className="ml-1 bg-orange-500 text-white rounded-full px-1.5 text-[11px]">{nonLus}</span>}
          </button>
          <button onClick={() => setTab('envoyes')} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${tab === 'envoyes' ? 'bg-orange-500/20 text-blue-600 dark:text-orange-400 border-orange-500/30' : 'bg-zinc-50 dark:bg-black/40 text-zinc-600 dark:text-orange-200/60 border-zinc-200 dark:border-orange-500/10 hover:text-zinc-900 dark:hover:text-white'}`}>
            Envoyés
          </button>
        </div>
        <button onClick={() => setComposeOpen(true)} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors">
          <Send size={15} /> Nouveau message
        </button>
      </div>

      {displayed.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm flex flex-col items-center gap-3">
          <Inbox size={32} className="opacity-30" />
          {tab === 'recus' ? 'Aucun message reçu.' : 'Aucun message envoyé.'}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl divide-y divide-orange-500/5">
          {displayed.map((m) => (
            <button key={m.id} onClick={() => openMessage(m)} className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-orange-500/5 transition-colors">
              <div className="mt-0.5 shrink-0">
                {tab === 'recus' && !m.lu ? <Mail size={16} className="text-blue-600 dark:text-orange-400" /> : <MailOpen size={16} className="text-zinc-500" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-sm truncate ${tab === 'recus' && !m.lu ? 'text-zinc-900 dark:text-white font-semibold' : 'text-zinc-800 dark:text-orange-100/70'}`}>{m.sujet}</p>
                </div>
                <p className="text-xs text-zinc-500 dark:text-orange-200/40 mt-0.5 truncate">
                  {tab === 'recus' ? `De ${m.fromNom}` : `À ${m.toNom}`} · {new Date(m.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lecture */}
      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between gap-3 mb-4 shrink-0">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{open.sujet}</h2>
                <p className="text-xs text-zinc-500 dark:text-orange-200/40 mt-1">De {open.fromNom} · À {open.toNom} · {new Date(open.createdAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
              <button onClick={() => setOpen(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white shrink-0"><X size={20} /></button>
            </div>
            <p className="text-zinc-800 dark:text-orange-100/80 text-sm leading-relaxed whitespace-pre-wrap flex-1 min-h-0 overflow-y-auto">{open.corps}</p>
            <div className="flex justify-end mt-6 shrink-0">
              <button onClick={() => handleDelete(open)} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 hover:text-red-400 transition-colors"><Trash2 size={13} /> Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Composer */}
      {composeOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Nouveau message</h2>
              <button onClick={() => setComposeOpen(false)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Destinataire</label>
                <select value={form.toUid} onChange={(e) => setForm((f) => ({ ...f, toUid: e.target.value }))} className={selectCls}>
                  <option value="">{contacts.length ? 'Choisir…' : 'Aucun contact disponible'}</option>
                  {contacts.map((c) => <option key={c.uid} value={c.uid}>{c.displayName} ({c.role === 'teacher' ? 'Enseignant' : c.role === 'parent' ? 'Parent' : 'Étudiant'})</option>)}
                </select>
              </div>
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Objet</label>
                <input value={form.sujet} onChange={(e) => setForm((f) => ({ ...f, sujet: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Message</label>
                <textarea value={form.corps} onChange={(e) => setForm((f) => ({ ...f, corps: e.target.value }))} rows={5} className={`${inputCls} resize-none`} />
              </div>
              </div>

              <div className="flex gap-3 pt-6 shrink-0">
                <button onClick={() => setComposeOpen(false)} disabled={sending} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50">Annuler</button>
                <button onClick={handleSend} disabled={sending || !form.toUid || !form.sujet.trim() || !form.corps.trim()} className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                  {sending ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Send size={14} />}
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MessagesView
