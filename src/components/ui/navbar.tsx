'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const navLinks = [
  { label: 'Fonctionnalités', href: '#features' },
  { label: 'Tarifs', href: '#pricing' },
  { label: 'Témoignages', href: '#testimonials' },
  { label: 'FAQ', href: '#faq' },
]

export function Navbar() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (href: string) => {
    setMobileOpen(false)
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/85 backdrop-blur-md border-b border-zinc-200 shadow-sm dark:bg-black/80 dark:border-orange-500/10 dark:shadow-lg dark:shadow-black/20'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 group"
          >
            <div className="p-1.5 rounded-lg bg-orange-500 group-hover:shadow-lg group-hover:shadow-orange-500/30 transition-all duration-300">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-zinc-900 dark:text-white text-lg tracking-tight">
              Gest<span className="text-blue-600 dark:text-orange-400">Univ</span>
            </span>
          </button>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="group relative text-sm text-zinc-600 hover:text-blue-700 dark:text-orange-100/60 dark:hover:text-orange-300 transition-colors duration-200"
              >
                {link.label}
                {/* Soulignement qui se dessine au survol */}
                <span className="pointer-events-none absolute -bottom-1 left-0 h-px w-0 bg-blue-600 dark:bg-orange-300 transition-all duration-300 ease-out group-hover:w-full motion-reduce:transition-none" />
              </button>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => router.push('/auth/login')}
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-orange-200/70 dark:hover:text-white transition-colors duration-200 px-4 py-2"
            >
              Connexion
            </button>
            <button
              onClick={() => router.push('/auth/register-university')}
              className="text-sm px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-semibold transition-all duration-300 ease-out hover:scale-105 hover:shadow-lg hover:shadow-orange-500/25"
            >
              Essai gratuit
            </button>
          </div>

          {/* Mobile burger */}
          <button
            className="md:hidden text-blue-700 dark:text-orange-300 p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-16 left-0 right-0 z-40 bg-white/95 border-b border-zinc-200 dark:bg-black/95 dark:border-orange-500/10 backdrop-blur-md px-4 py-6 flex flex-col gap-4"
          >
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="text-left text-zinc-700 hover:text-blue-700 dark:text-orange-100/70 dark:hover:text-orange-300 text-base py-2 border-b border-zinc-200 dark:border-orange-500/5 transition-colors duration-200"
              >
                {link.label}
              </button>
            ))}
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => { setMobileOpen(false); router.push('/auth/login') }}
                className="text-sm text-zinc-700 border border-zinc-300 hover:bg-zinc-100 dark:text-orange-200/70 dark:border-orange-500/20 dark:hover:bg-orange-500/10 py-3 rounded-full transition-colors"
              >
                Connexion
              </button>
              <button
                onClick={() => { setMobileOpen(false); router.push('/auth/register-university') }}
                className="text-sm py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-semibold"
              >
                Essai gratuit
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
