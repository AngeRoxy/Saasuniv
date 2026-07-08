'use client'

import { useState } from 'react'
import {
  User,
  Mail,
  Building2,
  Shield,
  Copy,
  Check,
  Pencil,
  X,
  Phone,
  Briefcase,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { updateOwnProfile } from '@/lib/auth'

export default function AdminProfilePage() {
  const { user, profile } = useAuth()

  // --- copy university id ---
  const [copied, setCopied] = useState(false)

  function copyUniversityId() {
    if (!profile?.universityId) return
    navigator.clipboard.writeText(profile.universityId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // --- editable profile state ---
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')

  // --- edit modal ---
  const [modalOpen, setModalOpen] = useState(false)
  const [firstName, setFirstName] = useState(() => {
    const parts = (profile?.displayName ?? '').split(' ')
    return parts[0] ?? ''
  })
  const [lastName, setLastName] = useState(() => {
    const parts = (profile?.displayName ?? '').split(' ')
    return parts.slice(1).join(' ')
  })
  const [phone, setPhone] = useState('')
  const [title, setTitle] = useState('')

  function openModal() {
    const parts = displayName.split(' ')
    setFirstName(parts[0] ?? '')
    setLastName(parts.slice(1).join(' '))
    setModalOpen(true)
  }

  const [savingInfo, setSavingInfo] = useState(false)

  async function saveModal() {
    const full = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
    if (!full || !user || !profile) {
      setModalOpen(false)
      return
    }
    setSavingInfo(true)
    try {
      await updateOwnProfile(
        profile.universityId,
        user.uid,
        { displayName: full, telephone: phone.trim() },
        'admin_universite'
      )
      setDisplayName(full)
    } catch {
      /* on garde l'affichage local même si la persistance échoue */
      setDisplayName(full)
    } finally {
      setSavingInfo(false)
      setModalOpen(false)
    }
  }

  // --- password section ---
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwMessage, setPwMessage] = useState<string | null>(null)

  const [pwSubmitting, setPwSubmitting] = useState(false)

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwMessage(null)

    if (newPw.length < 8) {
      setPwMessage('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (!/[A-Z]/.test(newPw) || !/[0-9]/.test(newPw)) {
      setPwMessage('Le mot de passe doit contenir au moins une majuscule et un chiffre.')
      return
    }
    if (newPw !== confirmPw) {
      setPwMessage('Les mots de passe ne correspondent pas.')
      return
    }
    if (!user || !profile) {
      setPwMessage('Session introuvable. Reconnectez-vous.')
      return
    }

    setPwSubmitting(true)
    try {
      await updateOwnProfile(
        profile.universityId,
        user.uid,
        { motDePasse: newPw, motDePasseActuel: currentPw },
        'admin_universite'
      )
      setPwMessage('Mot de passe mis à jour avec succès.')
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      setPwMessage(
        code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? 'Mot de passe actuel incorrect.'
          : code === 'auth/requires-recent-login'
            ? 'Reconnectez-vous puis réessayez.'
            : 'Impossible de mettre à jour le mot de passe.'
      )
    } finally {
      setPwSubmitting(false)
    }
  }

  const createdAt = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—'

  return (
    <>
      <div className="max-w-2xl space-y-6">

        {/* Avatar + name */}
        <div className="bg-zinc-950 border border-orange-500/10 rounded-2xl p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
            <User size={28} className="text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xl font-bold truncate">{displayName || 'Administrateur'}</p>
            <p className="text-zinc-400 text-sm mt-0.5 truncate">{user?.email}</p>
            <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium">
              <Shield size={11} />
              Administrateur université
            </span>
          </div>
          <button
            onClick={openModal}
            className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium hover:bg-orange-500/20 transition-colors"
          >
            <Pencil size={14} />
            Modifier le profil
          </button>
        </div>

        {/* Info cards */}
        <div className="bg-zinc-950 border border-orange-500/10 rounded-2xl p-6 space-y-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Informations du compte</p>

          <div className="space-y-4">

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <User size={14} className="text-zinc-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Nom complet</p>
                <p className="text-white text-sm font-medium">{displayName || '—'}</p>
              </div>
            </div>

            {title && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <Briefcase size={14} className="text-zinc-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Poste / Titre</p>
                  <p className="text-white text-sm font-medium">{title}</p>
                </div>
              </div>
            )}

            {phone && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <Phone size={14} className="text-zinc-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Téléphone</p>
                  <p className="text-white text-sm font-medium">{phone}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <Mail size={14} className="text-zinc-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Adresse email</p>
                <p className="text-white text-sm font-medium">{user?.email ?? '—'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <Building2 size={14} className="text-zinc-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-zinc-500">Code université</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-white text-sm font-medium font-mono">{profile?.universityId ?? '—'}</p>
                  {profile?.universityId && (
                    <button
                      onClick={copyUniversityId}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs transition-colors bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20"
                    >
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                      {copied ? 'Copié !' : 'Copier'}
                    </button>
                  )}
                </div>
                <p className="text-zinc-600 text-xs mt-1">
                  Partagez ce code avec vos enseignants, étudiants et parents pour qu&apos;ils puissent rejoindre votre université.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Account details */}
        <div className="bg-zinc-950 border border-orange-500/10 rounded-2xl p-6 space-y-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Détails du compte</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-1">Rôle</p>
              <p className="text-white text-sm font-medium">Admin université</p>
            </div>
            <div className="bg-black/40 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-1">Compte créé le</p>
              <p className="text-white text-sm font-medium">{createdAt}</p>
            </div>
            <div className="bg-black/40 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-1">UID Firebase</p>
              <p className="text-zinc-400 text-xs font-mono truncate">{user?.uid ?? '—'}</p>
            </div>
            <div className="bg-black/40 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-1">Email vérifié</p>
              <p className={`text-sm font-medium ${user?.emailVerified ? 'text-green-400' : 'text-yellow-400'}`}>
                {user?.emailVerified ? 'Oui' : 'Non'}
              </p>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="bg-zinc-950 border border-orange-500/10 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-orange-400" />
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Changer le mot de passe</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Mot de passe actuel</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/40 border border-orange-500/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/40 border border-orange-500/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Confirmer le nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/40 border border-orange-500/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {pwMessage && (
              <p className="text-sm text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3">
                {pwMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={pwSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-semibold transition-colors"
            >
              {pwSubmitting && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
              Mettre à jour le mot de passe
            </button>

          </form>
        </div>

      </div>

      {/* Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setModalOpen(false)}
          />

          <div className="relative w-full max-w-md bg-zinc-950 border border-orange-500/20 rounded-2xl p-6 space-y-5 shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil size={16} className="text-orange-400" />
                <h3 className="text-white font-semibold">Modifier le profil</h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Fields */}
            <div className="space-y-4">

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Prénom</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Prénom"
                    className="w-full bg-black/40 border border-orange-500/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Nom</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Nom de famille"
                    className="w-full bg-black/40 border border-orange-500/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Téléphone</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    className="w-full bg-black/40 border border-orange-500/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Poste / Titre</label>
                <div className="relative">
                  <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex : Directeur des études"
                    className="w-full bg-black/40 border border-orange-500/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                  />
                </div>
              </div>

              {/* Read-only fields */}
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Email (non modifiable)</label>
                <div className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-zinc-500 cursor-not-allowed select-none">
                  {user?.email ?? '—'}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Code université (non modifiable)</label>
                <div className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-zinc-500 font-mono cursor-not-allowed select-none">
                  {profile?.universityId ?? '—'}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-orange-500/20 text-zinc-400 text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={saveModal}
                disabled={savingInfo}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-black text-sm font-semibold transition-colors"
              >
                {savingInfo && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                Enregistrer
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
