'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, ArrowLeft, Gift } from 'lucide-react'
import { registerAdmin } from '@/lib/auth'
import { createUniversity, initTrial } from '@/lib/db'
import { syncSessionCookie } from '@/lib/session-client'
import { PLANS_CONFIG, PLAN_ORDER } from '@/lib/plans'
import type { PlanFeatures } from '@/types/plan'

interface Step1Data {
  universityName: string
  slug: string
  country: string
  type: string
}

interface Step2Data {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
}

const UNIVERSITY_TYPES = [
  'Université publique',
  'Université privée',
  'Grande école',
  'Institut supérieur',
  "École de commerce",
  "École d'ingénieurs",
  'Autre',
]

/** Fonctionnalités résumées affichées sous chaque plan (informatif). */
const PLAN_HIGHLIGHTS: { key: keyof PlanFeatures; label: string }[] = [
  { key: 'chatbotIA', label: 'Assistant IA' },
  { key: 'exportPDF', label: 'Export PDF' },
  { key: 'bulletinsPDF', label: 'Bulletins PDF' },
  { key: 'messagerieInterne', label: 'Messagerie interne' },
  { key: 'multiCampus', label: 'Multi-campus' },
  { key: 'apiAccess', label: 'Accès API' },
]

function formatPrice(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value)
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function getFirebaseErrorMessage(code: string, message?: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Cet email est déjà utilisé.'
    case 'auth/invalid-email':
      return 'Adresse email invalide.'
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères.'
    case 'auth/network-request-failed':
      return 'Erreur réseau. Vérifiez votre connexion internet.'
    case 'PERMISSION_DENIED':
      return 'Accès refusé par la base de données. Vérifiez les règles Firebase.'
    default:
      return message ? `Erreur : ${message}` : 'Une erreur est survenue. Veuillez réessayer.'
  }
}

