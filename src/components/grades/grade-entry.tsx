'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Save, CheckCircle, AlertTriangle, BarChart3 } from 'lucide-react'
import {
  getFilieres,
  getSemestres,
  getMatieres,
  getUniversityMembers,
  getNotes,
  saveNotes,
} from '@/lib/db'
import type { Filiere, Matiere, Semestre, UniversityMember } from '@/lib/db'
import { getMention, calculerMoyenneMatiere, EVALUATIONS } from '@/types/note'
import { EvalPending } from './eval-pending'

interface Row {
  studentUid: string
  nom: string
  matricule: string
  /** Saisie brute des 3 évaluations (chaîne : '' = non saisie). */
  interro1: string
  interro2: string
  examen: string
  /**
   * Note historique d'une entrée saisie AVANT les 3 évaluations. Conservée
   * telle quelle tant que l'enseignant ne saisit aucune évaluation : rééditer
   * un commentaire ne doit pas effacer une note existante.
   */
  noteHistorique: number | null
  commentaire: string
}

function parseNote(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (Number.isNaN(n)) return null
  return Math.min(20, Math.max(0, n))
}

/** Détail parsé d'une ligne, prêt pour le calcul de moyenne. */
function detailDe(r: Row) {
  return {
    interro1: parseNote(r.interro1),
    interro2: parseNote(r.interro2),
    examen: parseNote(r.examen),
  }
}

/**
 * Note affichée pour une ligne : la moyenne pondérée des évaluations saisies,
 * ou à défaut la note historique (entrée créée avant les 3 évaluations).
 */
function noteFinaleDe(r: Row): number | null {
  return calculerMoyenneMatiere(detailDe(r)) ?? r.noteHistorique
}

/**
 * Saisie des notes (enseignant). En mode `readOnly`, affiche les notes sans
 * possibilité de modification (consultation admin) — seul l'enseignant édite.
 */
