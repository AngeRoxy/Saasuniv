'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Search, UserPlus, X, Pencil, Trash2, ChevronLeft, ChevronRight, AlertTriangle, Wifi, Mail, CheckCircle2, History, RotateCcw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usePlan } from '@/hooks/usePlan'
import { getPlanConfig } from '@/lib/plans'
import {
  getUniversityMembers,
  getManualStudents,
  getFilieres,
  updateManualStudent,
  updateMemberProfile,
  removeManualStudent,
  removeMember,
  getEtudiantsRedoublants,
  getParcoursEtudiant,
  type ParcoursAnnuel,
} from '@/lib/db'
import type { Filiere } from '@/types/filiere'
import { STATUT_PARCOURS_LABELS, STATUT_PARCOURS_STYLES, redoublementBadgeLabel } from '@/types/parcours'
import { createMemberViaApi } from '@/lib/members-client'
import { EmailEditModal } from '@/components/admin/email-edit-modal'

// ─── Types ────────────────────────────────────────────────────────────────────

type StudentStatus = 'Actif' | 'Inactif'

interface Student {
  uid?: string      // set for Firebase Auth-registered members
  fbKey?: string    // set for manually added RTDB records
  matricule: string
  nom: string
  prenom: string
  email: string
  telephone: string
  filiere: string
  niveau: string
  statut: StudentStatus
  parentUid?: string
}

