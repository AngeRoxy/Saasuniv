'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getUniversityMembers, getFilieres } from '@/lib/db'
import type { Filiere } from '@/types/filiere'
import { createMemberViaApi } from '@/lib/members-client'
import { PlanGate } from '@/components/ui/plan-gate'

type Tab = 'etudiants' | 'enseignants'

interface ParsedRow {
  prenom: string
  nom: string
  email: string
  /** Étudiant : filière unique (nom). */
  filiere: string
  niveau: string
  /** Enseignant : noms de filières saisis dans la cellule (séparés par `;`). */
  filieresNoms: string[]
  /** Enseignant : IDs résolus depuis les filières réelles de l'université. */
  filiereIds: string[]
  valid: boolean
  reason?: string
}

interface ImportResult {
  email: string
  ok: boolean
  message: string
}

const HEADERS_ETU = ['prenom', 'nom', 'email', 'filiere', 'niveau']
// Un enseignant peut intervenir dans PLUSIEURS filières (cf. filiereIds sur
// UniversityMember) : la colonne est au pluriel, séparateur `;` DANS la cellule
// — la virgule est déjà le séparateur de colonnes du CSV.
const HEADERS_ENS = ['prenom', 'nom', 'email', 'filieres']

/** Séparateur des filières multiples à l'intérieur d'une cellule. */
const SEP_FILIERES = ';'

function stripAccents(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Clé de comparaison d'un nom de filière : insensible à la casse et aux accents. */
function cleFiliere(nom: string): string {
  return stripAccents(nom.trim().toLowerCase())
}

function parseCSV(text: string, tab: Tab, filieres: Filiere[]): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => stripAccents(h.trim().toLowerCase()))
  const idx = (name: string) => headers.indexOf(name)
  const iPrenom = idx('prenom')
  const iNom = idx('nom')
  const iEmail = idx('email')
  const iFiliere = idx('filiere')
  const iNiveau = idx('niveau')
  const iFilieres = idx('filieres')

  // Résolution nom → id sur les filières RÉELLES de l'université.
  const idParNom = new Map(filieres.map((f) => [cleFiliere(f.nom), f.id]))

  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim())
    const prenom = iPrenom >= 0 ? cells[iPrenom] ?? '' : ''
    const nom = iNom >= 0 ? cells[iNom] ?? '' : ''
    const email = iEmail >= 0 ? cells[iEmail] ?? '' : ''
    const filiere = iFiliere >= 0 ? cells[iFiliere] ?? '' : ''
    const niveau = iNiveau >= 0 ? cells[iNiveau] ?? '' : ''

    // Enseignant : « Informatique;Mathématiques » → ['Informatique', 'Mathématiques']
    const brut = iFilieres >= 0 ? cells[iFilieres] ?? '' : ''
    const filieresNoms = brut
      .split(SEP_FILIERES)
      .map((s) => s.trim())
      .filter(Boolean)

    const filiereIds: string[] = []
    const inconnues: string[] = []
    for (const n of filieresNoms) {
      const id = idParNom.get(cleFiliere(n))
      if (id) filiereIds.push(id)
      else inconnues.push(n)
    }

    let valid = true
    let reason: string | undefined
    if (!email || !email.includes('@')) { valid = false; reason = 'Email manquant ou invalide' }
    else if (!prenom && !nom) { valid = false; reason = 'Nom manquant' }
    else if (tab === 'etudiants' && (!filiere || !niveau)) { valid = false; reason = 'Filière ou niveau manquant' }
    // La colonne `filieres` est FACULTATIVE (un enseignant peut n'être affecté à
    // aucune filière), mais un nom saisi qui n'existe pas est une erreur : sans
    // ça, l'affectation serait silencieusement perdue à l'import.
    else if (tab === 'enseignants' && inconnues.length > 0) {
      valid = false
      reason = `Filière inconnue : ${inconnues.map((n) => `« ${n} »`).join(', ')}`
    }

    return { prenom, nom, email, filiere, niveau, filieresNoms, filiereIds, valid, reason }
  })
}