export function GradeEntry({ universityId, readOnly = false }: { universityId: string; readOnly?: boolean }) {
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [loading, setLoading] = useState(true)

  const [filiereId, setFiliereId] = useState('')
  const [niveau, setNiveau] = useState('')
  const [semestreId, setSemestreId] = useState('')
  const [matiereId, setMatiereId] = useState('')

  const [rows, setRows] = useState<Row[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Chargement initial : filières + semestres.
  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [fil, sem] = await Promise.all([
          getFilieres(universityId),
          getSemestres(universityId),
        ])
        if (!active) return
        setFilieres(fil)
        setSemestres(sem)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId])

  // Matières de la filière sélectionnée.
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
  const selectedMatiere = matieres.find((m) => m.id === matiereId)
  const ready = Boolean(filiereId && niveau && semestreId && matiereId)

  function handleFiliereChange(id: string) {
    setFiliereId(id)
    setMatiereId('')
    const f = filieres.find((x) => x.id === id)
    if (!f?.niveaux?.includes(niveau)) setNiveau('')
  }

  // Charge les étudiants de la classe + leurs notes existantes pour la matière.
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!universityId || !ready || !selectedFiliere) {
        if (active) setRows([])
        return
      }
      setRowsLoading(true)
      try {
        const [students, notes] = await Promise.all([
          getUniversityMembers(universityId, 'student'),
          getNotes(universityId),
        ])
        if (!active) return
        const cohorte = students.filter(
          (s) => s.filiere === selectedFiliere.nom && s.niveau === niveau
        )
        const noteByStudent = new Map(
          notes
            .filter((n) => n.semestreId === semestreId && n.matiereId === matiereId)
            .map((n) => [n.studentUid, n])
        )
        setRows(
          cohorte.map((s: UniversityMember) => {
            const existing = noteByStudent.get(s.uid)
            // Une note historique n'a pas de détail : les 3 champs restent vides
            // et sa note d'origine est conservée dans `noteHistorique`. Elle
            // s'affiche donc normalement, sans migration ni perte.
            return {
              studentUid: s.uid,
              nom: s.displayName,
              matricule: s.matricule ?? '',
              interro1: existing?.interro1 !== undefined ? String(existing.interro1) : '',
              interro2: existing?.interro2 !== undefined ? String(existing.interro2) : '',
              examen: existing?.examen !== undefined ? String(existing.examen) : '',
              noteHistorique: existing ? existing.note : null,
              commentaire: existing?.commentaire ?? '',
            }
          })
        )
      } finally {
        if (active) setRowsLoading(false)
      }
    })()
    return () => { active = false }
    // selectedFiliere dérivé de filiereId/filieres ; deps explicites ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId, filiereId, niveau, semestreId, matiereId])

  function updateRow(uid: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.studentUid === uid ? { ...r, ...patch } : r)))
  }

  // Moyenne de la classe : moyenne des notes FINALES (pondérées) de chaque
  // étudiant, pas des évaluations prises isolément.
  const average = useMemo(() => {
    const vals = rows.map(noteFinaleDe).filter((n): n is number => n !== null)
    if (vals.length === 0) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }, [rows])

  const nbNotees = useMemo(() => rows.filter((r) => noteFinaleDe(r) !== null).length, [rows])

  async function handleSave() {
    if (!ready || !selectedMatiere) return
    setSaving(true)
    try {
      await saveNotes(
        universityId,
        rows.map((r) => {
          const detail = detailDe(r)
          return {
            studentUid: r.studentUid,
            matiere: selectedMatiere.nom,
            matiereId,
            filiereId,
            niveau,
            semestreId,
            ...detail,
            // Reprise de la note historique tant qu'aucune évaluation n'est
            // saisie ; dès qu'une l'est, la moyenne pondérée prend le relais
            // (saveNotes ignore alors ce champ).
            note: r.noteHistorique,
            commentaire: r.commentaire,
          }
        })
      )
      setToast('Notes enregistrées avec succès.')
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      console.error('saveNotes a échoué', err)
      setToast('Échec de l’enregistrement — aucune note n’a été sauvegardée.')
      setTimeout(() => setToast(null), 4000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (filieres.length === 0 || semestres.length === 0) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20 px-4 py-3">
        <AlertTriangle size={15} className="text-blue-600 dark:text-orange-400 shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-600 dark:text-orange-200/70 leading-relaxed">
          Vous devez d’abord créer au moins une{' '}
          <Link href="/dashboard/admin/filieres" className="text-blue-600 dark:text-orange-400 underline hover:text-blue-900 dark:hover:text-orange-300">filière</Link>{' '}
          (avec ses matières et niveaux) et un{' '}
          <Link href="/dashboard/admin/semestres" className="text-blue-600 dark:text-orange-400 underline hover:text-blue-900 dark:hover:text-orange-300">semestre</Link>.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sélecteurs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-4">
        <Selector label="Filière" value={filiereId} onChange={handleFiliereChange} placeholder="Choisir…"
          options={filieres.map((f) => ({ value: f.id, label: f.nom }))} />
        <Selector label="Niveau" value={niveau} onChange={setNiveau} disabled={!filiereId}
          placeholder={filiereId ? 'Choisir…' : 'Filière d’abord'}
          options={niveauxOptions.map((n) => ({ value: n, label: n }))} />
        <Selector label="Semestre" value={semestreId} onChange={setSemestreId} placeholder="Choisir…"
          options={semestres.map((s) => ({ value: s.id, label: s.nom }))} />
        <Selector label="Matière" value={matiereId} onChange={setMatiereId} disabled={!filiereId}
          placeholder={matieres.length ? 'Choisir…' : 'Aucune matière'}
          options={matieres.map((m) => ({ value: m.id, label: m.nom }))} />
      </div>

      {!ready ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
          Sélectionnez filière, niveau, semestre et matière pour saisir les notes.
        </div>
      ) : rowsLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
          Aucun étudiant inscrit dans cette filière / niveau.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                <BarChart3 size={13} className="text-blue-600 dark:text-orange-400" />
                {rows.length} étudiant{rows.length > 1 ? 's' : ''} · {selectedMatiere?.nom}
              </p>
              {/* Barème affiché : l'enseignant ne doit pas avoir à deviner la pondération. */}
              <p className="text-[11px] text-zinc-500 dark:text-orange-200/30">
                Moyenne = (Interro 1 + Interro 2 + 2 × Examen) ÷ 4 · une évaluation non saisie n’est pas comptée comme un zéro
              </p>
            </div>
            {readOnly ? (
              <span className="text-xs text-zinc-600 dark:text-orange-200/50 border border-orange-500/20 bg-orange-500/5 rounded-lg px-3 py-1.5">
                Lecture seule — seul l’enseignant peut modifier les notes
              </span>
            ) : (
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors">
                {saving ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save size={15} />}
                Tout enregistrer
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-black/40 text-blue-700 dark:text-orange-300/60 text-xs uppercase tracking-wider border-b border-zinc-200 dark:border-orange-500/10">
                  <th className="px-4 py-3 text-left">Étudiant</th>
                  <th className="px-4 py-3 text-left">Matricule</th>
                  {EVALUATIONS.map((e) => (
                    <th key={e.champ} className="px-3 py-3 text-center w-24 whitespace-nowrap">
                      {e.labelCourt}
                      <span className="ml-1 normal-case text-zinc-500 dark:text-orange-300/40">×{e.poids}</span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center w-28">Moyenne /20</th>
                  <th className="px-4 py-3 text-center w-28">Mention</th>
                  <th className="px-4 py-3 text-left">Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const n = noteFinaleDe(r)
                  const mention = getMention(n)
                  const aDesEvals = EVALUATIONS.some((e) => parseNote(r[e.champ]) !== null)
                  // Note historique = une note d'origine existe mais aucune des 3
                  // évaluations n'est saisie (schéma pré-3-évaluations).
                  const historiqueSeule = n !== null && !aDesEvals
                  return (
                    <tr key={r.studentUid} className="border-t border-orange-500/5 hover:bg-orange-500/5 transition-colors">
                      <td className="px-4 py-2.5 text-zinc-800 dark:text-orange-100/80 font-medium whitespace-nowrap">{r.nom}</td>
                      <td className="px-4 py-2.5 text-blue-600 dark:text-orange-400/70 font-mono text-xs whitespace-nowrap">{r.matricule || '—'}</td>

                      {/* Les 3 évaluations, saisies séparément. */}
                      {EVALUATIONS.map((e) => {
                        const v = parseNote(r[e.champ])
                        return (
                          <td key={e.champ} className="px-3 py-2.5 text-center">
                            {readOnly ? (
                              // Consultation admin : distinguer une vraie note
                              // d'un « — » historique et d'une éval « En attente »
                              // (jamais un 0/20 fictif).
                              v !== null ? (
                                <span className={`font-semibold ${v < 10 ? 'text-red-400' : 'text-zinc-900 dark:text-white'}`}>{v}</span>
                              ) : historiqueSeule ? (
                                <span className="text-zinc-500 dark:text-orange-200/30">—</span>
                              ) : (
                                <EvalPending />
                              )
                            ) : (
                              // Champ vide = neutre (jamais de bordure rouge) : une
                              // évaluation non saisie n'est pas une erreur.
                              <input type="number" min={0} max={20} step={0.25} value={r[e.champ]}
                                onChange={(ev) => updateRow(r.studentUid, { [e.champ]: ev.target.value })}
                                aria-label={`${e.label} — ${r.nom}`}
                                className={`w-16 bg-zinc-50 dark:bg-black/40 border rounded-lg px-2 py-1 text-center text-sm font-semibold focus:outline-none transition-colors placeholder:text-[10px] placeholder:font-normal placeholder:text-zinc-400 dark:placeholder:text-zinc-500 ${
                                  v !== null && v < 10 ? 'border-red-500/40 text-red-400' : 'border-orange-500/20 text-zinc-900 dark:text-white focus:border-orange-400/60'
                                }`} placeholder="À saisir" />
                            )}
                          </td>
                        )
                      })}

                      {/* Moyenne : dérivée, jamais saisie à la main. */}
                      <td className="px-4 py-2.5 text-center">
                        <span className={`font-bold ${n !== null && n < 10 ? 'text-red-400' : 'text-zinc-900 dark:text-white'}`}>
                          {n !== null ? `${n}/20` : '—'}
                        </span>
                        {historiqueSeule && (
                          <span
                            className="ml-1.5 text-[10px] font-semibold text-blue-600 dark:text-amber-400 border border-amber-500/40 bg-amber-500/10 rounded px-1 py-0.5 cursor-help align-middle"
                            title="Note saisie avant le passage aux 3 évaluations. Saisir une interrogation ou l'examen la remplacera par la moyenne pondérée."
                          >
                            Historique
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2.5 text-center">
                        {mention ? (
                          <span className={`inline-block text-xs font-semibold border rounded-full px-2.5 py-0.5 ${mention.cls}`}>{mention.abbr}</span>
                        ) : <span className="text-zinc-500 dark:text-orange-200/20 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {readOnly ? (
                          <span className="text-zinc-800 dark:text-orange-100/60 text-xs">{r.commentaire || '—'}</span>
                        ) : (
                          <input type="text" value={r.commentaire}
                            onChange={(e) => updateRow(r.studentUid, { commentaire: e.target.value })}
                            placeholder="Commentaire…"
                            className="w-full bg-transparent border border-transparent hover:border-orange-500/15 focus:border-orange-500/30 rounded-lg px-2 py-1 text-zinc-800 dark:text-orange-100/70 text-xs focus:outline-none transition-colors placeholder:text-zinc-500 dark:placeholder:text-orange-200/20" />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-orange-500/20 bg-zinc-50 dark:bg-black/30">
                  <td colSpan={2 + EVALUATIONS.length} className="px-4 py-3 text-blue-700 dark:text-orange-300/70 text-xs font-semibold uppercase tracking-wider">Moyenne de la classe</td>
                  <td className="px-4 py-3 text-center font-bold text-zinc-900 dark:text-white">{average !== null ? `${average.toFixed(2)}/20` : '—'}</td>
                  <td colSpan={2} className="px-4 py-3 text-zinc-500 dark:text-orange-200/30 text-xs">
                    {nbNotees}/{rows.length} notes saisies
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-white dark:bg-zinc-900 border border-orange-500/30 rounded-xl px-5 py-3.5 shadow-2xl">
          <CheckCircle size={17} className="text-blue-600 dark:text-orange-400 shrink-0" />
          <span className="text-zinc-900 dark:text-white text-sm font-medium">{toast}</span>
        </div>
      )}
    </div>
  )
}

function Selector({ label, value, onChange, options, placeholder, disabled }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
  disabled?: boolean
}) {
  return (
    <div>
      <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className="w-full bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 disabled:opacity-50 disabled:cursor-not-allowed">
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export default GradeEntry
