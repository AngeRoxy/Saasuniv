'use client'

import { useState, useEffect, useMemo } from 'react'
import { CreditCard, Clock, AlertCircle, TrendingUp, Check, Pencil, Trash2, Plus, X, Search } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getPaiements,
  createPaiement,
  updatePaiement,
  deletePaiement,
  getUniversityMembers,
  type Paiement,
  type UniversityMember,
} from '@/lib/db'
import {
  PAIEMENT_TYPES,
  statutAffiche,
  formatFCFA,
  type PaiementType,
  type PaiementStatut,
  type PaiementStatutAffiche,
} from '@/types/paiement'

const BADGE: Record<PaiementStatutAffiche, string> = {
  'Payé': 'bg-green-500/15 text-green-400 border border-green-500/25',
  'En attente': 'bg-orange-500/15 text-blue-600 dark:text-orange-400 border border-orange-500/25',
  'En retard': 'bg-red-500/15 text-red-400 border border-red-500/25',
}
const FILTERS: ('Tous' | PaiementStatutAffiche)[] = ['Tous', 'Payé', 'En attente', 'En retard']

interface FormState {
  studentUid: string
  type: PaiementType
  montant: string
  echeance: string
  statut: PaiementStatut
}

export default function FinancesPage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId

  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [students, setStudents] = useState<UniversityMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'Tous' | PaiementStatutAffiche>('Tous')

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ studentUid: '', type: 'Scolarité', montant: '', echeance: '', statut: 'En attente' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Paiement | null>(null)

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [pmts, studs] = await Promise.all([
          getPaiements(universityId),
          getUniversityMembers(universityId, 'student'),
        ])
        if (!active) return
        setPaiements(pmts)
        setStudents(studs)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId])

  async function refresh() {
    if (!universityId) return
    setPaiements(await getPaiements(universityId))
  }

  // KPIs
  const totalCollecte = paiements.filter((p) => p.statut === 'Payé').reduce((s, p) => s + p.montant, 0)
  const totalAttendu = paiements.reduce((s, p) => s + p.montant, 0)
  const enAttente = paiements.filter((p) => statutAffiche(p, today) === 'En attente')
  const enRetard = paiements.filter((p) => statutAffiche(p, today) === 'En retard')
  const taux = totalAttendu > 0 ? Math.round((totalCollecte / totalAttendu) * 100) : 0

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return paiements.filter((p) => {
      const st = statutAffiche(p, today)
      if (filter !== 'Tous' && st !== filter) return false
      if (q && !p.studentNom.toLowerCase().includes(q) && !p.matricule.toLowerCase().includes(q)) return false
      return true
    })
  }, [paiements, filter, search, today])

  function openAdd() {
    setEditId(null)
    setForm({ studentUid: '', type: 'Scolarité', montant: '', echeance: '', statut: 'En attente' })
    setFormError(null)
    setModalOpen(true)
  }
  function openEdit(p: Paiement) {
    setEditId(p.id)
    setForm({ studentUid: p.studentUid, type: p.type, montant: String(p.montant), echeance: p.echeance, statut: p.statut })
    setFormError(null)
    setModalOpen(true)
  }
  function closeModal() { setModalOpen(false); setEditId(null); setFormError(null) }

  async function handleSave() {
    if (!universityId) return
    const student = students.find((s) => s.uid === form.studentUid)
    if (!student) { setFormError('Choisissez un étudiant.'); return }
    const montant = Number(form.montant)
    if (!form.montant || Number.isNaN(montant) || montant < 0) { setFormError('Montant invalide.'); return }
    if (!form.echeance) { setFormError('Renseignez une échéance.'); return }

    setSaving(true)
    setFormError(null)
    try {
      const data = {
        studentUid: student.uid,
        studentNom: student.displayName,
        matricule: student.matricule ?? '',
        type: form.type,
        montant,
        echeance: form.echeance,
        statut: form.statut,
      }
      if (editId) await updatePaiement(universityId, editId, data)
      else await createPaiement(universityId, data)
      await refresh()
      closeModal()
    } catch {
      setFormError('Échec de l’enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  async function markPaid(p: Paiement) {
    if (!universityId) return
    await updatePaiement(universityId, p.id, { statut: 'Payé' })
    await refresh()
  }
  async function handleDelete() {
    if (!universityId || !deleteTarget) return
    await deletePaiement(universityId, deleteTarget.id)
    await refresh()
    setDeleteTarget(null)
  }

  if (profile && profile.role !== 'admin_universite' && profile.role !== 'super_admin_plateforme') {
    return <div className="flex items-center justify-center h-64 text-blue-700 dark:text-orange-300/60 text-sm">Accès réservé aux administrateurs.</div>
  }
  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  const kpis = [
    { label: 'Total collecté', value: formatFCFA(totalCollecte), icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'En attente', value: `${enAttente.length} · ${formatFCFA(enAttente.reduce((s, p) => s + p.montant, 0))}`, icon: Clock, color: 'text-blue-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Taux de recouvrement', value: `${taux} %`, icon: CreditCard, color: 'text-zinc-700 dark:text-zinc-300', bg: 'bg-white dark:bg-white/5' },
    { label: 'En retard', value: `${enRetard.length} dossier${enRetard.length !== 1 ? 's' : ''}`, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${k.bg} flex items-center justify-center shrink-0`}><k.icon size={20} className={k.color} /></div>
            <div className="min-w-0">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">{k.label}</p>
              <p className={`text-base font-bold truncate ${k.color}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-orange-500/10 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un étudiant…"
              className="w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/60" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-orange-500 text-white' : 'bg-zinc-50 dark:bg-black/40 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-orange-500/10'}`}>{f}</button>
            ))}
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shrink-0 sm:ml-auto">
            <Plus size={15} /> Ajouter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-black/30 text-blue-700 dark:text-orange-300/60 text-xs uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Étudiant</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-right">Montant</th>
                <th className="px-5 py-3 text-left">Échéance</th>
                <th className="px-5 py-3 text-center">Statut</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-zinc-600 text-sm">
                  {paiements.length === 0 ? 'Aucun paiement enregistré. Cliquez sur « Ajouter ».' : 'Aucun paiement ne correspond aux filtres.'}
                </td></tr>
              ) : filtered.map((p) => {
                const st = statutAffiche(p, today)
                return (
                  <tr key={p.id} className="border-t border-orange-500/5 hover:bg-orange-500/5 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-zinc-900 dark:text-white text-sm font-medium leading-none">{p.studentNom}</p>
                      {p.matricule && <p className="text-zinc-500 text-xs font-mono mt-0.5">{p.matricule}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400">{p.type}</td>
                    <td className="px-5 py-3.5 text-right text-zinc-900 dark:text-white font-semibold whitespace-nowrap">{formatFCFA(p.montant)}</td>
                    <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{p.echeance ? new Date(p.echeance).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap ${BADGE[st]}`}>{st}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-center">
                        {p.statut !== 'Payé' && (
                          <button onClick={() => markPaid(p)} title="Marquer payé" className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-green-400 hover:bg-green-500/10"><Check size={14} /></button>
                        )}
                        <button onClick={() => openEdit(p)} title="Modifier" className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-blue-800 dark:hover:text-orange-400 hover:bg-orange-500/10"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteTarget(p)} title="Supprimer" className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-orange-500/10 text-xs text-zinc-600">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''} · {paiements.length} au total</div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{editId ? 'Modifier le paiement' : 'Ajouter un paiement'}</h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
              <Field label="Étudiant">
                <select value={form.studentUid} onChange={(e) => setForm((f) => ({ ...f, studentUid: e.target.value }))} className={selectCls}>
                  <option value="">{students.length ? 'Choisir…' : 'Aucun étudiant inscrit'}</option>
                  {students.map((s) => <option key={s.uid} value={s.uid}>{s.displayName}{s.matricule ? ` (${s.matricule})` : ''}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Type">
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PaiementType }))} className={selectCls}>
                    {PAIEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Statut">
                  <select value={form.statut} onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value as PaiementStatut }))} className={selectCls}>
                    <option value="En attente">En attente</option>
                    <option value="Payé">Payé</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Montant (FCFA)">
                  <input type="number" min={0} value={form.montant} onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))} placeholder="150000" className={inputCls} />
                </Field>
                <Field label="Échéance">
                  <input type="date" value={form.echeance} onChange={(e) => setForm((f) => ({ ...f, echeance: e.target.value }))} className={`${inputCls} scheme-dark`} />
                </Field>
              </div>
              {formError && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{formError}</p>}
              </div>

              <div className="flex gap-3 pt-6 shrink-0">
                <button onClick={closeModal} disabled={saving} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50">Annuler</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                  {saving && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  {editId ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-red-500/20 rounded-2xl p-7 w-full max-w-sm flex flex-col max-h-[90vh]">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white mb-2 shrink-0">Supprimer ce paiement ?</h2>
            <p className="text-zinc-800 dark:text-orange-100/55 text-sm mb-6 flex-1 min-h-0 overflow-y-auto">{deleteTarget.studentNom} — {formatFCFA(deleteTarget.montant)} ({deleteTarget.type})</p>
            <div className="flex gap-3 shrink-0">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors">Annuler</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-zinc-500 dark:placeholder:text-orange-200/25'
const selectCls = 'w-full bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">{label}</label>
      {children}
    </div>
  )
}
