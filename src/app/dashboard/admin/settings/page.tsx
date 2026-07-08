'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Save, Shield, Globe, ChevronRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usePlan } from '@/hooks/usePlan'
import { getFilieres } from '@/lib/db'
import type { Filiere } from '@/types/filiere'
import { PlanBadge } from '@/components/ui/plan-badge'
import { PlanGate } from '@/components/ui/plan-gate'

export default function SettingsPage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId ?? ''
  const { plan } = usePlan(universityId)
  const [sousDomaine, setSousDomaine] = useState('')
  const [info, setInfo] = useState({ nom: 'Université Félix Houphouët-Boigny', pays: 'Côte d\'Ivoire', type: 'Publique', slug: 'ufhb', annee: '2024-2025' })
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [frais, setFrais] = useState<{ filiereId: string; filiere: string; montant: number }[]>([])
  const [calendrier, setCalendrier] = useState({ rentree: '2024-10-07', examsS1: '2025-01-20', vacances: '2025-02-10', examsS2: '2025-06-09', cloture: '2025-07-31' })
  const [confirmText, setConfirmText] = useState('')
  const [showDanger, setShowDanger] = useState(false)

  // Filières chargées depuis Firebase (gérées dans Filières & Matières).
  // Les frais de scolarité s'alignent sur ces filières réelles.
  useEffect(() => {
    if (!universityId) return
    getFilieres(universityId)
      .then((list) => {
        setFilieres(list)
        setFrais(list.map((f) => ({ filiereId: f.id, filiere: f.nom, montant: 0 })))
      })
      .catch(() => { setFilieres([]); setFrais([]) })
  }, [universityId])

  function handleSaveInfo() { alert('Informations générales sauvegardées.') }
  function handleSaveFrais() { alert('Frais de scolarité mis à jour.') }
  function handleSaveCalendrier() { alert('Calendrier académique sauvegardé.') }

  function handleCloture() {
    if (confirmText !== 'CLOTURE-2025') return alert('Texte de confirmation incorrect.')
    alert('Année académique 2024-2025 clôturée avec succès.')
    setShowDanger(false)
    setConfirmText('')
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Paramètres de l&apos;université</h1>
        <p className="text-orange-200/40 text-sm mt-1">Configuration générale et académique</p>
      </div>

      {/* Informations générales */}
      <div className="bg-zinc-950 border border-orange-500/10 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Informations générales</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-orange-200/60 text-xs font-medium block mb-1.5">Nom de l&apos;université</label>
              <input value={info.nom} onChange={e => setInfo(i => ({ ...i, nom: e.target.value }))} className="w-full bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-400/60" />
            </div>
            <div>
              <label className="text-orange-200/60 text-xs font-medium block mb-1.5">Pays</label>
              <input value={info.pays} onChange={e => setInfo(i => ({ ...i, pays: e.target.value }))} className="w-full bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-400/60" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-orange-200/60 text-xs font-medium block mb-1.5">Type</label>
              <select value={info.type} onChange={e => setInfo(i => ({ ...i, type: e.target.value }))} className="w-full bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-400/60">
                {['Publique', 'Privée', 'Grande École', 'Institut'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-orange-200/60 text-xs font-medium block mb-1.5">Slug (non modifiable)</label>
              <input value={info.slug} disabled className="w-full bg-black/20 border border-orange-500/10 rounded-xl px-4 py-3 text-zinc-500 text-sm cursor-not-allowed" />
            </div>
            <div>
              <label className="text-orange-200/60 text-xs font-medium block mb-1.5">Année académique</label>
              <input value={info.annee} onChange={e => setInfo(i => ({ ...i, annee: e.target.value }))} className="w-full bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-400/60" />
            </div>
          </div>
          <button onClick={handleSaveInfo} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-black rounded-xl px-4 py-2 font-semibold text-sm transition-colors"><Save size={14} /> Sauvegarder</button>
        </div>
      </div>

      {/* Abonnement */}
      <div className="bg-zinc-950 border border-orange-500/10 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Abonnement</h2>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-orange-200/60 text-xs font-medium">Plan actuel</span>
              {plan && <PlanBadge plan={plan} size="md" />}
            </div>
            <p className="text-orange-200/40 text-xs">Renouvellement le 26 juillet 2026</p>
          </div>
          <Link href="/pricing" className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-black rounded-xl px-4 py-2 font-semibold text-sm transition-colors">
            Changer de plan
          </Link>
        </div>
      </div>

      {/* Sous-domaine personnalisé */}
      <div className="bg-zinc-950 border border-orange-500/10 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4"><Globe size={16} className="text-orange-400" /> Sous-domaine personnalisé</h2>
        <PlanGate feature="sousDomainePerso" universityId={universityId}>
          <div className="space-y-4">
            <div>
              <label className="text-orange-200/60 text-xs font-medium block mb-1.5">Sous-domaine</label>
              <div className="flex items-center gap-2">
                <input value={sousDomaine} onChange={e => setSousDomaine(e.target.value)} placeholder="mon-universite" className="flex-1 bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-400/60" />
                <span className="text-orange-200/40 text-sm">.gestuniv.app</span>
              </div>
            </div>
            <button className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-black rounded-xl px-4 py-2 font-semibold text-sm transition-colors"><Save size={14} /> Sauvegarder</button>
          </div>
        </PlanGate>
      </div>

      {/* Filières */}
      <div className="bg-zinc-950 border border-orange-500/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Filières</h2>
          <Link href="/dashboard/admin/filieres" className="flex items-center gap-1.5 text-xs bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl px-3 py-1.5 hover:bg-orange-500/20 transition-colors">
            Gérer <ChevronRight size={12} />
          </Link>
        </div>
        {filieres.length === 0 ? (
          <p className="text-orange-200/40 text-sm">
            Aucune filière enregistrée. Créez vos filières dans{' '}
            <Link href="/dashboard/admin/filieres" className="text-orange-400 underline hover:text-orange-300">
              Filières &amp; Matières
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-2">
            {filieres.map(f => (
              <div key={f.id} className="flex items-center justify-between bg-black/30 border border-orange-500/5 rounded-xl px-4 py-3">
                <div>
                  <p className="text-orange-100/80 text-sm font-medium">{f.nom}</p>
                  <p className="text-orange-200/40 text-xs mt-0.5">
                    {f.dureeAns} an{f.dureeAns > 1 ? 's' : ''}
                    {f.niveaux.length > 0 && <> · Niveaux : {f.niveaux.join(', ')}</>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calendrier */}
      <div className="bg-zinc-950 border border-orange-500/10 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Calendrier académique</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            ['Rentrée', 'rentree'], ['Examens S1', 'examsS1'], ['Vacances intersemestrielles', 'vacances'],
            ['Examens S2', 'examsS2'], ['Clôture de l\'année', 'cloture'],
          ].map(([label, key]) => (
            <div key={key}>
              <label className="text-orange-200/60 text-xs font-medium block mb-1.5">{label}</label>
              <input type="date" value={calendrier[key as keyof typeof calendrier]} onChange={e => setCalendrier(c => ({ ...c, [key]: e.target.value }))} className="w-full bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-400/60" />
            </div>
          ))}
        </div>
        <button onClick={handleSaveCalendrier} className="mt-4 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-black rounded-xl px-4 py-2 font-semibold text-sm transition-colors"><Save size={14} /> Sauvegarder</button>
      </div>

      {/* Frais */}
      <div className="bg-zinc-950 border border-orange-500/10 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Frais de scolarité</h2>
        <div className="space-y-3">
          {frais.map((f, i) => (
            <div key={i} className="flex items-center gap-4 bg-black/30 border border-orange-500/5 rounded-xl px-4 py-3">
              <p className="text-orange-100/80 text-sm flex-1">{f.filiere}</p>
              <input type="number" value={f.montant} onChange={e => setFrais(prev => prev.map((x, j) => j === i ? { ...x, montant: +e.target.value } : x))} className="bg-black/40 border border-orange-500/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-400/60 w-36 text-right" />
              <span className="text-orange-200/40 text-sm">FCFA</span>
            </div>
          ))}
        </div>
        <button onClick={handleSaveFrais} className="mt-4 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-black rounded-xl px-4 py-2 font-semibold text-sm transition-colors"><Save size={14} /> Sauvegarder</button>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-2"><Shield size={16} /> Zone dangereuse</h2>
        <p className="text-red-300/60 text-xs mb-4">Ces actions sont irréversibles. Procédez avec la plus grande prudence.</p>
        {!showDanger ? (
          <button onClick={() => setShowDanger(true)} className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-2 text-sm hover:bg-red-500/20 transition-colors">
            Clôturer l&apos;année académique 2024-2025
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-red-300/80 text-xs">Tapez <code className="text-red-400 font-mono">CLOTURE-2025</code> pour confirmer :</p>
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="CLOTURE-2025" className="bg-black/40 border border-red-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-400/60 w-64" />
            <div className="flex gap-3">
              <button onClick={handleCloture} disabled={confirmText !== 'CLOTURE-2025'} className="bg-red-500 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors">Confirmer la clôture</button>
              <button onClick={() => { setShowDanger(false); setConfirmText('') }} className="text-zinc-400 hover:text-white text-sm transition-colors">Annuler</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
