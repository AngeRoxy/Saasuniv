import { getAdminDb } from '@/lib/server/firebase-admin'
import { verifyGeniusPayWebhookSignature } from '@/lib/geniuspay'
import type { AbonnementPaiement, AbonnementPaiementStatut } from '@/types/abonnement-paiement'
import type { PlanId } from '@/types/plan'

interface GeniusPayWebhookPayload {
  event: string
  data: {
    reference: string
    amount: number
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

export async function POST(request: Request): Promise<Response> {
  // Le corps BRUT (avant tout parsing JSON) est requis pour la vérification
  // de signature — le HMAC porte sur les octets exacts envoyés par GeniusPay.
  const rawBody = await request.text()
  const signature = request.headers.get('x-webhook-signature')
  const timestamp = request.headers.get('x-webhook-timestamp')

  if (!verifyGeniusPayWebhookSignature(rawBody, timestamp, signature)) {
    console.error('[geniuspay/webhook] Signature invalide ou absente — webhook rejeté.')
    return Response.json({ error: 'Signature invalide.' }, { status: 401 })
  }

  let payload: GeniusPayWebhookPayload
  try {
    payload = JSON.parse(rawBody) as GeniusPayWebhookPayload
  } catch {
    return Response.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }

  const { universityId, paiementId, plan } = payload.data.metadata ?? {}
  if (!universityId || !paiementId || !isPlanId(plan) || plan === 'enterprise') {
    console.error('[geniuspay/webhook] metadata manquant ou invalide sur le paiement', payload.data.reference)
    return Response.json({ error: 'Métadonnées de paiement invalides.' }, { status: 400 })
  }

  const isSuccess = SUCCESS_EVENTS.has(payload.event)
  const isFailure = FAILURE_EVENTS.has(payload.event)
  if (!isSuccess && !isFailure) {
    // Événement reconnu mais sans action requise (ex. payment.initiated).
    return Response.json({ ok: true })
  }

  const adminDb = getAdminDb()
  const paiementRef = adminDb.ref(`universities/${universityId}/abonnementPaiements/${paiementId}`)
  const snapshot = await paiementRef.get()
  if (!snapshot.exists()) {
    console.error('[geniuspay/webhook] Paiement introuvable en base :', paiementId)
    return Response.json({ error: 'Paiement introuvable.' }, { status: 404 })
  }
  const existing = snapshot.val() as AbonnementPaiement

  // Idempotence : un webhook déjà traité (livraison en double par GeniusPay)
  // ne doit ni ré-écraser convertedAt ni redéclencher d'effet de bord.
  if (existing.statut !== 'en_attente') {
    return Response.json({ ok: true })
  }

  // Défense en profondeur : le montant confirmé par GeniusPay doit correspondre
  // à celui calculé côté serveur lors de la création — sinon on ne fait
  // confiance à rien plutôt que de valider un montant trafiqué.
  if (isSuccess && payload.data.amount !== existing.montant) {
    console.error(
      `[geniuspay/webhook] Montant incohérent pour ${paiementId} : attendu ${existing.montant}, reçu ${payload.data.amount}`
    )
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
  } else {
    await paiementRef.update({ statut: nouveauStatut, updatedAt: now })
  }

  return Response.json({ ok: true })
}
