'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getUniversityMembers } from '@/lib/db'
import { createMemberViaApi } from '@/lib/members-client'

type Tab = 'etudiants' | 'enseignants'

interface ParsedRow {
  prenom: string
  nom: string
  email: string
  filiere: string
  niveau: string
  valid: boolean
  reason?: string
}

interface ImportResult {
  email: string
  ok: boolean
  message: string
}

const HEADERS_ETU = ['prenom', 'nom', 'email', 'filiere', 'niveau']
const HEADERS_ENS = ['prenom', 'nom', 'email']

function stripAccents(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function parseCSV(text: string, tab: Tab): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => stripAccents(h.trim().toLowerCase()))
  const idx = (name: string) => headers.indexOf(name)
  const iPrenom = idx('prenom')
  const iNom = idx('nom')
  const iEmail = idx('email')
  const iFiliere = idx('filiere')
  const iNiveau = idx('niveau')

  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim())
    const prenom = iPrenom >= 0 ? cells[iPrenom] ?? '' : ''
    const nom = iNom >= 0 ? cells[iNom] ?? '' : ''
    const email = iEmail >= 0 ? cells[iEmail] ?? '' : ''
    const filiere = iFiliere >= 0 ? cells[iFiliere] ?? '' : ''
    const niveau = iNiveau >= 0 ? cells[iNiveau] ?? '' : ''
    let valid = true
    let reason: string | undefined
    if (!email || !email.includes('@')) { valid = false; reason = 'Email manquant ou invalide' }
    else if (!prenom && !nom) { valid = false; reason = 'Nom manquant' }
    else if (tab === 'etudiants' && (!filiere || !niveau)) { valid = false; reason = 'Filière ou niveau manquant' }
    return { prenom, nom, email, filiere, niveau, valid, reason }
  })
}

function downloadTemplate(tab: Tab) {
  const headers = tab === 'etudiants' ? HEADERS_ETU : HEADERS_ENS
  const blob = new Blob([headers.join(',') + '\n'], { type: 'text/csv;charset=utf-8;' })
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
  const inputRef = useRef<HTMLInputElement>(null)

  // Numérotation matricule : repart du max existant.
  useEffect(() => {
    if (!universityId) return
    let active = true
    ;(async () => {
      const studs = await getUniversityMembers(universityId, 'student')
      if (!active) return
      const nums = studs
        .map((s) => parseInt((s.matricule ?? '').split('-')[2] ?? '0', 10))
        .filter(Number.isFinite)
      setMatriculeBase(nums.length ? Math.max(...nums) : 0)
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
    reader.onload = () => setRows(parseCSV(String(reader.result ?? ''), tab))
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
          await createMemberViaApi({ universityId, email: r.email, displayName, role: 'teacher' })
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
    return <div className="flex items-center justify-center h-64 text-orange-300/60 text-sm">Accès réservé aux administrateurs.</div>
  }

  const successCount = results?.filter((r) => r.ok).length ?? 0

  return (
    <div className="space-y-6 max-w-4xl">
      <p className="text-orange-200/50 text-sm">
        Importez des comptes en masse depuis un fichier CSV. Chaque membre reçoit ses identifiants par email
        et devra changer son mot de passe à la première connexion.
      </p>

      {/* Tabs */}
      <div className="flex gap-2">
        {([['etudiants', 'Étudiants'], ['enseignants', 'Enseignants']] as const).map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); resetState() }}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${tab === key ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-black/40 text-orange-200/60 border-orange-500/10 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-black rounded-xl px-4 py-2.5 font-semibold text-sm transition-colors">
          <Upload size={15} /> Choisir un fichier CSV
        </button>
        <input ref={inputRef} type="file" accept=".csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        <button onClick={() => downloadTemplate(tab)}
          className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl px-4 py-2.5 text-sm hover:bg-orange-500/20 transition-colors">
          <Download size={14} /> Télécharger le modèle
        </button>
        {fileName && (
          <span className="flex items-center gap-2 text-xs text-orange-200/60">
            <FileSpreadsheet size={14} className="text-orange-400" /> {fileName}
            <button onClick={resetState} className="text-zinc-500 hover:text-white"><X size={13} /></button>
          </span>
        )}
      </div>
      <p className="text-orange-200/30 text-xs">
        Colonnes attendues : <code className="text-orange-400">{(tab === 'etudiants' ? HEADERS_ETU : HEADERS_ENS).join(', ')}</code>
        {' '}(la filière et le niveau doivent correspondre à ceux déjà créés). Évitez les virgules dans les valeurs.
      </p>

      {/* Aperçu */}
      {rows.length > 0 && !results && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">{validRows.length} ligne{validRows.length !== 1 ? 's' : ''} valide{validRows.length !== 1 ? 's' : ''} sur {rows.length}</p>
            <button onClick={handleImport} disabled={importing || validRows.length === 0}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-black rounded-xl px-4 py-2 font-semibold text-sm transition-colors">
              {importing && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
              Lancer l’import ({validRows.length})
            </button>
          </div>

          {progress && (
            <div>
              <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
              <p className="text-xs text-orange-200/40 mt-1 text-right">{progress.done}/{progress.total}</p>
            </div>
          )}

          <div className="bg-zinc-950 border border-orange-500/10 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/40 text-orange-300/60 text-xs uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left">Nom</th>
                  <th className="px-4 py-2.5 text-left">Email</th>
                  {tab === 'etudiants' && <th className="px-4 py-2.5 text-left">Filière</th>}
                  {tab === 'etudiants' && <th className="px-4 py-2.5 text-left">Niveau</th>}
                  <th className="px-4 py-2.5 text-center">État</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-orange-500/5">
                    <td className="px-4 py-2 text-orange-100/80">{`${r.prenom} ${r.nom}`.trim() || '—'}</td>
                    <td className="px-4 py-2 text-orange-100/60">{r.email || '—'}</td>
                    {tab === 'etudiants' && <td className="px-4 py-2 text-orange-100/60">{r.filiere || '—'}</td>}
                    {tab === 'etudiants' && <td className="px-4 py-2 text-orange-100/60">{r.niveau || '—'}</td>}
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
            {successCount === results.length ? <CheckCircle size={20} className="text-green-400" /> : <AlertTriangle size={20} className="text-orange-400" />}
            <p className="text-sm text-white font-medium">{successCount}/{results.length} compte{results.length !== 1 ? 's' : ''} créé{successCount !== 1 ? 's' : ''} avec succès.</p>
            <button onClick={resetState} className="ml-auto text-xs text-orange-400 hover:text-orange-300">Nouvel import</button>
          </div>
          {results.some((r) => !r.ok) && (
            <div className="bg-zinc-950 border border-orange-500/10 rounded-xl divide-y divide-orange-500/5">
              {results.filter((r) => !r.ok).map((r, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-orange-100/70">{r.email}</span>
                  <span className="text-red-400 text-xs">{r.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