export default function RegisterUniversityPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [step1, setStep1] = useState<Step1Data>({ universityName: '', slug: '', country: '', type: '' })
  const [step2, setStep2] = useState<Step2Data>({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' })

  function handleUniversityNameChange(value: string) {
    setStep1(prev => ({ ...prev, universityName: value, slug: slugify(value) }))
  }

  function validateStep1(): string | null {
    if (!step1.universityName.trim()) return "Le nom de l'université est requis."
    if (!step1.slug.trim()) return "L'identifiant est requis."
    if (!/^[a-z0-9-]+$/.test(step1.slug)) return "L'identifiant ne doit contenir que des lettres minuscules, chiffres et tirets."
    if (!step1.country.trim()) return 'Le pays est requis.'
    if (!step1.type) return "Le type d'établissement est requis."
    return null
  }

  function validateStep2(): string | null {
    if (!step2.firstName.trim()) return 'Le prénom est requis.'
    if (!step2.lastName.trim()) return 'Le nom est requis.'
    if (!step2.email.trim()) return "L'email est requis."
    if (!step2.password) return 'Le mot de passe est requis.'
    if (step2.password.length < 6) return 'Le mot de passe doit contenir au moins 6 caractères.'
    if (step2.password !== step2.confirmPassword) return 'Les mots de passe ne correspondent pas.'
    return null
  }

  function goToStep2() {
    const err = validateStep1()
    if (err) { setError(err); return }
    setError('')
    setStep(2)
  }

  function goToStep3() {
    const err = validateStep2()
    if (err) { setError(err); return }
    setError('')
    setStep(3)
  }

  async function handleSubmit() {
    setError('')
    setLoading(true)
    try {
      const displayName = `${step2.firstName} ${step2.lastName}`.trim()
      const credential = await registerAdmin(step2.email, step2.password, step1.slug, displayName)
      await createUniversity(step1.slug, {
        name: step1.universityName,
        slug: step1.slug,
        plan: 'trial',
        adminUid: credential.user.uid,
      })
      // Active l'essai gratuit (30 jours, fonctionnalités Premium).
      await initTrial(step1.slug)
      await syncSessionCookie()
      router.push('/dashboard/admin')
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string }
      setError(getFirebaseErrorMessage(firebaseErr.code ?? '', firebaseErr.message))
      setLoading(false)
    }
  }

  const progressPercent = step === 1 ? 33 : step === 2 ? 66 : 100

  return (
    <div className="bg-white dark:bg-white/5 border border-orange-500/20 rounded-2xl p-8 shadow-lg shadow-zinc-300/40 dark:shadow-none">
      <div className="mb-6">
        <Link
          href="/auth/register"
          className="flex items-center gap-1.5 text-blue-700/70 dark:text-orange-300/60 hover:text-blue-900 dark:hover:text-orange-300 text-sm mb-4 transition-colors"
        >
          <ArrowLeft size={14} />
          Retour
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Créer votre université</h1>
        <p className="text-zinc-600 dark:text-orange-200/60 text-sm mt-1">Étape {step} sur 3</p>
      </div>

      <div className="w-full bg-zinc-50 dark:bg-black/40 rounded-full h-1.5 mb-8">
        <div className="bg-orange-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <p className="text-blue-600 dark:text-orange-400 font-semibold text-sm uppercase tracking-wider mb-1">Informations établissement</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Nom de l&apos;université</label>
            <input
              type="text"
              value={step1.universityName}
              onChange={e => handleUniversityNameChange(e.target.value)}
              placeholder="Université de Abidjan"
              className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Identifiant unique (slug)</label>
            <input
              type="text"
              value={step1.slug}
              onChange={e => setStep1(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="universite-abidjan"
              className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60"
            />
            <span className="text-zinc-500 dark:text-orange-200/40 text-xs">Minuscules, chiffres et tirets. C&apos;est le code que vous partagerez avec vos membres.</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Pays</label>
            <input
              type="text"
              value={step1.country}
              onChange={e => setStep1(prev => ({ ...prev, country: e.target.value }))}
              placeholder="Côte d'Ivoire"
              className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Type d&apos;établissement</label>
            <select
              value={step1.type}
              onChange={e => setStep1(prev => ({ ...prev, type: e.target.value }))}
              className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-orange-400/60"
            >
              <option value="" disabled className="bg-[#fafafa] dark:bg-black">Sélectionner un type</option>
              {UNIVERSITY_TYPES.map(t => <option key={t} value={t} className="bg-[#fafafa] dark:bg-black">{t}</option>)}
            </select>
          </div>

          {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

          <button onClick={goToStep2} className="mt-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-full py-3 transition-colors">
            Continuer
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-blue-600 dark:text-orange-400 font-semibold text-sm uppercase tracking-wider mb-1">Compte administrateur</p>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Prénom</label>
              <input type="text" value={step2.firstName} onChange={e => setStep2(prev => ({ ...prev, firstName: e.target.value }))} placeholder="Jean"
                className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60" />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Nom</label>
              <input type="text" value={step2.lastName} onChange={e => setStep2(prev => ({ ...prev, lastName: e.target.value }))} placeholder="Kouassi"
                className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Email</label>
            <input type="email" value={step2.email} onChange={e => setStep2(prev => ({ ...prev, email: e.target.value }))} placeholder="admin@universite.ci"
              className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Mot de passe</label>
            <input type="password" value={step2.password} onChange={e => setStep2(prev => ({ ...prev, password: e.target.value }))} placeholder="••••••••"
              className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Confirmer le mot de passe</label>
            <input type="password" value={step2.confirmPassword} onChange={e => setStep2(prev => ({ ...prev, confirmPassword: e.target.value }))} placeholder="••••••••"
              className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60" />
          </div>

          {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button onClick={() => { setError(''); setStep(1) }} className="flex-1 border border-orange-500/30 text-blue-700 dark:text-orange-300 hover:border-orange-400/60 font-semibold rounded-full py-3 transition-colors">
              Retour
            </button>
            <button onClick={goToStep3} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-full py-3 transition-colors">
              Continuer
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <p className="text-blue-600 dark:text-orange-400 font-semibold text-sm uppercase tracking-wider mb-1">Votre essai gratuit</p>

          <div className="flex items-start gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
            <Gift size={18} className="mt-0.5 shrink-0 text-blue-600 dark:text-orange-400" />
            <p className="text-sm text-zinc-800 dark:text-orange-200/90">
              Vous démarrez avec un <span className="font-semibold text-zinc-800 dark:text-orange-100">essai gratuit de 30 jours</span> incluant
              toutes les fonctionnalités Premium. Aucune carte bancaire requise.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {PLAN_ORDER.map(planId => {
              const config = PLANS_CONFIG[planId]
              const isEnterprise = planId === 'enterprise'
              return (
                <div key={planId}
                  className={`rounded-xl border p-4 ${planId === 'premium' ? 'border-orange-500/40 bg-orange-500/5' : 'border-orange-500/20 bg-zinc-50 dark:bg-black/40'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-zinc-900 dark:text-white font-semibold">{config.nom}</span>
                      <span className="ml-3 text-blue-600 dark:text-orange-400 font-bold text-sm">
                        {isEnterprise ? 'Sur devis' : `${formatPrice(config.prixMensuel)} FCFA/mois`}
                      </span>
                      {config.badge && <span className="ml-2 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{config.badge}</span>}
                    </div>
                  </div>
                  <ul className="grid grid-cols-2 gap-1">
                    {PLAN_HIGHLIGHTS.map(({ key, label }) => {
                      const on = Boolean(config.features[key])
                      return (
                        <li key={key} className={`text-xs flex items-center gap-1.5 ${on ? 'text-zinc-700 dark:text-orange-200/70' : 'text-zinc-600 dark:text-zinc-400 dark:text-orange-200/25 line-through'}`}>
                          <Check className={`w-3 h-3 shrink-0 ${on ? 'text-blue-600 dark:text-orange-400' : 'text-zinc-600 dark:text-zinc-400 dark:text-orange-200/20'}`} strokeWidth={3} />
                          {label}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>

          {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button onClick={() => { setError(''); setStep(2) }} className="flex-1 border border-orange-500/30 text-blue-700 dark:text-orange-300 hover:border-orange-400/60 font-semibold rounded-full py-3 transition-colors">
              Retour
            </button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-full py-3 transition-colors">
              {loading ? 'Création…' : "Démarrer l'essai gratuit"}
            </button>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-zinc-600 dark:text-orange-200/60 text-sm">
        Déjà un compte ?{' '}
        <Link href="/auth/login" className="text-blue-600 dark:text-orange-400 hover:text-blue-900 dark:hover:text-orange-300 font-medium transition-colors">
          Se connecter
        </Link>
      </p>
    </div>
  )
}
