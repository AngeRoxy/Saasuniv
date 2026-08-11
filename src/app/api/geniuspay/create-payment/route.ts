import { verifyFirebaseToken } from '@/lib/verify-token'
import { assertAdminCaller } from '@/lib/server/members'
import { getAdminDb } from '@/lib/server/firebase-admin'
import { createGeniusPayPayment } from '@/lib/geniuspay'
import { PLANS_CONFIG } from '@/lib/plans'
import type { AbonnementPaiement, AbonnementPeriode } from '@/types/abonnement-paiement'
import type { PlanId } from '@/types/plan'

const PAYABLE_PLANS: PlanId[] = ['standard', 'premium']

interface CreatePaymentBody {
  universityId: string
  plan: PlanId
  periode: AbonnementPeriode
}

export async function POST(request: Request): Promise<Response> {
  const auth = await verifyFirebaseToken(request)
  if (!auth) {
    return Response.json({ error: 'Non authentifié.' }, { status: 401 })
  }
  const idToken = (request.headers.get('authorization') ?? '').split(' ')[1] ?? ''

  let body: CreatePaymentBody
  try {
    body = (await request.json()) as CreatePaymentBody
  } catch {
    return Response.json({ error: 'Corps invalide.' }, { status: 400 })
  }

  if (!body.universityId || typeof body.universityId !== 'string') {
    return Response.json({ error: 'universityId requis.' }, { status: 400 })
  }
  if (!PAYABLE_PLANS.includes(body.plan)) {
    return Response.json(
      { error: 'Plan invalide. Seuls standard et premium se souscrivent en ligne.' },
      { status: 400 }
    )
  }
  if (body.periode !== 'mensuel' && body.periode !== 'annuel') {
    return Response.json({ error: 'Période invalide.' }, { status: 400 })
  }

  // Autorisation : uniquement l'admin de CETTE université, ou le super admin.
  const caller = await assertAdminCaller(auth.uid, idToken, body.universityId)
  if (!caller) {
    return Response.json(
      { error: "Accès refusé. Seule l'administration de l'université peut souscrire un plan." },
      { status: 403 }
    )
  }

  // Montant calculé UNIQUEMENT côté serveur depuis PLANS_CONFIG — jamais depuis
  // une valeur envoyée par le client.
  const config = PLANS_CONFIG[body.plan]
  const montant = body.periode === 'annuel' ? config.prixAnnuel : config.prixMensuel

  // Email de l'admin (pour le reçu GeniusPay) — lu avec SON idToken, jamais
  // fourni par le client.
  let callerEmail: string | undefined
  try {
    const dbUrl = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? '').replace(/\/$/, '')
    const res = await fetch(`${dbUrl}/users/${auth.uid}/email.json?auth=${idToken}`)
    if (res.ok) {
      const val = (await res.json()) as string | null
      if (typeof val === 'string') callerEmail = val
    }
  } catch {
    /* le nom du client sur le reçu GeniusPay est purement informatif */
  }

  const origin = new URL(request.url).origin
  const adminDb = getAdminDb()
  const paiementRef = adminDb.ref(`universities/${body.universityId}/abonnementPaiements`).push()
  const paiementId = paiementRef.key
  if (!paiementId) {
    return Response.json({ error: 'Impossible de générer un identifiant de paiement.' }, { status: 500 })
  }

  let payment
  try {
    payment = await createGeniusPayPayment({
      amount: montant,
      description: `Abonnement gestUniv — plan ${config.nom} (${body.periode})`,
      customer: callerEmail ? { email: callerEmail } : undefined,
      successUrl: `${origin}/dashboard/admin/billing/success?paiementId=${paiementId}`,
      errorUrl: `${origin}/dashboard/admin/billing/cancel?paiementId=${paiementId}`,
      metadata: {
        universityId: body.universityId,
        paiementId,
        plan: body.plan,
        periode: body.periode,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue.'
    console.error('[geniuspay/create-payment] Échec de création du paiement :', message)
    return Response.json(
      { error: "Impossible d'initier le paiement auprès de GeniusPay. Réessayez dans un instant." },
      { status: 502 }
    )
  }

  const now = Date.now()
  const record: AbonnementPaiement = {
    id: paiementId,
    plan: body.plan,
    periode: body.periode,
    montant,
    statut: 'en_attente',
    reference: payment.reference,
    checkoutUrl: payment.checkout_url,
    createdAt: now,
    updatedAt: now,
    initiatedByUid: auth.uid,
  }
  await paiementRef.set(record)

  return Response.json({ checkoutUrl: payment.checkout_url })
}
