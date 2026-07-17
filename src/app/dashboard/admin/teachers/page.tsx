'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { UserPlus, X, Pencil, Trash2, Clock, Wifi, AlertTriangle, Mail, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usePlan } from '@/hooks/usePlan'
import { getPlanConfig } from '@/lib/plans'
import { getUniversityMembers, updateMemberProfile, getFilieres, getMatieres, removeMember } from '@/lib/db'
import type { Filiere, Matiere } from '@/types/filiere'
import { createMemberViaApi } from '@/lib/members-client'
import { EmailEditModal } from '@/components/admin/email-edit-modal'
import { MemberAvatar } from '@/components/ui/member-avatar'

interface Teacher {
  uid?: string
  id: string
  nom: string
  prenom: string
  email: string
  telephone?: string
  filiereIds: string[]   // un enseignant peut intervenir dans PLUSIEURS filières
  matieres: string[]
  chargeHoraire: number
  photoUrl?: string
}

type FormState = {
  nom: string
  prenom: string
  email: string
  telephone: string
  filiereIds: string[]   // filières sélectionnées (drive la cascade matières)
  matieres: string[]     // matières enseignées (saisies ou choisies)
  chargeHoraire: string
}
const emptyForm: FormState = {
  nom: '', prenom: '', email: '', telephone: '',
  filiereIds: [], matieres: [], chargeHoraire: '0',
}

