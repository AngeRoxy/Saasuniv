'use client'

import { useState, useEffect } from 'react'
import {
  User,
  Mail,
  Building2,
  Hash,
  Tag,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  Save,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getUniversityMember, getFilieres, type UniversityMember } from '@/lib/db'
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
        <Icon className="h-4 w-4 text-blue-600 dark:text-orange-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-orange-300/40 mb-0.5">{label}</p>
        <p className="text-sm text-zinc-800 dark:text-orange-100/80 font-medium truncate">{value || '—'}</p>
      </div>
    </div>
  )
}

export default function TeacherProfilePage() {
  const { user, profile, loading } = useAuth()
  const [member, setMember] = useState<UniversityMember | null>(null)
  const [filiereLabel, setFiliereLabel] = useState('')

  const email = user?.email ?? profile?.email ?? '—'
  const universityId = profile?.universityId ?? '—'

  // Editable fields (RÈGLE 2 : enseignant peut modifier displayName & téléphone)
  const [displayName, setDisplayName] = useState('')
  const [telephone, setTelephone] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoMsg, setInfoMsg] = useState<string | null>(null)

  // Password section
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
    Promise.all([
      getUniversityMember(universityId, user.uid),
      getFilieres(universityId),
    ])
      .then(([m, fils]) => {
        setMember(m)
        setDisplayName(m?.displayName ?? profile.displayName ?? '')
        setTelephone(m?.telephone ?? '')
        // Enseignant : plusieurs filières (IDs). Rétro-compat : ancien champ
        // `filiere` (nom unique) affiché tel quel si `filiereIds` est absent.
        const nomById = new Map(fils.map((f) => [f.id, f.nom]))
        const names = (m?.filiereIds ?? []).map((id) => nomById.get(id) ?? id)
        setFiliereLabel(names.length > 0 ? names.join(', ') : (m?.filiere ?? ''))
      })
      .catch(() => setMember(null))
  }, [profile?.universityId, profile?.displayName, user?.uid])

  async function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault()
    setInfoMsg(null)
    if (!user || !profile) return
    if (!displayName.trim()) {
      setInfoMsg('Le nom complet est requis.')
      return
    }
    setSavingInfo(true)
    try {
      await updateOwnProfile(
        profile.universityId,
        user.uid,
        { displayName: displayName.trim(), telephone: telephone.trim() },
        'teacher'
      )
      setInfoMsg('Profil mis à jour.')
    } catch {
      setInfoMsg('Échec de la mise à jour du profil.')
    } finally {
      setSavingInfo(false)
    }
  }

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
      await updateOwnProfile(
        profile.universityId,
        user.uid,
        { motDePasse: newPw, motDePasseActuel: currentPw },
        'teacher'
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
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Mon profil</h1>
        <p className="text-sm text-zinc-500 dark:text-orange-300/40 mt-1">Informations enseignant et sécurité du compte</p>
      </div>

      {/* Header card */}
      <div className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 overflow-hidden">
        <div className="h-20 bg-orange-950/30 border-b border-zinc-200 dark:border-orange-500/10" />
        <div className="px-6 pb-6">
          <div className="-mt-9 mb-4 flex items-end gap-4">
            <div className="w-16 h-16 rounded-full bg-orange-500 border-4 border-zinc-200 dark:border-zinc-950 flex items-center justify-center shadow-lg shrink-0">
              <User className="h-8 w-8 text-white" />
            </div>
            <span className="mb-1 inline-flex items-center rounded-full bg-orange-500/15 border border-orange-500/30 px-3 py-0.5 text-xs font-semibold text-blue-600 dark:text-orange-400 uppercase tracking-wider">
              Enseignant
            </span>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{displayName || 'Enseignant(e)'}</h2>
          <p className="text-sm text-blue-600 dark:text-orange-400/70 mt-0.5">{email}</p>
        </div>
      </div>

      {/* Editable info */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-orange-100/80 mb-4">Informations modifiables</h2>
        <div className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 p-6">
          <form onSubmit={handleInfoSubmit} className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-600 dark:text-zinc-400">Nom complet</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Votre nom complet"
                className="w-full bg-[#fafafa] dark:bg-black border border-orange-500/20 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-600 dark:text-zinc-400">Téléphone</label>
              <input
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+225 07 00 00 00 00"
                className="w-full bg-[#fafafa] dark:bg-black border border-orange-500/20 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
              />
            </div>
            {infoMsg && (
              <p className="flex items-center gap-2 text-blue-700 dark:text-orange-300 text-sm bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2.5">
                <CheckCircle2 size={15} /> {infoMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={savingInfo}
              className="flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {savingInfo && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
              <Save size={15} />
              Enregistrer
            </button>
          </form>
        </div>
      </div>

      {/* Read-only info */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-orange-100/80">Informations gérées par l&apos;université</h2>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 text-[11px] font-medium">
            🔒
          </span>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 px-6 py-2">
          <ReadOnlyRow icon={Mail} label="Adresse e-mail" value={email} />
          <ReadOnlyRow icon={Tag} label="Filière(s) assignée(s)" value={filiereLabel} />
          <ReadOnlyRow icon={Hash} label="Matricule" value={member?.matricule ?? ''} />
          <ReadOnlyRow icon={Building2} label="Identifiant université" value={universityId} />
        </div>
      </div>

      {/* Security */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-orange-400" />
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-orange-100/80">Sécurité</h2>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 p-6">
          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-600 dark:text-zinc-400">Mot de passe actuel</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#fafafa] dark:bg-black border border-orange-500/20 rounded-xl px-4 py-2.5 pr-10 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
                />
                <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300">
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-600 dark:text-zinc-400">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#fafafa] dark:bg-black border border-orange-500/20 rounded-xl px-4 py-2.5 pr-10 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
                />
                <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300">
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-600 dark:text-zinc-400">Confirmer le nouveau mot de passe</label>
              <input
                type={showNew ? 'text' : 'password'}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#fafafa] dark:bg-black border border-orange-500/20 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
              />
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-orange-300/40">Minimum 8 caractères, une majuscule et un chiffre.</p>

            {pwError && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{pwError}</p>
            )}
            {pwSuccess && (
              <p className="flex items-center gap-2 text-blue-700 dark:text-orange-300 text-sm bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2.5">
                <CheckCircle2 size={15} /> Mot de passe mis à jour avec succès.
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
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
