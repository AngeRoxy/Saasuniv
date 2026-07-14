'use client'

import { useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, X } from 'lucide-react'

interface VideoDemoModalProps {
  open: boolean
  onClose: () => void
}

export function VideoDemoModal({ open, onClose }: VideoDemoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // onClose toujours à jour pour les listeners (popstate) sans recréer l'effet.
  // La synchronisation se fait après le rendu : écrire dans une ref pendant le
  // rendu est interdit (react-hooks/refs).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Demande de fermeture : on dépile l'entrée d'historique ajoutée à
  // l'ouverture, ce qui déclenche `popstate` → fermeture effective. Ainsi le
  // bouton « Retour » du navigateur et nos boutons ont le même comportement et
  // ne font jamais quitter le site.
  const requestClose = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.state?.videoModal) {
      window.history.back()
    } else {
      onClose()
    }
  }, [onClose])

  // À l'ouverture : empiler une entrée d'historique et écouter le retour
  // navigateur pour fermer la modale au lieu de sortir du site.
  useEffect(() => {
    if (!open) return
    window.history.pushState({ videoModal: true }, '')
    const onPopState = () => onCloseRef.current()
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [open])

  // Fermeture à la touche Échap.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, requestClose])

  // Bloquer le scroll du body tant que la modale est ouverte.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  // À la fermeture : pause + coupure du son de la vidéo.
  useEffect(() => {
    if (open) return
    const video = videoRef.current
    if (video) {
      video.pause()
      video.currentTime = 0
      video.muted = true
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Vidéo de démonstration GestUniv"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={requestClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[1100px]"
          >
            {/* Barre supérieure : bouton Retour (gauche) + bouton fermer (droite) */}
            <div className="absolute -top-12 left-0 right-0 flex items-center justify-between">
              <button
                type="button"
                onClick={requestClose}
                aria-label="Retour à l'accueil"
                className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-zinc-900 dark:text-white transition-colors hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </button>

              <button
                type="button"
                onClick={requestClose}
                aria-label="Fermer la vidéo"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-zinc-900 dark:text-white transition-colors hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/60">
              <video
                ref={videoRef}
                src="/videos/gestuniv-demo.mp4"
                poster="/videos/gestuniv-poster.jpg"
                preload="metadata"
                controls
                autoPlay
                className="h-full w-full rounded-2xl"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
