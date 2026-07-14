'use client'

import { useState, useEffect } from 'react'
import { BookOpen, RotateCcw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { GradeEntry } from '@/components/grades/grade-entry'
import { RattrapageEntry } from '@/components/grades/rattrapage-entry'
import { getFilieres, getSemestres, getMatieres } from '@/lib/db'
import type { Filiere, Matiere, Semestre } from '@/lib/db'

type Mode = 'normales' | 'rattrapage'

export default function TeacherGradesPage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId
  const [mode, setMode] = useState<Mode>('normales')

  if (!universityId) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Saisie des notes</h1>
        <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
          {mode === 'normales'
            ? 'Saisissez les notes par filière, niveau, semestre et matière.'
            : 'Rattrapage : notes des étudiants n’ayant pas validé en session normale.'}
        </p>
      </div>

      {/* Bascule Notes normales / Rattrapage — sections clairement distinctes. */}
      <div className="inline-flex rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-1">
        <button
          onClick={() => setMode('normales')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'normales' ? 'bg-orange-500 text-white' : 'text-orange-200/60 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <BookOpen size={15} /> Notes normales
        </button>
        <button
          onClick={() => setMode('rattrapage')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'rattrapage' ? 'bg-amber-500 text-white' : 'text-amber-200/60 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <RotateCcw size={15} /> Rattrapage
        </button>
      </div>

      {mode === 'normales' ? (
        <GradeEntry universityId={universityId} />
      ) : (
        <RattrapageSection universityId={universityId} />
      )}
    </div>
  )
}

const selectCls =
  'w-full bg-white dark:bg-zinc-900 border border-amber-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-amber-400/60 disabled:opacity-50 disabled:cursor-not-allowed'

/** Sélecteurs propres au rattrapage (la saisie normale a les siens dans GradeEntry). */
function RattrapageSection({ universityId }: { universityId: string }) {
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [loading, setLoading] = useState(true)

  const [filiereId, setFiliereId] = useState('')
  const [niveau, setNiveau] = useState('')
  const [semestreId, setSemestreId] = useState('')
  const [matiereId, setMatiereId] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [fil, sem] = await Promise.all([getFilieres(universityId), getSemestres(universityId)])
        if (!active) return
        setFilieres(fil)
        setSemestres(sem)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [universityId])

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!filiereId) {
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

  function handleFiliereChange(id: string) {
    setFiliereId(id)
    setMatiereId('')
    const f = filieres.find((x) => x.id === id)
    if (!f?.niveaux?.includes(niveau)) setNiveau('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 bg-white dark:bg-zinc-950 border border-amber-500/15 rounded-xl p-4">
        <Field label="Filière">
          <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={selectCls}>
            <option value="">Choisir…</option>
            {filieres.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </Field>
        <Field label="Niveau">
          <select value={niveau} onChange={(e) => setNiveau(e.target.value)} disabled={!filiereId} className={selectCls}>
            <option value="">{filiereId ? 'Choisir…' : 'Filière d’abord'}</option>
            {niveauxOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Semestre">
          <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)} className={selectCls}>
            <option value="">Choisir…</option>
            {semestres.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </Field>
        <Field label="Matière">
          <select value={matiereId} onChange={(e) => setMatiereId(e.target.value)} disabled={!filiereId} className={selectCls}>
            <option value="">{matieres.length ? 'Choisir…' : 'Aucune matière'}</option>
            {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        </Field>
      </div>

      <RattrapageEntry
        universityId={universityId}
        semestreId={semestreId}
        matiereId={matiereId}
        filiereId={filiereId}
        niveau={niveau}
        matiereNom={selectedMatiere?.nom}
      />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-zinc-600 dark:text-amber-200/60 text-xs font-medium block mb-1.5">{label}</label>
      {children}
    </div>
  )
}
