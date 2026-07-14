'use client'

import { useEffect, useRef, useState } from 'react'
import { LogOut, Loader2, AlertTriangle } from 'lucide-react'

// Intégration de la visioconférence via l'« External API » officielle de Jitsi
// Meet, chargée depuis le service public gratuit meet.jit.si. L'appel vidéo vit
// dans un iframe injecté par le script Jitsi dans le conteneur ci-dessous — aucune
// redirection vers un site externe. La seule protection d'accès étant le nom de
// salle aléatoire (généré côté db.ts), aucun secret ne transite ici.

const JITSI_DOMAIN = 'meet.jit.si'
const JITSI_SCRIPT_SRC = 'https://meet.jit.si/external_api.js'

// Surface minimale de l'API Jitsi effectivement utilisée (le script n'est pas typé).
interface JitsiApi {
  addEventListener(event: string, listener: (...args: unknown[]) => void): void
  removeEventListener(event: string, listener: (...args: unknown[]) => void): void
  dispose(): void
  executeCommand(command: string, ...args: unknown[]): void
}

type JitsiApiConstructor = new (domain: string, options: Record<string, unknown>) => JitsiApi

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiApiConstructor
  }
}

// Promesse partagée entre tous les montages : le script Jitsi n'est chargé QU'UNE
// SEULE FOIS pour toute la session, même si le composant est monté/démonté plusieurs
// fois (un enseignant qui enchaîne des cours, un étudiant qui rejoint puis quitte…).
let jitsiScriptPromise: Promise<void> | null = null

function chargerScriptJitsi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Jitsi ne peut être chargé que côté navigateur.'))
  }
  if (window.JitsiMeetExternalAPI) return Promise.resolve()
  if (jitsiScriptPromise) return jitsiScriptPromise

  jitsiScriptPromise = new Promise<void>((resolve, reject) => {
    const finaliser = () => (window.JitsiMeetExternalAPI ? resolve() : echouer())
    const echouer = () => {
      jitsiScriptPromise = null // permet une nouvelle tentative au prochain montage
      reject(new Error('Échec du chargement de la visioconférence Jitsi.'))
    }

    // Un <script> Jitsi est peut-être déjà présent (autre montage concurrent).
    const existant = document.querySelector<HTMLScriptElement>(`script[src="${JITSI_SCRIPT_SRC}"]`)
    if (existant) {
      existant.addEventListener('load', finaliser)
      existant.addEventListener('error', echouer)
      if (window.JitsiMeetExternalAPI) resolve()
      return
    }

    const script = document.createElement('script')
    script.src = JITSI_SCRIPT_SRC
    script.async = true
    script.addEventListener('load', finaliser)
    script.addEventListener('error', echouer)
    document.body.appendChild(script)
  })

  return jitsiScriptPromise
}

interface JitsiVideoCallProps {
  roomName: string
  /** Nom affiché dans l'appel (ex : profile.displayName). */
  displayName: string
  /** Appelé une seule fois quand l'utilisateur quitte (bouton ou fin d'appel Jitsi). */
  onCallEnd?: () => void
  /** Libellé du bouton de sortie (ex : « Terminer le cours » côté enseignant). */
  leaveLabel?: string
  /** Sous-titre affiché dans la barre supérieure (ex : matière · filière). */
  sousTitre?: string
}

