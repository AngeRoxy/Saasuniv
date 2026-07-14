import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import { storage } from './firebase'

// ─── Contraintes d'upload ─────────────────────────────────────────────────────
// Elles sont appliquées ICI (avant l'envoi, pour un message d'erreur clair) ET
// dans storage.rules (autorité réelle : un client modifié ne peut pas les
// contourner). Les deux listes doivent rester alignées.

export const RESSOURCE_MAX_BYTES = 20 * 1024 * 1024 // 20 Mo
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024 // 5 Mo

export const RESSOURCE_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png']
export const AVATAR_EXTENSIONS = ['.jpg', '.jpeg', '.png']

/** `accept` du <input type="file"> — dérivé des extensions autorisées. */
export const RESSOURCE_ACCEPT = RESSOURCE_EXTENSIONS.join(',')
export const AVATAR_ACCEPT = AVATAR_EXTENSIONS.join(',')

export class UploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UploadError'
  }
}

function extensionDe(nom: string): string {
  const i = nom.lastIndexOf('.')
  return i === -1 ? '' : nom.slice(i).toLowerCase()
}

export function formatTaille(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

/**
 * Valide un fichier avant envoi. Lève une UploadError au message directement
 * affichable — on ne laisse jamais l'utilisateur découvrir le refus après coup.
 */
export function validerFichier(
  file: File,
  extensions: string[],
  maxBytes: number
): void {
  const ext = extensionDe(file.name)
  if (!extensions.includes(ext)) {
    throw new UploadError(
      `Format non autorisé (${ext || 'inconnu'}). Formats acceptés : ${extensions.join(', ')}.`
    )
  }
  if (file.size > maxBytes) {
    throw new UploadError(
      `Fichier trop volumineux (${formatTaille(file.size)}). Maximum : ${formatTaille(maxBytes)}.`
    )
  }
  if (file.size === 0) {
    throw new UploadError('Fichier vide.')
  }
}

/**
 * Assainit un nom de fichier pour un chemin Storage : accents retirés, tout ce
 * qui n'est pas alphanumérique/point/tiret remplacé. Évite les chemins exotiques
 * et les collisions d'encodage.
 */
export function assainirNomFichier(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
}

export interface UploadResult {
  /** URL de téléchargement publique (signée par Firebase). */
  url: string
  /** Chemin Storage — indispensable pour supprimer le fichier plus tard. */
  path: string
  nom: string
  taille: number
}

/**
 * Traduit un code d'erreur Firebase Storage en message actionnable.
 *
 * `retry-limit-exceeded` mérite un traitement à part : il ne veut PAS dire
 * « réseau lent ». Le SDK a réessayé jusqu'à abandonner parce que la requête
 * n'aboutit pas du tout — dans ce projet, la cause de très loin la plus probable
 * est que **Cloud Storage n'est pas activé** sur le projet Firebase (le bucket
 * n'existe pas → 404 à chaque tentative). Le message générique « échec de
 * l'envoi » envoyait l'utilisateur chercher un problème de fichier ou de réseau
 * qui n'existe pas.
 */
function messageErreurUpload(code: string): string {
  switch (code) {
    case 'storage/unauthorized':
      return "Envoi refusé par les règles de sécurité — vérifiez vos droits, ou que les règles Storage ont bien été déployées."
    case 'storage/unauthenticated':
      return 'Session expirée — reconnectez-vous puis réessayez.'
    case 'storage/retry-limit-exceeded':
      return "Le service de fichiers est injoignable. Si le problème touche tous les envois, c'est que Cloud Storage n'est pas activé sur le projet Firebase (ou que le bucket configuré n'existe pas) — contactez l'administrateur technique."
    case 'storage/quota-exceeded':
      return "L'espace de stockage de l'établissement est saturé — contactez l'administration."
    case 'storage/canceled':
      return 'Envoi annulé.'
    default:
      return `Échec de l'envoi du fichier (${code}).`
  }
}

/**
 * Envoie un fichier et rapporte la progression réelle (0-100).
 * Résout uniquement quand le fichier est effectivement écrit ET que l'URL de
 * téléchargement est obtenue : aucun succès n'est annoncé avant.
 */
function uploadAvecProgression(
  path: string,
  file: File,
  onProgress?: (pourcent: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef(storage, path), file, {
      contentType: file.type || 'application/octet-stream',
    })

    task.on(
      'state_changed',
      (snapshot) => {
        const pourcent = snapshot.totalBytes
          ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          : 0
        onProgress?.(pourcent)
      },
      (error) => {
        reject(new UploadError(messageErreurUpload(error.code)))
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref)
          resolve({ url, path, nom: file.name, taille: file.size })
        } catch {
          reject(new UploadError("Fichier envoyé mais URL de téléchargement introuvable."))
        }
      }
    )
  })
}

/**
 * Ressource pédagogique.
 * Chemin : /universities/{universityId}/resources/{matiereSegment}/{timestamp}-{nom}
 *
 * Note : une Ressource ne porte pas de `matiereId` (la matière y est un texte
 * libre facultatif). On dérive donc un segment assaini du nom de matière, et
 * « _general » quand aucune matière n'est renseignée.
 */
export async function uploadRessource(
  universityId: string,
  matiere: string,
  file: File,
  onProgress?: (pourcent: number) => void
): Promise<UploadResult> {
  validerFichier(file, RESSOURCE_EXTENSIONS, RESSOURCE_MAX_BYTES)
  const segment = matiere.trim() ? assainirNomFichier(matiere.trim()) : '_general'
  const path = `universities/${universityId}/resources/${segment}/${Date.now()}-${assainirNomFichier(file.name)}`
  return uploadAvecProgression(path, file, onProgress)
}

/**
 * Photo de profil.
 * Chemin : /universities/{universityId}/avatars/{uid}
 * Chemin FIXE (pas d'horodatage) : une photo par membre, le nouvel envoi
 * remplace l'ancien — pas de fichiers orphelins à nettoyer.
 */
export async function uploadAvatar(
  universityId: string,
  uid: string,
  file: File,
  onProgress?: (pourcent: number) => void
): Promise<UploadResult> {
  validerFichier(file, AVATAR_EXTENSIONS, AVATAR_MAX_BYTES)
  const path = `universities/${universityId}/avatars/${uid}`
  return uploadAvecProgression(path, file, onProgress)
}

/**
 * Supprime un fichier. Un fichier déjà absent n'est pas une erreur (la
 * suppression de la ressource RTDB doit pouvoir aboutir malgré tout).
 */
export async function supprimerFichier(path: string): Promise<void> {
  try {
    await deleteObject(storageRef(storage, path))
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'storage/object-not-found') return
    throw err
  }
}

/**
 * Redimensionne une image côté client avant envoi (max `maxDim` px de côté,
 * ratio conservé). Réduit fortement le poids des photos de profil.
 * Retourne le fichier d'origine si le navigateur ne peut pas décoder l'image —
 * la validation de taille reste alors la garde.
 */
export async function redimensionnerImage(
  file: File,
  maxDim = 500,
  qualite = 0.85
): Promise<File> {
  if (typeof document === 'undefined') return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const { width, height } = bitmap
  const echelle = Math.min(1, maxDim / Math.max(width, height))
  if (echelle === 1) {
    bitmap.close()
    return file
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * echelle)
  canvas.height = Math.round(height * echelle)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', qualite)
  )
  if (!blob) return file

  // L'extension doit rester cohérente avec le contenu réel (JPEG après canvas).
  const base = file.name.replace(/\.[^.]+$/, '')
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
}
