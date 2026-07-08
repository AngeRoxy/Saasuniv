'use client'

import { MessagesView } from '@/components/messages/messages-view'

export default function ParentMessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Messagerie</h1>
        <p className="text-orange-200/40 text-sm mt-1">Échangez avec les enseignants et l’administration.</p>
      </div>
      <MessagesView />
    </div>
  )
}
