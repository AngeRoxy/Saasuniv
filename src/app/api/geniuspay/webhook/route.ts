import { getAdminDb } from '@/lib/server/firebase-admin'
import { verifyGeniusPayWebhookSignature } from '@/lib/geniuspay'
import type { AbonnementPaiement, AbonnementPaiementStatut } from '@/types/abonnement-paiement'
import type { PlanId } from '@/types/plan'

interface GeniusPayWebhookPayload {
  /** Identifiant unique de l'événement (livraisons en double possibles). */
  id?: string
  event: string
  data: {
    reference: string
    // GeniusPay renvoie parfois ce champ en chaîne avec décimales (ex.
    // "15000.00") plutôt qu'en nombre — jamais faire confiance au type
    // déclaré, toujours convertir avant de comparer (cf. montantRecu ci-dessous).
    amount: number | string
    status: string
    metadata?: {
      universityId?: string
      paiementId?: string
      plan?: string
      periode?: string
    }
  }
}

const SUCCESS_EVENTS = new Set(['payment.success'])
const FAILURE_EVENTS = new Set(['payment.failed', 'payment.cancelled', 'payment.expired'])

function isPlanId(value: string | undefined): value is PlanId {
  return value === 'standard' || value === 'premium' || value === 'enterprise'
}

const log = (msg: string, extra?: Record<string, unknown>) =>
  console.log(`[geniuspay/webhook] ${msg}`, extra ?? '')
const logError = (msg: string, extra?: Record<string, unknown>) =>
  console.error(`[geniuspay/webhook] ${msg}`, extra ?? '')

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now()

  // Le corps BRUT (avant tout parsing JSON) est requis pour la vérification
  // de signature — le HMAC porte sur les octets exacts envoyés par GeniusPay.
  // Headers.get() est insensible à la casse (spec Fetch) : X-Webhook-Signature
  // envoyé par GeniusPay est bien lu par 'x-webhook-signature'.
  const rawBody = await request.text()
  const signature = request.headers.get('x-webhook-signature')
  const timestamp = request.headers.get('x-webhook-timestamp')
  const eventHeader = request.headers.get('x-webhook-event')

  const verification = verifyGeniusPayWebhookSignature(rawBody, timestamp, signature)
  if (!verification.ok) {
    logError('Webhook rejeté — signature invalide', { reason: verification.reason, event: eventHeader })
    return Response.json({ error: 'Signature invalide.' }, { status: 401 })
  }
  log('Signature vérifiée avec succès', { event: eventHeader })

  let payload: GeniusPayWebhookPayload
  try {
    payload = JSON.parse(rawBody) as GeniusPayWebhookPayload
  } catch {
    logError('Corps JSON illisible malgré une signature valide')
    return Response.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }

  const { universityId, paiementId, plan } = payload.data.metadata ?? {}
  if (!universityId || !paiementId || !isPlanId(plan) || plan === 'enterprise') {
    logError('Métadonnées manquantes ou invalides', {
      eventId: payload.id,
      reference: payload.data.reference,
      metadata: payload.data.metadata,
    })
    return Response.json({ error: 'Métadonnées de paiement invalides.' }, { status: 400 })
  }

  const isSuccess = SUCCESS_EVENTS.has(payload.event)
  const isFailure = FAILURE_EVENTS.has(payload.event)
  if (!isSuccess && !isFailure) {
    // Événement reconnu mais sans action requise (ex. payment.initiated).
    log('Événement sans action requise', { event: payload.event, eventId: payload.id, paiementId })
    return Response.json({ ok: true })
  }

  const adminDb = getAdminDb()
  const paiementRef = adminDb.ref(`universities/${universityId}/abonnementPaiements/${paiementId}`)
  const snapshot = await paiementRef.get()
  if (!snapshot.exists()) {
    logError('Paiement introuvable en base', { paiementId, eventId: payload.id })
    return Response.json({ error: 'Paiement introuvable.' }, { status: 404 })
  }
  const existing = snapshot.val() as AbonnementPaiement

  // Idempotence : un événement déjà traité (livraison en double par
  // GeniusPay — cf. champ `id` du payload) ne doit ni ré-écraser convertedAt
  // ni redéclencher d'effet de bord. Le statut du paiement porte cette garde :
  // une fois sorti de "en_attente", plus rien ne le fait bouger.
  if (existing.statut !== 'en_attente') {
    log('Événement déjà traité — idempotence, aucune action', {
      paiementId,
      eventId: payload.id,
      statutActuel: existing.statut,
    })
    return Response.json({ ok: true })
  }

  // Défense en profondeur : le montant confirmé par GeniusPay doit correspondre
  // à celui calculé côté serveur lors de la création — sinon on ne fait
  // confiance à rien plutôt que de valider un montant trafiqué. GeniusPay
  // renvoie parfois ce champ en chaîne décimale (ex. "15000.00") : on convertit
  // avant de comparer, avec une tolérance d'un centime pour l'arrondi flottant
  // — jamais une égalité stricte entre un nombre et une chaîne (toujours fausse).
  const montantRecu = Number(payload.data.amount)
  const montantValide = Number.isFinite(montantRecu) && Math.abs(montantRecu - existing.montant) < 0.01
  if (isSuccess && !montantValide) {
    logError('Montant incohérent — traitement refusé', {
      paiementId,
      attendu: existing.montant,
      recu: payload.data.amount,
    })
    return Response.json({ error: 'Montant incohérent.' }, { status: 400 })
  }

  const now = Date.now()
  const nouveauStatut: AbonnementPaiementStatut = isSuccess ? 'reussi' : 'echoue'

  if (isSuccess) {
    // Écriture atomique multi-chemins : le paiement ET le plan de l'université
    // passent ensemble, ou pas du tout.
    await adminDb.ref().update({
      [`universities/${universityId}/abonnementPaiements/${paiementId}/statut`]: nouveauStatut,
      [`universities/${universityId}/abonnementPaiements/${paiementId}/updatedAt`]: now,
      [`universities/${universityId}/abonnementPaiements/${paiementId}/paidAt`]: now,
      [`universities/${universityId}/plan`]: plan,
      [`universities/${universityId}/trialStatus`]: 'converted',
      [`universities/${universityId}/convertedAt`]: now,
      [`universities/${universityId}/convertedPlan`]: plan,
    })
    log('Paiement confirmé — plan mis à jour', { universityId, paiementId, plan, ms: Date.now() - startedAt })
  } else {
    await paiementRef.update({ statut: nouveauStatut, updatedAt: now })
    log('Paiement marqué échoué', { universityId, paiementId, event: payload.event, ms: Date.now() - startedAt })
  }

  return Response.json({ ok: true })
}
