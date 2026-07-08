'use client'

import { useAuth } from '@/context/AuthContext'
import { PaymentsView } from '@/components/finances/payments-view'

export default function StudentPaymentsPage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId

  if (!universityId || !user?.uid) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mes paiements</h1>
        <p className="text-orange-200/40 text-sm mt-1">Suivi de votre scolarité et de vos échéances.</p>
      </div>
      <PaymentsView universityId={universityId} studentUid={user.uid} />
    </div>
  )
}
