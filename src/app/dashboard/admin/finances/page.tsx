'use client'

import { useState, useEffect, useMemo, Fragment } from 'react'
import {
  CreditCard, Clock, AlertCircle, TrendingUp, Check, Pencil, Trash2, Plus, X, Search,
  Layers, ChevronDown, ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getPaiements,
  createPaiement,
  updatePaiement,
  deletePaiement,
  createEcheancier,
  getUniversityMembers,
  getFraisScolarite,
  type Paiement,
  type UniversityMember,
  type FraisFiliere,
} from '@/lib/db'
import {
  PAIEMENT_TYPES,
  statutAffiche,
  statutEcheancier,
  regrouperEcheanciers,
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

interface EcheancierTrancheForm {
  montant: string
  echeance: string
}

/** Répartition égale d'un montant total sur n tranches (la dernière absorbe l'arrondi). */
function genererTranches(total: number, n: number): EcheancierTrancheForm[] {
  if (n <= 0) return []
  const base = total > 0 ? Math.floor(total / n) : 0
  return Array.from({ length: n }, (_, i) => {
    const montant = i === n - 1 ? total - base * (n - 1) : base
    return { montant: total > 0 ? String(montant) : '', echeance: '' }
  })
}

/** Une ligne du tableau : soit un échéancier groupé, soit une échéance libre (une seule tranche). */
interface Row {
  key: string
  studentNom: string
  matricule: string
  echeancierId: string | null
  tranches: Paiement[]
  montantTotal: number
  solde: number
  statut: PaiementStatutAffiche
}

export default function FinancesPage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId

  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [students, setStudents] = useState<UniversityMember[]>([])
  const [frais, setFrais] = useState<Record<string, FraisFiliere>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'Tous' | PaiementStatutAffiche>('Tous')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Modal « échéance libre » — édition d'une tranche existante, ou ajout d'un
  // paiement isolé (inscription, examen, cas particulier hors échéancier).
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ studentUid: '', type: 'Scolarité', montant: '', echeance: '', statut: 'En attente' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Paiement | null>(null)

  // Modal « créer un échéancier » — flux principal pour la scolarité.
  const [echModalOpen, setEchModalOpen] = useState(false)
  const [echStudentUid, setEchStudentUid] = useState('')
  const [echMontantTotal, setEchMontantTotal] = useState('')
  const [echNbTranches, setEchNbTranches] = useState(3)
  const [echTranches, setEchTranches] = useState<EcheancierTrancheForm[]>([])
  const [echSaving, setEchSaving] = useState(false)
  const [echError, setEchError] = useState<string | null>(null)

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [pmts, studs, fraisMap] = await Promise.all([
          getPaiements(universityId),
          getUniversityMembers(universityId, 'student'),
          getFraisScolarite(universityId),
        ])
        if (!active) return
        setPaiements(pmts)
        setStudents(studs)
        setFrais(fraisMap)
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

  // KPIs — calculés au niveau des tranches individuelles : la somme est
  // identique qu'un paiement appartienne à un échéancier ou soit libre.
  const totalCollecte = paiements.filter((p) => p.statut === 'Payé').reduce((s, p) => s + p.montant, 0)
  const totalAttendu = paiements.reduce((s, p) => s + p.montant, 0)
  const enAttente = paiements.filter((p) => statutAffiche(p, today) === 'En attente')
  const enRetard = paiements.filter((p) => statutAffiche(p, today) === 'En retard')
  const taux = totalAttendu > 0 ? Math.round((totalCollecte / totalAttendu) * 100) : 0

  // Regroupement par échéancier pour l'affichage : chaque échéancier devient
  // une ligne dépliable, chaque paiement libre reste une ligne simple.
  const rows: Row[] = useMemo(() => {
    const { echeanciers, libres } = regrouperEcheanciers(paiements)
    const out: Row[] = echeanciers.map((g) => ({
      key: `ech-${g.echeancierId}`,
      studentNom: g.tranches[0].studentNom,
      matricule: g.tranches[0].matricule,
      echeancierId: g.echeancierId,
      tranches: g.tranches,
      montantTotal: g.montantTotal,
      solde: g.solde,
      statut: statutEcheancier(g, today),
    }))
    for (const p of libres) {
      out.push({
        key: `libre-${p.id}`,
        studentNom: p.studentNom,
        matricule: p.matricule,
        echeancierId: null,
        tranches: [p],
        montantTotal: p.montant,
        solde: p.statut === 'Payé' ? 0 : p.montant,
        statut: statutAffiche(p, today),
      })
    }
    return out.sort((a, b) => a.studentNom.localeCompare(b.studentNom))
  }, [paiements, today])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter((r) => {
      if (filter !== 'Tous' && r.statut !== filter) return false
      if (q && !r.studentNom.toLowerCase().includes(q) && !r.matricule.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, filter, search])

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

  // ─── Échéancier ────────────────────────────────────────────────────────────

  function openEcheancier() {
    setEchStudentUid('')
    setEchMontantTotal('')
    setEchNbTranches(3)
    setEchTranches(genererTranches(0, 3))
    setEchError(null)
    setEchModalOpen(true)
  }
  function closeEcheancierModal() { setEchModalOpen(false) }

  function handleEchStudentChange(uid: string) {
    setEchStudentUid(uid)
    const student = students.find((s) => s.uid === uid)
    const fraisMatch = student?.filiere
      ? Object.values(frais).find((f) => f.filiereNom === student.filiere)
      : undefined
    const total = fraisMatch?.montant ?? 0
    setEchMontantTotal(total > 0 ? String(total) : '')
    setEchTranches(genererTranches(total, echNbTranches))
    setEchError(null)
  }
  function handleEchNbTranchesChange(n: number) {
    setEchNbTranches(n)
    setEchTranches(genererTranches(Number(echMontantTotal) || 0, n))
  }
  function repartirEgalement() {
    setEchTranches(genererTranches(Number(echMontantTotal) || 0, echNbTranches))
  }
  function updateTranche(i: number, field: keyof EcheancierTrancheForm, value: string) {
    setEchTranches((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)))
  }

  const echStudent = students.find((s) => s.uid === echStudentUid)
  const echFraisMatch = echStudent?.filiere
    ? Object.values(frais).find((f) => f.filiereNom === echStudent.filiere)
    : undefined
  const echTotalNum = Number(echMontantTotal) || 0
  const echSomme = echTranches.reduce((s, t) => s + (Number(t.montant) || 0), 0)
  const echEcart = echSomme - echTotalNum

  async function handleSaveEcheancier() {
    if (!universityId) return
    const student = students.find((s) => s.uid === echStudentUid)
    if (!student) { setEchError('Choisissez un étudiant.'); return }
    if (!echMontantTotal || echTotalNum <= 0) { setEchError('Montant total invalide.'); return }
    if (echTranches.length === 0) { setEchError('Définissez au moins une tranche.'); return }
    for (let i = 0; i < echTranches.length; i++) {
      const t = echTranches[i]
      const m = Number(t.montant)
      if (!t.montant || Number.isNaN(m) || m <= 0) { setEchError(`Montant invalide pour la tranche ${i + 1}.`); return }
      if (!t.echeance) { setEchError(`Renseignez la date d’échéance de la tranche ${i + 1}.`); return }
    }

    setEchSaving(true)
    setEchError(null)
    try {
      await createEcheancier(universityId, {
        studentUid: student.uid,
        studentNom: student.displayName,
        matricule: student.matricule ?? '',
        tranches: echTranches.map((t) => ({ montant: Number(t.montant), echeance: t.echeance })),
      })
      await refresh()
      closeEcheancierModal()
    } catch {
      setEchError('Échec de la création de l’échéancier.')
    } finally {
      setEchSaving(false)
    }
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="flex gap-2 shrink-0 sm:ml-auto">
            <button onClick={openAdd} className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-orange-500/20 text-zinc-600 dark:text-orange-200/70 hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white text-sm font-medium transition-colors">
              <Plus size={15} /> Échéance libre
            </button>
            <button onClick={openEcheancier} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors">
              <Layers size={15} /> Créer un échéancier
            </button>
          </div>
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
                  {rows.length === 0 ? 'Aucun paiement enregistré. Créez un échéancier ou ajoutez une échéance libre.' : 'Aucun paiement ne correspond aux filtres.'}
                </td></tr>
              ) : filtered.map((row) => {
                if (!row.echeancierId) {
                  const p = row.tranches[0]
                  const st = row.statut
                  return (
                    <tr key={row.key} className="border-t border-orange-500/5 hover:bg-orange-500/5 transition-colors">
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
                }

                const isExpanded = expanded.has(row.echeancierId)
                return (
                  <Fragment key={row.key}>
                    <tr onClick={() => toggleExpanded(row.echeancierId!)}
                      className="border-t border-orange-500/5 bg-orange-500/3 hover:bg-orange-500/6 transition-colors cursor-pointer">
                      <td className="px-5 py-3.5">
                        <p className="text-zinc-900 dark:text-white text-sm font-medium leading-none">{row.studentNom}</p>
                        {row.matricule && <p className="text-zinc-500 text-xs font-mono mt-0.5">{row.matricule}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-blue-700 dark:text-orange-300 text-sm font-medium">
                        <div className="flex items-center gap-1.5">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          Échéancier · {row.tranches.length} tranche{row.tranches.length > 1 ? 's' : ''}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right text-zinc-900 dark:text-white font-semibold whitespace-nowrap">{formatFCFA(row.montantTotal)}</td>
                      <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">Solde {formatFCFA(row.solde)}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap ${BADGE[row.statut]}`}>{row.statut}</span>
                      </td>
                      <td className="px-5 py-3.5" />
                    </tr>
                    {isExpanded && row.tranches.map((p, idx) => {
                      const st = statutAffiche(p, today)
                      return (
                        <tr key={p.id} className="border-t border-orange-500/5 bg-black/1.5 dark:bg-white/2">
                          <td className="px-5 py-2.5 pl-10 text-zinc-500 text-xs">Tranche {idx + 1}</td>
                          <td className="px-5 py-2.5 text-zinc-600 dark:text-zinc-400 text-xs">{p.type}</td>
                          <td className="px-5 py-2.5 text-right text-zinc-800 dark:text-zinc-200 text-sm whitespace-nowrap">{formatFCFA(p.montant)}</td>
                          <td className="px-5 py-2.5 text-zinc-600 dark:text-zinc-400 text-sm whitespace-nowrap">{p.echeance ? new Date(p.echeance).toLocaleDateString('fr-FR') : '—'}</td>
                          <td className="px-5 py-2.5 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium whitespace-nowrap ${BADGE[st]}`}>{st}</span>
                          </td>
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-1 justify-center">
                              {p.statut !== 'Payé' && (
                                <button onClick={(e) => { e.stopPropagation(); markPaid(p) }} title="Marquer payé" className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-green-400 hover:bg-green-500/10"><Check size={13} /></button>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); openEdit(p) }} title="Modifier" className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-blue-800 dark:hover:text-orange-400 hover:bg-orange-500/10"><Pencil size={12} /></button>
                              <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(p) }} title="Supprimer" className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-orange-500/10 text-xs text-zinc-600">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''} · {rows.length} au total</div>
      </div>

      {/* Modal échéance libre */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{editId ? 'Modifier le paiement' : 'Ajouter une échéance libre'}</h2>
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

      {/* Modal créer un échéancier */}
      {echModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Créer un échéancier</h2>
              <button onClick={closeEcheancierModal} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
                <Field label="Étudiant">
                  <select value={echStudentUid} onChange={(e) => handleEchStudentChange(e.target.value)} className={selectCls}>
                    <option value="">{students.length ? 'Choisir…' : 'Aucun étudiant inscrit'}</option>
                    {students.map((s) => <option key={s.uid} value={s.uid}>{s.displayName}{s.matricule ? ` (${s.matricule})` : ''}</option>)}
                  </select>
                </Field>

                {echStudentUid && (
                  <p className="text-xs text-zinc-500 dark:text-orange-200/40 -mt-2">
                    {echFraisMatch
                      ? `Frais de scolarité (${echStudent?.filiere}) : ${formatFCFA(echFraisMatch.montant)} — pré-rempli, modifiable.`
                      : `Aucun frais configuré pour la filière de cet étudiant${echStudent?.filiere ? ` (${echStudent.filiere})` : ''} — saisissez le montant manuellement.`}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Montant total (FCFA)">
                    <input type="number" min={0} value={echMontantTotal} onChange={(e) => setEchMontantTotal(e.target.value)} placeholder="450000" className={inputCls} />
                  </Field>
                  <Field label="Nombre de tranches">
                    <input type="number" min={1} max={12} value={echNbTranches} onChange={(e) => handleEchNbTranchesChange(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
                  </Field>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium">Tranches</p>
                  <button type="button" onClick={repartirEgalement} className="text-xs text-blue-700 dark:text-orange-400 hover:underline">Répartir également</button>
                </div>
                <div className="space-y-2.5">
                  {echTranches.map((t, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <input type="number" min={0} value={t.montant} onChange={(e) => updateTranche(i, 'montant', e.target.value)} placeholder="Montant" className={inputCls} />
                      <input type="date" value={t.echeance} onChange={(e) => updateTranche(i, 'echeance', e.target.value)} className={`${inputCls} scheme-dark`} />
                      <span className="text-zinc-500 text-xs w-14 text-right">Tranche {i + 1}</span>
                    </div>
                  ))}
                </div>

                {echTotalNum > 0 && echEcart !== 0 && (
                  <p className="text-orange-500 text-xs bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2.5">
                    La somme des tranches ({formatFCFA(echSomme)}) ne correspond pas au montant total ({formatFCFA(echTotalNum)}) — écart de {formatFCFA(Math.abs(echEcart))}. Vous pouvez continuer si c’est volontaire (bourse, cas particulier…).
                  </p>
                )}
                {echError && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{echError}</p>}
              </div>

              <div className="flex gap-3 pt-6 shrink-0">
                <button onClick={closeEcheancierModal} disabled={echSaving} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50">Annuler</button>
                <button onClick={handleSaveEcheancier} disabled={echSaving} className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                  {echSaving && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  Créer l’échéancier
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
