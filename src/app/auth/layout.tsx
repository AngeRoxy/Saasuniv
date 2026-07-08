'use client'

import { GraduationCap } from 'lucide-react'
import { ShaderBackground } from '@/components/ui/shader-background'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      <ShaderBackground />

      {/* Overlay léger pour améliorer la lisibilité du formulaire */}
      <div className="absolute inset-0 bg-black/40 z-0" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="p-2 rounded-xl bg-orange-500/20 border border-orange-500/30 backdrop-blur-sm">
            <GraduationCap className="h-7 w-7 text-orange-400" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">
            Gest<span className="text-orange-400">Univ</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
