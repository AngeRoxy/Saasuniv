'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'

/**
 * Page de retour post-paiement GeniusPay (succès déclaré côté client).
 * La confirmation FIABLE reste le webhook `/api/geniuspay/webhook`, seul
 * habilité à faire passer le plan à jour — cette page n'affirme donc jamais
 * que l'abonnement a changé, seulement que le paiement a été transmis.
 */
export default function BillingSuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-zinc-200 dark:border-orange-500/10 bg-white dark:bg-zinc-950 px-6 py-16 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Paiement transmis</h1>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        Votre paiement a été transmis à GeniusPay. La mise à jour de votre plan
        peut prendre quelques instants le temps que la confirmation nous
        parvienne — consultez l'historique des paiements pour suivre son statut.
      </p>
      <Link
        href="/dashboard/admin/billing"
        className="mt-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
      >
        Retour à la facturation
      </Link>
    </div>
  )
}
