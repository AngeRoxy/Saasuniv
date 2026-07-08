'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Crown, ArrowLeft, Info } from 'lucide-react'
import { registerMember } from '@/lib/auth'
import { syncSessionCookie } from '@/lib/session-client'

// RÈGLE 1 — Seul le super administrateur plateforme peut s'inscrire lui-même.
// Les comptes Enseignant / Étudiant / Parent sont créés par l'administration
// de l'université (voir le message informatif sur l'étape de sélection).
type MemberRole = 'super_admin_plateforme'

const ROLE_REDIRECTS: Record<MemberRole, string> = {
  super_admin_plateforme: '/dashboard/super-admin',
}

const ROLES = [
  {
    id: 'super_admin_plateforme' as MemberRole,
    label: 'Super Admin',
    description: 'Administrez la plateforme GestUniv',
    icon: Crown,
    accent: 'red',
  },
]

function getFirebaseError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use': return 'Cet email est déjà utilisé.'
    case 'auth/invalid-email': return 'Adresse email invalide.'
    case 'auth/weak-password': return 'Le mot de passe doit contenir au moins 6 caractères.'
    case 'auth/network-request-failed': return 'Erreur réseau. Vérifiez votre connexion.'
    case 'PERMISSION_DENIED': return 'Accès refusé. Vérifiez les règles Firebase.'
    default: return 'Une erreur est survenue. Veuillez réessayer.'
  }
}

type FormData = {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  universityId: string
}

