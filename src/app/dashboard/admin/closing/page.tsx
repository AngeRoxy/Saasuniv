'use client'

import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, CheckCircle, CheckCircle2, Save, Archive, RotateCcw, ArrowRight, GraduationCap } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getSemestres,
  getUniversityMembers,
  getFilieres,
  getNotes,
  getMoyennesManuelles,
  getDeliberation,
  saveDeliberation,
  setStatutSemestre,
  getParcoursAnnee,
  cloturerAnneeEtudiant,
  type Semestre,
  type Decision,
  type DeliberationEntry,
  type Filiere,
  type ParcoursAnnuel,
} from '@/lib/db'
import { getNoteRetenue } from '@/types/note'
import {
  parcoursId,
  suggestNiveauSuivant,
  STATUT_PARCOURS_LABELS,
  STATUT_PARCOURS_STYLES,
} from '@/types/parcours'

const DECISIONS: Decision[] = ['Admis', 'Redoublant', 'Diplômé']
const decisionColors: Record<Decision, string> = {
  Admis: 'bg-green-500/20 text-green-400 border-green-500/30',
  Diplômé: 'bg-amber-500/20 text-blue-600 dark:text-amber-400 border-amber-500/30',
  // Neutre (ambre), jamais rouge alarmant : un redoublement se présente avec respect.
  Redoublant: 'bg-amber-500/15 text-blue-700 dark:text-amber-300 border-amber-500/30',
  'Sans notes': 'bg-zinc-200 dark:bg-zinc-700/40 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10',
}

// Métadonnées d'un étudiant nécessaires à la clôture de son année (résolues depuis
// son profil membre, avec repli sur ses notes du semestre).
interface StudentMeta {
  filiereId: string
  filiereNom: string
  niveau: string
  niveaux: string[]
}

