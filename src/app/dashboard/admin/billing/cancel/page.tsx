'use client'

import Link from 'next/link'
import { XCircle } from 'lucide-react'

export default function BillingCancelPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-zinc-200 dark:border-orange-500/10 bg-white dark:bg-zinc-950 px-6 py-16 text-center">
      <XCircle className="h-8 w-8 text-red-400" />
      <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Paiement annulé</h1>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        Le paiement a été annulé ou n'a pas abouti. Votre plan actuel n'a pas
        changé — vous pouvez réessayer à tout moment.
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
