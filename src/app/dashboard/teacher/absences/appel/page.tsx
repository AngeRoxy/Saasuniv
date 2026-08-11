'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, X, Info, ClipboardCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getCreneaux,
  getUniversityMembers,
  getFilieres,
  getAbsences,
  getAppels,
  createAbsence,
  deleteAbsence,
  saveAppel,
  type Absence,
  type Appel,
  type UniversityMember,
  type Filiere,
} from '@/lib/db'
import { type Creneau, JOUR_LABEL, toDateISO, verifierDateOccurrence } from '@/types/emploi-du-temps'
import { appelKey } from '@/types/absence'

const inputCls = 'w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60'
const selectCls = 'w-full bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60'

interface PresenceState {
  [studentUid: string]: boolean
}

export default function FaireAppelPage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId
  const teacherName = profile?.displayName ?? user?.displayName ?? ''

  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  const [students, setStudents] = useState<UniversityMember[]>([])
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [appels, setAppels] = useState<Appel[]>([])
  const [loading, setLoading] = useState(true)

  const [creneauId, setCreneauId] = useState('')
  const [date, setDate] = useState(() => toDateISO(new Date()))

  const [saving, setSaving] = useState(false)
  const [resultMsg, setResultMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [cres, studs, fils, abs, aps] = await Promise.all([
          getCreneaux(universityId),
          getUniversityMembers(universityId, 'student'),
          getFilieres(universityId),
          getAbsences(universityId),
          getAppels(universityId),
        ])
        if (!active) return
        setCreneaux(cres)
        setStudents(studs)
        setFilieres(fils)
        setAbsences(abs)
        setAppels(aps)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId])

  async function refresh() {
    if (!universityId) return
    const [abs, aps] = await Promise.all([getAbsences(universityId), getAppels(universityId)])
    setAbsences(abs)
    setAppels(aps)
  }

  const filiereNom = useMemo(() => {
    const map = new Map(filieres.map((f) => [f.id, f.nom]))
    return (id: string) => map.get(id) ?? ''
  }, [filieres])

  // Créneaux de l'enseignant : appariés par nom (cf. emploi du temps), triés
  // pour un sélecteur prévisible.
  const mesCreneaux = useMemo(
    () => creneaux
      .filter((c) => c.enseignant && c.enseignant === teacherName)
      .sort((a, b) => a.jour.localeCompare(b.jour) || a.heureDebut.localeCompare(b.heureDebut)),
    [creneaux, teacherName]
  )

  // Sélection par défaut dérivée (pas de useEffect) : le premier créneau tant
  // que l'enseignant n'a rien choisi explicitement.
  const effectiveCreneauId = creneauId || mesCreneaux[0]?.id || ''
  const creneau = mesCreneaux.find((c) => c.id === effectiveCreneauId) ?? null

  // Étudiants du groupe (filière + niveau) du créneau sélectionné.
  const groupeStudents = useMemo(() => {
    if (!creneau) return []
    const nom = filiereNom(creneau.filiereId)
    return students
      .filter((s) => s.filiere === nom && s.niveau === creneau.niveau)
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  }, [creneau, students, filiereNom])

  // Absences déjà enregistrées pour ce créneau précis + cette date précise.
  const existingByStudent = useMemo(() => {
    const map = new Map<string, Absence>()
    if (!creneau) return map
    for (const a of absences) {
      if (a.creneauId === creneau.id && a.date === date) map.set(a.studentUid, a)
    }
    return map
  }, [absences, creneau, date])

  const appelExistant = useMemo(() => {
    if (!creneau) return null
    return appels.find((a) => a.id === appelKey(creneau.id, date)) ?? null
  }, [appels, creneau, date])

  // Cases à cocher : présent par défaut, sauf étudiant déjà marqué absent pour
  // cette séance précise. Réinitialisées quand créneau OU date change — pattern
  // « information from previous renders » (comparaison pendant le render, pas
  // dans un useEffect : évite react-hooks/set-state-in-effect, cf. mémoire projet).
  const [presence, setPresence] = useState<PresenceState>({})
  const resetKey = `${effectiveCreneauId}|${date}`
  const [prevResetKey, setPrevResetKey] = useState(resetKey)
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey)
    const next: PresenceState = {}
    for (const s of groupeStudents) next[s.uid] = !existingByStudent.has(s.uid)
    setPresence(next)
    setResultMsg(null)
    setError(null)
  }

  const avertissementJour = creneau ? verifierDateOccurrence(creneau.jour, date) : null

  const nbPresents = groupeStudents.filter((s) => presence[s.uid] !== false).length
  const nbAbsents = groupeStudents.length - nbPresents

  function togglePresence(uid: string, present: boolean) {
    setPresence((prev) => ({ ...prev, [uid]: present }))
    setResultMsg(null)
  }

  async function handleSubmit() {
    if (!universityId || !creneau || groupeStudents.length === 0) return
    setSaving(true)
    setError(null)
    setResultMsg(null)

    const ops: Promise<unknown>[] = []
    let presents = 0
    let absents = 0
    for (const s of groupeStudents) {
      const estPresent = presence[s.uid] !== false
      const existing = existingByStudent.get(s.uid)
      if (estPresent) {
        presents++
        if (existing) ops.push(deleteAbsence(universityId, existing.id))
      } else {
        absents++
        if (!existing) {
          ops.push(createAbsence(universityId, {
            studentUid: s.uid,
            studentNom: s.displayName,
            matricule: s.matricule ?? '',
            date,
            matiere: creneau.matiere,
            justifiee: false,
            motif: '',
            creneauId: creneau.id,
            marqueParUid: user?.uid ?? '',
            marqueParNom: teacherName || user?.email || '',
          }))
        }
      }
    }

    try {
      await Promise.all(ops)
      await saveAppel(universityId, creneau.id, date, {
        faitParUid: user?.uid ?? '',
        faitParNom: teacherName || user?.email || '',
        presents,
        absents,
      })
      setResultMsg(`Appel enregistré : ${presents} présent${presents > 1 ? 's' : ''}, ${absents} absent${absents > 1 ? 's' : ''}.`)
    } catch {
      setError('Échec de l’enregistrement de l’appel. Réessayez — vérifiez la liste ci-dessous avant de recommencer.')
    } finally {
      await refresh()
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/teacher/absences" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-orange-200/40 hover:text-blue-800 dark:hover:text-orange-400 transition-colors mb-2">
          <ArrowLeft size={13} /> Retour aux absences
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <ClipboardCheck size={22} className="text-blue-600 dark:text-orange-400" />
          Faire l’appel
        </h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">Cochez les absents ; tous les étudiants sont présents par défaut.</p>
      </div>

      {mesCreneaux.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
          Aucun cours ne vous est assigné. L’administration vous attribue les créneaux depuis l’emploi du temps.
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Créneau</label>
                <select value={effectiveCreneauId} onChange={(e) => setCreneauId(e.target.value)} className={selectCls}>
                  {mesCreneaux.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.matiere} — {filiereNom(c.filiereId)} · {c.niveau} ({JOUR_LABEL[c.jour]} {c.heureDebut})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} scheme-dark`} />
              </div>
            </div>

            {avertissementJour && (
              <p className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <Info size={13} className="shrink-0 mt-0.5" /> {avertissementJour}
              </p>
            )}

            {appelExistant && (
              <p className="flex items-start gap-2 text-xs text-blue-700 dark:text-orange-300/70 bg-blue-500/5 dark:bg-orange-500/5 border border-blue-500/15 dark:border-orange-500/15 rounded-lg px-3 py-2">
                <Info size={13} className="shrink-0 mt-0.5" />
                Appel déjà fait par {appelExistant.faitParNom} le {new Date(appelExistant.updatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} ({appelExistant.presents} présent{appelExistant.presents > 1 ? 's' : ''}, {appelExistant.absents} absent{appelExistant.absents > 1 ? 's' : ''}). Vous pouvez le corriger ci-dessous.
              </p>
            )}
          </div>

          {groupeStudents.length === 0 ? (
            <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
              Aucun étudiant inscrit dans ce groupe (filière/niveau).
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-5 py-3 border-b border-zinc-200 dark:border-orange-500/10 bg-zinc-50 dark:bg-black/40">
                <span className="text-xs text-blue-700 dark:text-orange-300/60 uppercase tracking-wider">{groupeStudents.length} étudiant{groupeStudents.length > 1 ? 's' : ''}</span>
                <span className="text-xs text-zinc-500">{nbPresents} présent{nbPresents > 1 ? 's' : ''} · {nbAbsents} absent{nbAbsents > 1 ? 's' : ''}</span>
              </div>
              <ul className="divide-y divide-orange-500/5">
                {groupeStudents.map((s) => {
                  const estPresent = presence[s.uid] !== false
                  return (
                    <li key={s.uid} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-3">
                      <div>
                        <p className="text-zinc-900 dark:text-white text-sm font-medium leading-none">{s.displayName}</p>
                        {s.matricule && <p className="text-zinc-500 text-xs font-mono mt-1">{s.matricule}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => togglePresence(s.uid, true)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            estPresent
                              ? 'bg-green-500/15 text-green-400 border-green-500/25'
                              : 'text-zinc-500 border-orange-500/10 hover:border-orange-500/30'
                          }`}>
                          <Check size={13} /> Présent
                        </button>
                        <button type="button" onClick={() => togglePresence(s.uid, false)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            !estPresent
                              ? 'bg-red-500/15 text-red-400 border-red-500/25'
                              : 'text-zinc-500 border-orange-500/10 hover:border-orange-500/30'
                          }`}>
                          <X size={13} /> Absent
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{error}</p>}
          {resultMsg && <p className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5">{resultMsg}</p>}

          {groupeStudents.length > 0 && (
            <div className="flex justify-end">
              <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
                {saving && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                Enregistrer l’appel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
