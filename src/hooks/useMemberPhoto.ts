'use client'

import { useState, useEffect } from 'react'
import { getUniversityMember } from '@/lib/db'

/**
 * Photo de profil du membre connecté, pour les endroits qui n'ont que le
 * `UserProfile` du contexte d'auth (sidebars notamment).
 *
 * La photo vit sur `members/{uid}` et non sur `users/{uid}` : le contexte
 * d'auth ne la porte donc pas, d'où cette lecture ciblée. Retourne `undefined`
 * tant qu'elle n'est pas chargée — l'avatar affiche alors ses initiales, il n'y
 * a aucun état de chargement à gérer côté appelant.
 */
export function useMemberPhoto(
  universityId: string | undefined,
  uid: string | undefined
): string | undefined {
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!universityId || !uid) return
    let active = true
    ;(async () => {
      try {
        const member = await getUniversityMember(universityId, uid)
        if (active) setPhotoUrl(member?.photoUrl)
      } catch {
        /* photo indisponible : l'avatar retombe sur les initiales */
      }
    })()
    return () => {
      active = false
    }
  }, [universityId, uid])

  return photoUrl
}
