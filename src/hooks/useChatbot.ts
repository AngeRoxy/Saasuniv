'use client'

import { useCallback, useState } from 'react'
import { auth } from '@/lib/firebase'
import type { ChatContext, ChatMessage } from '@/types/chatbot'

/** Nombre maximum de messages conservés dans l'historique (les plus récents). */
const MAX_HISTORY = 20

interface UseChatbotResult {
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  sendMessage: (content: string) => Promise<void>
  clearHistory: () => void
}

/** Ne garde que les `MAX_HISTORY` messages les plus récents. */
function limitHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.length > MAX_HISTORY ? messages.slice(-MAX_HISTORY) : messages
}

/**
 * Hook client pilotant la conversation avec l'assistant IA.
 *
 * Le message de bienvenue est purement visuel et géré par le widget : il n'est
 * jamais ajouté à l'état ni envoyé à l'API. L'historique réel est plafonné à
 * {@link MAX_HISTORY} messages.
 */
export function useChatbot(context: ChatContext): UseChatbotResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || loading) return

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      }

      // Ajout optimiste du message utilisateur + historique à envoyer.
      const history = limitHistory([...messages, userMessage])
      setMessages(history)
      setLoading(true)
      setError(null)

      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) {
          setError('Vous devez être connecté.')
          return
        }

        const res = await fetch('/api/chatbot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ messages: history, context }),
        })

        const data: { reply?: string; error?: string } = await res
          .json()
          .catch(() => ({}))

        if (!res.ok) {
          setError(data.error ?? "Une erreur est survenue. Veuillez réessayer.")
          return
        }

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply ?? '',
          timestamp: Date.now(),
        }

        setMessages((prev) => limitHistory([...prev, assistantMessage]))
      } catch {
        setError('Connexion impossible. Vérifiez votre réseau et réessayez.')
      } finally {
        setLoading(false)
      }
    },
    [messages, loading, context]
  )

  const clearHistory = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, loading, error, sendMessage, clearHistory }
}

export default useChatbot
