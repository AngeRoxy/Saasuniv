'use client'

import { useState } from 'react'
import { User } from 'lucide-react'

interface MemberAvatarProps {
  /** URL Storage de la photo. Absente → initiales ou icône. */
  photoUrl?: string
  /** Nom du membre — sert d'alt et de source des initiales. */
  name?: string
  /** Diamètre en pixels. */
  size?: number
  className?: string
}

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return ''
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase()
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase()
}

/**
 * Photo de profil d'un membre, avec repli en cascade :
 * photo → initiales → icône générique.
 *
 * Le repli couvre aussi le cas d'une image qui ne charge pas (fichier supprimé
 * du bucket, URL expirée) : on n'affiche jamais une vignette cassée.
 *
 * <img> natif et non next/image : les URL Storage sont signées et changent, les
 * déclarer dans `remotePatterns` n'apporterait rien ici (pas d'optimisation
 * possible sur un contenu privé et éphémère).
 */
export function MemberAvatar({ photoUrl, name = '', size = 32, className = '' }: MemberAvatarProps) {
  const [erreur, setErreur] = useState(false)
  const afficheImage = Boolean(photoUrl) && !erreur
  const lettres = initiales(name)

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {afficheImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name ? `Photo de ${name}` : 'Photo de profil'}
          width={size}
          height={size}
          onError={() => setErreur(true)}
          className="h-full w-full object-cover"
        />
      ) : lettres ? (
        <span
          className="font-semibold text-blue-700 dark:text-orange-300 select-none"
          style={{ fontSize: Math.max(10, Math.round(size * 0.38)) }}
        >
          {lettres}
        </span>
      ) : (
        <User className="text-blue-600 dark:text-orange-400" style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </div>
  )
}

export default MemberAvatar
