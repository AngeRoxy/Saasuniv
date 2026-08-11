// ⚠️ Module SERVEUR UNIQUEMENT — seul point d'entrée du SDK Admin dans le
// projet (le reste de l'app évite volontairement firebase-admin, cf.
// SECURITY_AUDIT.md). Réservé aux écritures qui n'ont AUCUN idToken
// utilisateur pour les porter, ex. le webhook GeniusPay appelé
// serveur-à-serveur : lui seul peut faire autorité sur `plan` après
// confirmation réelle d'un paiement.
//
// Nécessite FIREBASE_SERVICE_ACCOUNT_KEY dans .env.local — JSON complet
// de la clé de compte de service (Firebase Console → Paramètres du projet
// → Comptes de service → Générer une nouvelle clé privée), sur une seule
// ligne. Jamais exposé au client (pas de préfixe NEXT_PUBLIC_).

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getDatabase, type Database } from 'firebase-admin/database'

let app: App | null = null

function getAdminApp(): App {
  if (app) return app
  const existing = getApps()[0]
  if (existing) {
    app = existing
    return app
  }

  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!rawKey) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY manquant : impossible d’initialiser firebase-admin.'
    )
  }

  const raw = JSON.parse(rawKey) as {
    project_id: string
    client_email: string
    private_key: string
  }

  app = initializeApp({
    credential: cert({
      projectId: raw.project_id,
      clientEmail: raw.client_email,
      privateKey: raw.private_key,
    }),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  })
  return app
}

/** Base de données Realtime Database via le SDK Admin (contourne les règles). */
export function getAdminDb(): Database {
  return getDatabase(getAdminApp())
}
