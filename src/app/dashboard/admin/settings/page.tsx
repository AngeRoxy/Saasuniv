'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Save, Shield, Globe, ChevronRight, X, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usePlan } from '@/hooks/usePlan'
import {
  getFilieres,
  getUniversity,
  updateUniversity,
  getFraisScolarite,
  setFraisScolarite,
  getCalendrierAcademique,
  setCalendrierAcademique,
  getSousDomaine,
  setSousDomaine,
  CALENDRIER_VIDE,
  type CalendrierAcademique,
} from '@/lib/db'
import type { Filiere } from '@/types/filiere'
import { PlanBadge } from '@/components/ui/plan-badge'
import { PlanGate } from '@/components/ui/plan-gate'

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastState = { message: string; type: 'success' | 'error' }

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  const styles = toast.type === 'success' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'
  return (
    <div className={`fixed bottom-6 right-6 z-100 ${styles} text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 max-w-sm`}>
      {toast.message}
      <button onClick={onClose} className="shrink-0"><X size={14} /></button>
    </div>
  )
}

export default function SettingsPage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId ?? ''
  const { plan } = usePlan(universityId)
  const [sousDomaine, setSousDomaineInput] = useState('')
  const [savingSousDomaine, setSavingSousDomaine] = useState(false)
  const [info, setInfo] = useState({ nom: '', pays: '', type: 'Publique', slug: '', annee: '' })
  const [savingInfo, setSavingInfo] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [frais, setFrais] = useState<{ filiereId: string; filiere: string; montant: number }[]>([])
  const [savingFrais, setSavingFrais] = useState(false)
  // Aucune date par défaut inventée : les champs restent vides tant que
  // l'université n'a rien configuré.
  const [calendrier, setCalendrier] = useState<CalendrierAcademique>({ ...CALENDRIER_VIDE })
  const [savingCalendrier, setSavingCalendrier] = useState(false)

  // Informations générales : chargées depuis la vraie université du tenant
  // (universities/{universityId}). Plus aucune valeur codée en dur — les champs
  // restent vides tant que la lecture n'a pas abouti.
  useEffect(() => {
    if (!universityId) return
    let active = true
    getUniversity(universityId)
      .then((u) => {
        if (!active || !u) return
        setInfo({
          nom: u.name ?? '',
          pays: u.pays ?? '',
          type: u.type ?? 'Publique',
          slug: u.slug ?? '',
          annee: u.annee ?? '',
        })
      })
      .catch(() => { /* lecture échouée : on laisse les champs vides, pas de données d'un autre tenant */ })
    return () => { active = false }
  }, [universityId])

  // Filières chargées depuis Firebase (gérées dans Filières & Matières).
  // Les frais s'alignent sur ces filières réelles et sont pré-remplis avec les
  // montants déjà enregistrés (config/frais). Une filière sans montant connu
  // reste à 0 — c'est une valeur non configurée, pas une valeur inventée.
  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      try {
        const [list, montants] = await Promise.all([
          getFilieres(universityId),
          getFraisScolarite(universityId),
        ])
        if (!active) return
        setFilieres(list)
        setFrais(
          list.map((f) => ({
            filiereId: f.id,
            filiere: f.nom,
            montant: montants[f.id]?.montant ?? 0,
          }))
        )
      } catch {
        if (!active) return
        setFilieres([])
        setFrais([])
      }
    })()
    return () => { active = false }
  }, [universityId])

  // Calendrier académique + sous-domaine (config/*).
  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      try {
        const [cal, sd] = await Promise.all([
          getCalendrierAcademique(universityId),
          getSousDomaine(universityId),
        ])
        if (!active) return
        setCalendrier(cal)
        setSousDomaineInput(sd)
      } catch {
        /* lecture échouée : champs laissés vides, aucune donnée inventée */
      }
    })()
    return () => { active = false }
  }, [universityId])

  // Persiste réellement le nom + infos générales sur universities/{id}.
  // Succès affiché UNIQUEMENT après confirmation Firebase ; échec = toast d'erreur
  // explicite (jamais de faux succès optimiste).
  async function handleSaveInfo() {
    if (!universityId || savingInfo) return
    setSavingInfo(true)
    try {
      await updateUniversity(universityId, {
        name: info.nom.trim(),
        pays: info.pays.trim(),
        type: info.type,
        annee: info.annee.trim(),
      })
      setToast({ message: 'Informations générales enregistrées.', type: 'success' })
    } catch (err) {
      console.error('updateUniversity a échoué', err)
      setToast({ message: "Échec de l'enregistrement — vérifiez vos droits ou votre connexion.", type: 'error' })
    } finally {
      setSavingInfo(false)
    }
  }
  // Frais de scolarité → config/frais. Écriture réelle, succès après confirmation.
  async function handleSaveFrais() {
    if (!universityId || savingFrais) return
    if (frais.some((f) => f.montant < 0)) {
      setToast({ message: 'Un montant ne peut pas être négatif.', type: 'error' })
      return
    }
    setSavingFrais(true)
    try {
      await setFraisScolarite(
        universityId,
        frais.map((f) => ({ filiereId: f.filiereId, filiereNom: f.filiere, montant: f.montant }))
      )
      setToast({ message: 'Frais de scolarité enregistrés.', type: 'success' })
    } catch (err) {
      console.error('setFraisScolarite a échoué', err)
      setToast({ message: "Échec de l'enregistrement des frais — vérifiez vos droits ou votre connexion.", type: 'error' })
    } finally {
      setSavingFrais(false)
    }
  }

  // Calendrier académique → config/calendrier.
  async function handleSaveCalendrier() {
    if (!universityId || savingCalendrier) return
    setSavingCalendrier(true)
    try {
      await setCalendrierAcademique(universityId, calendrier)
      setToast({ message: 'Calendrier académique enregistré.', type: 'success' })
    } catch (err) {
      console.error('setCalendrierAcademique a échoué', err)
      setToast({ message: "Échec de l'enregistrement du calendrier — vérifiez vos droits ou votre connexion.", type: 'error' })
    } finally {
      setSavingCalendrier(false)
    }
  }

  // Sous-domaine → config/sousDomaine. Le bouton n'avait aucun handler : il
  // affichait « Sauvegarder » sans rien enregistrer.
  async function handleSaveSousDomaine() {
    if (!universityId || savingSousDomaine) return
    setSavingSousDomaine(true)
    try {
      await setSousDomaine(universityId, sousDomaine.trim())
      setToast({ message: 'Sous-domaine enregistré.', type: 'success' })
    } catch (err) {
      console.error('setSousDomaine a échoué', err)
      setToast({ message: "Échec de l'enregistrement du sous-domaine — vérifiez vos droits ou votre connexion.", type: 'error' })
    } finally {
      setSavingSousDomaine(false)
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Paramètres de l&apos;université</h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">Configuration générale et académique</p>
      </div>

      {/* Informations générales */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Informations générales</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Nom de l&apos;université</label>
              <input value={info.nom} onChange={e => setInfo(i => ({ ...i, nom: e.target.value }))} className="w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60" />
            </div>
            <div>
              <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Pays</label>
              <input value={info.pays} onChange={e => setInfo(i => ({ ...i, pays: e.target.value }))} className="w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Type</label>
              <select value={info.type} onChange={e => setInfo(i => ({ ...i, type: e.target.value }))} className="w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60">
                {['Publique', 'Privée', 'Grande École', 'Institut'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Slug (non modifiable)</label>
              <input value={info.slug} disabled className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-orange-500/10 rounded-xl px-4 py-3 text-zinc-500 text-sm cursor-not-allowed" />
            </div>
            <div>
              <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Année académique</label>
              <input value={info.annee} onChange={e => setInfo(i => ({ ...i, annee: e.target.value }))} className="w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60" />
            </div>
          </div>
          <button onClick={handleSaveInfo} disabled={savingInfo || !universityId} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors"><Save size={14} /> {savingInfo ? 'Enregistrement…' : 'Sauvegarder'}</button>
        </div>
      </div>

      {/* Abonnement */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Abonnement</h2>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium">Plan actuel</span>
              {plan && <PlanBadge plan={plan} size="md" />}
            </div>
          </div>
          <Link href="/dashboard/admin/billing" className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors">
            Changer de plan
          </Link>
        </div>
      </div>

      {/* Sous-domaine personnalisé */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-4"><Globe size={16} className="text-blue-600 dark:text-orange-400" /> Sous-domaine personnalisé</h2>
        <PlanGate feature="sousDomainePerso" universityId={universityId}>
          <div className="space-y-4">
            <div>
              <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Sous-domaine</label>
              <div className="flex items-center gap-2">
                <input value={sousDomaine} onChange={e => setSousDomaineInput(e.target.value)} placeholder="mon-universite" className="flex-1 bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60" />
                <span className="text-zinc-500 dark:text-orange-200/40 text-sm">.gestuniv.app</span>
              </div>
            </div>
            <button onClick={handleSaveSousDomaine} disabled={savingSousDomaine || !universityId} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors"><Save size={14} /> {savingSousDomaine ? 'Enregistrement…' : 'Sauvegarder'}</button>
          </div>
        </PlanGate>
      </div>

      {/* Filières */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Filières</h2>
          <Link href="/dashboard/admin/filieres" className="flex items-center gap-1.5 text-xs bg-orange-500/10 border border-orange-500/20 text-blue-600 dark:text-orange-400 rounded-xl px-3 py-1.5 hover:bg-orange-500/20 transition-colors">
            Gérer <ChevronRight size={12} />
          </Link>
        </div>
        {filieres.length === 0 ? (
          <p className="text-zinc-500 dark:text-orange-200/40 text-sm">
            Aucune filière enregistrée. Créez vos filières dans{' '}
            <Link href="/dashboard/admin/filieres" className="text-blue-600 dark:text-orange-400 underline hover:text-blue-900 dark:hover:text-orange-300">
              Filières &amp; Matières
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-2">
            {filieres.map(f => (
              <div key={f.id} className="flex items-center justify-between bg-zinc-50 dark:bg-black/30 border border-orange-500/5 rounded-xl px-4 py-3">
                <div>
                  <p className="text-zinc-800 dark:text-orange-100/80 text-sm font-medium">{f.nom}</p>
                  <p className="text-zinc-500 dark:text-orange-200/40 text-xs mt-0.5">
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
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Calendrier académique</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            ['Rentrée', 'rentree'], ['Examens S1', 'examsS1'], ['Vacances intersemestrielles', 'vacances'],
            ['Examens S2', 'examsS2'], ['Clôture de l\'année', 'cloture'],
          ].map(([label, key]) => (
            <div key={key}>
              <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">{label}</label>
              <input type="date" value={calendrier[key as keyof typeof calendrier]} onChange={e => setCalendrier(c => ({ ...c, [key]: e.target.value }))} className="w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60" />
            </div>
          ))}
        </div>
        <button onClick={handleSaveCalendrier} disabled={savingCalendrier || !universityId} className="mt-4 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors"><Save size={14} /> {savingCalendrier ? 'Enregistrement…' : 'Sauvegarder'}</button>
      </div>

      {/* Frais */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Frais de scolarité</h2>
        {frais.length === 0 && (
          <p className="text-zinc-500 dark:text-orange-200/40 text-sm">
            Aucune filière enregistrée — créez d&apos;abord vos filières pour leur associer des frais.
          </p>
        )}
        <div className="space-y-3">
          {frais.map((f, i) => (
            <div key={i} className="flex items-center gap-4 bg-zinc-50 dark:bg-black/30 border border-orange-500/5 rounded-xl px-4 py-3">
              <p className="text-zinc-800 dark:text-orange-100/80 text-sm flex-1">{f.filiere}</p>
              <input type="number" value={f.montant} onChange={e => setFrais(prev => prev.map((x, j) => j === i ? { ...x, montant: +e.target.value } : x))} className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-3 py-2 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 w-36 text-right" />
              <span className="text-zinc-500 dark:text-orange-200/40 text-sm">FCFA</span>
            </div>
          ))}
        </div>
        <button onClick={handleSaveFrais} disabled={savingFrais || !universityId || frais.length === 0} className="mt-4 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors"><Save size={14} /> {savingFrais ? 'Enregistrement…' : 'Sauvegarder'}</button>
      </div>

      {/* Clôture de l'année — la vraie procédure vit dans /dashboard/admin/closing
          (délibération, redoublement, progression de niveau). Cette page ne
          duplique plus une action de clôture factice : elle y renvoie. */}
      <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-2"><Shield size={16} /> Clôture de l&apos;année académique</h2>
        <p className="text-red-300/60 text-xs mb-4">
          La clôture est une opération irréversible (délibération, passage de niveau, redoublement).
          Elle se pilote depuis son module dédié, étudiant par étudiant.
        </p>
        <Link href="/dashboard/admin/closing" className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-2 text-sm hover:bg-red-500/20 transition-colors">
          Gérer la clôture de l&apos;année <ArrowRight size={14} />
        </Link>
      </div>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