export function JitsiVideoCall({
  roomName,
  displayName,
  onCallEnd,
  leaveLabel = 'Quitter le cours',
  sousTitre,
}: JitsiVideoCallProps) {
  const conteneurRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<JitsiApi | null>(null)
  const [statut, setStatut] = useState<'chargement' | 'pret' | 'erreur'>('chargement')

  // onCallEnd est capturé dans une ref : l'effet d'initialisation ne dépend ainsi
  // que de roomName/displayName et ne réinitialise pas l'appel si le parent
  // recrée le callback à chaque rendu.
  const onCallEndRef = useRef(onCallEnd)
  useEffect(() => {
    onCallEndRef.current = onCallEnd
  }, [onCallEnd])

  // Garantit que onCallEnd n'est déclenché qu'UNE fois : le bouton de sortie et
  // l'événement Jitsi « videoConferenceLeft » peuvent tous deux survenir.
  const finiRef = useRef(false)
  function terminerUneFois() {
    if (finiRef.current) return
    finiRef.current = true
    onCallEndRef.current?.()
  }

  useEffect(() => {
    let annule = false
    let api: JitsiApi | null = null

    ;(async () => {
      setStatut('chargement')
      try {
        await chargerScriptJitsi()
      } catch {
        if (!annule) setStatut('erreur')
        return
      }
      if (annule || !conteneurRef.current || !window.JitsiMeetExternalAPI) {
        if (!annule) setStatut('erreur')
        return
      }

      api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName,
        parentNode: conteneurRef.current,
        width: '100%',
        height: '100%',
        userInfo: { displayName },
        configOverwrite: {
          // Pas de page « pré-connexion » : on entre directement dans la salle.
          prejoinPageEnabled: false,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableDeepLinking: true,
        },
        interfaceConfigOverwrite: {
          // Retire la marque Jitsi (intégration « maison »).
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_POWERED_BY: false,
          DEFAULT_BACKGROUND: '#09090b',
          DISABLE_VIDEO_BACKGROUND: true,
          MOBILE_APP_PROMO: false,
        },
      })
      apiRef.current = api
      api.addEventListener('videoConferenceLeft', terminerUneFois)
      api.addEventListener('readyToClose', terminerUneFois)
      if (!annule) setStatut('pret')
    })()

    // Nettoyage impératif : dispose() détruit l'iframe et coupe micro/caméra, sinon
    // un appel « fantôme » continuerait en arrière-plan après le démontage.
    return () => {
      annule = true
      if (api) {
        try {
          api.dispose()
        } catch {
          // dispose() peut lever si l'iframe est déjà parti — sans conséquence.
        }
      }
      apiRef.current = null
    }
  }, [roomName, displayName])

  function handleQuitter() {
    // Demande à Jitsi de raccrocher proprement ; « videoConferenceLeft » suivra et
    // déclenchera terminerUneFois. On l'appelle aussi directement par sécurité.
    try {
      apiRef.current?.executeCommand('hangup')
    } catch {
      /* ignore */
    }
    terminerUneFois()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-black/60 px-4 py-3 shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">Cours en direct</p>
          {sousTitre && <p className="text-xs text-zinc-500 dark:text-orange-200/40 truncate">{sousTitre}</p>}
        </div>
        <button
          onClick={handleQuitter}
          className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 shrink-0"
        >
          <LogOut size={15} />
          {leaveLabel}
        </button>
      </header>

      <div className="relative flex-1 bg-[#fafafa] dark:bg-black">
        {/* Conteneur cible de l'iframe Jitsi. */}
        <div ref={conteneurRef} className="absolute inset-0 h-full w-full" />

        {statut === 'chargement' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-orange-200/60">
            <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
            <p className="text-sm">Connexion à la salle vidéo…</p>
          </div>
        )}

        {statut === 'erreur' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white dark:bg-zinc-950 px-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-zinc-900 dark:text-white">Impossible de charger la visioconférence.</p>
            <p className="max-w-sm text-xs text-zinc-500 dark:text-orange-200/40">
              Vérifiez votre connexion internet, puis fermez et rouvrez le cours. Le service
              meet.jit.si doit être accessible depuis votre réseau.
            </p>
            <button
              onClick={handleQuitter}
              className="mt-1 rounded-lg border border-zinc-200 dark:border-white/10 px-4 py-2 text-sm text-zinc-600 dark:text-orange-200/70 transition-colors hover:text-zinc-900 dark:hover:text-white"
            >
              Fermer
            </button>
          </div>
        )}
      </div>

      <p className="border-t border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-black/60 px-4 py-2 text-center text-[11px] text-zinc-500 dark:text-orange-200/30 shrink-0">
        Aucun enregistrement automatique — le service gratuit Jitsi ne conserve pas les cours.
      </p>
    </div>
  )
}
