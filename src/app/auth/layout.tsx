import { GraduationCap } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 overflow-hidden bg-[#fafafa] dark:bg-[#09090b]">
      {/* Dégradé bleu très discret — statique, non animé : garde un peu de
          personnalité sans jamais nuire à la lisibilité du formulaire. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-blue-600/5 via-transparent to-transparent dark:from-blue-500/10"
      />

      <div className="relative z-10 w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="p-2 rounded-xl bg-orange-500/15 border border-orange-500/30">
            <GraduationCap className="h-7 w-7 text-blue-600 dark:text-orange-400" />
          </div>
          <span className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Gest<span className="text-blue-600 dark:text-orange-400">Univ</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