export default function ClosingPage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId

  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [semestreId, setSemestreId] = useState('')
  const [rows, setRows] = useState<DeliberationEntry[]>([])
  const [meta, setMeta] = useState<Record<string, StudentMeta>>({})
  const [traites, setTraites] = useState<Record<string, ParcoursAnnuel>>({})
  const [loading, setLoading] = useState(true)
  const [rowsLoading, setRowsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Clôture individuelle d'un étudiant (parcours annuel / redoublement).
  const [clotureTarget, setClotureTarget] = useState<DeliberationEntry | null>(null)
  const [niveauChoice, setNiveauChoice] = useState('')
  const [processing, setProcessing] = useState(false)
  const [clotureError, setClotureError] = useState<string | null>(null)

  const selectedSemestre = semestres.find((s) => s.id === semestreId)
  const anneeAcademique = selectedSemestre?.anneeAcademique ?? ''

  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [sem, fil] = await Promise.all([
          getSemestres(universityId),
          getFilieres(universityId),
        ])
        if (!active) return
        setSemestres(sem)
        setFilieres(fil)
        const enCours = sem.find((s) => s.statut === 'en_cours')
        setSemestreId(enCours?.id ?? sem[0]?.id ?? '')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId])

  // Calcule les moyennes + décisions + métadonnées pour le semestre sélectionné,
  // et charge les parcours déjà clôturés de l'année (pour marquer « Traité »).
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!universityId || !semestreId) {
        if (active) { setRows([]); setMeta({}); setTraites({}) }
        return
      }
      setRowsLoading(true)
      try {
        const [students, notes, manuelles, existing, parcoursAnnee] = await Promise.all([
          getUniversityMembers(universityId, 'student'),
          getNotes(universityId),
          getMoyennesManuelles(universityId, semestreId),
          getDeliberation(universityId, semestreId),
          anneeAcademique ? getParcoursAnnee(universityId, anneeAcademique) : Promise.resolve({}),
        ])
        if (!active) return
        const filiereByNom = new Map(filieres.map((f) => [f.nom, f]))
        const filiereById = new Map(filieres.map((f) => [f.id, f]))

        const computedMeta: Record<string, StudentMeta> = {}
        const computed = students.map((s): DeliberationEntry => {
          const sien = notes.filter((n) => n.studentUid === s.uid && n.semestreId === semestreId)
          // Note retenue (rattrapage si présent) : la décision Admis/Redoublant doit
          // refléter le rattrapage, sinon un étudiant sauvé serait marqué Redoublant.
          const auto = sien.length ? sien.reduce((a, n) => a + getNoteRetenue(n), 0) / sien.length : null
          // La moyenne forcée par l'enseignant prime sur le calcul automatique.
          const moyenne = manuelles[s.uid] ?? auto
          const saved = existing[s.uid]
          const decision: Decision = saved?.decision ?? (moyenne === null ? 'Sans notes' : moyenne >= 10 ? 'Admis' : 'Redoublant')

          // Résolution filière/niveau : profil membre d'abord, repli sur les notes.
          const filiereFromNom = s.filiere ? filiereByNom.get(s.filiere) : undefined
          let filiereId = filiereFromNom?.id ?? ''
          let niveau = s.niveau ?? ''
          if (!filiereId || !niveau) {
            const anyNote = sien[0]
            if (anyNote) {
              filiereId = filiereId || anyNote.filiereId
              niveau = niveau || anyNote.niveau
            }
          }
          const niveaux = (filiereFromNom ?? filiereById.get(filiereId))?.niveaux ?? []
          computedMeta[s.uid] = { filiereId, filiereNom: s.filiere ?? '', niveau, niveaux }

          return { studentUid: s.uid, studentNom: s.displayName, moyenne, decision }
        })
        setRows(computed)
        setMeta(computedMeta)
        setTraites(parcoursAnnee)
      } finally {
        if (active) setRowsLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId, semestreId, anneeAcademique, filieres])

  const stats = useMemo(() => {
    const avecNotes = rows.filter((r) => r.moyenne !== null)
    return {
      total: rows.length,
      avecNotes: avecNotes.length,
      admis: rows.filter((r) => r.decision === 'Admis').length,
      redoublants: rows.filter((r) => r.decision === 'Redoublant').length,
      diplomes: rows.filter((r) => r.decision === 'Diplômé').length,
      traites: rows.filter((r) => traites[r.studentUid]).length,
    }
  }, [rows, traites])

  function setDecision(uid: string, decision: Decision) {
    setRows((prev) => prev.map((r) => (r.studentUid === uid ? { ...r, decision } : r)))
  }

  async function handleSaveDelib() {
    if (!universityId || !semestreId) return
    setSaving(true)
    try {
      await saveDeliberation(universityId, semestreId, rows)
      setToast('Délibérations enregistrées.')
      setTimeout(() => setToast(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function handleCloture() {
    if (!universityId || !semestreId) return
    setSaving(true)
    try {
      await saveDeliberation(universityId, semestreId, rows)
      await setStatutSemestre(universityId, semestreId, 'termine')
      setSemestres((prev) => prev.map((s) => (s.id === semestreId ? { ...s, statut: 'termine' } : s)))
      setToast('Semestre clôturé et archivé avec succès.')
      setTimeout(() => setToast(null), 4000)
    } finally {
      setSaving(false)
      setConfirmClose(false)
    }
  }

  function openCloture(row: DeliberationEntry) {
    const m = meta[row.studentUid]
    // Pour un étudiant admis, on pré-suggère le niveau suivant (position dans la
    // liste ordonnée de la filière, sinon incrément numérique) ; l'admin confirme.
    setNiveauChoice(row.decision === 'Admis' && m ? (suggestNiveauSuivant(m.niveau, m.niveaux) ?? '') : '')
    setClotureError(null)
    setClotureTarget(row)
  }

  async function handleConfirmCloture() {
    if (!universityId || !clotureTarget || !user || !profile || !selectedSemestre) return
    const row = clotureTarget
    const m = meta[row.studentUid]
    const statutDecision: 'valide' | 'redouble' = row.decision === 'Redoublant' ? 'redouble' : 'valide'
    // Le niveau suivant n'est transmis que pour un « Admis » (progression). Un
    // diplômé ou un redoublant ne change pas de niveau.
    const niveauSuivant = row.decision === 'Admis' && niveauChoice ? niveauChoice : undefined

    setProcessing(true)
    setClotureError(null)
    try {
      await cloturerAnneeEtudiant(
        universityId,
        row.studentUid,
        m?.filiereId ?? '',
        m?.niveau ?? '',
        selectedSemestre.anneeAcademique,
        row.moyenne,
        statutDecision,
        user.uid,
        profile.displayName,
        niveauSuivant
      )
      // L'écriture a réussi → on reflète le fait réel (pas un succès optimiste).
      const now = Date.now()
      const acted: ParcoursAnnuel = {
        id: parcoursId(row.studentUid, selectedSemestre.anneeAcademique),
        universityId,
        studentUid: row.studentUid,
        filiereId: m?.filiereId ?? '',
        niveau: m?.niveau ?? '',
        anneeAcademique: selectedSemestre.anneeAcademique,
        statut: statutDecision,
        ...(row.moyenne !== null ? { moyenneGenerale: row.moyenne } : {}),
        dateCloture: now,
        clotureParUid: user.uid,
        clotureParNom: profile.displayName,
        createdAt: traites[row.studentUid]?.createdAt ?? now,
        updatedAt: now,
      }
      setTraites((prev) => ({ ...prev, [row.studentUid]: acted }))
      setClotureTarget(null)
      setToast(
        statutDecision === 'redouble'
          ? `${row.studentNom} : année ${selectedSemestre.anneeAcademique} clôturée — niveau repris.`
          : `${row.studentNom} : année ${selectedSemestre.anneeAcademique} clôturée — validée.`
      )
      setTimeout(() => setToast(null), 4000)
    } catch (err) {
      setClotureError(err instanceof Error ? err.message : 'Échec de la clôture. Rien n’a été enregistré.')
    } finally {
      setProcessing(false)
    }
  }

  if (profile && profile.role !== 'admin_universite' && profile.role !== 'super_admin_plateforme') {
    return <div className="flex items-center justify-center h-64 text-blue-700 dark:text-orange-300/60 text-sm">Accès réservé aux administrateurs.</div>
  }
  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  const dejaClos = selectedSemestre?.statut === 'termine'
  const clotureMeta = clotureTarget ? meta[clotureTarget.studentUid] : undefined

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Clôture & délibérations</h1>
          <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
            Moyennes calculées à partir des notes saisies.
            {anneeAcademique && <> Année académique <span className="text-blue-700 dark:text-orange-300/70">{anneeAcademique}</span>.</>}
          </p>
        </div>
        {semestres.length > 0 && (
          <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)}
            className="bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60">
            {semestres.map((s) => <option key={s.id} value={s.id}>{s.nom}{s.statut === 'termine' ? ' (clôturé)' : ''}</option>)}
          </select>
        )}
      </div>

      {semestres.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">Aucun semestre. Créez-en un d’abord.</div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Étudiants', value: stats.total, color: 'text-zinc-900 dark:text-white' },
              { label: 'Notés', value: `${stats.avecNotes}/${stats.total}`, color: 'text-blue-600 dark:text-orange-400' },
              { label: 'Admis', value: stats.admis, color: 'text-green-400' },
              { label: 'Redoublants', value: stats.redoublants, color: 'text-blue-700 dark:text-amber-300' },
            ].map((k) => (
              <div key={k.label} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl p-4 text-center">
                <p className="text-zinc-600 dark:text-orange-200/50 text-xs mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {dejaClos && (
            <div className="flex items-center gap-3 bg-green-950/30 border border-green-500/30 rounded-xl p-4">
              <CheckCircle size={18} className="text-green-400 shrink-0" />
              <p className="text-green-300 text-sm">Ce semestre est clôturé. Les décisions ci-dessous sont archivées (vous pouvez encore les ajuster).</p>
            </div>
          )}

          {/* Délibérations */}
          {rowsLoading ? (
            <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">Aucun étudiant inscrit.</div>
          ) : (
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-black/40 text-blue-700 dark:text-orange-300/60 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Étudiant</th>
                      <th className="px-4 py-3 text-center">Moyenne</th>
                      <th className="px-4 py-3 text-center">Décision</th>
                      <th className="px-4 py-3 text-right">Clôture de l’année</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const traite = traites[r.studentUid]
                      return (
                        <tr key={r.studentUid} className="border-t border-orange-500/5 hover:bg-orange-500/5 transition-colors">
                          <td className="px-4 py-3 text-zinc-800 dark:text-orange-100/80 font-medium">{r.studentNom}</td>
                          <td className={`px-4 py-3 text-center font-bold ${r.moyenne === null ? 'text-zinc-600' : r.moyenne < 10 ? 'text-blue-700 dark:text-amber-300' : 'text-zinc-900 dark:text-white'}`}>
                            {r.moyenne === null ? '—' : `${r.moyenne.toFixed(2)}/20`}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <select value={r.decision} onChange={(e) => setDecision(r.studentUid, e.target.value as Decision)}
                              className={`text-xs font-medium border rounded-lg px-3 py-1.5 focus:outline-none ${decisionColors[r.decision]}`}>
                              {DECISIONS.map((d) => <option key={d} value={d} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">{d}</option>)}
                              {r.decision === 'Sans notes' && <option value="Sans notes" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Sans notes</option>}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {traite ? (
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-lg px-2.5 py-1 ${STATUT_PARCOURS_STYLES[traite.statut]}`}>
                                <CheckCircle2 size={12} /> Traité · {STATUT_PARCOURS_LABELS[traite.statut]}
                              </span>
                            ) : r.decision === 'Sans notes' ? (
                              <span className="text-zinc-600 text-xs">—</span>
                            ) : (
                              <button
                                onClick={() => openCloture(r)}
                                className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 text-blue-700 dark:text-orange-300 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-orange-500/20 transition-colors"
                              >
                                Confirmer la clôture
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={handleSaveDelib} disabled={saving}
                className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-blue-700 dark:text-orange-300 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-orange-500/20 transition-colors disabled:opacity-50">
                <Save size={15} /> Enregistrer les délibérations
              </button>
              {stats.traites > 0 && (
                <span className="text-xs text-zinc-500 dark:text-orange-200/40">{stats.traites}/{stats.total} étudiant{stats.traites > 1 ? 's' : ''} clôturé{stats.traites > 1 ? 's' : ''} pour {anneeAcademique}</span>
              )}
              {!dejaClos && (
                <button onClick={() => setConfirmClose(true)} disabled={saving}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ml-auto">
                  <Archive size={15} /> Clôturer le semestre
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Confirmation clôture du semestre (archivage global existant) */}
      {confirmClose && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-red-500/20 rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">Clôturer {selectedSemestre?.nom} ?</h2>
                <p className="text-zinc-800 dark:text-orange-100/55 text-sm mt-1">Le semestre passera au statut « terminé » et les décisions seront archivées. Vous pourrez toujours les rouvrir depuis la gestion des semestres.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmClose(false)} disabled={saving} className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50">Annuler</button>
              <button onClick={handleCloture} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50">
                {saving && <span className="w-4 h-4 border-2 border-zinc-300 dark:border-white/30 border-t-white rounded-full animate-spin" />}
                Confirmer la clôture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation clôture individuelle de l'année (parcours / redoublement) */}
      {clotureTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-2 rounded-xl shrink-0 ${clotureTarget.decision === 'Redoublant' ? 'bg-amber-500/10' : clotureTarget.decision === 'Diplômé' ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                {clotureTarget.decision === 'Redoublant'
                  ? <RotateCcw size={18} className="text-blue-700 dark:text-amber-300" />
                  : clotureTarget.decision === 'Diplômé'
                    ? <GraduationCap size={18} className="text-blue-700 dark:text-amber-300" />
                    : <ArrowRight size={18} className="text-emerald-300" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  {clotureTarget.decision === 'Redoublant'
                    ? `Confirmer que ${clotureTarget.studentNom} redouble ${clotureMeta?.niveau || 'son niveau'} ?`
                    : clotureTarget.decision === 'Diplômé'
                      ? `Confirmer le diplôme de ${clotureTarget.studentNom} ?`
                      : `Confirmer le passage de ${clotureTarget.studentNom} ?`}
                </h2>
                <p className="text-zinc-800 dark:text-orange-100/55 text-sm mt-1">
                  {clotureTarget.decision === 'Redoublant'
                    ? <>Cette action clôture son année <span className="text-zinc-900 dark:text-white">{anneeAcademique}</span> avec le statut « Niveau repris » et le maintient sur le même niveau. Ses notes de cette année restent conservées et consultables.</>
                    : clotureTarget.decision === 'Diplômé'
                      ? <>Cette action clôture son année <span className="text-zinc-900 dark:text-white">{anneeAcademique}</span> comme validée (diplômé). Son niveau reste inchangé.</>
                      : <>Cette action clôture son année <span className="text-zinc-900 dark:text-white">{anneeAcademique}</span> comme validée et le fait passer au niveau suivant.</>}
                </p>
              </div>
            </div>

            {/* Choix du niveau suivant — uniquement pour un admis */}
            {clotureTarget.decision === 'Admis' && (
              <div className="mb-4">
                <label className="block text-xs text-zinc-600 dark:text-orange-200/60 mb-1.5">Niveau suivant</label>
                {clotureMeta && clotureMeta.niveaux.length > 0 ? (
                  <select
                    value={niveauChoice}
                    onChange={(e) => setNiveauChoice(e.target.value)}
                    className="w-full bg-[#fafafa] dark:bg-black border border-zinc-200 dark:border-white/10 focus:border-orange-500/60 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none transition-colors"
                  >
                    <option value="" className="bg-white dark:bg-zinc-900">Ne pas changer de niveau</option>
                    {clotureMeta.niveaux.map((n) => (
                      <option key={n} value={n} className="bg-white dark:bg-zinc-900">{n}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3">
                    <AlertTriangle size={15} className="text-blue-700 dark:text-amber-300 shrink-0 mt-0.5" />
                    <p className="text-xs text-zinc-800 dark:text-amber-100/70 leading-relaxed">
                      Aucun niveau n’est défini pour cette filière — le niveau ne sera pas modifié automatiquement. Ajustez-le manuellement depuis la fiche étudiant si nécessaire.
                    </p>
                  </div>
                )}
                {clotureMeta && clotureMeta.niveaux.length > 0 && (
                  <p className="text-[11px] text-zinc-500 dark:text-orange-200/40 mt-1.5">
                    {niveauChoice
                      ? <>Niveau actuel <span className="text-zinc-600 dark:text-orange-200/70">{clotureMeta.niveau || '—'}</span> → <span className="text-zinc-600 dark:text-orange-200/70">{niveauChoice}</span></>
                      : 'Le niveau du membre restera inchangé.'}
                  </p>
                )}
              </div>
            )}

            {clotureError && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-500/5 border border-red-500/30 px-4 py-3 mb-4">
                <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed">{clotureError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setClotureTarget(null); setClotureError(null) }} disabled={processing} className="flex-1 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50">Annuler</button>
              <button onClick={handleConfirmCloture} disabled={processing} className={`flex-1 flex items-center justify-center gap-2 font-semibold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50 ${clotureTarget.decision === 'Admis' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
                {processing && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-white dark:bg-zinc-900 border border-orange-500/25 rounded-xl px-4 py-3 shadow-2xl">
          <CheckCircle size={16} className="text-blue-600 dark:text-orange-400 shrink-0" />
          <p className="text-zinc-800 dark:text-orange-100 text-sm">{toast}</p>
        </div>
      )}
    </div>
  )
}
