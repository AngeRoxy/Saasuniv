'use client'

import { Suspense, lazy } from 'react'

const Spline = lazy(() => import('@splinetool/react-spline'))

interface SplineSceneProps {
  scene: string
  className?: string
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex items-center justify-center bg-black/40">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-orange-300/60 text-sm">Chargement 3D…</span>
          </div>
        </div>
      }
    >
      <Spline scene={scene} className={className} />
    </Suspense>
  )
}