interface ParentOption {
  uid: string
  displayName: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeStatut(raw: string | undefined): StudentStatus {
  // Les comptes créés par l'admin utilisent 'actif'/'inactif'/'premiere_connexion' ;
  // les étudiants manuels historiques utilisent 'Actif'/'Inactif'. On unifie ici.
  if (raw === 'Inactif' || raw === 'inactif') return 'Inactif'
  return 'Actif'
}

function generateMatricule(existing: Student[]): string {
  const year = new Date().getFullYear()
  const nums = existing
    .map((s) => parseInt(s.matricule.split('-')[2] ?? '0', 10))
    .filter(Number.isFinite)
  const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1
  return `STU-${year}-${String(next).padStart(4, '0')}`
}

type FormData = Omit<Student, 'matricule' | 'statut' | 'uid' | 'fbKey'>

const EMPTY_FORM: FormData = {
  prenom: '',
  nom: '',
  email: '',
  telephone: '',
  filiere: '',
  niveau: '',
  parentUid: '',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">{label}</label>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#fafafa] dark:bg-black border border-zinc-200 dark:border-zinc-800 focus:border-orange-500/60 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-600 focus:outline-none transition-colors"
      />
    </div>
  )
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  required,
  disabled,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  required?: boolean
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">{label}</label>
      <select
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#fafafa] dark:bg-black border border-zinc-200 dark:border-zinc-800 focus:border-orange-500/60 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none transition-colors appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="" disabled className="bg-white dark:bg-zinc-900">{placeholder ?? 'Choisir…'}</option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-white dark:bg-zinc-900">{o}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Student Modal ────────────────────────────────────────────────────────────

interface ModalProps {
  mode: 'add' | 'edit'
  initial: FormData
  matriculePreview: string
  parents: ParentOption[]
  filieres: Filiere[]
  submitting: boolean
  onSubmit: (data: FormData) => void
  onClose: () => void
}

function StudentModal({ mode, initial, matriculePreview, parents, filieres, submitting, onSubmit, onClose }: ModalProps) {
  const [form, setForm] = useState<FormData>(initial)

  function set(key: keyof FormData) {
    return (v: string) => setForm((prev) => ({ ...prev, [key]: v }))
  }

  // Cascade filière → niveau : les niveaux proposés sont ceux de la filière
  // choisie (saisis librement par l'université). Changer de filière réinitialise
  // le niveau pour éviter une combinaison incohérente.
  const selectedFiliere = filieres.find((f) => f.nom === form.filiere)
  const niveauOptions = selectedFiliere?.niveaux ?? []

  function handleFiliereChange(v: string) {
    setForm((prev) => ({ ...prev, filiere: v, niveau: '' }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-8 w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            {mode === 'add' ? 'Ajouter un étudiant' : 'Modifier l\'étudiant'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Prénom / Nom */}
          <div className="grid grid-cols-2 gap-4">
            <FieldInput label="Prénom" value={form.prenom} onChange={set('prenom')} placeholder="Yves" required />
            <FieldInput label="Nom" value={form.nom} onChange={set('nom')} placeholder="Konan" required />
          </div>

          {/* Email */}
          <FieldInput label="Email" type="email" value={form.email} onChange={set('email')} placeholder="etudiant@university.ci" required />

          {/* Téléphone */}
          <FieldInput label="Téléphone" type="tel" value={form.telephone} onChange={set('telephone')} placeholder="+225 07 00 00 00" required />

          {/* Filière / Niveau — chargés dynamiquement depuis Firebase */}
          {filieres.length === 0 ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20 px-4 py-3">
              <AlertTriangle size={15} className="text-blue-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-600 dark:text-orange-200/70 leading-relaxed">
                Aucune filière disponible — créez d&apos;abord vos filières dans{' '}
                <Link href="/dashboard/admin/filieres" className="text-blue-600 dark:text-orange-400 underline hover:text-blue-900 dark:hover:text-orange-300">
                  Filières &amp; Matières
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FieldSelect label="Filière" value={form.filiere} onChange={handleFiliereChange} options={filieres.map((f) => f.nom)} required />
                <FieldSelect
                  label="Niveau"
                  value={form.niveau}
                  onChange={set('niveau')}
                  options={niveauOptions}
                  required
                  disabled={!form.filiere || niveauOptions.length === 0}
                  placeholder={form.filiere ? undefined : 'Choisir une filière d’abord'}
                />
              </div>
              {form.filiere && niveauOptions.length === 0 && (
                <div className="flex items-start gap-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20 px-4 py-3">
                  <AlertTriangle size={15} className="text-blue-600 dark:text-orange-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-600 dark:text-orange-200/70 leading-relaxed">
                    La filière «&nbsp;{form.filiere}&nbsp;» n&apos;a aucun niveau défini. Ajoutez-en un dans{' '}
                    <Link href="/dashboard/admin/filieres" className="text-blue-600 dark:text-orange-400 underline hover:text-blue-900 dark:hover:text-orange-300">
                      Filières &amp; Matières
                    </Link>{' '}
                    pour pouvoir inscrire un étudiant.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Lier à un parent (optionnel) — création uniquement */}
          {mode === 'add' && (
            <div>
              <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">Lier à un parent (optionnel)</label>
              <select
                value={form.parentUid ?? ''}
                onChange={(e) => set('parentUid')(e.target.value)}
                className="w-full bg-[#fafafa] dark:bg-black border border-zinc-200 dark:border-zinc-800 focus:border-orange-500/60 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none transition-colors appearance-none"
              >
                <option value="" className="bg-white dark:bg-zinc-900">Aucun parent lié</option>
                {parents.map((p) => (
                  <option key={p.uid} value={p.uid} className="bg-white dark:bg-zinc-900">{p.displayName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Matricule preview */}
          <div className="bg-[#fafafa] dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3">
            <p className="text-xs text-zinc-500">Numéro matricule</p>
            <p className="text-sm font-mono text-blue-600 dark:text-orange-400 mt-0.5">{matriculePreview}</p>
          </div>

          {/* Indicateur envoi email — création uniquement */}
          {mode === 'add' && (
            <div className="flex items-start gap-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20 px-4 py-3">
              <Mail size={15} className="text-blue-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-600 dark:text-orange-200/70 leading-relaxed">
                Un email contenant les identifiants de connexion sera envoyé
                automatiquement à l&apos;étudiant. Il devra changer son mot de
                passe à la première connexion.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
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
              {mode === 'add' ? (submitting ? 'Création…' : 'Créer le compte') : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function ConfirmDelete({ student, deleting, onConfirm, onCancel }: { student: Student; deleting: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-950 border border-red-500/20 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-2 bg-red-500/10 rounded-xl shrink-0">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white mb-1">Supprimer l&apos;étudiant</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Voulez-vous vraiment supprimer{' '}
              <span className="text-zinc-900 dark:text-white font-medium">{student.prenom} {student.nom}</span>{' '}
              ({student.matricule}) ? Cette action est irréversible.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 bg-white dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting && <span className="w-4 h-4 border-2 border-zinc-300 dark:border-white/30 border-t-white rounded-full animate-spin" />}
            {deleting ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Parcours Modal (chronologie des années clôturées) ────────────────────────

function ParcoursModal({ universityId, student, onClose }: { universityId: string; student: Student; onClose: () => void }) {
  const [list, setList] = useState<ParcoursAnnuel[] | null>(null)

  useEffect(() => {
    const uid = student.uid
    let active = true
    ;(async () => {
      if (!uid) { if (active) setList([]); return }
      try {
        const p = await getParcoursEtudiant(universityId, uid)
        if (active) setList(p)
      } catch {
        if (active) setList([])
      }
    })()
    return () => { active = false }
  }, [universityId, student.uid])

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-2xl p-7 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Parcours académique</h2>
            <p className="text-zinc-500 text-xs mt-0.5">{student.prenom} {student.nom}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        {list === null ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-center text-zinc-500 text-sm py-10 leading-relaxed">
            Aucune année clôturée pour le moment.<br />
            Le parcours s’affichera ici après la clôture annuelle (page Clôture &amp; délibérations).
          </p>
        ) : (
          <ol className="space-y-3">
            {list.map((p) => (
              <li key={p.id} className="flex items-start gap-3 rounded-xl border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-black/30 px-4 py-3">
                <span className="w-2 h-2 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-zinc-900 dark:text-white text-sm font-medium">{p.anneeAcademique}</p>
                    <span className={`text-[11px] font-medium border rounded-md px-2 py-0.5 ${STATUT_PARCOURS_STYLES[p.statut]}`}>
                      {STATUT_PARCOURS_LABELS[p.statut]}
                    </span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1">
                    Niveau <span className="text-zinc-800 dark:text-zinc-200">{p.niveau || '—'}</span>
                    {typeof p.moyenneGenerale === 'number' && (
                      <> · Moyenne <span className="text-zinc-800 dark:text-zinc-200">{p.moyenneGenerale.toFixed(2)}/20</span></>
                    )}
                  </p>
                  {p.clotureParNom && (
                    <p className="text-zinc-600 text-[11px] mt-0.5">Clôturé par {p.clotureParNom}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const { profile } = useAuth()
  const { plan, isWithinLimit } = usePlan(profile?.universityId ?? '')
  const [students, setStudents] = useState<Student[]>([])
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [fbLoading, setFbLoading] = useState(true)
  const [limitError, setLimitError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filiereFilter, setFiliereFilter] = useState('')
  const [page, setPage] = useState(1)

  // Modal state
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<Student | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Parents (pour la liaison) + toasts
  const [parents, setParents] = useState<ParentOption[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Erreur d'action hors modal (suppression, changement de statut) — affichée
  // en toast indépendant, car `createError` n'est rendu qu'avec le modal ouvert.
  const [actionError, setActionError] = useState<string | null>(null)

  // Email edit (correction admin, comptes Auth uniquement)
  const [emailTarget, setEmailTarget] = useState<Student | null>(null)

  // Redoublement : uid → nombre de fois le niveau actuel a été redoublé (badge).
  const [redoublants, setRedoublants] = useState<Record<string, number>>({})
  // Parcours académique (modal chronologie)
  const [parcoursTarget, setParcoursTarget] = useState<Student | null>(null)

  // ── Firebase load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!profile?.universityId) return
    const universityId = profile.universityId
    getUniversityMembers(universityId, 'parent')
      .then((list) =>
        setParents(list.map((p) => ({ uid: p.uid, displayName: p.displayName })))
      )
      .catch(() => setParents([]))
    getFilieres(universityId)
      .then(setFilieres)
      .catch(() => setFilieres([]))
    getEtudiantsRedoublants(universityId)
      .then((list) => setRedoublants(Object.fromEntries(list.map((r) => [r.studentUid, r.nombreRedoublements]))))
      .catch(() => setRedoublants({}))
    Promise.all([
      getUniversityMembers(universityId, 'student'),
      getManualStudents(universityId),
    ])
      .then(([members, manual]) => {
        const fromAuth: Student[] = members.map((m) => {
          const parts = m.displayName.split(' ')
          return {
            uid: m.uid,
            matricule: m.matricule ?? '',
            prenom: parts[0] ?? '',
            nom: parts.slice(1).join(' ') || m.displayName,
            email: m.email,
            telephone: m.telephone ?? '',
            filiere: m.filiere ?? '',
            niveau: m.niveau ?? '',
            statut: normalizeStatut(m.statut),
            parentUid: m.parentUid,
          }
        })
        const fromManual: Student[] = manual.map((s) => {
          const parts = s.displayName?.split(' ') ?? []
          return {
            fbKey: s.key,
            matricule: s.matricule ?? '',
            prenom: parts[0] ?? '',
            nom: parts.slice(1).join(' ') || '',
            email: s.email,
            telephone: s.telephone ?? '',
            filiere: s.filiere ?? '',
            niveau: s.niveau ?? '',
            statut: normalizeStatut(s.statut),
          }
        })
        setStudents([...fromAuth, ...fromManual])
      })
      .catch(() => setStudents([]))
      .finally(() => setFbLoading(false))
  }, [profile?.universityId])

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return students.filter((s) => {
      const matchSearch =
        !q ||
        s.nom.toLowerCase().includes(q) ||
        s.prenom.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.filiere.toLowerCase().includes(q) ||
        s.matricule.toLowerCase().includes(q)
      const matchFiliere = !filiereFilter || s.filiere === filiereFilter
      return matchSearch && matchFiliere
    })
  }, [students, search, filiereFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Reset to page 1 when filters change (handled inside handlers below)

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleSearchChange(v: string) {
    setSearch(v)
    setPage(1)
  }

  function handleFiliereChange(v: string) {
    setFiliereFilter(v)
    setPage(1)
  }

  function openAdd() {
    if (!isWithinLimit('maxEtudiants', students.length)) {
      const max = getPlanConfig(plan ?? undefined).features.maxEtudiants
      setLimitError(`Limite de ${max} étudiants atteinte pour le plan ${getPlanConfig(plan ?? undefined).nom}. Passez au plan supérieur.`)
      return
    }
    setEditTarget(null)
    setModalMode('add')
  }

  function openEdit(student: Student) {
    setEditTarget(student)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditTarget(null)
  }

  async function handleModalSubmit(data: FormData) {
    const universityId = profile?.universityId
    if (modalMode === 'add') {
      // Création d'un VRAI compte étudiant (Auth + email d'accès) via l'API.
      if (!universityId) {
        setCreateError("Aucune université active. Impossible de créer le compte.")
        return
      }
      const mat = generateMatricule(students)
      const displayName = `${data.prenom} ${data.nom}`.trim()
      setSubmitting(true)
      setCreateError(null)
      try {
        const result = await createMemberViaApi({
          universityId,
          email: data.email,
          displayName,
          role: 'student',
          filiere: data.filiere,
          niveau: data.niveau,
          telephone: data.telephone,
          matricule: mat,
          parentUid: data.parentUid || undefined,
        })
        const newStudent: Student = {
          uid: result.uid,
          matricule: mat,
          prenom: data.prenom,
          nom: data.nom,
          email: data.email,
          telephone: data.telephone,
          filiere: data.filiere,
          niveau: data.niveau,
          statut: 'Actif',
          parentUid: data.parentUid || undefined,
        }
        setStudents((prev) => [newStudent, ...prev])
        setToast(
          result.emailSent
            ? `Compte créé. Email d'accès envoyé à ${data.email}.`
            : `Compte créé. ⚠️ Email non envoyé — mot de passe temporaire : ${result.tempPassword}`
        )
        setTimeout(() => setToast(null), result.emailSent ? 5000 : 15000)
        closeModal()
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'Échec de la création.')
      } finally {
        setSubmitting(false)
      }
      return
    } else if (modalMode === 'edit' && editTarget) {
      if (!universityId) {
        setCreateError("Aucune université active. Modification non enregistrée.")
        return
      }
      setSubmitting(true)
      setCreateError(null)
      try {
        if (editTarget.uid) {
          await updateMemberProfile(universityId, editTarget.uid, {
            filiere: data.filiere, niveau: data.niveau, telephone: data.telephone,
            displayName: `${data.prenom} ${data.nom}`.trim(),
          })
        } else if (editTarget.fbKey) {
          await updateManualStudent(universityId, editTarget.fbKey, {
            displayName: `${data.prenom} ${data.nom}`.trim(),
            filiere: data.filiere, niveau: data.niveau, telephone: data.telephone,
          })
        }
      } catch (err) {
        // Écriture Firebase échouée : erreur claire, aucune modification locale,
        // le modal reste ouvert.
        setCreateError(err instanceof Error ? err.message : "L'enregistrement des modifications a échoué.")
        setSubmitting(false)
        return
      }
      // Succès confirmé uniquement.
      setStudents((prev) =>
        prev.map((s) => s.matricule === editTarget.matricule ? { ...s, ...data } : s)
      )
      setSubmitting(false)
    }
    closeModal()
  }

  async function handleToggleStatus(matricule: string) {
    const student = students.find((s) => s.matricule === matricule)
    if (!student) return
    const newStatut: StudentStatus = student.statut === 'Actif' ? 'Inactif' : 'Actif'
    const universityId = profile?.universityId
    if (!universityId) {
      setActionError("Aucune université active. Changement de statut non enregistré.")
      return
    }
    setActionError(null)
    try {
      if (student.uid) await updateMemberProfile(universityId, student.uid, { statut: newStatut })
      else if (student.fbKey) await updateManualStudent(universityId, student.fbKey, { statut: newStatut })
    } catch (err) {
      // Échec Firebase : erreur claire, pas de mise à jour locale (pas de faux succès).
      setActionError(err instanceof Error ? err.message : "Le changement de statut a échoué.")
      return
    }
    setStudents((prev) =>
      prev.map((s) => s.matricule === matricule ? { ...s, statut: newStatut } : s)
    )
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    const universityId = profile?.universityId
    if (!universityId) {
      setActionError("Aucune université active. Suppression non enregistrée.")
      return
    }
    setDeleting(true)
    setActionError(null)
    try {
      // Étudiant inscrit (compte Auth) → members/{uid} ; étudiant manuel → manual_students/{key}.
      if (deleteTarget.uid) {
        await removeMember(universityId, deleteTarget.uid)
      } else if (deleteTarget.fbKey) {
        await removeManualStudent(universityId, deleteTarget.fbKey)
      }
    } catch (err) {
      // Écriture Firebase échouée : erreur claire, aucune modification locale.
      setActionError(err instanceof Error ? err.message : 'La suppression a échoué.')
      setDeleting(false)
      return
    }
    // Succès confirmé uniquement : on retire alors l'entrée du state local.
    setStudents((prev) => prev.filter((s) => s.matricule !== deleteTarget.matricule))
    setDeleting(false)
    setDeleteTarget(null)
  }

  // ── Derived for modal ─────────────────────────────────────────────────────────

  const modalInitial: FormData = editTarget
    ? { prenom: editTarget.prenom, nom: editTarget.nom, email: editTarget.email, telephone: editTarget.telephone, filiere: editTarget.filiere, niveau: editTarget.niveau }
    : EMPTY_FORM

  const matriculePreview = editTarget ? editTarget.matricule : generateMatricule(students)

  // ── Render ────────────────────────────────────────────────────────────────────

  if (fbLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher par nom, email, filière…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-[#fafafa] dark:bg-black border border-zinc-200 dark:border-zinc-800 focus:border-orange-500/50 rounded-xl pl-9 pr-4 py-2.5 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-600 focus:outline-none transition-colors"
          />
        </div>

        {/* Filière filter */}
        <select
          value={filiereFilter}
          onChange={(e) => handleFiliereChange(e.target.value)}
          className="bg-[#fafafa] dark:bg-black border border-zinc-200 dark:border-zinc-800 focus:border-orange-500/50 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none transition-colors appearance-none min-w-50"
        >
          <option value="" className="bg-white dark:bg-zinc-900">Toutes les filières</option>
          {filieres.map((f) => (
            <option key={f.id} value={f.nom} className="bg-white dark:bg-zinc-900">{f.nom}</option>
          ))}
        </select>

        {/* Add button */}
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2.5 font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
        >
          <UserPlus size={15} />
          Ajouter un étudiant
        </button>
      </div>

      {/* Stats bar */}
      <p className="text-xs text-zinc-500">
        {filtered.length} étudiant{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
        {filiereFilter && <span> · filière <span className="text-blue-600 dark:text-orange-400">{filiereFilter}</span></span>}
      </p>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-100 dark:bg-black/60 border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left text-blue-700 dark:text-orange-300/50 text-xs uppercase tracking-wider px-5 py-3.5 font-medium">Matricule</th>
                <th className="text-left text-blue-700 dark:text-orange-300/50 text-xs uppercase tracking-wider px-5 py-3.5 font-medium">Nom complet</th>
                <th className="text-left text-blue-700 dark:text-orange-300/50 text-xs uppercase tracking-wider px-5 py-3.5 font-medium">Filière</th>
                <th className="text-left text-blue-700 dark:text-orange-300/50 text-xs uppercase tracking-wider px-5 py-3.5 font-medium">Niveau</th>
                <th className="text-left text-blue-700 dark:text-orange-300/50 text-xs uppercase tracking-wider px-5 py-3.5 font-medium">Statut</th>
                <th className="text-right text-blue-700 dark:text-orange-300/50 text-xs uppercase tracking-wider px-5 py-3.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-zinc-600 py-14 text-sm">
                    Aucun étudiant trouvé.
                  </td>
                </tr>
              )}
              {paginated.map((student) => (
                <tr key={student.uid ?? student.fbKey ?? student.matricule} className="hover:bg-white/2 transition-colors">
                  {/* Matricule */}
                  <td className="px-5 py-4 text-blue-600 dark:text-orange-400 text-xs font-mono whitespace-nowrap">{student.matricule}</td>

                  {/* Nom complet + email */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <p className="text-zinc-900 dark:text-white text-sm font-medium leading-none">{student.prenom} {student.nom}</p>
                      {student.uid && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                          <Wifi size={9} />
                          Inscrit
                        </span>
                      )}
                      {student.uid && redoublants[student.uid] > 0 && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-blue-700 dark:text-amber-300 text-[10px] font-medium"
                          title="Situation de redoublement"
                        >
                          <RotateCcw size={9} />
                          {redoublementBadgeLabel(student.niveau, redoublants[student.uid])}
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-xs mt-1">{student.email}</p>
                  </td>

                  {/* Filière */}
                  <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300 text-sm whitespace-nowrap">{student.filiere}</td>

                  {/* Niveau */}
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-mono">
                      {student.niveau}
                    </span>
                  </td>

                  {/* Statut toggle */}
                  <td className="px-5 py-4">
                    <button
                      onClick={() => handleToggleStatus(student.matricule)}
                      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        student.statut === 'Actif'
                          ? 'bg-orange-500/15 text-blue-600 dark:text-orange-400 border-orange-500/25 hover:bg-orange-500/25'
                          : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-700/60'
                      }`}
                      title="Cliquer pour changer le statut"
                    >
                      {student.statut}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {student.uid && (
                        <button
                          onClick={() => setParcoursTarget(student)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-800 dark:hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                          title="Parcours académique"
                        >
                          <History size={14} />
                        </button>
                      )}
                      {student.uid && (
                        <button
                          onClick={() => setEmailTarget(student)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-800 dark:hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                          title="Corriger l'email"
                        >
                          <Mail size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(student)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-800 dark:hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                        title="Modifier"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(student)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-black/30">
            <p className="text-xs text-zinc-500">
              Page {safePage} sur {totalPages} · {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                    n === safePage
                      ? 'bg-orange-500 text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10'
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalMode !== null && (
        <div>
          <StudentModal
            mode={modalMode}
            initial={modalInitial}
            matriculePreview={matriculePreview}
            parents={parents}
            filieres={filieres}
            submitting={submitting}
            onSubmit={handleModalSubmit}
            onClose={closeModal}
          />
          {createError && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-60 max-w-md flex items-start gap-3 bg-white dark:bg-zinc-900 border border-red-500/30 rounded-xl px-4 py-3 shadow-2xl">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm flex-1">{createError}</p>
              <button onClick={() => setCreateError(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
          )}
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

      {/* Delete Confirm */}
      {deleteTarget !== null && (
        <ConfirmDelete
          student={deleteTarget}
          deleting={deleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Parcours académique (chronologie des années clôturées) */}
      {parcoursTarget?.uid && profile?.universityId && (
        <ParcoursModal
          universityId={profile.universityId}
          student={parcoursTarget}
          onClose={() => setParcoursTarget(null)}
        />
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
            setStudents((prev) =>
              prev.map((s) => (s.uid === emailTarget.uid ? { ...s, email: newEmail } : s))
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

      {/* Erreur d'action (suppression / changement de statut) */}
      {actionError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-60 max-w-md flex items-start gap-3 bg-white dark:bg-zinc-900 border border-red-500/30 rounded-xl px-4 py-3 shadow-2xl">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm flex-1">{actionError}</p>
          <button onClick={() => setActionError(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
