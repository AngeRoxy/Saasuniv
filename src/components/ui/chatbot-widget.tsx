'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, Sparkles, X, Send } from 'lucide-react'
import { ref, get } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useChatbot } from '@/hooks/useChatbot'
import { PlanGate } from '@/components/ui/plan-gate'
import type { ChatContext } from '@/types/chatbot'
import { cn } from '@/lib/utils'

interface ChatbotWidgetProps {
  universityId: string
  /**
   * Parent : uid de l'enfant sélectionné dans le tableau de bord, pour que
   * l'assistant réponde sur le bon enfant. Ignoré pour les autres rôles.
   */
  enfantUid?: string
  className?: string
}

const WELCOME =
  'Bonjour ! Je suis votre assistant GestUniv. Comment puis-je vous aider aujourd’hui ?'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Petit avatar IA réutilisé dans le header et les bulles assistant. */
function AiAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
  const icon = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-orange-500/20',
        dim
      )}
    >
      <Sparkles className={cn('text-blue-600 dark:text-orange-400', icon)} />
    </div>
  )
}

export function ChatbotWidget({ universityId, enfantUid, className }: ChatbotWidgetProps) {
  const { user, profile } = useAuth()
  const [plan, setPlan] = useState<string | null>(null)
  const [planLoaded, setPlanLoaded] = useState(false)
  const [universityName, setUniversityName] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)

  // Lecture du plan (et du nom) — uniquement côté client.
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [planSnap, nameSnap] = await Promise.all([
          get(ref(db, `universities/${universityId}/plan`)),
          get(ref(db, `universities/${universityId}/name`)),
        ])
        if (!active) return
        setPlan(planSnap.exists() ? String(planSnap.val()) : null)
        setUniversityName(nameSnap.exists() ? String(nameSnap.val()) : null)
      } catch {
        if (active) setPlan(null)
      } finally {
        if (active) setPlanLoaded(true)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [universityId])

  const context = useMemo<ChatContext>(
    () => ({
      universityId,
      userId: user?.uid ?? '',
      role: profile?.role ?? '',
      nomUniversite: universityName ?? universityId,
      enfantUid,
    }),
    [universityId, user?.uid, profile?.role, universityName, enfantUid]
  )

  const { messages, loading, error, sendMessage } = useChatbot(context)

  // Scroll automatique vers le bas à chaque nouveau message ou frappe.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, open])

  // Plan « standard » : aucun chatbot. On attend aussi le chargement pour
  // éviter un flash du bouton.
  if (!planLoaded || plan === 'standard') return null

  function handleSend() {
    const value = input
    setInput('')
    void sendMessage(value)
  }

  return (
    <PlanGate feature="chatbotIA" universityId={universityId} showUpgradePrompt={false}>
      {/* Bouton flottant */}
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            aria-label="Ouvrir l’assistant GestUniv"
            className={cn(
              'fixed bottom-6 right-6 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/40 transition-colors hover:bg-orange-400',
              className
            )}
          >
            <MessageCircle className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panneau de chat */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'fixed bottom-6 right-6 z-50 flex h-130 w-95 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-900/95 text-zinc-800 dark:text-zinc-100 shadow-2xl backdrop-blur',
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-white/10 px-4 py-3">
              <AiAvatar />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-50">
                  Assistant GestUniv
                </p>
                <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">Propulsé par Claude</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Zone messages */}
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              {/* Bulle de bienvenue (visuelle uniquement) */}
              <div className="flex items-end gap-2 self-start">
                <AiAvatar size="sm" />
                <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-white dark:bg-white/5 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100">
                  {WELCOME}
                </div>
              </div>

              {messages.map((msg) =>
                msg.role === 'user' ? (
                  <div key={msg.id} className="flex flex-col items-end self-end">
                    <div className="max-w-[80%] whitespace-pre-wrap wrap-break rounded-2xl rounded-br-sm bg-orange-500/20 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-50">
                      {msg.content}
                    </div>
                    <span className="mt-1 text-[10px] text-zinc-500">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                ) : (
                  <div key={msg.id} className="flex flex-col items-start self-start">
                    <div className="flex items-end gap-2">
                      <AiAvatar size="sm" />
                      <div className="max-w-[80%] whitespace-pre-wrap wrap-break rounded-2xl rounded-bl-sm bg-white dark:bg-white/5 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100">
                        {msg.content}
                      </div>
                    </div>
                    <span className="ml-8 mt-1 text-[10px] text-zinc-500">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                )
              )}

              {/* Indicateur de frappe */}
              {loading && (
                <div className="flex items-end gap-2 self-start">
                  <AiAvatar size="sm" />
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white dark:bg-white/5 px-3 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="block h-1.5 w-1.5 rounded-full bg-zinc-400"
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                        transition={{
                          duration: 0.9,
                          repeat: Infinity,
                          delay: i * 0.15,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="self-start rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {error}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Zone de saisie */}
            <div className="border-t border-zinc-200 dark:border-white/10 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  rows={1}
                  placeholder="Écrivez votre message…"
                  className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/40"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  aria-label="Envoyer"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PlanGate>
  )
}

export default ChatbotWidget
