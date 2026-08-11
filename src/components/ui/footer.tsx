import Link from 'next/link'
import { GraduationCap } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-orange-500/10 py-10 px-4">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-blue-600 dark:text-orange-400" />
          <span className="font-bold text-zinc-900 dark:text-white text-lg">GestUniv</span>
          <span className="text-zinc-500 dark:text-orange-400/40 text-xs">plateforme en ligne</span>
        </div>
        <p className="text-zinc-500 dark:text-orange-200/30 text-sm text-center">
          © 2026 GestUniv. Tous droits réservés. Conforme RGPD.
        </p>
        <div className="flex gap-6 text-xs text-zinc-500 dark:text-orange-200/30">
          <Link href="/confidentialite" className="hover:text-blue-600 dark:hover:text-orange-400 transition-colors">
            Confidentialité
          </Link>
          <Link href="/cgu" className="hover:text-blue-600 dark:hover:text-orange-400 transition-colors">
            CGU
          </Link>
          <Link href="/contact" className="hover:text-blue-600 dark:hover:text-orange-400 transition-colors">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  )
}
