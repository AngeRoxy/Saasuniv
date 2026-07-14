'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, X, Video, Radio, Play, History, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getSessionsEnseignant,
  createSessionEnLigne,
  demarrerSession,
  terminerSession,
  getCreneaux,
  getFilieres,
  getMatieres,
  type SessionEnLigne,
  type Filiere,
  type Matiere,
} from '@/lib/db'
import { type Creneau } from '@/types/emploi-du-temps'
import {
  STATUT_SESSION_LABELS,
  STATUT_SESSION_STYLES,
  dureeApproxSession,
  compareSessionsRecentes,
} from '@/types/cours-en-ligne'
import { JitsiVideoCall } from '@/components/ui/jitsi-video-call'

interface TForm {
  filiereId: string
  niveau: string
  matiereId: string
  titre: string
}

const inputCls =
  'w-full bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 placeholder:text-zinc-500 dark:placeholder:text-orange-200/25'
const selectCls =
  'w-full bg-white dark:bg-zinc-900 border border-orange-500/20 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-orange-400/60 disabled:opacity-50 disabled:cursor-not-allowed'

const emptyForm: TForm = { filiereId: '', niveau: '', matiereId: '', titre: '' }

export default function TeacherCoursEnLignePage() {
  const { user, profile } = useAuth()
  const universityId = profile?.universityId
  const enseignantUid = user?.uid
  const teacherName = profile?.displayName ?? user?.displayName ?? ''

  const [sessions, setSessions] = useState<SessionEnLigne[]>([])
  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<TForm>(emptyForm)
  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Session actuellement ouverte en visio (l'enseignant l'a démarrée ou rejointe).
  const [activeSession, setActiveSession] = useState<SessionEnLigne | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!universityId || !enseignantUid) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [sess, cres, fils] = await Promise.all([
          getSessionsEnseignant(universityId, enseignantUid),
          getCreneaux(universityId),
          getFilieres(universityId),
        ])
        if (!active) return
        setSessions(sess)
        setCreneaux(cres)
        setFilieres(fils)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [universityId, enseignantUid])

  // Matières de la filière sélectionnée dans le formulaire (résout matiereId + nom).
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!universityId || !form.filiereId) {
        if (active) setMatieres([])
        return
      }
      const list = await getMatieres(universityId, form.filiereId)
      if (active) setMatieres(list)
    })()
    return () => {
      active = false
    }
  }, [universityId, form.filiereId])

  async function refresh() {
    if (!universityId || !enseignantUid) return
    setSessions(await getSessionsEnseignant(universityId, enseignantUid))
  }

  const filiereNom = useMemo(() => {
    const map = new Map(filieres.map((f) => [f.id, f.nom]))
    return (id: string) => map.get(id) ?? ''
  }, [filieres])

  // RÈGLE 1 : l'enseignant ne peut créer une session que pour une matière qu'il
  // enseigne réellement. Comme le reste de l'app, cette « assignation » se lit dans
  // ses créneaux d'emploi du temps (appariés par NOM, cf. page Absences).
  const mesCreneaux = useMemo(
    () => creneaux.filter((c) => c.enseignant && c.enseignant === teacherName),
    [creneaux, teacherName]
  )

  const filiereOptions = useMemo(() => {
    const ids = new Set(mesCreneaux.map((c) => c.filiereId))
    return filieres.filter((f) => ids.has(f.id))
  }, [mesCreneaux, filieres])

  const niveauOptions = useMemo(() => {
    if (!form.filiereId) return []
    return [...new Set(mesCreneaux.filter((c) => c.filiereId === form.filiereId).map((c) => c.niveau))]
  }, [mesCreneaux, form.filiereId])

  // Matières que l'enseignant assure pour ce groupe (créneau) ET qui existent dans
  // le référentiel de la filière (pour disposer d'un matiereId fiable).
  const matiereOptions = useMemo(() => {
    if (!form.filiereId || !form.niveau) return []
    const nomsAssures = new Set(
      mesCreneaux
        .filter((c) => c.filiereId === form.filiereId && c.niveau === form.niveau)
        .map((c) => c.matiere.trim().toLowerCase())
    )
    return matieres.filter((m) => nomsAssures.has(m.nom.trim().toLowerCase()))
  }, [mesCreneaux, matieres, form.filiereId, form.niveau])

  const sessionsTriees = useMemo(() => [...sessions].sort(compareSessionsRecentes), [sessions])
  const sessionsActives = sessionsTriees.filter((s) => s.statut !== 'terminee')
  const sessionsTerminees = sessionsTriees.filter((s) => s.statut === 'terminee')

  function openAdd() {
    setForm(emptyForm)
    setMatieres([])
    setFormError(null)
    setModalOpen(true)
  }
  function closeModal() {
    setModalOpen(false)
    setFormError(null)
  }

  function handleFiliereChange(id: string) {
    setForm((f) => ({ ...f, filiereId: id, niveau: '', matiereId: '' }))
  }
  function handleNiveauChange(niveau: string) {
    setForm((f) => ({ ...f, niveau, matiereId: '' }))
  }

  async function handleCreate() {
    if (!universityId || !enseignantUid) return
    const matiere = matiereOptions.find((m) => m.id === form.matiereId)
    if (!form.filiereId || !form.niveau) {
      setFormError('Choisissez la filière et le niveau.')
      return
    }
    if (!matiere) {
      setFormError('Choisissez une matière que vous enseignez.')
      return
    }
    const titre = form.titre.trim()
    if (!titre) {
      setFormError('Donnez un intitulé au cours.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      await createSessionEnLigne(
        universityId,
        { filiereId: form.filiereId, niveau: form.niveau, matiereId: matiere.id, titre },
        enseignantUid,
        teacherName || user?.email || 'Enseignant',
        matiere.nom
      )
      await refresh()
      closeModal()
    } catch {
      setFormError("Échec de la création de la session. Réessayez.")
    } finally {
      setSaving(false)
    }
  }

  // Démarre une session programmée PUIS ouvre la visio (RÈGLE 3 : passe « en_direct »).
  async function handleDemarrer(session: SessionEnLigne) {
    if (!universityId) return
    setActionError(null)
    try {
      await demarrerSession(universityId, session.id)
      // demarreeAt est horodaté côté db.ts ; l'objet local ne sert qu'à ouvrir la
      // visio (roomName), on n'y recopie donc pas de timestamp calculé au rendu.
      await refresh()
      setActiveSession({ ...session, statut: 'en_direct' })
    } catch {
      setActionError("Impossible de démarrer le cours. Vérifiez votre connexion et réessayez.")
    }
  }

  // Rejoint une session déjà en direct (ex : après un rafraîchissement de page).
  function handleRejoindre(session: SessionEnLigne) {
    setActionError(null)
    setActiveSession(session)
  }

  // Fin de l'appel côté enseignant = fin de la session pour tout le monde.
  async function handleTerminer() {
    const session = activeSession
    setActiveSession(null)
    if (!universityId || !session) return
    try {
      await terminerSession(universityId, session.id)
      await refresh()
    } catch {
      setActionError("La session s'est fermée mais la clôture n'a pas été enregistrée. Réessayez depuis la liste.")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {activeSession && (
        <JitsiVideoCall
          roomName={activeSession.roomName}
          displayName={teacherName || user?.email || 'Enseignant'}
          leaveLabel="Terminer le cours"
          sousTitre={`${activeSession.matiereNom} · ${filiereNom(activeSession.filiereId)} · ${activeSession.niveau}`}
          onCallEnd={handleTerminer}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Video size={22} className="text-blue-600 dark:text-orange-400" />
            Cours en ligne
          </h1>
          <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
            Lancez une visioconférence pour vos étudiants. Aucun enregistrement n’est réalisé.
          </p>
        </div>
        {filiereOptions.length > 0 && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shrink-0"
          >
            <Plus size={15} /> Nouveau cours en direct
          </button>
        )}
      </div>

      {actionError && (
        <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {filiereOptions.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 dark:text-orange-200/30 text-sm">
          Aucun cours ne vous est assigné. L’administration vous attribue des créneaux depuis
          l’emploi du temps ; vous pourrez alors lancer des cours en ligne pour vos groupes.
        </div>
      ) : (
        <>
          {/* Sessions en cours / à venir */}
          <section className="space-y-3">
            {sessionsActives.length === 0 ? (
              <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl px-5 py-8 text-center text-zinc-500 dark:text-orange-200/30 text-sm">
                Aucun cours en direct ou programmé. Créez-en un pour démarrer.
              </div>
            ) : (
              sessionsActives.map((s) => (
                <div
                  key={s.id}
                  className={`bg-white dark:bg-zinc-950 rounded-xl p-5 border ${
                    s.statut === 'en_direct' ? 'border-red-500/40' : 'border-zinc-200 dark:border-orange-500/10'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatutBadge statut={s.statut} />
                        <h3 className="text-zinc-900 dark:text-white font-semibold truncate">{s.titre}</h3>
                      </div>
                      <p className="text-zinc-500 dark:text-orange-200/40 text-sm mt-1">
                        {s.matiereNom} · {filiereNom(s.filiereId)} · {s.niveau}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {s.statut === 'programmee' ? (
                        <button
                          onClick={() => handleDemarrer(s)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
                        >
                          <Play size={15} /> Démarrer le cours
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRejoindre(s)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                        >
                          <Radio size={15} /> Rejoindre le cours
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>

          {/* Historique */}
          {sessionsTerminees.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-600 dark:text-orange-200/50 flex items-center gap-2 pt-2">
                <History size={15} /> Historique
              </h2>
              <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-orange-500/10 rounded-xl divide-y divide-zinc-200 dark:divide-white/5">
                {sessionsTerminees.map((s) => {
                  const duree = dureeApproxSession(s)
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="text-zinc-900 dark:text-white text-sm font-medium truncate">{s.titre}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">
                          {s.matiereNom} · {filiereNom(s.filiereId)} · {s.niveau}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-zinc-600 dark:text-zinc-400 text-xs">
                          {s.demarreeAt ? new Date(s.demarreeAt).toLocaleDateString('fr-FR') : '—'}
                        </p>
                        <p className="text-zinc-600 text-xs mt-0.5">{duree ? `Durée ~ ${duree}` : 'Non démarrée'}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-orange-200/30">
                Les cours terminés ne sont plus rejoignables. Aucun enregistrement n’est conservé
                (limitation du service gratuit Jitsi).
              </p>
            </section>
          )}
        </>
      )}

      {/* Modal nouveau cours */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-orange-500/20 rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Nouveau cours en direct</h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Filière</label>
                <select value={form.filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={selectCls}>
                  <option value="">Choisir…</option>
                  {filiereOptions.map((f) => (
                    <option key={f.id} value={f.id}>{f.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Niveau</label>
                <select
                  value={form.niveau}
                  onChange={(e) => handleNiveauChange(e.target.value)}
                  disabled={!form.filiereId}
                  className={selectCls}
                >
                  <option value="">{form.filiereId ? 'Choisir…' : 'Filière d’abord'}</option>
                  {niveauOptions.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Matière</label>
                <select
                  value={form.matiereId}
                  onChange={(e) => setForm((f) => ({ ...f, matiereId: e.target.value }))}
                  disabled={!form.niveau}
                  className={selectCls}
                >
                  <option value="">
                    {!form.niveau ? 'Niveau d’abord' : matiereOptions.length ? 'Choisir…' : 'Aucune matière assurée'}
                  </option>
                  {matiereOptions.map((m) => (
                    <option key={m.id} value={m.id}>{m.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-zinc-600 dark:text-orange-200/60 text-xs font-medium block mb-1.5">Intitulé du cours</label>
                <input
                  value={form.titre}
                  onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
                  placeholder="Ex : Algorithmique — Chapitre 3"
                  className={inputCls}
                />
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-orange-200/40">
                La session est d’abord <span className="text-blue-700 dark:text-blue-300/80">programmée</span>. Vos
                étudiants ne pourront la rejoindre qu’une fois que vous l’aurez démarrée.
              </p>
              {formError && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{formError}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeModal}
                  disabled={saving}
                  className="flex-1 border border-orange-500/20 text-zinc-600 dark:text-orange-200/60 rounded-xl py-2.5 text-sm hover:border-orange-500/40 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
                >
                  {saving && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  Créer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatutBadge({ statut }: { statut: SessionEnLigne['statut'] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${STATUT_SESSION_STYLES[statut]}`}
    >
      {statut === 'en_direct' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
      {STATUT_SESSION_LABELS[statut]}
    </span>
  )
}
