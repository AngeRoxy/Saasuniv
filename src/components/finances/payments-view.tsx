'use client'

import { useState, useEffect } from 'react'
import { CreditCard } from 'lucide-react'
import { getPaiementsForStudent, type Paiement } from '@/lib/db'
import { statutAffiche, formatFCFA, type PaiementStatutAffiche } from '@/types/paiement'

const BADGE: Record<PaiementStatutAffiche, string> = {
  'Payé': 'bg-green-500/15 text-green-400 border border-green-500/25',
  'En attente': 'bg-orange-500/15 text-orange-400 border border-orange-500/25',
  'En retard': 'bg-red-500/15 text-red-400 border border-red-500/25',
}

/** Consultation des paiements d'un étudiant (étudiant + parent). */
export function PaymentsView({ universityId, studentUid }: { universityId: string; studentUid: string }) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!universityId || !studentUid) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const list = await getPaiementsForStudent(universityId, studentUid)
        if (active) setPaiements(list)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId, studentUid])

  const totalDu = paiements.reduce((s, p) => s + p.montant, 0)
  const totalPaye = paiements.filter((p) => p.statut === 'Payé').reduce((s, p) => s + p.montant, 0)
  const reste = totalDu - totalPaye

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total dû', value: formatFCFA(totalDu), color: 'text-white' },
          { label: 'Payé', value: formatFCFA(totalPaye), color: 'text-green-400' },
          { label: 'Reste à payer', value: formatFCFA(reste), color: reste > 0 ? 'text-orange-400' : 'text-green-400' },
        ].map((k) => (
          <div key={k.label} className="bg-zinc-950 border border-orange-500/10 rounded-xl p-5">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">{k.label}</p>
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {paiements.length === 0 ? (
        <div className="text-center py-16 text-orange-200/30 text-sm flex flex-col items-center gap-3">
          <CreditCard size={32} className="opacity-30" />
          Aucun paiement enregistré pour l’instant.
        </div>
      ) : (
        <div className="bg-zinc-950 border border-orange-500/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/40 text-orange-300/60 text-xs uppercase tracking-wider border-b border-orange-500/10">
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-left">Échéance</th>
                <th className="px-4 py-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody>
              {paiements.map((p) => {
                const st = statutAffiche(p, today)
                return (
                  <tr key={p.id} className="border-t border-orange-500/5">
                    <td className="px-4 py-3 text-orange-100/80 font-medium">{p.type}</td>
                    <td className="px-4 py-3 text-right text-white font-semibold whitespace-nowrap">{formatFCFA(p.montant)}</td>
                    <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{p.echeance ? new Date(p.echeance).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium ${BADGE[st]}`}>{st}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default PaymentsView