function downloadTemplate(tab: Tab) {
  const headers = tab === 'etudiants' ? HEADERS_ETU : HEADERS_ENS
  // Ligne d'exemple pour les enseignants : le séparateur `;` de la colonne
  // `filieres` n'est pas devinable depuis un en-tête seul. Elle est commentée
  // (préfixe #) pour qu'un oubli de suppression ne crée pas un compte fantôme —
  // parseCSV n'a pas d'email valide sur cette ligne, elle est donc rejetée.
  const exemple =
    tab === 'enseignants'
      ? '#exemple,,,Informatique;Mathematiques\n'
      : ''
  const blob = new Blob([headers.join(',') + '\n' + exemple], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `modele_${tab}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ImportPage() {
  const { profile } = useAuth()
  const universityId = profile?.universityId

  const [tab, setTab] = useState<Tab>('etudiants')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [results, setResults] = useState<ImportResult[] | null>(null)
  const [matriculeBase, setMatriculeBase] = useState(0)
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Numérotation matricule + filières réelles (pour résoudre la colonne
  // `filieres` des enseignants en IDs).
  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      const [studs, fils] = await Promise.all([
        getUniversityMembers(universityId, 'student'),
        getFilieres(universityId),
      ])
      if (!active) return
      const nums = studs
        .map((s) => parseInt((s.matricule ?? '').split('-')[2] ?? '0', 10))
        .filter(Number.isFinite)
      setMatriculeBase(nums.length ? Math.max(...nums) : 0)
      setFilieres(fils)
    })()
    return () => { active = false }
  }, [universityId])

  function resetState() {
    setRows([])
    setFileName('')
    setResults(null)
    setProgress(null)
  }

  function handleFile(file: File) {
    setResults(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setRows(parseCSV(String(reader.result ?? ''), tab, filieres))
    reader.readAsText(file)
  }

  const validRows = rows.filter((r) => r.valid)

  async function handleImport() {
    if (!universityId || validRows.length === 0) return
    setImporting(true)
    setResults(null)
    const out: ImportResult[] = []
    const year = new Date().getFullYear()
    let next = matriculeBase
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i]
      setProgress({ done: i, total: validRows.length })
      const displayName = `${r.prenom} ${r.nom}`.trim()
      try {
        if (tab === 'etudiants') {
          next += 1
          await createMemberViaApi({
            universityId, email: r.email, displayName, role: 'student',
            filiere: r.filiere, niveau: r.niveau,
            matricule: `STU-${year}-${String(next).padStart(4, '0')}`,
          })
        } else {
          await createMemberViaApi({
            universityId,
            email: r.email,
            displayName,
            role: 'teacher',
            // Multi-filières : IDs déjà résolus et validés au parsing.
            ...(r.filiereIds.length > 0 && { filiereIds: r.filiereIds }),
          })
        }
        out.push({ email: r.email, ok: true, message: 'Compte créé' })
      } catch (e) {
        out.push({ email: r.email, ok: false, message: e instanceof Error ? e.message : 'Échec' })
      }
    }
    setProgress({ done: validRows.length, total: validRows.length })
    setResults(out)
    setMatriculeBase(next)
    setImporting(false)
  }

  if (profile && profile.role !== 'admin_universite' && profile.role !== 'super_admin_plateforme') {
    return <div className="flex items-center justify-center h-64 text-blue-700 dark:text-orange-300/60 text-sm">Accès réservé aux administrateurs.</div>
  }

  if (!universityId) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const successCount = results?.filter((r) => r.ok).length ?? 0

  return (
    // L'import est un feature flag de plan (importCSV) : le gate rend la règle
    // applicable même si la grille tarifaire évolue. Aujourd'hui importCSV est
    // à true sur les trois plans (cf. src/lib/plans.ts), le gate laisse donc
    // passer — le jour où l'import devient payant, un seul booléen suffit.
    <PlanGate feature="importCSV" universityId={universityId}>
    <div className="space-y-6 max-w-4xl">
      <p className="text-zinc-600 dark:text-orange-200/50 text-sm">
        Importez des comptes en masse depuis un fichier CSV. Chaque membre reçoit ses identifiants par email
        et devra changer son mot de passe à la première connexion.
      </p>

      {/* Tabs */}
      <div className="flex gap-2">
        {([['etudiants', 'Étudiants'], ['enseignants', 'Enseignants']] as const).map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); resetState() }}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${tab === key ? 'bg-orange-500/20 text-blue-600 dark:text-orange-400 border-orange-500/30' : 'bg-zinc-50 dark:bg-black/40 text-zinc-600 dark:text-orange-200/60 border-zinc-200 dark:border-orange-500/10 hover:text-zinc-900 dark:hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2.5 font-semibold text-sm transition-colors">
          <Upload size={15} /> Choisir un fichier CSV
        </button>
        <input ref={inputRef} type="file" accept=".csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        <button onClick={() => downloadTemplate(tab)}
          className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-blue-600 dark:text-orange-400 rounded-xl px-4 py-2.5 text-sm hover:bg-orange-500/20 transition-colors">
          <Download size={14} /> Télécharger le modèle
        </button>
        {fileName && (
          <span className="flex items-center gap-2 text-xs text-zinc-600 dark:text-orange-200/60">
            <FileSpreadsheet size={14} className="text-blue-600 dark:text-orange-400" /> {fileName}
            <button onClick={resetState} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X size={13} /></button>
          </span>
        )}
      </div>
      <p className="text-zinc-500 dark:text-orange-200/30 text-xs">
        Colonnes attendues : <code className="text-blue-600 dark:text-orange-400">{(tab === 'etudiants' ? HEADERS_ETU : HEADERS_ENS).join(', ')}</code>
        {' '}(la filière et le niveau doivent correspondre à ceux déjà créés). Évitez les virgules dans les valeurs.
        {tab === 'enseignants' && (
          <>
            {' '}La colonne <code className="text-blue-600 dark:text-orange-400">filieres</code> est facultative et accepte
            plusieurs filières séparées par un point-virgule, par exemple{' '}
            <code className="text-blue-600 dark:text-orange-400">Informatique;Mathématiques</code>.
          </>
        )}
      </p>

      {tab === 'enseignants' && filieres.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20 px-4 py-3">
          <AlertTriangle size={15} className="text-blue-600 dark:text-orange-400 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-600 dark:text-orange-200/70">
            Aucune filière n’existe encore : la colonne <code>filieres</code> sera refusée sur toutes les lignes
            qui la renseignent. Créez d’abord vos filières.
          </p>
        </div>
      )}

      {/* Aperçu */}
      {rows.length > 0 && !results && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{validRows.length} ligne{validRows.length !== 1 ? 's' : ''} valide{validRows.length !== 1 ? 's' : ''} sur {rows.length}</p>
            <button onClick={handleImport} disabled={importing || validRows.length === 0}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors">
              {importing && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
              Lancer l’import ({validRows.length})
            </button>
          </div>

          {progress && (
            <div>
              <div className="h-2 bg-zinc-50 dark:bg-black/40 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
              <p className="text-xs text-zinc-500 dark:text-orange-200/40 mt-1 text-right">{progress.done}/{progress.total}</p>
            </div>
          )}

          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-black/40 text-blue-700 dark:text-orange-300/60 text-xs uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left">Nom</th>
                  <th className="px-4 py-2.5 text-left">Email</th>
                  {tab === 'etudiants' && <th className="px-4 py-2.5 text-left">Filière</th>}
                  {tab === 'etudiants' && <th className="px-4 py-2.5 text-left">Niveau</th>}
                  {tab === 'enseignants' && <th className="px-4 py-2.5 text-left">Filières</th>}
                  <th className="px-4 py-2.5 text-center">État</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-orange-500/5">
                    <td className="px-4 py-2 text-zinc-800 dark:text-orange-100/80">{`${r.prenom} ${r.nom}`.trim() || '—'}</td>
                    <td className="px-4 py-2 text-zinc-800 dark:text-orange-100/60">{r.email || '—'}</td>
                    {tab === 'etudiants' && <td className="px-4 py-2 text-zinc-800 dark:text-orange-100/60">{r.filiere || '—'}</td>}
                    {tab === 'etudiants' && <td className="px-4 py-2 text-zinc-800 dark:text-orange-100/60">{r.niveau || '—'}</td>}
                    {tab === 'enseignants' && (
                      <td className="px-4 py-2">
                        {r.filieresNoms.length === 0 ? (
                          <span className="text-zinc-500 dark:text-orange-200/30">—</span>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {r.filieresNoms.map((n) => (
                              <span key={n} className="text-[11px] bg-orange-500/10 border border-orange-500/20 text-blue-700 dark:text-orange-300 rounded-full px-2 py-0.5">
                                {n}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-2 text-center">
                      {r.valid ? <span className="text-green-400 text-xs">✓ Valide</span>
                        : <span className="text-red-400 text-xs" title={r.reason}>✕ {r.reason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Résultats */}
      {results && (
        <div className="space-y-3">
          <div className={`flex items-center gap-3 rounded-xl p-4 border ${successCount === results.length ? 'bg-green-950/30 border-green-500/30' : 'bg-orange-950/30 border-orange-500/30'}`}>
            {successCount === results.length ? <CheckCircle size={20} className="text-green-400" /> : <AlertTriangle size={20} className="text-blue-600 dark:text-orange-400" />}
            <p className="text-sm text-zinc-900 dark:text-white font-medium">{successCount}/{results.length} compte{results.length !== 1 ? 's' : ''} créé{successCount !== 1 ? 's' : ''} avec succès.</p>
            <button onClick={resetState} className="ml-auto text-xs text-blue-600 dark:text-orange-400 hover:text-blue-900 dark:hover:text-orange-300">Nouvel import</button>
          </div>
          {results.some((r) => !r.ok) && (
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl divide-y divide-orange-500/5">
              {results.filter((r) => !r.ok).map((r, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-zinc-800 dark:text-orange-100/70">{r.email}</span>
                  <span className="text-red-400 text-xs">{r.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </PlanGate>
  )
}
