'use client'

import { useState, useEffect, useMemo } from 'react'
import { Shield, UserPlus, Bell, CreditCard, CalendarX, FolderOpen, CalendarClock, Search } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { PlanGate } from '@/components/ui/plan-gate'
import {
  getUniversityMembers,
  getAnnonces,
  getPaiements,
  getAbsences,
  getRessources,
  getCreneaux,
  getFilieres,
} from '@/lib/db'
import { formatFCFA } from '@/types/paiement'

type EntryType = 'membre' | 'annonce' | 'paiement' | 'absence' | 'ressource' | 'creneau'

interface Entry {
  id: string
  type: EntryType
  label: string
  detail: string
  ts: number
}

const TYPE_CONFIG: Record<EntryType, { icon: React.ElementType; color: string; label: string }> = {
  membre: { icon: UserPlus, color: 'text-green-400', label: 'Inscription' },
  annonce: { icon: Bell, color: 'text-blue-400', label: 'Annonce' },
  paiement: { icon: CreditCard, color: 'text-amber-400', label: 'Paiement' },
  absence: { icon: CalendarX, color: 'text-red-400', label: 'Absence' },
  ressource: { icon: FolderOpen, color: 'text-purple-400', label: 'Ressource' },
  creneau: { icon: CalendarClock, color: 'text-orange-400', label: 'Emploi du temps' },
}
const FILTRES: ('Tous' | EntryType)[] = ['Tous', 'membre', 'annonce', 'paiement', 'absence', 'ressource', 'creneau']
const roleLabel: Record<string, string> = { student: 'Étudiant', teacher: 'Enseignant', parent: 'Parent' }

function AuditContent({ universityId }: { universityId: string }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<'Tous' | EntryType>('Tous')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [members, annonces, paiements, absences, ressources, creneaux, filieres] = await Promise.all([
          getUniversityMembers(universityId),
          getAnnonces(universityId),
          getPaiements(universityId),
          getAbsences(universityId),
          getRessources(universityId),
          getCreneaux(universityId),
          getFilieres(universityId),
        ])
        if (!active) return
        const filiereNom = new Map(filieres.map((f) => [f.id, f.nom]))
        const all: Entry[] = [
          ...members.map((m) => ({ id: `m-${m.uid}`, type: 'membre' as const, label: `${m.displayName} (${roleLabel[m.role] ?? m.role})`, detail: m.email, ts: m.createdAt })),
          ...annonces.map((a) => ({ id: `a-${a.id}`, type: 'annonce' as const, label: a.titre, detail: `Par ${a.auteur}`, ts: a.createdAt })),
          ...paiements.map((p) => ({ id: `p-${p.id}`, type: 'paiement' as const, label: `${p.type} — ${p.studentNom}`, detail: `${formatFCFA(p.montant)} · ${p.statut}`, ts: p.createdAt })),
          ...absences.map((ab) => ({ id: `ab-${ab.id}`, type: 'absence' as const, label: `${ab.studentNom}`, detail: `${ab.matiere || 'Séance'} · ${ab.justifiee ? 'justifiée' : 'non justifiée'}`, ts: ab.createdAt })),
          ...ressources.map((r) => ({ id: `r-${r.id}`, type: 'ressource' as const, label: r.titre, detail: `Par ${r.auteur}`, ts: r.createdAt })),
          ...creneaux.map((c) => ({ id: `c-${c.id}`, type: 'creneau' as const, label: `${c.matiere}`, detail: `${filiereNom.get(c.filiereId) ?? ''} ${c.niveau}`.trim(), ts: c.createdAt })),
        ]
        setEntries(all.sort((x, y) => y.ts - x.ts))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return entries.filter((e) => {
      if (filtre !== 'Tous' && e.type !== filtre) return false
      if (q && !e.label.toLowerCase().includes(q) && !e.detail.toLowerCase().includes(q)) return false
      return true
    })
  }, [entries, filtre, search])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Shield size={22} className="text-orange-400" /> Journal d’activité
        </h1>
        <p className="text-orange-200/40 text-sm mt-1">Historique des actions réelles enregistrées dans votre université.</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
            className="bg-black/40 border border-orange-500/20 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 text-sm w-60" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTRES.map((f) => (
            <button key={f} onClick={() => setFiltre(f)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${filtre === f ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-black/40 text-orange-200/60 border-orange-500/10 hover:text-white'}`}>
              {f === 'Tous' ? 'Tous' : TYPE_CONFIG[f].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-orange-200/30 text-sm">Aucune activité enregistrée pour l’instant.</div>
      ) : (
        <div className="bg-zinc-950 border border-orange-500/10 rounded-xl divide-y divide-orange-500/5">
          {filtered.map((e) => {
            const cfg = TYPE_CONFIG[e.type]
            const Icon = cfg.icon
            return (
              <div key={e.id} className="flex items-start gap-4 px-5 py-3.5">
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0"><Icon size={16} className={cfg.color} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-medium ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-sm text-orange-100/80 truncate">{e.label}</span>
                  </div>
                  <p className="text-xs text-orange-200/40 mt-0.5">{e.detail}</p>
                </div>
                <span className="text-xs text-orange-200/30 shrink-0 whitespace-nowrap">{e.ts ? new Date(e.ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function AuditPage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId ?? ''
  return (
    <PlanGate feature="auditLogs" universityId={universityId}>
      {universityId ? <AuditContent universityId={universityId} /> : null}
    </PlanGate>
  )
}
