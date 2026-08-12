'use client'

import { useState, useEffect, useMemo } from 'react'
import { CreditCard, Layers } from 'lucide-react'
import { getPaiementsForStudent, type Paiement } from '@/lib/db'
import {
  statutAffiche,
  statutEcheancier,
  regrouperEcheanciers,
  prochaineEcheanceNonPayee,
  formatFCFA,
  type PaiementStatutAffiche,
} from '@/types/paiement'

const BADGE: Record<PaiementStatutAffiche, string> = {
  'Payé': 'bg-green-500/15 text-green-400 border border-green-500/25',
  'En attente': 'bg-orange-500/15 text-blue-600 dark:text-orange-400 border border-orange-500/25',
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
  const prochaine = useMemo(() => prochaineEcheanceNonPayee(paiements), [paiements])

  // Échéanciers structurés (tranches liées) et paiements libres (anciens, ou
  // hors scolarité planifiée) sont affichés séparément — jamais reconstitués
  // de force en un échéancier.
  const { echeanciers, libres } = useMemo(() => regrouperEcheanciers(paiements), [paiements])

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total dû', value: formatFCFA(totalDu), color: 'text-zinc-900 dark:text-white' },
          { label: 'Payé', value: formatFCFA(totalPaye), color: 'text-green-400' },
          { label: 'Reste à payer', value: formatFCFA(reste), color: reste > 0 ? 'text-blue-600 dark:text-orange-400' : 'text-green-400' },
        ].map((k) => (
          <div key={k.label} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-5">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">{k.label}</p>
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {prochaine && (
        <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-blue-800 dark:text-orange-200/80">
            Prochaine échéance : <span className="font-semibold text-zinc-900 dark:text-white">{formatFCFA(prochaine.montant)}</span> le {new Date(prochaine.echeance).toLocaleDateString('fr-FR')}
          </p>
        </div>
      )}

      {paiements.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm flex flex-col items-center gap-3">
          <CreditCard size={32} className="opacity-30" />
          Aucun paiement enregistré pour l’instant.
        </div>
      ) : (
        <>
          {echeanciers.map((g) => {
            const st = statutEcheancier(g, today)
            return (
              <div key={g.echeancierId} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-orange-500/10 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                    <Layers size={15} className="text-blue-600 dark:text-orange-400" />
                    Échéancier scolarité
                    <span className="text-xs font-normal text-zinc-500">· {g.tranches.length} tranche{g.tranches.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-zinc-600 dark:text-zinc-400">Total {formatFCFA(g.montantTotal)}</span>
                    <span className="text-zinc-600 dark:text-zinc-400">Solde {formatFCFA(g.solde)}</span>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap ${BADGE[st]}`}>{st}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {g.tranches.map((p, idx) => {
                        const pst = statutAffiche(p, today)
                        const isProchaine = prochaine?.id === p.id
                        return (
                          <tr key={p.id} className="border-t border-orange-500/5 first:border-t-0">
                            <td className="px-4 py-2.5 text-zinc-500 text-xs w-24">Tranche {idx + 1}</td>
                            <td className="px-4 py-2.5 text-right text-zinc-900 dark:text-white font-semibold whitespace-nowrap">{formatFCFA(p.montant)}</td>
                            <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                              {p.echeance ? new Date(p.echeance).toLocaleDateString('fr-FR') : '—'}
                              {isProchaine && <span className="ml-2 text-[10px] text-blue-600 dark:text-orange-400 font-medium">Prochaine</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium ${BADGE[pst]}`}>{pst}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          {libres.length > 0 && (
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
              {echeanciers.length > 0 && (
                <div className="px-5 py-3 border-b border-zinc-200 dark:border-orange-500/10 text-xs font-medium text-zinc-500 dark:text-orange-200/40 uppercase tracking-wider">
                  Autres paiements
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-black/40 text-blue-700 dark:text-orange-300/60 text-xs uppercase tracking-wider border-b border-zinc-200 dark:border-orange-500/10">
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-right">Montant</th>
                      <th className="px-4 py-3 text-left">Échéance</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {libres.map((p) => {
                      const st = statutAffiche(p, today)
                      return (
                        <tr key={p.id} className="border-t border-orange-500/5">
                          <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/80 font-medium">{p.type}</td>
                          <td className="px-4 py-3 text-right text-zinc-900 dark:text-white font-semibold whitespace-nowrap">{formatFCFA(p.montant)}</td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{p.echeance ? new Date(p.echeance).toLocaleDateString('fr-FR') : '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium ${BADGE[st]}`}>{st}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default PaymentsView