const emptyForm: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  universityId: '',
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [role, setRole] = useState<MemberRole | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const needsUniversity = role !== 'super_admin_plateforme'
  const progress = step === 0 ? 0 : step === 1 ? (needsUniversity ? 50 : 100) : 100

  function selectRole(r: MemberRole) {
    setRole(r)
    setError('')
    setStep(1)
  }

  function validateStep1(): string | null {
    if (!form.firstName.trim()) return 'Le prénom est requis.'
    if (!form.lastName.trim()) return 'Le nom est requis.'
    if (!form.email.trim()) return "L'email est requis."
    if (!form.password) return 'Le mot de passe est requis.'
    if (form.password.length < 6) return 'Le mot de passe doit contenir au moins 6 caractères.'
    if (form.password !== form.confirmPassword) return 'Les mots de passe ne correspondent pas.'
    return null
  }

  function goToStep2() {
    const err = validateStep1()
    if (err) { setError(err); return }
    setError('')
    setStep(2)
  }

  async function submit() {
    if (needsUniversity && !form.universityId.trim()) {
      setError("Le code de l'université est requis.")
      return
    }
    setError('')
    setLoading(true)

    try {
      const displayName = `${form.firstName} ${form.lastName}`.trim()
      await registerMember(
        form.email,
        form.password,
        form.universityId.trim(),
        displayName,
        role!
      )
      await syncSessionCookie()
      router.push(ROLE_REDIRECTS[role!])
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setError(getFirebaseError(code))
      setLoading(false)
    }
  }

  async function handleStep1Submit() {
    if (needsUniversity) {
      goToStep2()
    } else {
      const err = validateStep1()
      if (err) { setError(err); return }
      setError('')
      await submit()
    }
  }

  const selectedRole = ROLES.find(r => r.id === role)

  return (
    <div className="bg-black/60 backdrop-blur-md border border-orange-500/20 rounded-2xl p-8 shadow-2xl shadow-black/50 w-full">

      {/* Header */}
      <div className="mb-6">
        {step > 0 && (
          <button
            onClick={() => { setStep(step === 2 ? 1 : 0); setError('') }}
            className="flex items-center gap-1.5 text-orange-300/60 hover:text-orange-300 text-sm mb-4 transition-colors"
          >
            <ArrowLeft size={14} />
            Retour
          </button>
        )}
        <h1 className="text-2xl font-bold text-white">
          {step === 0 ? 'Créer un compte' : `Inscription — ${selectedRole?.label}`}
        </h1>
        <p className="text-orange-200/60 text-sm mt-1">
          {step === 0
            ? 'Choisissez votre rôle pour commencer'
            : step === 1
              ? 'Vos informations personnelles'
              : 'Rejoindre votre université'}
        </p>
      </div>

      {/* Progress bar (hidden on step 0) */}
      {step > 0 && (
        <div className="w-full bg-black/40 rounded-full h-1 mb-8">
          <div
            className="bg-orange-500 h-1 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* STEP 0 — Role selection */}
      {step === 0 && (
        <div className="flex flex-col gap-4">
          {/* Message informatif : les comptes membres sont créés par l'école */}
          <div className="flex gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
            <Info size={18} className="text-orange-400 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-200/70 leading-relaxed">
              Les comptes <strong className="text-orange-300">Étudiant</strong>,{' '}
              <strong className="text-orange-300">Enseignant</strong> et{' '}
              <strong className="text-orange-300">Parent</strong> sont créés par
              l&apos;administration de votre université. Contactez votre
              établissement pour obtenir vos accès.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
          {ROLES.map(({ id, label, description, icon: Icon, accent }) => (
            <button
              key={id}
              onClick={() => selectRole(id)}
              className={`text-left rounded-xl border p-4 transition-all hover:scale-[1.02] active:scale-[0.99] ${
                accent === 'red'
                  ? 'border-red-500/20 bg-red-500/5 hover:border-red-500/50 hover:bg-red-500/10'
                  : 'border-orange-500/20 bg-white/5 hover:border-orange-500/50 hover:bg-orange-500/10'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
                accent === 'red' ? 'bg-red-500/15' : 'bg-orange-500/15'
              }`}>
                <Icon size={18} className={accent === 'red' ? 'text-red-400' : 'text-orange-400'} />
              </div>
              <p className="text-white font-semibold text-sm">{label}</p>
              <p className="text-zinc-500 text-xs mt-1 leading-relaxed">{description}</p>
            </button>
          ))}
          </div>
        </div>
      )}

      {/* STEP 1 — Personal info */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-orange-200/60 text-sm font-medium">Prénom</label>
              <input
                type="text"
                value={form.firstName}
                onChange={e => setForm({ ...form, firstName: e.target.value })}
                placeholder="Jean"
                className="bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60"
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-orange-200/60 text-sm font-medium">Nom</label>
              <input
                type="text"
                value={form.lastName}
                onChange={e => setForm({ ...form, lastName: e.target.value })}
                placeholder="Kouassi"
                className="bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-orange-200/60 text-sm font-medium">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="vous@exemple.com"
              className="bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-orange-200/60 text-sm font-medium">Mot de passe</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              className="bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-orange-200/60 text-sm font-medium">Confirmer le mot de passe</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
              placeholder="••••••••"
              className="bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            onClick={handleStep1Submit}
            disabled={loading}
            className="mt-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-full py-3 transition-colors flex items-center justify-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
            {needsUniversity ? 'Continuer' : (loading ? 'Création…' : 'Créer mon compte')}
          </button>
        </div>
      )}

      {/* STEP 2 — University code (teacher/student/parent only) */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 text-sm text-orange-200/70 leading-relaxed">
            Demandez le <strong className="text-orange-400">code université</strong> à votre administrateur.
            C&apos;est l&apos;identifiant unique de votre établissement sur GestUniv.
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-orange-200/60 text-sm font-medium">Code université</label>
            <input
              type="text"
              value={form.universityId}
              onChange={e => setForm({ ...form, universityId: e.target.value.toLowerCase().trim() })}
              placeholder="universite-abidjan"
              className="bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-white placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60"
            />
            <span className="text-orange-200/40 text-xs">Minuscules et tirets uniquement (ex: univ-cocody)</span>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="mt-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-full py-3 transition-colors flex items-center justify-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
            {loading ? 'Création du compte…' : 'Créer mon compte'}
          </button>
        </div>
      )}

      {/* Footer links */}
      <div className="mt-6 flex flex-col gap-2 text-center text-sm">
        <p className="text-orange-200/60">
          Déjà un compte ?{' '}
          <Link href="/auth/login" className="text-orange-400 hover:text-orange-300 font-medium transition-colors">
            Se connecter
          </Link>
        </p>
        <p className="text-orange-200/40">
          Vous créez une université ?{' '}
          <Link href="/auth/register-university" className="text-orange-400/70 hover:text-orange-400 font-medium transition-colors">
            Par ici
          </Link>
        </p>
      </div>
    </div>
  )
}
