'use client'

import { AnnoncesView } from '@/components/annonces/annonces-view'

export default function ParentAnnoncesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Annonces</h1>
        <p className="text-orange-200/40 text-sm mt-1">Communications de l’université.</p>
      </div>
      <AnnoncesView />
    </div>
  )
}
