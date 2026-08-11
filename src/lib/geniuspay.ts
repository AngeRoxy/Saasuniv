// ⚠️ Module SERVEUR UNIQUEMENT — GENIUSPAY_API_SECRET et
// GENIUSPAY_WEBHOOK_SECRET ne doivent jamais atteindre le client.
//
// Format d'API déduit de la documentation réelle (https://pay.genius.ci/doc,
// consultée le 2026-08-11) — voir le résumé donné à l'utilisateur pour le
// détail des hypothèses restant à valider en sandbox.

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

/**
 * Vérifie la signature d'un webhook GeniusPay : HMAC-SHA256(timestamp + "." +
 * corps_brut, secret_webhook), comparaison à temps constant, et rejet si le
 * timestamp date de plus de 5 minutes (anti-rejeu). Ne fait JAMAIS confiance
 * à un webhook dont la signature n'a pas pu être vérifiée.
 */
export function verifyGeniusPayWebhookSignature(
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null
): boolean {
  const secret = process.env.GENIUSPAY_WEBHOOK_SECRET
  if (!secret || !timestampHeader || !signatureHeader) return false

  const timestamp = Number(timestampHeader)
  if (!Number.isFinite(timestamp)) return false
  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp)
  if (ageSeconds > 5 * 60) return false

  const expected = createHmac('sha256', secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest('hex')

  const expectedBuf = Buffer.from(expected, 'utf8')
  const receivedBuf = Buffer.from(signatureHeader, 'utf8')
  if (expectedBuf.length !== receivedBuf.length) return false
  return timingSafeEqual(expectedBuf, receivedBuf)
}
