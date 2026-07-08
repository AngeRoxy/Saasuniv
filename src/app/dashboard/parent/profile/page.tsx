'use client'

import { useState, useEffect } from 'react'
import {
  User,
  Mail,
  Phone,
  Building2,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  Baby,
  GraduationCap,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getUniversityMember, getUniversityMembers, type UniversityMember } from '@/lib/db'
import { updateOwnProfile } from '@/lib/auth'

function ReadOnlyRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-orange-500/5 last:border-0">
      <div className="rounded-lg bg-orange-500/10 p-2 shrink-0">
        <Icon className="h-4 w-4 text-orange-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-orange-300/40 mb-0.5">{label}</p>
        <p className="text-sm text-orange-100/80 font-medium truncate">{value || '—'}</p>
      </div>
    </div>
  )
}

export default function ParentProfilePage() {
  const { user, profile, loading } = useAuth()
  const [member, setMember] = useState<UniversityMember | null>(null)
  const [enfants, setEnfants] = useState<UniversityMember[]>([])

  const email = user?.email ?? profile?.email ?? '—'
  const universityId = profile?.universityId ?? '—'
  const displayName = member?.displayName ?? profile?.displayName ?? 'Parent'

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!profile?.universityId || !user?.uid) return
    const universityId = profile.universityId
    getUniversityMember(universityId, user.uid)
      .then(async (m) => {
        setMember(m)
        const enfantUids = m?.enfantUids ?? []
        if (enfantUids.length === 0) {
          setEnfants([])
          return
        }
        const students = await getUniversityMembers(universityId, 'student')
        setEnfants(students.filter((s) => enfantUids.includes(s.uid)))
      })
      .catch(() => {
        setMember(null)
        setEnfants([])
      })
  }, [profile?.universityId, user?.uid])

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)

    if (newPw.length < 8) {
      setPwError('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (!/[A-Z]/.test(newPw) || !/[0-9]/.test(newPw)) {
      setPwError('Le mot de passe doit contenir au moins une majuscule et un chiffre.')
      return
    }
    if (newPw !== confirmPw) {
      setPwError('Les mots de passe ne correspondent pas.')
      return
    }
    if (!user || !profile) {
      setPwError('Session introuvable. Reconnectez-vous.')
      return
    }

    setSubmitting(true)
    try {
      // RÈGLE 2 : pour un parent, seul le mot de passe est pris en compte.
      await updateOwnProfile(
        profile.universityId,
        user.uid,
        { motDePasse: newPw, motDePasseActuel: currentPw },
        'parent'
      )
      setPwSuccess(true)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      setPwError(
        code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? 'Mot de passe actuel incorrect.'
          : code === 'auth/requires-recent-login'
            ? 'Reconnectez-vous puis réessayez.'
            : 'Impossible de mettre à jour le mot de passe.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Mon profil</h1>
        <p className="text-sm text-orange-300/40 mt-1">
          Vos informations, vos enfants et la sécurité de votre compte
        </p>
      </div>

      {/* Identity card */}
      <div className="rounded-xl bg-zinc-950 border border-orange-500/10 overflow-hidden">
        <div className="h-20 bg-orange-950/30 border-b border-orange-500/10" />
        <div className="px-6 pb-6">
          <div className="-mt-9 mb-4">
            <div className="w-16 h-16 rounded-full bg-orange-500 border-4 border-zinc-950 flex items-center justify-center shadow-lg">
              <User className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white">{displayName}</h2>
          <p className="text-sm text-orange-400/70 mt-0.5">{email}</p>
        </div>
      </div>

      {/* Read-only info */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-orange-100/80">Informations</h2>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/80 border border-white/10 text-zinc-400 text-[11px] font-medium">
            🔒 Géré par votre université
          </span>
        </div>
        <div className="rounded-xl bg-zinc-950 border border-orange-500/10 px-6 py-2">
          <ReadOnlyRow icon={User} label="Nom complet" value={displayName} />
          <ReadOnlyRow icon={Mail} label="Adresse e-mail" value={email} />
          {member?.telephone && <ReadOnlyRow icon={Phone} label="Téléphone" value={member.telephone} />}
          <ReadOnlyRow icon={Building2} label="Identifiant université" value={universityId} />
        </div>
      </div>

      {/* Mes enfants — read only */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Baby className="h-4 w-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-orange-100/80">Mes enfants</h2>
        </div>
        <div className="rounded-xl bg-zinc-950 border border-orange-500/10 px-6 py-2">
          {enfants.length === 0 ? (
            <p className="py-4 text-sm text-orange-300/30">Aucun enfant lié à votre compte.</p>
          ) : (
            enfants.map((enfant) => (
              <div key={enfant.uid} className="flex items-center gap-4 py-3 border-b border-orange-500/5 last:border-0">
                <div className="rounded-lg bg-orange-500/10 p-2 shrink-0">
                  <GraduationCap className="h-4 w-4 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{enfant.displayName}</p>
                  <p className="text-xs text-orange-300/40 truncate">
                    {[enfant.filiere, enfant.niveau].filter(Boolean).join(' · ') || 'Filière non renseignée'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        <p className="mt-2 text-xs text-orange-300/30">
          Les liaisons parent-enfant sont gérées par l&apos;administration de votre université.
        </p>
      </div>

      {/* Security */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-4 w-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-orange-100/80">Sécurité</h2>
        </div>
        <div className="rounded-xl bg-zinc-950 border border-orange-500/10 p-6">
          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Mot de passe actuel</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black border border-orange-500/20 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
                />
                <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black border border-orange-500/20 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
                />
                <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Confirmer le nouveau mot de passe</label>
              <input
                type={showNew ? 'text' : 'password'}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black border border-orange-500/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
              />
            </div>

            <p className="text-[11px] text-orange-300/40">Minimum 8 caractères, une majuscule et un chiffre.</p>

            {pwError && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{pwError}</p>
            )}
            {pwSuccess && (
              <p className="flex items-center gap-2 text-orange-300 text-sm bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2.5">
                <CheckCircle2 size={15} /> Mot de passe mis à jour avec succès.
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-semibold transition-colors"
            >
              {submitting && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
              <Lock size={15} />
              Mettre à jour le mot de passe
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
