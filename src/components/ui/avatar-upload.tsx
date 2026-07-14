'use client'

import { useRef, useState } from 'react'
import { Camera, AlertTriangle } from 'lucide-react'
import { MemberAvatar } from '@/components/ui/member-avatar'
import { updateMemberPhoto } from '@/lib/db'
import {
  uploadAvatar,
  validerFichier,
  redimensionnerImage,
  UploadError,
  STORAGE_ENABLED,
  AVATAR_ACCEPT,
  AVATAR_EXTENSIONS,
  AVATAR_MAX_BYTES,
  formatTaille,
} from '@/lib/storage'

interface AvatarUploadProps {
  universityId: string
  uid: string
  name: string
  /** Photo actuelle (depuis members/{uid}/photoUrl). */
  photoUrl?: string
  size?: number
  /** Appelé avec la nouvelle URL une fois l'écriture RTDB confirmée. */
  onUploaded: (url: string) => void
}

/**
 * Photo de profil cliquable : sélection → redimensionnement client (500×500 max)
 * → envoi Storage → écriture de l'URL en base.
 *
 * L'aperçu n'est mis à jour qu'APRÈS confirmation de l'écriture RTDB : jamais de
 * succès optimiste. Si l'écriture échoue, l'ancienne photo reste affichée et
 * l'erreur est explicite.
 */
export function AvatarUpload({
  universityId,
  uid,
  name,
  photoUrl,
  size = 64,
  onUploaded,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Firebase Storage désactivé : on rend un avatar simple, non cliquable, sans
  // aucun appel Storage. `photoUrl` (absent en pratique) retombe proprement sur
  // les initiales / l'icône via MemberAvatar. Réactivation = STORAGE_ENABLED.
  if (!STORAGE_ENABLED) {
    return <MemberAvatar photoUrl={photoUrl} name={name} size={size} />
  }

  const enCours = progress !== null

  async function handleFile(file: File | undefined) {
    if (!file || enCours) return
    setError(null)

    try {
      validerFichier(file, AVATAR_EXTENSIONS, AVATAR_MAX_BYTES)

      // Redimensionnement AVANT envoi : une photo de téléphone fait plusieurs Mo
      // pour un affichage de 64 px. Le fichier d'origine n'est jamais envoyé tel
      // quel s'il dépasse 500 px de côté.
      const image = await redimensionnerImage(file, 500)

      setProgress(0)
      const { url } = await uploadAvatar(universityId, uid, image, setProgress)

      // L'URL n'est propagée à l'UI qu'une fois écrite en base.
      await updateMemberPhoto(universityId, uid, url)
      onUploaded(url)
    } catch (e) {
      console.error('Envoi de la photo de profil échoué', e)
      setError(
        e instanceof UploadError
          ? e.message
          : "Échec de l'enregistrement de la photo — réessayez."
      )
    } finally {
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={enCours}
        aria-label="Changer ma photo de profil"
        className="group relative rounded-full focus:outline-none focus:ring-2 focus:ring-orange-400/60 disabled:cursor-wait"
      >
        <MemberAvatar photoUrl={photoUrl} name={name} size={size} />

        {/* Voile + icône au survol : indique clairement que l'avatar est cliquable. */}
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="h-1/3 w-1/3 text-white" />
        </span>

        {enCours && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/70">
            <span className="text-[10px] font-semibold text-white">{progress}%</span>
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_ACCEPT}
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="hidden"
      />

      <p className="text-[11px] text-zinc-500 dark:text-orange-200/30 text-center">
        JPG ou PNG · {formatTaille(AVATAR_MAX_BYTES)} max
      </p>

      {error && (
        <p className="flex items-start gap-1.5 text-[11px] text-red-400 max-w-56 text-center">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

export default AvatarUpload
