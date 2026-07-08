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
            ? 'bg-black/80 backdrop-blur-md border-b border-orange-500/10 shadow-lg shadow-black/20'
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
              <GraduationCap className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">
              Gest<span className="text-orange-400">Univ</span>
            </span>
          </button>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="text-sm text-orange-100/60 hover:text-orange-300 transition-colors duration-200"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => router.push('/auth/login')}
              className="text-sm text-orange-200/70 hover:text-white transition-colors duration-200 px-4 py-2"
            >
              Connexion
            </button>
            <button
              onClick={() => router.push('/auth/register-university')}
              className="text-sm px-5 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded-full font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-orange-500/25"
            >
              Essai gratuit
            </button>
          </div>

          {/* Mobile burger */}
          <button
            className="md:hidden text-orange-300 p-2"
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
            className="fixed top-16 left-0 right-0 z-40 bg-black/95 backdrop-blur-md border-b border-orange-500/10 px-4 py-6 flex flex-col gap-4"
          >
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="text-left text-orange-100/70 hover:text-orange-300 text-base py-2 border-b border-orange-500/5 transition-colors duration-200"
              >
                {link.label}
              </button>
            ))}
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => { setMobileOpen(false); router.push('/auth/login') }}
                className="text-sm text-orange-200/70 py-3 border border-orange-500/20 rounded-full hover:bg-orange-500/10 transition-colors"
              >
                Connexion
              </button>
              <button
                onClick={() => { setMobileOpen(false); router.push('/auth/register-university') }}
                className="text-sm py-3 bg-orange-500 hover:bg-orange-600 text-black rounded-full font-semibold"
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
