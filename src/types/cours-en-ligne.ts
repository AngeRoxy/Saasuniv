// Cours en ligne en direct : sessions de visioconférence adossées à une matière.
//
// Contrairement au reste de l'application (lectures ponctuelles get()), ce module
// s'écoute EN TEMPS RÉEL côté étudiant (onValue) : dès que l'enseignant démarre la
// session, l'étudiant doit voir le bouton « Rejoindre » s'activer sans rafraîchir.
//
// Nœud Firebase dédié : /universities/{universityId}/sessions_direct/{sessionId}
// (aucun lien avec emploi_du_temps ni examens — système complètement séparé).
//
// SÉCURITÉ : la visio passe par le service public gratuit meet.jit.si. Une salle
// Jitsi publique est accessible à QUICONQUE en connaît le nom. La seule protection
// est donc un `roomName` long et cryptographiquement aléatoire (crypto.randomUUID),
// résolu à la création dans db.ts — JAMAIS un nom prévisible.

export type StatutSession = 'programmee' | 'en_direct' | 'terminee'

export interface SessionEnLigne {
  id: string
  universityId: string
  filiereId: string
  niveau: string
  matiereId: string
  /** Nom de la matière dénormalisé (résolu à l'écriture, pas saisi). */
  matiereNom: string
  enseignantUid: string
  /** Nom de l'enseignant dénormalisé. */
  enseignantNom: string
  /** Intitulé libre, ex : « Cours d'Algorithmique — Chapitre 3 ». */
  titre: string
  /** Identifiant Jitsi aléatoire et unique (généré via crypto.randomUUID). */
  roomName: string
  statut: StatutSession
  /** Timestamp du passage à « en_direct ». */
  demarreeAt?: number
  /** Timestamp du passage à « terminee ». */
  termineeAt?: number
  createdAt: number
}

/**
 * Données saisies dans le formulaire enseignant : la `SessionEnLigne` sans son id,
 * son universityId, son roomName, son statut, ses timestamps NI ses champs
 * dénormalisés / d'identité (matiereNom, enseignantUid, enseignantNom), tous
 * résolus côté db.ts à l'écriture.
 */
export interface SessionFormData {
  filiereId: string
  niveau: string
  matiereId: string
  titre: string
}

// ─── Libellés d'affichage (source unique, aucun hardcode dispersé dans l'UI) ─────

export const STATUT_SESSION_LABELS: Record<StatutSession, string> = {
  programmee: 'Programmée',
  en_direct: 'En direct',
  terminee: 'Terminée',
}

export const STATUT_SESSION_STYLES: Record<StatutSession, string> = {
  programmee: 'bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300',
  en_direct: 'bg-red-500/15 border-red-500/30 text-red-300',
  terminee: 'bg-zinc-700/30 border-white/10 text-zinc-600 dark:text-zinc-400',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

/**
 * Durée approximative d'une session terminée, en libellé lisible. Renvoie `null`
 * tant qu'on ne dispose pas des deux bornes (session non démarrée / non terminée).
 * « Approximative » car bornée aux timestamps de démarrage/fin côté application —
 * le service gratuit Jitsi ne fournit aucune donnée de présence.
 */
export function dureeApproxSession(
  s: Pick<SessionEnLigne, 'demarreeAt' | 'termineeAt'>
): string | null {
  if (!s.demarreeAt || !s.termineeAt) return null
  const minutes = Math.max(0, Math.round((s.termineeAt - s.demarreeAt) / 60_000))
  if (minutes < 1) return "moins d'une minute"
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const r = minutes % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

/** Tri anti-chronologique : la session la plus récente d'abord (par createdAt). */
export function compareSessionsRecentes(a: SessionEnLigne, b: SessionEnLigne): number {
  return b.createdAt - a.createdAt
}
