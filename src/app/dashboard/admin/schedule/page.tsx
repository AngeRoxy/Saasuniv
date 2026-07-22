'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Plus, X, Pencil, Trash2, Clock, MapPin, User, UserCog, CalendarClock, CalendarX, RotateCcw, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getFilieres,
  getSemestres,
  getMatieres,
  getUniversityMembers,
  getCreneaux,
  createCreneau,
  updateCreneau,
  deleteCreneau,
  setRemplacement,
  clearRemplacement,
  annulerCreneauDate,
  reactiverCreneauDate,
} from '@/lib/db'
import type { Filiere, Matiere, Semestre } from '@/lib/db'
import {
  JOURS,
  JOUR_LABEL,
  findConflits,
  jourDeDate,
  prochaineOccurrence,
  verifierDateOccurrence,
  ConflitError,
  type Creneau,
  type CreneauFormData,
  type ConflitInfo,
  type JourSemaine,
} from '@/types/emploi-du-temps'

/** « YYYY-MM-DD » → « 14 juil. 2026 » (affichage court des dates ponctuelles). */
function formatDateFr(iso: string): string {
  const [y, m, j] = iso.split('-').map(Number)
  if (!y || !m || !j) return iso
  return new Date(y, m - 1, j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Une date ponctuelle enregistrée sur un autre jour que celui du créneau est
 * INVISIBLE côté étudiant/parent/enseignant (voir verifierDateOccurrence). On la
 * signale explicitement dans la liste admin, sinon l'admin croit le cours annulé
 * alors qu'il ne l'est nulle part ailleurs.
 */
function dateIncoherente(c: Creneau, iso: string): boolean {
  return jourDeDate(iso) !== c.jour
}

/** Libellé du jour de semaine d'une date « YYYY-MM-DD » (dimanche compris). */
function labelJourDeDate(iso: string): string {
  const j = jourDeDate(iso)
  return j ? JOUR_LABEL[j].toLowerCase() : 'dimanche'
}

const inputCls = 'w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-zinc-500 dark:placeholder:text-orange-200/25'
const selectCls = 'w-full bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60'
const labelCls = 'text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5'

function emptyForm(): { jour: JourSemaine; heureDebut: string; heureFin: string; matiere: string; salle: string; enseignant: string } {
  return { jour: 'lundi', heureDebut: '08:00', heureFin: '10:00', matiere: '', salle: '', enseignant: '' }
}

type FormState = ReturnType<typeof emptyForm>

export default function SchedulePage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId

  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [teachers, setTeachers] = useState<string[]>([])
  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [loading, setLoading] = useState(true)

  // Sélection courante
  const [filiereId, setFiliereId] = useState('')
  const [niveau, setNiveau] = useState('')
  const [semestreId, setSemestreId] = useState('')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [conflits, setConflits] = useState<ConflitInfo[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Creneau | null>(null)

  // Modal remplacement ponctuel d'enseignant (une occurrence datée précise).
  const [remplTarget, setRemplTarget] = useState<Creneau | null>(null)
  const [remplForm, setRemplForm] = useState({ date: '', remplacant: '', motif: '' })
  const [remplSaving, setRemplSaving] = useState(false)
  const [remplError, setRemplError] = useState<string | null>(null)

  // Modal annulation ponctuelle d'un créneau (jour férié, grève, imprévu).
  const [annulTarget, setAnnulTarget] = useState<Creneau | null>(null)
  const [annulForm, setAnnulForm] = useState({ date: '', motif: '' })
  const [annulSaving, setAnnulSaving] = useState(false)
  const [annulError, setAnnulError] = useState<string | null>(null)

  // Chargement initial
  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [fil, sem, prof, cre] = await Promise.all([
          getFilieres(universityId),
          getSemestres(universityId),
          getUniversityMembers(universityId, 'teacher'),
          getCreneaux(universityId),
        ])
        if (!active) return
        setFilieres(fil)
        setSemestres(sem)
        setTeachers(prof.map((p) => p.displayName))
        setCreneaux(cre)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId])

  // Matières de la filière sélectionnée
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!universityId || !filiereId) {
        if (active) setMatieres([])
        return
      }
      const list = await getMatieres(universityId, filiereId)
      if (active) setMatieres(list)
    })()
    return () => { active = false }
  }, [universityId, filiereId])

  const selectedFiliere = filieres.find((f) => f.id === filiereId)
  const niveauxOptions = selectedFiliere?.niveaux ?? []
  const ready = Boolean(filiereId && niveau && semestreId)

  // Réinitialise le niveau si on change de filière et qu'il n'existe plus.
  function handleFiliereChange(id: string) {
    setFiliereId(id)
    const f = filieres.find((x) => x.id === id)
    if (!f?.niveaux?.includes(niveau)) setNiveau('')
  }

  const filtered = useMemo(
    () => creneaux.filter((c) => c.filiereId === filiereId && c.niveau === niveau && c.semestreId === semestreId),
    [creneaux, filiereId, niveau, semestreId]
  )

  const byDay = useMemo(
    () =>
      JOURS.map((jour) => ({
        jour,
        items: filtered
          .filter((c) => c.jour === jour)
          .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut)),
      })),
    [filtered]
  )

  async function refreshCreneaux() {
    if (!universityId) return
    setCreneaux(await getCreneaux(universityId))
  }

  function openAdd() {
    setEditId(null)
    setForm(emptyForm())
    setFormError(null)
    setConflits([])
    setModalOpen(true)
  }

  function openEdit(c: Creneau) {
    setEditId(c.id)
    setForm({ jour: c.jour, heureDebut: c.heureDebut, heureFin: c.heureFin, matiere: c.matiere, salle: c.salle, enseignant: c.enseignant })
    setFormError(null)
    setConflits([])
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditId(null)
    setForm(emptyForm())
    setFormError(null)
    setConflits([])
  }

  async function handleSave() {
    if (!universityId || !ready) return
    if (!form.matiere) { setFormError('Choisissez une matière.'); return }
    if (form.heureFin <= form.heureDebut) { setFormError('L’heure de fin doit être après l’heure de début.'); return }

    // RÈGLE 3 — détection de conflit instantanée sur les créneaux déjà chargés :
    // salle, enseignant ou groupe (filière + niveau) qui se chevauchent.
    const candidat = { filiereId, niveau, semestreId, ...form }
    const found = findConflits(creneaux, candidat, editId ?? undefined)
    if (found.length > 0) {
      setConflits(found)
      setFormError(null)
      return
    }

    setSaving(true)
    setFormError(null)
    setConflits([])
    try {
      if (editId) {
        await updateCreneau(universityId, editId, { ...form })
      } else {
        const data: CreneauFormData = { filiereId, niveau, semestreId, ...form }
        await createCreneau(universityId, data)
      }
      await refreshCreneaux()
      closeModal()
    } catch (err) {
      // Garde autoritaire de db.ts (ex : créneau ajouté par un autre admin
      // depuis le dernier chargement).
      if (err instanceof ConflitError) {
        setConflits(err.conflits)
      } else {
        setFormError('Échec de l’enregistrement. Réessayez.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!universityId || !deleteTarget) return
    try {
      await deleteCreneau(universityId, deleteTarget.id)
      await refreshCreneaux()
    } catch { /* silencieux */ }
    setDeleteTarget(null)
  }

  // ── Remplacement ponctuel d'enseignant ──────────────────────────────────────
  function openRempl(c: Creneau) {
    setRemplTarget(c)
    setRemplForm({
      // Pré-remplit avec le remplacement existant, sinon la PROCHAINE occurrence
      // réelle du créneau — jamais « aujourd'hui », qui tombe presque toujours un
      // autre jour de la semaine et produirait un état invisible côté étudiant.
      date: c.remplacantActifDate ?? prochaineOccurrence(c.jour, new Date()),
      remplacant: c.remplacantNom ?? '',
      motif: c.remplacantMotif ?? '',
    })
    setRemplError(null)
  }

  function closeRempl() {
    setRemplTarget(null)
    setRemplForm({ date: '', remplacant: '', motif: '' })
    setRemplError(null)
  }

  async function handleSaveRempl() {
    if (!universityId || !remplTarget) return
    if (!remplForm.date) { setRemplError('Choisissez la date du remplacement.'); return }
    if (!remplForm.remplacant) { setRemplError('Choisissez l’enseignant remplaçant.'); return }
    // La date doit tomber le jour du créneau, sinon l'état serait invisible côté
    // étudiant/parent/enseignant (garde également appliquée dans db.ts).
    const dateErr = verifierDateOccurrence(remplTarget.jour, remplForm.date)
    if (dateErr) { setRemplError(dateErr); return }

    setRemplSaving(true)
    setRemplError(null)
    try {
      await setRemplacement(universityId, remplTarget.id, {
        remplacantNom: remplForm.remplacant,
        remplacantActifDate: remplForm.date,
        remplacantMotif: remplForm.motif,
      })
      await refreshCreneaux()
      closeRempl()
    } catch (err) {
      // Remonte le message de la garde autoritaire de db.ts s'il y en a un.
      setRemplError(err instanceof Error ? err.message : 'Échec de l’enregistrement. Réessayez.')
    } finally {
      setRemplSaving(false)
    }
  }

  async function handleClearRempl() {
    if (!universityId || !remplTarget) return
    setRemplSaving(true)
    setRemplError(null)
    try {
      await clearRemplacement(universityId, remplTarget.id)
      await refreshCreneaux()
      closeRempl()
    } catch {
      setRemplError('Échec de la suppression. Réessayez.')
    } finally {
      setRemplSaving(false)
    }
  }

  // ── Annulation ponctuelle d'un créneau ──────────────────────────────────────
  function openAnnul(c: Creneau) {
    setAnnulTarget(c)
    // Prochaine occurrence réelle du créneau, pas « aujourd'hui » (cf. openRempl).
    setAnnulForm({ date: prochaineOccurrence(c.jour, new Date()), motif: '' })
    setAnnulError(null)
  }

  function closeAnnul() {
    setAnnulTarget(null)
    setAnnulForm({ date: '', motif: '' })
    setAnnulError(null)
  }

  // Recharge les créneaux et resynchronise la cible ouverte dans la modale, pour
  // que la liste des dates annulées reflète immédiatement l'ajout/le retrait.
  async function reloadAndSyncAnnul(creneauId: string) {
    if (!universityId) return
    const fresh = await getCreneaux(universityId)
    setCreneaux(fresh)
    setAnnulTarget(fresh.find((x) => x.id === creneauId) ?? null)
  }

  async function handleAnnuler() {
    if (!universityId || !annulTarget) return
    if (!annulForm.date) { setAnnulError('Choisissez la date à annuler.'); return }
    // Même garde que le remplacement : une date hors du jour du créneau créerait
    // une annulation que personne ne verrait à part l'admin.
    const dateErr = verifierDateOccurrence(annulTarget.jour, annulForm.date)
    if (dateErr) { setAnnulError(dateErr); return }

    setAnnulSaving(true)
    setAnnulError(null)
    try {
      await annulerCreneauDate(universityId, annulTarget.id, annulForm.date, annulForm.motif)
      await reloadAndSyncAnnul(annulTarget.id)
      setAnnulForm((f) => ({ ...f, motif: '' })) // prêt pour une éventuelle 2e date
    } catch (err) {
      setAnnulError(err instanceof Error ? err.message : 'Échec de l’enregistrement. Réessayez.')
    } finally {
      setAnnulSaving(false)
    }
  }

  async function handleReactiver(dateISO: string) {
    if (!universityId || !annulTarget) return
    setAnnulSaving(true)
    setAnnulError(null)
    try {
      await reactiverCreneauDate(universityId, annulTarget.id, dateISO)
      await reloadAndSyncAnnul(annulTarget.id)
    } catch {
      setAnnulError('Échec de la réactivation. Réessayez.')
    } finally {
      setAnnulSaving(false)
    }
  }

  // Garde d'accès
  if (profile && profile.role !== 'admin_universite' && profile.role !== 'super_admin_plateforme') {
    return (
      <div className="flex items-center justify-center h-64 text-blue-700 dark:text-orange-300/60 text-sm">
        Accès réservé aux administrateurs.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Cohérence de la date saisie dans chaque modale, évaluée en direct pour prévenir
  // AVANT l'enregistrement (le blocage dur reste dans les handlers + db.ts).
  const remplDateErr = remplTarget ? verifierDateOccurrence(remplTarget.jour, remplForm.date) : null
  const annulDateErr = annulTarget ? verifierDateOccurrence(annulTarget.jour, annulForm.date) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <CalendarClock size={22} className="text-blue-600 dark:text-orange-400" />
          Emploi du temps
        </h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
          Construisez la grille hebdomadaire par filière, niveau et semestre.
        </p>
      </div>

      {filieres.length === 0 || semestres.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20 px-4 py-3">
          <AlertTriangle size={15} className="text-blue-600 dark:text-orange-400 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-600 dark:text-orange-200/70 leading-relaxed">
            Vous devez d’abord créer au moins une{' '}
            <Link href="/dashboard/admin/filieres" className="text-blue-600 dark:text-orange-400 underline hover:text-blue-900 dark:hover:text-orange-300">filière</Link>{' '}
            (avec ses niveaux) et un{' '}
            <Link href="/dashboard/admin/semestres" className="text-blue-600 dark:text-orange-400 underline hover:text-blue-900 dark:hover:text-orange-300">semestre</Link>{' '}
            avant de construire un emploi du temps.
          </p>
        </div>
      ) : (
        <>
          {/* Sélecteurs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-4">
            <div>
              <label className={labelCls}>Filière</label>
              <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={selectCls}>
                <option value="">Choisir…</option>
                {filieres.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Niveau</label>
              <select value={niveau} onChange={(e) => setNiveau(e.target.value)} disabled={!filiereId} className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}>
                <option value="">{filiereId ? 'Choisir…' : 'Choisir une filière d’abord'}</option>
                {niveauxOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Semestre</label>
              <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)} className={selectCls}>
                <option value="">Choisir…</option>
                {semestres.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </div>
          </div>

          {!ready ? (
            <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
              Sélectionnez une filière, un niveau et un semestre pour afficher la grille.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">{filtered.length} créneau{filtered.length !== 1 ? 'x' : ''}</p>
                <button
                  onClick={openAdd}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors"
                >
                  <Plus size={16} /> Ajouter un créneau
                </button>
              </div>

              {/* Grille hebdomadaire */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {byDay.map(({ jour, items }) => (
                  <div key={jour} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-orange-500/10 bg-zinc-50 dark:bg-black/30">
                      <p className="text-xs font-semibold text-blue-700 dark:text-orange-300/80 uppercase tracking-wider">{JOUR_LABEL[jour]}</p>
                    </div>
                    <div className="p-2 space-y-2 min-h-16">
                      {items.length === 0 ? (
                        <p className="text-center text-zinc-500 dark:text-orange-200/20 text-xs py-4">—</p>
                      ) : (
                        items.map((c) => (
                          <div key={c.id} className="group rounded-lg bg-orange-500/5 border border-orange-500/15 p-2.5">
                            <div className="flex items-start justify-between gap-1">
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-600 dark:text-orange-400">
                                <Clock size={10} /> {c.heureDebut}–{c.heureFin}
                              </span>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openRempl(c)} className="p-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-teal-500" title="Remplacer l’enseignant (ponctuel)"><UserCog size={11} /></button>
                                <button onClick={() => openAnnul(c)} className="p-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-rose-500" title="Annuler pour une date"><CalendarX size={11} /></button>
                                <button onClick={() => openEdit(c)} className="p-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-blue-800 dark:hover:text-orange-400" title="Modifier"><Pencil size={11} /></button>
                                <button onClick={() => setDeleteTarget(c)} className="p-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-red-400" title="Supprimer"><Trash2 size={11} /></button>
                              </div>
                            </div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-white mt-1 leading-snug">{c.matiere}</p>
                            {c.salle && <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 flex items-center gap-1"><MapPin size={9} /> {c.salle}</p>}
                            {c.enseignant ? (
                              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1"><User size={9} /> {c.enseignant}</p>
                            ) : (
                              <p className="text-[11px] text-zinc-600 italic flex items-center gap-1"><User size={9} /> Aucun enseignant assigné</p>
                            )}
                            {/* Remplacement ponctuel programmé : badge daté teal (distinct de l'accent bleu).
                                Vire au rose si la date ne tombe pas le jour du créneau : l'état est alors
                                invisible côté étudiant/parent, il faut le corriger. */}
                            {c.remplacantNom && c.remplacantActifDate && (
                              <button
                                onClick={() => openRempl(c)}
                                title={dateIncoherente(c, c.remplacantActifDate)
                                  ? 'Date hors du jour du créneau : ce remplacement n’est visible par personne. Cliquez pour corriger.'
                                  : 'Modifier le remplacement'}
                                className={`mt-1 w-full flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] transition-colors ${
                                  dateIncoherente(c, c.remplacantActifDate)
                                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/15'
                                    : 'bg-teal-500/10 border-teal-500/25 text-teal-700 dark:text-teal-300 hover:bg-teal-500/15'
                                }`}
                              >
                                {dateIncoherente(c, c.remplacantActifDate)
                                  ? <AlertTriangle size={9} className="shrink-0" />
                                  : <UserCog size={9} className="shrink-0" />}
                                <span className="truncate">{c.remplacantNom} · {formatDateFr(c.remplacantActifDate)}</span>
                              </button>
                            )}
                            {/* Annulations programmées : badge rose daté (clic = gérer via la modale).
                                Signale les dates incohérentes (invisibles côté étudiant). */}
                            {c.datesAnnulees && c.datesAnnulees.length > 0 && (
                              <button
                                onClick={() => openAnnul(c)}
                                className="mt-1 w-full flex items-center gap-1 rounded-md bg-rose-500/10 border border-rose-500/25 px-1.5 py-0.5 text-[10px] text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 transition-colors"
                                title={c.datesAnnulees.some((d) => dateIncoherente(c, d))
                                  ? 'Une date ne tombe pas le jour du créneau : invisible côté étudiant. Cliquez pour corriger.'
                                  : 'Gérer les annulations'}
                              >
                                {c.datesAnnulees.some((d) => dateIncoherente(c, d))
                                  ? <AlertTriangle size={9} className="shrink-0" />
                                  : <CalendarX size={9} className="shrink-0" />}
                                <span className="truncate">
                                  {c.datesAnnulees.length === 1
                                    ? `Annulé le ${formatDateFr(c.datesAnnulees[0])}`
                                    : `${c.datesAnnulees.length} dates annulées`}
                                </span>
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Modal ajout / édition */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{editId ? 'Modifier le créneau' : 'Ajouter un créneau'}</h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"><X size={20} /></button>
            </div>

            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Jour</label>
                  <select value={form.jour} onChange={(e) => setForm((f) => ({ ...f, jour: e.target.value as JourSemaine }))} className={selectCls}>
                    {JOURS.map((j) => <option key={j} value={j}>{JOUR_LABEL[j]}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Début</label>
                  <input type="time" value={form.heureDebut} onChange={(e) => setForm((f) => ({ ...f, heureDebut: e.target.value }))} className={`${inputCls} scheme-dark`} />
                </div>
                <div>
                  <label className={labelCls}>Fin</label>
                  <input type="time" value={form.heureFin} onChange={(e) => setForm((f) => ({ ...f, heureFin: e.target.value }))} className={`${inputCls} scheme-dark`} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Matière</label>
                <select value={form.matiere} onChange={(e) => setForm((f) => ({ ...f, matiere: e.target.value }))} className={selectCls}>
                  <option value="">{matieres.length ? 'Choisir une matière…' : 'Aucune matière dans cette filière'}</option>
                  {matieres.map((m) => <option key={m.id} value={m.nom}>{m.nom}</option>)}
                </select>
                {matieres.length === 0 && (
                  <p className="text-[11px] text-zinc-500 dark:text-orange-200/40 mt-1.5">
                    Ajoutez des matières dans{' '}
                    <Link href={`/dashboard/admin/filieres/${filiereId}`} className="text-blue-600 dark:text-orange-400 underline hover:text-blue-900 dark:hover:text-orange-300">cette filière</Link>.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Salle</label>
                  <input value={form.salle} onChange={(e) => setForm((f) => ({ ...f, salle: e.target.value }))} placeholder="Ex: Amphi A" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Enseignant</label>
                  <select value={form.enseignant} onChange={(e) => setForm((f) => ({ ...f, enseignant: e.target.value }))} className={selectCls}>
                    <option value="">{teachers.length ? 'Optionnel…' : 'Aucun enseignant'}</option>
                    {teachers.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {conflits.length > 0 && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-red-300">
                    <AlertTriangle size={15} className="shrink-0" />
                    Conflit{conflits.length > 1 ? 's' : ''} détecté{conflits.length > 1 ? 's' : ''}
                  </p>
                  <ul className="mt-2 space-y-1 list-disc pl-5">
                    {conflits.map((c, i) => (
                      <li key={i} className="text-xs text-red-200/80 leading-relaxed">{c.message}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-red-200/50 mt-2">
                    Modifiez l’horaire, la salle, l’enseignant ou le groupe pour continuer.
                  </p>
                </div>
              )}

              {formError && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{formError}</p>
              )}

              </div>

              <div className="flex gap-3 pt-6 shrink-0">
                <button onClick={closeModal} disabled={saving} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                  {saving && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  {editId ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-red-500/20 rounded-2xl p-7 w-full max-w-sm flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Supprimer ce créneau ?</h2>
            </div>
            <p className="text-zinc-800 dark:text-orange-100/55 text-sm mb-6 flex-1 min-h-0 overflow-y-auto">
              {deleteTarget.matiere} — {JOUR_LABEL[deleteTarget.jour]} {deleteTarget.heureDebut}–{deleteTarget.heureFin}
            </p>
            <div className="flex gap-3 shrink-0">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors">Annuler</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal remplacement ponctuel d'enseignant */}
      {remplTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-teal-500/30 rounded-2xl p-7 w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <UserCog size={18} className="text-teal-500" /> Remplacer l’enseignant
              </h2>
              <button onClick={closeRempl} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-orange-200/50 mb-5 shrink-0">
              {remplTarget.matiere} · {JOUR_LABEL[remplTarget.jour]} {remplTarget.heureDebut}–{remplTarget.heureFin}
              {remplTarget.enseignant ? <> · titulaire : <span className="text-zinc-700 dark:text-zinc-300">{remplTarget.enseignant}</span></> : <> · aucun titulaire</>}
            </p>

            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
                <div className="rounded-lg bg-teal-500/5 border border-teal-500/20 px-3 py-2 text-[11px] text-teal-700 dark:text-teal-300/80 leading-relaxed">
                  Le remplacement ne vaut que pour la <strong>date précise</strong> choisie (une seule occurrence).
                  Le créneau récurrent et le titulaire habituel ne sont pas modifiés.
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Date concernée</label>
                    <input
                      type="date"
                      value={remplForm.date}
                      onChange={(e) => setRemplForm((f) => ({ ...f, date: e.target.value }))}
                      className={`${inputCls} scheme-dark ${remplDateErr ? 'border-rose-500/60' : ''}`}
                    />
                    {remplDateErr ? (
                      <p className="mt-1 flex items-start gap-1 text-[11px] text-rose-500">
                        <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {remplDateErr}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-zinc-500">{JOUR_LABEL[remplTarget.jour]} {formatDateFr(remplForm.date)}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Enseignant remplaçant</label>
                    <select
                      value={remplForm.remplacant}
                      onChange={(e) => setRemplForm((f) => ({ ...f, remplacant: e.target.value }))}
                      className={selectCls}
                    >
                      <option value="">{teachers.length ? 'Choisir…' : 'Aucun enseignant'}</option>
                      {teachers
                        .filter((t) => t !== remplTarget.enseignant)
                        .map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Motif (optionnel)</label>
                  <input
                    value={remplForm.motif}
                    onChange={(e) => setRemplForm((f) => ({ ...f, motif: e.target.value }))}
                    placeholder="Ex : maladie, formation…"
                    className={inputCls}
                  />
                </div>

                {remplError && (
                  <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{remplError}</p>
                )}
              </div>

              <div className="flex gap-3 pt-6 shrink-0">
                {/* Retirer le remplacement (visible seulement si un remplacement existe déjà). */}
                {remplTarget.remplacantNom && (
                  <button
                    onClick={handleClearRempl}
                    disabled={remplSaving}
                    className="border border-red-500/25 text-red-500 rounded-xl px-4 py-2.5 text-sm hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    Retirer
                  </button>
                )}
                <button onClick={closeRempl} disabled={remplSaving} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50">
                  Annuler
                </button>
                <button onClick={handleSaveRempl} disabled={remplSaving} className="flex-1 flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                  {remplSaving && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal annulation ponctuelle d'un créneau */}
      {annulTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-rose-500/30 rounded-2xl p-7 w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <CalendarX size={18} className="text-rose-500" /> Annuler pour une date
              </h2>
              <button onClick={closeAnnul} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-orange-200/50 mb-5 shrink-0">
              {annulTarget.matiere} · {JOUR_LABEL[annulTarget.jour]} {annulTarget.heureDebut}–{annulTarget.heureFin}
            </p>

            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
                <div className="rounded-lg bg-rose-500/5 border border-rose-500/20 px-3 py-2 text-[11px] text-rose-600 dark:text-rose-400/90 leading-relaxed">
                  Le créneau récurrent <strong>reste actif les autres semaines</strong> : on n’éteint que la
                  date précise choisie.
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Date à annuler</label>
                    <input
                      type="date"
                      value={annulForm.date}
                      onChange={(e) => setAnnulForm((f) => ({ ...f, date: e.target.value }))}
                      className={`${inputCls} scheme-dark ${annulDateErr ? 'border-rose-500/60' : ''}`}
                    />
                    {annulDateErr ? (
                      <p className="mt-1 flex items-start gap-1 text-[11px] text-rose-500">
                        <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {annulDateErr}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-zinc-500">{JOUR_LABEL[annulTarget.jour]} {formatDateFr(annulForm.date)}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Motif (optionnel)</label>
                    <select
                      value={annulForm.motif}
                      onChange={(e) => setAnnulForm((f) => ({ ...f, motif: e.target.value }))}
                      className={selectCls}
                    >
                      <option value="">Aucun…</option>
                      <option value="Jour férié">Jour férié</option>
                      <option value="Grève">Grève</option>
                      <option value="Imprévu">Imprévu</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleAnnuler}
                  disabled={annulSaving}
                  className="w-full flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
                >
                  {annulSaving && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  Annuler cette date
                </button>

                {annulError && (
                  <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{annulError}</p>
                )}

                {/* Dates déjà annulées, avec réactivation (retrait) si erreur. */}
                {annulTarget.datesAnnulees && annulTarget.datesAnnulees.length > 0 && (
                  <div>
                    <p className={labelCls}>Dates annulées</p>
                    <ul className="space-y-1.5">
                      {annulTarget.datesAnnulees.map((d) => (
                        <li key={d} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                          dateIncoherente(annulTarget, d)
                            ? 'bg-rose-500/5 border-rose-500/40'
                            : 'bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/10'
                        }`}>
                          <span className="min-w-0 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                            {dateIncoherente(annulTarget, d)
                              ? <AlertTriangle size={13} className="text-rose-500 shrink-0" />
                              : <CalendarX size={13} className="text-rose-500 shrink-0" />}
                            <span className="truncate">
                              {formatDateFr(d)}
                              {annulTarget.motifsAnnulation?.[d] && (
                                <span className="text-zinc-500"> · {annulTarget.motifsAnnulation[d]}</span>
                              )}
                              {dateIncoherente(annulTarget, d) && (
                                <span className="block text-[11px] text-rose-500">
                                  Tombe un {labelJourDeDate(d)}, pas un {JOUR_LABEL[annulTarget.jour].toLowerCase()} — invisible côté étudiant. Réactivez puis ré-annulez à la bonne date.
                                </span>
                              )}
                            </span>
                          </span>
                          <button
                            onClick={() => handleReactiver(d)}
                            disabled={annulSaving}
                            className="shrink-0 flex items-center gap-1 text-xs text-blue-600 dark:text-orange-400 hover:underline disabled:opacity-50"
                            title="Réactiver ce cours à cette date"
                          >
                            <RotateCcw size={12} /> Réactiver
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-6 shrink-0">
                <button onClick={closeAnnul} disabled={annulSaving} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
