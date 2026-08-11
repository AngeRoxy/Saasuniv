// ⚠️ Module SERVEUR UNIQUEMENT — GENIUSPAY_API_SECRET et
// GENIUSPAY_WEBHOOK_SECRET ne doivent jamais atteindre le client.
//
// Format de création de paiement déduit de https://pay.genius.ci/doc
// (2026-08-11) — non encore testé en sandbox réel. Format de webhook
// (headers, formule HMAC) confirmé sur le dashboard GeniusPay
// (geniuspay.ci/dashboard/integrations?tab=webhooks) le 2026-08-11.

import { createHmac, timingSafeEqual } from 'crypto'

const GENIUSPAY_BASE_URL = 'https://pay.genius.ci/api/v1/merchant'

export interface CreateGeniusPayPaymentParams {
  amount: number
  description: string
  customer?: {
    name?: string
    email?: string
  }
  successUrl: string
  errorUrl: string
  metadata: Record<string, string>
}

export interface GeniusPayPaymentData {
  reference: string
  checkout_url: string
  status: string
}

interface GeniusPayCreateResponse {
  success: boolean
  data?: GeniusPayPaymentData
  message?: string
}

/**
 * Crée un paiement auprès de GeniusPay et retourne l'URL de checkout hébergée.
 * Lève une erreur explicite si l'appel échoue (jamais de faux succès).
 */
export async function createGeniusPayPayment(
  params: CreateGeniusPayPaymentParams
): Promise<GeniusPayPaymentData> {
  const apiKey = process.env.GENIUSPAY_API_KEY
  const apiSecret = process.env.GENIUSPAY_API_SECRET
  if (!apiKey || !apiSecret) {
    throw new Error('Clés GeniusPay non configurées côté serveur.')
  }

  let res: Response
  try {
    res = await fetch(`${GENIUSPAY_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-API-Secret': apiSecret,
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: 'XOF',
        description: params.description,
        customer: params.customer,
        success_url: params.successUrl,
        error_url: params.errorUrl,
        metadata: params.metadata,
      }),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'erreur réseau inconnue'
    throw new Error(`Impossible de joindre GeniusPay : ${message}`)
  }

  let body: GeniusPayCreateResponse
  try {
    body = (await res.json()) as GeniusPayCreateResponse
  } catch {
    throw new Error(`Réponse GeniusPay illisible (statut ${res.status}).`)
  }

  if (!res.ok || !body.success || !body.data?.checkout_url) {
    throw new Error(body.message ?? `GeniusPay a refusé la création du paiement (statut ${res.status}).`)
  }

  return body.data
}

export type WebhookVerificationResult =
  | { ok: true }
  | { ok: false; reason: 'secret_manquant' | 'headers_manquants' | 'timestamp_invalide' | 'timestamp_expire' | 'signature_invalide' }

/**
 * Vérifie la signature d'un webhook GeniusPay : hash_hmac('sha256',
 * $timestamp . '.' . $payload, $secret) — formule confirmée sur le dashboard
 * GeniusPay (geniuspay.ci/dashboard/integrations?tab=webhooks) — comparaison
 * à temps constant, et rejet si le timestamp date de plus de 5 minutes
 * (anti-rejeu). Ne fait JAMAIS confiance à un webhook dont la signature n'a
 * pas pu être vérifiée. Retourne la raison du rejet (jamais les valeurs
 * secrètes) pour un diagnostic clair dans les logs serveur.
 */
export function verifyGeniusPayWebhookSignature(
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null
): WebhookVerificationResult {
  const secret = process.env.GENIUSPAY_WEBHOOK_SECRET
  if (!secret) return { ok: false, reason: 'secret_manquant' }
  if (!timestampHeader || !signatureHeader) return { ok: false, reason: 'headers_manquants' }

  const timestamp = Number(timestampHeader)
  if (!Number.isFinite(timestamp)) return { ok: false, reason: 'timestamp_invalide' }
  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp)
  if (ageSeconds > 5 * 60) return { ok: false, reason: 'timestamp_expire' }

  const expected = createHmac('sha256', secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest('hex')

  const expectedBuf = Buffer.from(expected, 'utf8')
  const receivedBuf = Buffer.from(signatureHeader, 'utf8')
  const matches =
    expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf)

  return matches ? { ok: true } : { ok: false, reason: 'signature_invalide' }
}
