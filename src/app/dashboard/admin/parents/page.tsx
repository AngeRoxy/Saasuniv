'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { UserPlus, X, Wifi, AlertTriangle, Mail, CheckCircle2, Users, Baby, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getUniversityMembers,
  updateMemberProfile,
  removeMember,
  syncParentEnfants,
  detachEnfantsFromParent,
} from '@/lib/db'
import { createMemberViaApi } from '@/lib/members-client'
import { EmailEditModal } from '@/components/admin/email-edit-modal'

interface Parent {
  uid: string
  displayName: string
  email: string
  telephone?: string
  enfantUids: string[]
}

interface StudentOption {
  uid: string
  displayName: string
  filiere?: string
  niveau?: string
}

type FormState = { displayName: string; email: string; telephone: string; enfantUids: string[] }
const emptyForm: FormState = { displayName: '', email: '', telephone: '', enfantUids: [] }

export default function ParentsPage() {
  const { profile } = useAuth()
  const [parents, setParents] = useState<Parent[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [fbLoading, setFbLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editingUid, setEditingUid] = useState<string | null>(null)
  // enfantUids du parent AU MOMENT de l'ouverture de l'édition : sert à calculer
  // le delta (enfants ajoutés / retirés) à la sauvegarde.
  const [editEnfantsInitial, setEditEnfantsInitial] = useState<string[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [emailTarget, setEmailTarget] = useState<Parent | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Parent | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Source unique de (re)chargement depuis Firebase — appelée au montage ET
  // après chaque mutation (édition / suppression) pour éviter tout désync : on
  // refait TOUJOURS un vrai refetch plutôt qu'une manipulation manuelle du state.
  const loadData = useCallback(async (universityId: string) => {
    const [parentMembers, studentMembers] = await Promise.all([
      getUniversityMembers(universityId, 'parent'),
      getUniversityMembers(universityId, 'student'),
    ])
    setParents(
      parentMembers.map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        email: p.email,
        telephone: p.telephone,
        enfantUids: p.enfantUids ?? [],
      }))
    )
    setStudents(
      studentMembers.map((s) => ({
        uid: s.uid,
        displayName: s.displayName,
        filiere: s.filiere,
        niveau: s.niveau,
      }))
    )
  }, [])

  useEffect(() => {
    if (!profile?.universityId) return
    const universityId = profile.universityId
    let active = true
    ;(async () => {
      try {
        await loadData(universityId)
      } catch {
        if (active) {
          setParents([])
          setStudents([])
        }
      } finally {
        if (active) setFbLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [profile?.universityId, loadData])

  const studentById = useMemo(() => {
    const map = new Map<string, StudentOption>()
    students.forEach((s) => map.set(s.uid, s))
    return map
  }, [students])

  // Noms des enfants d'un parent (pour l'affichage et l'avertissement de suppression).
  function enfantNoms(enfantUids: string[]): string[] {
    return enfantUids.map((uid) => studentById.get(uid)?.displayName ?? 'Étudiant inconnu')
  }

  function openAdd() {
    setEditingUid(null)
    setEditEnfantsInitial([])
    setForm(emptyForm)
    setCreateError(null)
    setShowModal(true)
  }

  function openEdit(parent: Parent) {
    setEditingUid(parent.uid)
    setEditEnfantsInitial(parent.enfantUids)
    setForm({
      displayName: parent.displayName,
      email: parent.email,
      telephone: parent.telephone ?? '',
      enfantUids: [...parent.enfantUids],
    })
    setCreateError(null)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingUid(null)
    setEditEnfantsInitial([])
    setForm(emptyForm)
  }

  function toggleEnfant(uid: string) {
    setForm((prev) => ({
      ...prev,
      enfantUids: prev.enfantUids.includes(uid)
        ? prev.enfantUids.filter((x) => x !== uid)
        : [...prev.enfantUids, uid],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.universityId) {
      setCreateError("Aucune université active. Impossible d'enregistrer.")
      return
    }
    const universityId = profile.universityId

    // ─── Modification d'un parent existant ───────────────────────────────────
    if (editingUid) {
      setSubmitting(true)
      setCreateError(null)
      try {
        // 1. Profil (displayName, telephone). L'email N'EST PAS modifiable ici
        //    (passe par /api/admin-update-email via l'action « Corriger l'email »).
        await updateMemberProfile(universityId, editingUid, {
          displayName: form.displayName,
          telephone: form.telephone,
        })
        // 2. Liens enfants : réécrit enfantUids sur le parent et resynchronise
        //    parentUid sur les enfants ajoutés / retirés (delta vs l'initial).
        await syncParentEnfants(universityId, editingUid, form.enfantUids, editEnfantsInitial)
      } catch (err) {
        // Écriture Firebase échouée : erreur claire, on GARDE le modal ouvert et
        // les données saisies pour permettre un nouvel essai.
        setCreateError(err instanceof Error ? err.message : "L'enregistrement des modifications a échoué.")
        setSubmitting(false)
        return
      }
      // Succès confirmé : refetch complet depuis Firebase, puis fermeture.
      setToast('Modifications enregistrées.')
      try {
        await loadData(universityId)
      } catch {
        setToast('Modifications enregistrées. (Actualisez la page pour rafraîchir la liste.)')
      }
      setTimeout(() => setToast(null), 4000)
      closeModal()
      setSubmitting(false)
      return
    }

    // ─── Création d'un nouveau compte parent (Auth + email d'accès) ───────────
    setSubmitting(true)
    setCreateError(null)
    try {
      const result = await createMemberViaApi({
        universityId,
        email: form.email,
        displayName: form.displayName,
        role: 'parent',
        telephone: form.telephone,
        enfantUids: form.enfantUids.length ? form.enfantUids : undefined,
      })
      setParents((prev) => [
        {
          uid: result.uid,
          displayName: form.displayName,
          email: form.email,
          telephone: form.telephone,
          enfantUids: form.enfantUids,
        },
        ...prev,
      ])
      setToast(
        result.emailSent
          ? `Compte créé. Email d'accès envoyé à ${form.email}.`
          : `Compte créé. ⚠️ Email non envoyé — mot de passe temporaire : ${result.tempPassword}`
      )
      setTimeout(() => setToast(null), result.emailSent ? 5000 : 15000)
      closeModal()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Échec de la création.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    const universityId = profile?.universityId
    if (!deleteTarget || !universityId) return
    setDeleting(true)
    setCreateError(null)

    // a. Détacher chaque enfant lié (parentUid effacé) AVANT de supprimer le
    //    parent, pour ne pas laisser de références orphelines.
    try {
      if (deleteTarget.enfantUids.length > 0) {
        await detachEnfantsFromParent(universityId, deleteTarget.enfantUids)
      }
    } catch (err) {
      setCreateError(
        `Étape « détachement des enfants » échouée : ${
          err instanceof Error ? err.message : 'erreur inconnue'
        }. Le parent n'a PAS été supprimé.`
      )
      setDeleting(false)
      return
    }

    // b. Supprimer le parent de /members.
    try {
      await removeMember(universityId, deleteTarget.uid)
    } catch (err) {
      setCreateError(
        `Étape « suppression du parent » échouée : ${
          err instanceof Error ? err.message : 'erreur inconnue'
        }. Les enfants ont été détachés — réessayez la suppression.`
      )
      setDeleting(false)
      return
    }

    // c. Succès confirmé : refetch depuis Firebase.
    setToast('Parent supprimé. Les enfants liés ont été détachés.')
    try {
      await loadData(universityId)
    } catch {
      setToast('Parent supprimé. (Actualisez la page pour rafraîchir la liste.)')
    }
    setTimeout(() => setToast(null), 5000)
    setDeleteTarget(null)
    setDeleting(false)
  }

  if (fbLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {parents.length} parent{parents.length !== 1 ? 's' : ''} enregistré{parents.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors"
        >
          <UserPlus size={16} />
          Ajouter un parent
        </button>
      </div>

      {parents.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <Users size={28} className="mx-auto mb-3 text-zinc-700" />
          <p>Aucun parent enregistré.</p>
          <p className="text-xs text-zinc-600 mt-1">Créez un compte parent et liez-le à ses enfants.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {parents.map((parent) => (
            <div key={parent.uid} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-zinc-900 dark:text-white font-semibold">{parent.displayName}</p>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                      <Wifi size={9} />
                      Inscrit
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs mt-0.5">{parent.email}</p>
                  {parent.telephone && <p className="text-zinc-500 text-xs mt-0.5">{parent.telephone}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setEmailTarget(parent)}
                    className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-blue-800 dark:hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                    title="Corriger l'email"
                  >
                    <Mail size={14} />
                  </button>
                  <button
                    onClick={() => openEdit(parent)}
                    className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-blue-800 dark:hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                    title="Modifier"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(parent)}
                    className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Baby size={12} />
                  Enfants liés
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {parent.enfantUids.length === 0 && (
                    <span className="text-zinc-600 text-xs">Aucun enfant lié</span>
                  )}
                  {parent.enfantUids.map((uid) => {
                    const child = studentById.get(uid)
                    return (
                      <span
                        key={uid}
                        className="px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 text-blue-700 dark:text-orange-300 text-xs"
                      >
                        {child?.displayName ?? 'Étudiant inconnu'}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editingUid ? 'Modifier le parent' : 'Ajouter un parent'}
              </h2>
              <button onClick={closeModal} disabled={submitting} className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">Nom complet</label>
                <input
                  required
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="Kouassi Jean"
                  className="w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={!!editingUid}
                  placeholder="parent@exemple.com"
                  className="w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {editingUid && (
                  <p className="text-[11px] text-zinc-500 mt-1.5">
                    L&apos;email ne se modifie pas ici. Utilisez l&apos;action « Corriger l&apos;email » (icône enveloppe) sur la fiche du parent.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">Téléphone</label>
                <input
                  type="tel"
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  placeholder="+225 07 00 00 00 00"
                  className="w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              {/* Multi-select enfants */}
              <div>
                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Enfants liés <span className="text-zinc-600">({form.enfantUids.length} sélectionné{form.enfantUids.length !== 1 ? 's' : ''})</span>
                </label>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-orange-500/20 bg-zinc-50 dark:bg-black/40 divide-y divide-zinc-200 dark:divide-white/5">
                  {students.length === 0 && (
                    <p className="px-4 py-3 text-xs text-zinc-600">Aucun étudiant disponible.</p>
                  )}
                  {students.map((s) => {
                    const selected = form.enfantUids.includes(s.uid)
                    return (
                      <button
                        key={s.uid}
                        type="button"
                        onClick={() => toggleEnfant(s.uid)}
                        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors ${
                          selected ? 'bg-orange-500/10' : 'hover:bg-zinc-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm text-zinc-900 dark:text-white truncate">{s.displayName}</span>
                          {(s.filiere || s.niveau) && (
                            <span className="block text-xs text-zinc-500 truncate">
                              {[s.filiere, s.niveau].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                        <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                          selected ? 'bg-orange-500 border-orange-500' : 'border-zinc-300 dark:border-zinc-600'
                        }`}>
                          {selected && <CheckCircle2 size={12} className="text-zinc-900 dark:text-white" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {!editingUid && (
                <div className="flex items-start gap-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20 px-4 py-3">
                  <Mail size={15} className="text-blue-600 dark:text-orange-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-600 dark:text-orange-200/70 leading-relaxed">
                    Un email avec les accès sera envoyé automatiquement au parent. Il
                    devra changer son mot de passe à la première connexion.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="flex-1 bg-white dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  {submitting
                    ? editingUid ? 'Enregistrement…' : 'Création…'
                    : editingUid ? 'Enregistrer les modifications' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Correction d'email */}
      {emailTarget && profile?.universityId && (
        <EmailEditModal
          target={{
            uid: emailTarget.uid,
            displayName: emailTarget.displayName,
            email: emailTarget.email,
          }}
          universityId={profile.universityId}
          onClose={() => setEmailTarget(null)}
          onUpdated={(newEmail, warning) => {
            setParents((prev) =>
              prev.map((p) => (p.uid === emailTarget.uid ? { ...p, email: newEmail } : p))
            )
            setEmailTarget(null)
            setToast(
              'Email mis à jour. Une notification a été envoyée à l\'ancienne et la nouvelle adresse.' +
                (warning ? ` (${warning})` : '')
            )
            setTimeout(() => setToast(null), warning ? 12000 : 6000)
          }}
        />
      )}

      {/* Confirmation de suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-red-500/20 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-2 bg-red-500/10 rounded-xl shrink-0">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white mb-1">Supprimer le parent</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Supprimer <span className="text-zinc-900 dark:text-white font-medium">{deleteTarget.displayName}</span> ?
                  Cette action retirera son accès à GestUniv.{' '}
                  {deleteTarget.enfantUids.length > 0 ? (
                    <>
                      Les enfants liés (
                      <span className="text-zinc-700 dark:text-zinc-300">{enfantNoms(deleteTarget.enfantUids).join(', ')}</span>
                      ) resteront dans le système mais ne seront plus rattachés à ce parent.
                    </>
                  ) : (
                    <>Ce parent n&apos;a aucun enfant lié.</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 bg-white dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting && <span className="w-4 h-4 border-2 border-zinc-300 dark:border-white/30 border-t-white rounded-full animate-spin" />}
                {deleting ? 'Suppression…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Erreur (création / modification / suppression) */}
      {createError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] max-w-md flex items-start gap-3 bg-white dark:bg-zinc-900 border border-red-500/30 rounded-xl px-4 py-3 shadow-2xl">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm flex-1">{createError}</p>
          <button onClick={() => setCreateError(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Toast succès */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] max-w-sm flex items-start gap-3 bg-white dark:bg-zinc-900 border border-orange-500/25 rounded-xl px-4 py-3 shadow-2xl">
          <CheckCircle2 size={16} className="text-blue-600 dark:text-orange-400 shrink-0 mt-0.5" />
          <p className="text-zinc-800 dark:text-orange-100 text-sm flex-1">{toast}</p>
          <button onClick={() => setToast(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