export default function TeachersPage() {
  const { profile } = useAuth()
  const { plan, isWithinLimit } = usePlan(profile?.universityId ?? '')
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [fbLoading, setFbLoading] = useState(true)
  const [limitError, setLimitError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [emailTarget, setEmailTarget] = useState<Teacher | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!profile?.universityId) return
    const universityId = profile.universityId
    let active = true
    ;(async () => {
      try {
        // Les filières sont nécessaires AVANT les enseignants pour la migration
        // douce (retrouver l'ID d'une ancienne filière stockée sous forme de nom).
        const [fils, members] = await Promise.all([
          getFilieres(universityId),
          getUniversityMembers(universityId, 'teacher'),
        ])
        if (!active) return
        setFilieres(fils)
        const idByNom = new Map(fils.map((f) => [f.nom, f.id]))
        const fbTeachers: Teacher[] = members.map((m, i) => {
          const parts = m.displayName.split(' ')
          // Migration douce : si `filiereIds` est absent mais l'ancien champ
          // `filiere` (nom unique) est présent, on le convertit en [id].
          const legacyId = m.filiere ? idByNom.get(m.filiere) : undefined
          const filiereIds = m.filiereIds ?? (legacyId ? [legacyId] : [])
          return {
            uid: m.uid,
            id: `ENS-${String(i + 1).padStart(3, '0')}`,
            nom: parts.slice(1).join(' ') || m.displayName,
            prenom: parts[0] ?? '',
            email: m.email,
            telephone: m.telephone ?? '',
            filiereIds,
            matieres: m.matieres ?? [],
            chargeHoraire: m.chargeHoraire ?? 0,
            photoUrl: m.photoUrl,
          }
        })
        setTeachers(fbTeachers)
      } catch {
        if (active) { setFilieres([]); setTeachers([]) }
      } finally {
        if (active) setFbLoading(false)
      }
    })()
    return () => { active = false }
  }, [profile?.universityId])

  // Cascade : recharge l'UNION des matières de toutes les filières sélectionnées.
  useEffect(() => {
    const universityId = profile?.universityId
    let active = true
    ;(async () => {
      if (!universityId || form.filiereIds.length === 0) {
        if (active) setMatieres([])
        return
      }
      try {
        const lists = await Promise.all(
          form.filiereIds.map((fid) => getMatieres(universityId, fid))
        )
        if (!active) return
        // Dédoublonnage par nom (une même matière peut exister dans plusieurs filières).
        const seen = new Set<string>()
        const merged: Matiere[] = []
        for (const list of lists) {
          for (const m of list) {
            if (!seen.has(m.nom)) { seen.add(m.nom); merged.push(m) }
          }
        }
        setMatieres(merged)
      } catch {
        if (active) setMatieres([])
      }
    })()
    return () => { active = false }
  }, [profile?.universityId, form.filiereIds])

  // id filière → nom (pour l'affichage des pills).
  const filiereNom = useMemo(() => {
    const map = new Map(filieres.map((f) => [f.id, f.nom]))
    return (id: string) => map.get(id) ?? id
  }, [filieres])

  // Options de matières proposées : union chargée + celles déjà sélectionnées
  // (pour ne jamais masquer une matière retenue si sa filière est décochée).
  const matiereOptions = useMemo(
    () => [...new Set([...matieres.map((m) => m.nom), ...form.matieres])],
    [matieres, form.matieres]
  )

  function openAdd() {
    if (!isWithinLimit('maxEnseignants', teachers.length)) {
      const max = getPlanConfig(plan ?? undefined).features.maxEnseignants
      setLimitError(`Limite de ${max} enseignants atteinte pour le plan ${getPlanConfig(plan ?? undefined).nom}. Passez au plan supérieur.`)
      return
    }
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(teacher: Teacher) {
    setEditingId(teacher.id)
    setForm({
      nom: teacher.nom,
      prenom: teacher.prenom,
      email: teacher.email,
      telephone: teacher.telephone ?? '',
      filiereIds: teacher.filiereIds,
      matieres: teacher.matieres,
      chargeHoraire: String(teacher.chargeHoraire),
    })
    setShowModal(true)
  }

  // Coche / décoche une filière (multi-sélection). Les matières déjà retenues
  // sont conservées ; la cascade recalcule seulement les options proposées.
  function toggleFiliere(id: string) {
    setForm((prev) => ({
      ...prev,
      filiereIds: prev.filiereIds.includes(id)
        ? prev.filiereIds.filter((x) => x !== id)
        : [...prev.filiereIds, id],
    }))
  }

  function toggleMatiere(nom: string) {
    setForm((prev) => ({
      ...prev,
      matieres: prev.matieres.includes(nom)
        ? prev.matieres.filter((m) => m !== nom)
        : [...prev.matieres, nom],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const matieres = form.matieres.map((m) => m.trim()).filter(Boolean)
    const chargeHoraire = Number(form.chargeHoraire) || 0

    if (editingId) {
      const teacher = teachers.find((t) => t.id === editingId)
      // Sans compte synchronisé, aucune persistance possible : on le signale
      // au lieu d'afficher un faux succès.
      if (!teacher?.uid || !profile?.universityId) {
        setCreateError("Enseignant non synchronisé : la modification ne peut pas être enregistrée.")
        return
      }
      setSubmitting(true)
      setCreateError(null)
      try {
        await updateMemberProfile(profile.universityId, teacher.uid, {
          // Tableau complet réécrit à chaque fois (pas d'ajout/retrait partiel).
          filiereIds: form.filiereIds,
          telephone: form.telephone,
          chargeHoraire,
          matieres,
        })
      } catch (err) {
        // L'écriture Firebase a échoué : erreur claire, pas de mise à jour locale.
        setCreateError(err instanceof Error ? err.message : "L'enregistrement des modifications a échoué.")
        setSubmitting(false)
        return
      }
      setTeachers((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? { ...t, nom: form.nom, prenom: form.prenom, email: form.email, telephone: form.telephone, filiereIds: form.filiereIds, matieres, chargeHoraire }
            : t
        )
      )
      setToast('Modifications enregistrées.')
      setTimeout(() => setToast(null), 4000)
      setForm(emptyForm)
      setEditingId(null)
      setShowModal(false)
      setSubmitting(false)
      return
    }

    // Création d'un VRAI compte enseignant (Auth + email d'accès) via l'API.
    if (!profile?.universityId) {
      setCreateError("Aucune université active. Impossible de créer le compte.")
      return
    }
    const displayName = `${form.prenom} ${form.nom}`.trim()
    setSubmitting(true)
    setCreateError(null)
    try {
      const result = await createMemberViaApi({
        universityId: profile.universityId,
        email: form.email,
        displayName,
        role: 'teacher',
        filiereIds: form.filiereIds,
        telephone: form.telephone,
        chargeHoraire,
        matieres,
      })
      const newTeacher: Teacher = {
        uid: result.uid,
        id: `ENS-${String(teachers.length + 1).padStart(3, '0')}`,
        nom: form.nom,
        prenom: form.prenom,
        email: form.email,
        telephone: form.telephone,
        filiereIds: form.filiereIds,
        matieres,
        chargeHoraire,
      }
      setTeachers((prev) => [newTeacher, ...prev])
      setToast(
        result.emailSent
          ? `Compte créé. Email d'accès envoyé à ${form.email}.`
          : `Compte créé. ⚠️ Email non envoyé — mot de passe temporaire : ${result.tempPassword}`
      )
      setTimeout(() => setToast(null), result.emailSent ? 5000 : 15000)
      setForm(emptyForm)
      setEditingId(null)
      setShowModal(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Échec de la création.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    const universityId = profile?.universityId
    if (!deleteTarget || !universityId) return
    // Enseignant sans compte synchronisé (pas d'uid) : rien à supprimer côté
    // Firebase. On le signale plutôt que d'afficher un faux succès.
    if (!deleteTarget.uid) {
      setCreateError("Enseignant non synchronisé : la suppression ne peut pas être enregistrée.")
      setDeleteTarget(null)
      return
    }
    setDeleting(true)
    setCreateError(null)
    try {
      await removeMember(universityId, deleteTarget.uid)
    } catch (err) {
      // Écriture Firebase échouée : erreur claire, aucune modification locale.
      setCreateError(err instanceof Error ? err.message : 'La suppression a échoué.')
      setDeleting(false)
      return
    }
    // Succès confirmé : on retire alors seulement l'entrée du state local.
    setTeachers((prev) => prev.filter((t) => t.uid !== deleteTarget.uid))
    setToast('Enseignant supprimé.')
    setTimeout(() => setToast(null), 4000)
    setDeleteTarget(null)
    setDeleting(false)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setForm(emptyForm)
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
      <div className="flex justify-end">
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors"
        >
          <UserPlus size={16} />
          Ajouter un enseignant
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {teachers.map((teacher) => (
          <div key={teacher.id} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3 min-w-0">
                <MemberAvatar photoUrl={teacher.photoUrl} name={`${teacher.prenom} ${teacher.nom}`} size={36} />
                <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-zinc-900 dark:text-white font-semibold">{teacher.nom} {teacher.prenom}</p>
                  {teacher.uid && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                      <Wifi size={9} />
                      Inscrit
                    </span>
                  )}
                </div>
                <p className="text-zinc-500 text-xs mt-0.5 truncate">{teacher.email}</p>
                </div>
              </div>
              <div className="flex gap-1">
                {teacher.uid && (
                  <button
                    onClick={() => setEmailTarget(teacher)}
                    className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-blue-800 dark:hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                    title="Corriger l'email"
                  >
                    <Mail size={14} />
                  </button>
                )}
                <button
                  onClick={() => openEdit(teacher)}
                  className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-blue-800 dark:hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                  title="Modifier"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteTarget(teacher)}
                  className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Filières</p>
              {teacher.filiereIds.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {teacher.filiereIds.map((fid) => (
                    <span
                      key={fid}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-blue-600 dark:text-orange-400 text-xs font-medium"
                    >
                      {filiereNom(fid)}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-zinc-600">Aucune filière assignée</span>
              )}
            </div>

            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Cours assignés</p>
              <div className="flex flex-wrap gap-1.5">
                {teacher.matieres.map((m) => (
                  <span key={m} className="px-2 py-0.5 rounded-md bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 text-xs">
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-orange-500/5">
              <Clock size={14} className="text-zinc-500" />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Charge horaire :{' '}
                <span className="text-zinc-900 dark:text-white font-medium">{teacher.chargeHoraire}h / semaine</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {teachers.length === 0 && (
        <div className="text-center py-16 text-zinc-500">
          <p>Aucun enseignant enregistré.</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-8 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editingId ? 'Modifier l\'enseignant' : 'Ajouter un enseignant'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">Nom</label>
                  <input
                    required
                    type="text"
                    value={form.nom}
                    onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    placeholder="Ouattara"
                    className="w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">Prénom</label>
                  <input
                    required
                    type="text"
                    value={form.prenom}
                    onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                    placeholder="Jean-Baptiste"
                    className="w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">Email professionnel</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="enseignant@university.ci"
                  className="w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
                />
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

              {/* Filières — multi-sélection : un enseignant peut intervenir dans plusieurs */}
              <div>
                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">Filières enseignées</label>
                {filieres.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {filieres.map((f) => {
                        const selected = form.filiereIds.includes(f.id)
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => toggleFiliere(f.id)}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                              selected
                                ? 'bg-orange-500/20 border-orange-500/40 text-blue-700 dark:text-orange-300'
                                : 'bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-white/20'
                            }`}
                          >
                            {f.nom}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-orange-200/40 mt-1.5">
                      Cochez toutes les filières où intervient cet enseignant.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-zinc-600 dark:text-orange-200/60">
                    Aucune filière disponible — créez d&apos;abord vos filières dans{' '}
                    <Link href="/dashboard/admin/filieres" className="text-blue-600 dark:text-orange-400 underline hover:text-blue-900 dark:hover:text-orange-300">
                      Filières &amp; Matières
                    </Link>
                    .
                  </p>
                )}
              </div>

              {/* Matières enseignées — union des matières des filières sélectionnées */}
              <div>
                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">Matières enseignées</label>
                {matiereOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {matiereOptions.map((nom) => {
                      const selected = form.matieres.includes(nom)
                      return (
                        <button
                          key={nom}
                          type="button"
                          onClick={() => toggleMatiere(nom)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                            selected
                              ? 'bg-orange-500/20 border-orange-500/40 text-blue-700 dark:text-orange-300'
                              : 'bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-white/20'
                          }`}
                        >
                          {nom}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={form.matieres.join(', ')}
                      onChange={(e) =>
                        setForm({ ...form, matieres: e.target.value.split(',').map((m) => m.trimStart()) })
                      }
                      placeholder="Saisir les matières (séparées par des virgules)"
                      className="w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
                    />
                    <p className="text-xs text-zinc-600 dark:text-orange-200/60 mt-1.5">
                      {form.filiereIds.length > 0
                        ? 'Aucune matière dans ces filières — '
                        : 'Sélectionnez au moins une filière pour choisir ses matières, ou '}
                      créez vos matières dans{' '}
                      <Link href="/dashboard/admin/filieres" className="text-blue-600 dark:text-orange-400 underline hover:text-blue-900 dark:hover:text-orange-300">
                        Filières &amp; Matières
                      </Link>
                      .
                    </p>
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">Charge horaire (h/semaine)</label>
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={form.chargeHoraire}
                  onChange={(e) => setForm({ ...form, chargeHoraire: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-500/50"
                />
              </div>

              {!editingId && (
                <div className="flex items-start gap-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20 px-4 py-3">
                  <Mail size={15} className="text-blue-600 dark:text-orange-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-600 dark:text-orange-200/70 leading-relaxed">
                    Un email avec les accès sera envoyé automatiquement à
                    l&apos;enseignant. Il devra changer son mot de passe à la
                    première connexion.
                  </p>
                </div>
              )}

              </div>

              <div className="flex gap-3 pt-6 shrink-0">
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
                  {editingId ? 'Enregistrer les modifications' : submitting ? 'Création…' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Correction d'email (comptes Auth) */}
      {emailTarget?.uid && profile?.universityId && (
        <EmailEditModal
          target={{
            uid: emailTarget.uid,
            displayName: `${emailTarget.prenom} ${emailTarget.nom}`.trim(),
            email: emailTarget.email,
          }}
          universityId={profile.universityId}
          onClose={() => setEmailTarget(null)}
          onUpdated={(newEmail, warning) => {
            setTeachers((prev) =>
              prev.map((t) => (t.uid === emailTarget.uid ? { ...t, email: newEmail } : t))
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
          <div className="bg-white dark:bg-zinc-950 border border-red-500/20 rounded-2xl p-8 w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-start gap-4 mb-6 flex-1 min-h-0 overflow-y-auto">
              <div className="p-2 bg-red-500/10 rounded-xl shrink-0">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white mb-1">Supprimer l&apos;enseignant</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Voulez-vous vraiment supprimer{' '}
                  <span className="text-zinc-900 dark:text-white font-medium">{deleteTarget.nom} {deleteTarget.prenom}</span>{' '}
                  ? Cette action est irréversible.
                </p>
              </div>
            </div>
            <div className="flex gap-3 shrink-0">
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
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Limit toast */}
      {limitError && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm flex items-start gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 shadow-2xl">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm flex-1">{limitError}</p>
          <button onClick={() => setLimitError(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Erreur de création */}
      {createError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-60 max-w-md flex items-start gap-3 bg-white dark:bg-zinc-900 border border-red-500/30 rounded-xl px-4 py-3 shadow-2xl">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm flex-1">{createError}</p>
          <button onClick={() => setCreateError(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Toast succès création */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-60 max-w-sm flex items-start gap-3 bg-white dark:bg-zinc-900 border border-orange-500/25 rounded-xl px-4 py-3 shadow-2xl">
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
