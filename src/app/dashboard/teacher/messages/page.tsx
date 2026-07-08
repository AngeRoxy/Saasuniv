'use client'

import { MessagesView } from '@/components/messages/messages-view'

export default function TeacherMessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Messagerie</h1>
        <p className="text-orange-200/40 text-sm mt-1">Échangez avec les étudiants, parents et collègues.</p>
      </div>
      <MessagesView />
    </div>
  )
}
