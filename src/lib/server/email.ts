// ⚠️ Module SERVEUR UNIQUEMENT — ne jamais importer depuis un composant client.
// (Le package `server-only` n'est pas installé dans ce projet ; à défaut, on
//  garantit l'isolement en n'important ce fichier que depuis des Route Handlers.)
import type { SendAccessEmailRequest } from '@/types/member'
import { ROLE_LABELS_FR, type MemberRole } from '@/types/member'

function translateRole(role: string): string {
  return ROLE_LABELS_FR[role as MemberRole] ?? role
}

function buildHtml(params: SendAccessEmailRequest): string {
  const roleFr = translateRole(params.role)
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vos accès GestUniv</title>
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090b;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#18181b;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
          <!-- Logo -->
          <tr>
            <td style="padding:32px 32px 0;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Gest<span style="color:#f97316;">Univ</span></span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 12px;font-size:16px;color:#ffffff;">Bonjour ${params.displayName},</p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#a1a1aa;">
                L'administration de <strong style="color:#fafafa;">${params.nomUniversite}</strong> a créé votre compte GestUniv.
              </p>
            </td>
          </tr>
          <!-- Credentials box -->
          <tr>
            <td style="padding:16px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-radius:12px;">
                <tr><td style="padding:18px 20px;">
                  <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#fb923c;">Vos identifiants</p>
                  <p style="margin:0 0 6px;font-size:14px;color:#e4e4e7;">Email : <strong style="color:#ffffff;">${params.email}</strong></p>
                  <p style="margin:0 0 6px;font-size:14px;color:#e4e4e7;">Mot de passe temporaire : <strong style="color:#fb923c;font-family:monospace;">${params.tempPassword}</strong></p>
                  <p style="margin:0;font-size:14px;color:#e4e4e7;">Rôle : <strong style="color:#ffffff;">${roleFr}</strong></p>
                </td></tr>
              </table>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td align="center" style="padding:8px 32px 24px;">
              <a href="${params.loginUrl}" style="display:inline-block;background-color:#f97316;color:#000000;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:9999px;">Se connecter</a>
            </td>
          </tr>
          <!-- Warning -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">
                Pour des raisons de sécurité, vous devrez changer votre mot de passe lors de votre première connexion.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:#52525b;">Cet email a été envoyé automatiquement par GestUniv.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Envoie l'email d'accès via l'API Resend. NON BLOQUANT :
 * en cas d'erreur, on logge et on retourne { success: false } sans throw,
 * afin de ne jamais faire échouer la création du compte.
 */
export async function sendAccessEmail(
  params: SendAccessEmailRequest
): Promise<{ success: boolean }> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('[sendAccessEmail] RESEND_API_KEY manquante — email non envoyé.')
      return { success: false }
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'GestUniv <noreply@gestuniv.com>',
        to: params.to,
        subject: `Vos accès GestUniv — ${params.nomUniversite}`,
        html: buildHtml(params),
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`[sendAccessEmail] Resend a répondu ${res.status}: ${detail}`)
      return { success: false }
    }

    return { success: true }
  } catch (err) {
    console.error('[sendAccessEmail] Erreur inattendue:', err)
    return { success: false }
  }
}

// ─── Notification de changement d'email (par l'admin) ─────────────────────────

export interface EmailChangeNotification {
  to: string
  displayName: string
  nomUniversite: string
  oldEmail: string
  newEmail: string
  loginUrl: string
}

function buildEmailChangeHtml(p: EmailChangeNotification): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Changement d'adresse email — GestUniv</title>
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090b;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#18181b;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 0;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Gest<span style="color:#f97316;">Univ</span></span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 12px;font-size:16px;color:#ffffff;">Bonjour ${p.displayName},</p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#a1a1aa;">
                L'administration de <strong style="color:#fafafa;">${p.nomUniversite}</strong> a modifié l'adresse email associée à votre compte GestUniv.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-radius:12px;">
                <tr><td style="padding:18px 20px;">
                  <p style="margin:0 0 6px;font-size:14px;color:#e4e4e7;">Ancienne adresse : <strong style="color:#ffffff;">${p.oldEmail}</strong></p>
                  <p style="margin:0;font-size:14px;color:#e4e4e7;">Nouvelle adresse : <strong style="color:#fb923c;">${p.newEmail}</strong></p>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">
                Si vous n'êtes pas à l'origine de cette demande, contactez immédiatement l'administration de votre université.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:#52525b;">Cet email a été envoyé automatiquement par GestUniv.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Notifie un utilisateur d'un changement d'adresse email (envoyée à l'ancienne
 * ET à la nouvelle adresse par l'appelant). NON BLOQUANT : ne throw jamais.
 */
export async function sendEmailChangeNotification(
  params: EmailChangeNotification
): Promise<{ success: boolean }> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('[sendEmailChangeNotification] RESEND_API_KEY manquante — email non envoyé.')
      return { success: false }
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'GestUniv <noreply@gestuniv.com>',
        to: params.to,
        subject: `Changement d'adresse email — ${params.nomUniversite}`,
        html: buildEmailChangeHtml(params),
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`[sendEmailChangeNotification] Resend a répondu ${res.status}: ${detail}`)
      return { success: false }
    }

    return { success: true }
  } catch (err) {
    console.error('[sendEmailChangeNotification] Erreur inattendue:', err)
    return { success: false }
  }
}
