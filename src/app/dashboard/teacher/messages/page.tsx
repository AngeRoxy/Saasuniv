'use client'

import { MessagesView } from '@/components/messages/messages-view'

export default function TeacherMessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Messagerie</h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">Échangez avec les étudiants, parents et collègues.</p>
      </div>
      <MessagesView />
    </div>
  )
}
