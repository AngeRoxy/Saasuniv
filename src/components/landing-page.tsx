'use client'

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Navbar } from '@/components/ui/navbar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  GraduationCap, BookOpen, Users, BarChart3, Shield, Bell,
  Star, ArrowRight, Building2, Globe, CreditCard, CheckCircle2,
  FileText, Lock, TrendingUp, ChevronDown, Check, X, Clock
} from 'lucide-react'
import {
  motion, animate, useInView, useReducedMotion, useScroll, useSpring,
  type Variants,
} from 'framer-motion'
import { VideoDemoModal } from '@/components/ui/video-demo-modal'
import { PLANS_CONFIG, PLAN_ORDER } from '@/lib/plans'
import type { PlanFeatures } from '@/types/plan'

// Affichage d'une limite numérique (Infinity => "Illimité").
const formatLimite = (valeur: number) =>
  valeur === Infinity ? 'Illimité' : valeur.toLocaleString('fr-FR')

// Groupe "Limites" : libellé + valeur dérivée des features.
const limiteRows: { label: string; value: (f: PlanFeatures) => string }[] = [
  { label: 'Étudiants max', value: (f) => formatLimite(f.maxEtudiants) },
  { label: 'Enseignants max', value: (f) => formatLimite(f.maxEnseignants) },
  { label: 'Filières max', value: (f) => formatLimite(f.maxFilieres) },
  { label: 'Stockage', value: (f) => (f.stockageGo === Infinity ? 'Illimité' : `${f.stockageGo} Go`) },
]

// Groupe "Fonctionnalités" : libellé + clé booléenne. `ia` => pill "IA".
// `soon` => fonctionnalité prévue mais pas encore livrée : badge "Bientôt"
// (roadmap assumée, cf. featureRow render). NE PAS marquer `soon` sur une
// fonctionnalité réellement disponible sous peine de la dévaloriser.
const featureRows: { label: string; key: keyof PlanFeatures; ia?: boolean; soon?: boolean }[] = [
  { label: 'Import depuis Excel', key: 'importCSV' },
  { label: 'Export PDF', key: 'exportPDF', soon: true },
  { label: 'Bulletins PDF', key: 'bulletinsPDF', soon: true },
  { label: 'Messagerie interne', key: 'messagerieInterne' },
  { label: 'Notifications email', key: 'notificationsEmail', soon: true },
  { label: 'Assistant virtuel intelligent', key: 'chatbotIA', ia: true },
  { label: 'Suggestions automatiques (intelligence artificielle)', key: 'recommandationsIA', ia: true },
  { label: 'Journal des activités', key: 'auditLogs' },
  { label: 'Support prioritaire', key: 'supportPrioritaire' },
  { label: 'Gestion de plusieurs campus/sites', key: 'multiCampus', soon: true },
  { label: 'Connexion avec vos autres logiciels', key: 'apiAccess', soon: true },
  { label: 'Adresse web à votre nom', key: 'sousDomainePerso', soon: true },
]

const features = [
  {
    icon: <GraduationCap className="w-7 h-7 text-blue-600 dark:text-orange-400" />,
    title: 'Gestion des Étudiants',
    description: 'Inscription, matricule automatique, suivi de parcours complet et gestion des statuts en temps réel.',
    color: 'bg-orange-500/10',
  },
  {
    icon: <BookOpen className="w-7 h-7 text-blue-600 dark:text-yellow-400" />,
    title: 'Cours en ligne intégrés',
    description: 'Bibliothèque numérique, cours en ligne, suivi de progression et gestion des ressources pédagogiques.',
    color: 'bg-yellow-500/10',
  },
  {
    icon: <BarChart3 className="w-7 h-7 text-blue-600 dark:text-amber-400" />,
    title: 'Notes & Évaluations',
    description: 'Calcul automatique des moyennes pondérées, bulletins générés en un clic, classements automatiques.',
    color: 'bg-amber-500/10',
  },
  {
    icon: <Users className="w-7 h-7 text-blue-700 dark:text-orange-300" />,
    title: 'Multi-Rôles Complets',
    description: 'Espaces dédiés pour l\'administration, les enseignants, les étudiants et les parents : chacun ne voit que ce qui le concerne.',
    color: 'bg-orange-400/10',
  },
  {
    icon: <CreditCard className="w-7 h-7 text-blue-700 dark:text-yellow-300" />,
    title: 'Finance & Scolarité',
    description: 'Suivi des paiements, échéances, historique des reçus et alertes automatiques.',
    color: 'bg-yellow-400/10',
  },
  {
    icon: <Shield className="w-7 h-7 text-red-400" />,
    title: 'Sécurité & Confidentialité',
    description: 'Vos données sont totalement sécurisées et privées, conforme RGPD (protection des données personnelles).',
    color: 'bg-red-500/10',
  },
  {
    icon: <Bell className="w-7 h-7 text-blue-700 dark:text-amber-300" />,
    title: 'Notifications Intelligentes',
    description: 'Alertes financières, publications de résultats et annonces en temps réel pour tous.',
    color: 'bg-amber-400/10',
  },
  {
    icon: <FileText className="w-7 h-7 text-zinc-600 dark:text-orange-200" />,
    title: 'Journal des activités',
    description: 'Historique inviolable de toutes les actions importantes et export conforme des données personnelles.',
    color: 'bg-orange-300/10',
  },
]

// Métadonnées d'affichage par plan (descriptions & CTA). Les prix, limites
// et feature flags proviennent exclusivement de PLANS_CONFIG.
const planMeta: Record<string, { description: string; cta: string; nom?: string }> = {
  standard: { description: 'Idéal pour les petits établissements', cta: 'Démarrer gratuitement' },
  premium: { description: 'Pour les universités en croissance', cta: 'Essai 30 jours gratuit' },
  enterprise: { description: 'Pour les grandes institutions', cta: 'Demander un devis', nom: 'Grandes institutions' },
}

const testimonials = [
  {
    name: 'Pr. Kouamé N\'Dri',
    role: 'Doyen — Université Félix Houphouët-Boigny',
    content: 'GestUniv a transformé notre gestion administrative. Les bulletins qui prenaient 3 semaines sont générés en 2 minutes. Remarquable.',
    stars: 5,
  },
  {
    name: 'Dr. Fatou Diallo',
    role: 'Directrice — Institut Supérieur de Dakar',
    content: 'La confidentialité totale de nos données nous rassure. Nos informations sont parfaitement protégées et sécurisées. La mise en route en 48h était impressionnante.',
    stars: 5,
  },
  {
    name: 'Mme. Aïcha Traoré',
    role: 'DGA — Académie des Sciences de Bamako',
    content: 'Enfin une plateforme en ligne conçue pour l\'Afrique. Les notifications par SMS et l\'interface en français ont séduit nos équipes immédiatement.',
    stars: 5,
  },
]

const dashboards = [
  { icon: <Building2 className="w-6 h-6" />, label: 'Administration', color: 'text-blue-600 dark:text-orange-400', desc: 'Pilotez l\'ensemble de l\'établissement' },
  { icon: <BookOpen className="w-6 h-6" />, label: 'Enseignants', color: 'text-blue-600 dark:text-yellow-400', desc: 'Saisie de notes et ressources pédagogiques' },
  { icon: <GraduationCap className="w-6 h-6" />, label: 'Étudiants', color: 'text-blue-600 dark:text-amber-400', desc: 'Résultats, cours et espace personnel' },
  { icon: <Users className="w-6 h-6" />, label: 'Parents', color: 'text-blue-700 dark:text-orange-300', desc: 'Suivi en temps réel de l\'enfant' },
  { icon: <Globe className="w-6 h-6" />, label: 'Administrateur général', color: 'text-red-400', desc: 'Supervision globale de la plateforme' },
]

const stats = [
  { value: '120+', label: 'Universités clientes' },
  { value: '85 000+', label: 'Étudiants gérés' },
  { value: '99.9%', label: 'Disponibilité garantie' },
  { value: '< 48h', label: 'Mise en route complète' },
]

const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
}

// Cascade : le conteneur décale l'apparition de ses enfants de 0.1s.
const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}
const staggerChild: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

/**
 * Compteur progressif : anime 0 → valeur finale quand le bloc entre dans le
 * viewport. La valeur d'origine est une chaîne ("85 000+", "99.9%", "< 48h") :
 * on isole la partie numérique et on ré-applique préfixe/suffixe à chaque frame.
 * Si l'utilisateur préfère moins d'animations, on affiche directement la valeur.
 */
function CountUp({ value, reduce }: { value: string; reduce: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  const parsed = useMemo(() => {
    const m = value.match(/^(\D*?)(\d[\d\s.,]*)(\D*)$/)
    if (!m) return null
    const raw = m[2].trim()
    const target = parseFloat(raw.replace(/\s/g, ''))
    if (!Number.isFinite(target)) return null
    const decimals = raw.includes('.') ? raw.split('.')[1].length : 0
    return { prefix: m[1], suffix: m[3], target, decimals }
  }, [value])

  const format = useCallback(
    (v: number) => {
      if (!parsed) return value
      const shown =
        parsed.decimals > 0 ? v.toFixed(parsed.decimals) : Math.round(v).toLocaleString('fr-FR')
      return `${parsed.prefix}${shown}${parsed.suffix}`
    },
    [parsed, value]
  )

  // Init paresseuse : on démarre à 0 (pas de setState synchrone dans l'effet).
  const [display, setDisplay] = useState(() => (parsed ? format(0) : value))

  useEffect(() => {
    if (!parsed || reduce || !inView) return
    const controls = animate(0, parsed.target, {
      duration: 1.4,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(format(v)), // callback async → pas de set-state-in-effect
    })
    return () => controls.stop()
  }, [inView, reduce, parsed, format])

  // Valeur non numérique ou animations réduites : rendu direct, sans compteur.
  if (!parsed || reduce) return <span ref={ref}>{value}</span>
  return <span ref={ref}>{display}</span>
}

/**
 * Lueur radiale discrète qui suit le curseur sur le Hero. Les coordonnées sont
 * écrites dans des variables CSS plutôt que dans un state React : aucun
 * re-render, donc aucun coût à chaque mouvement de souris.
 */
function useCursorGlow() {
  const heroRef = useRef<HTMLElement>(null)
  const heroGlowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onMove = (e: MouseEvent) => {
      const glow = heroGlowRef.current
      if (!glow) return
      const rect = el.getBoundingClientRect()
      glow.style.setProperty('--gx', `${e.clientX - rect.left}px`)
      glow.style.setProperty('--gy', `${e.clientY - rect.top}px`)
      glow.style.opacity = '1'
    }
    const onLeave = () => {
      if (heroGlowRef.current) heroGlowRef.current.style.opacity = '0'
    }

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return { heroRef, heroGlowRef }
}

/** Carte de rôle du Bento "Espaces". */
function BentoRole({
  d,
  className = '',
  large = false,
}: {
  d: (typeof dashboards)[number]
  className?: string
  large?: boolean
}) {
  return (
    <motion.div variants={staggerChild} className={className}>
      <div className="group h-full p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-orange-500/10 dark:bg-orange-500/5 dark:shadow-none flex flex-col justify-center text-center transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-500/20">
        <div className={`${d.color} flex justify-center`}>{d.icon}</div>
        <p className={`mt-3 font-semibold ${large ? 'text-lg' : 'text-sm'} ${d.color}`}>{d.label}</p>
        <p
          className={`mt-1.5 ${large ? 'text-sm' : 'text-xs'} leading-snug text-zinc-600 dark:text-orange-200/40`}
        >
          {d.desc}
        </p>
      </div>
    </motion.div>
  )
}

const visionPoints = [
  'Une seule plateforme pour l\'administration, la pédagogie et la scolarité',
  'Pensée pour les réalités des universités francophones',
  'Vos équipes autonomes en moins de 48 heures',
]

export default function LandingPage() {
  const router = useRouter()
  const [billingAnnual, setBillingAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [demoOpen, setDemoOpen] = useState(false)

  // Accessibilité : on neutralise les animations si l'OS le demande.
  const reduce = useReducedMotion() ?? false

  // Lueur du Hero suivant le curseur.
  const { heroRef, heroGlowRef } = useCursorGlow()

  // Barre de progression de scroll (fine, en haut de page).
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 })

  // Reveal de section : désactivé si prefers-reduced-motion.
  const reveal = reduce ? {} : fadeInUp
  const stagger = reduce
    ? {}
    : {
        initial: 'hidden' as const,
        whileInView: 'show' as const,
        viewport: { once: true, margin: '-60px' },
        variants: staggerParent,
      }

  const handleGetStarted = () => {
    router.push('/auth/register-university')
  }

  const handleDemo = () => {
    setDemoOpen(true)
  }

  return (
    <main className="bg-white text-zinc-900 dark:bg-black dark:text-white overflow-x-hidden">
      {/* Barre de progression de scroll */}
      {!reduce && (
        <motion.div
          style={{ scaleX: progress }}
          className="fixed top-0 left-0 right-0 z-[60] h-0.5 origin-left bg-blue-600 dark:bg-blue-500"
        />
      )}

      <Navbar />

      {/* ── Hero — split : texte à gauche, photo + badge flottant à droite ── */}
      <section ref={heroRef} className="relative overflow-hidden px-4 pt-28 pb-20 md:pt-36 md:pb-28">
        {/* Lueur bleue discrète qui suit le curseur (variables CSS → aucun re-render) */}
        <div
          ref={heroGlowRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 motion-reduce:hidden"
          style={{
            background:
              'radial-gradient(500px circle at var(--gx, 50%) var(--gy, 40%), rgba(59,130,246,0.12), transparent 70%)',
          }}
        />

        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Colonne texte */}
          <motion.div
            initial={reduce ? undefined : { opacity: 0, y: 24 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-blue-50 border border-blue-200 text-blue-700 dark:bg-orange-500/10 dark:border-orange-300/30 dark:text-orange-100">
              <span aria-hidden>🎓</span>
              La plateforme de référence pour les universités francophones
            </span>

            <h1 className="mt-6 text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              <span className="block text-zinc-900 dark:text-white">Gérez votre université</span>
              <span className="block text-blue-600 dark:text-blue-400">de façon intelligente</span>
            </h1>

            <p className="mt-6 text-lg md:text-xl font-light leading-relaxed text-zinc-600 dark:text-zinc-300 max-w-xl">
              Une plateforme en ligne complète et sécurisée pour centraliser toute la vie
              académique, financière et pédagogique de votre établissement.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleGetStarted}
                className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-semibold text-lg transition-all duration-300 ease-out hover:scale-105 hover:shadow-xl hover:shadow-orange-500/25"
              >
                Démarrer un essai gratuit
              </button>
              <button
                onClick={handleDemo}
                className="px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 ease-out hover:scale-105 border border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-orange-300/30 dark:text-orange-100 dark:hover:bg-orange-500/10"
              >
                Demander une démo
              </button>
            </div>
          </motion.div>

          {/* Colonne image + badge flottant */}
          <motion.div
            className="relative"
            initial={reduce ? undefined : { opacity: 0, y: 24 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          >
            <div className="relative aspect-4/3 rounded-3xl overflow-hidden border border-zinc-200 dark:border-orange-500/20 shadow-xl shadow-blue-500/10">
              <Image
                src="/images/landing/graduation.jpg"
                alt="Diplômés en toge lançant leur chapeau lors de la cérémonie de remise des diplômes"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>

            {/* Badge flottant, en débord sur le coin de la photo.
                `animate-float` est déjà neutralisé par le bloc prefers-reduced-motion
                de globals.css — inutile de le préfixer par motion-safe:, qui ne
                s'applique pas à une classe CSS écrite à la main. */}
            <motion.div
              initial={reduce ? undefined : { opacity: 0, scale: 0.9 }}
              animate={reduce ? undefined : { opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.5, ease: 'easeOut' }}
              className="absolute -bottom-6 -left-4 sm:-left-6 flex items-center gap-3 rounded-2xl px-5 py-4 bg-white border border-zinc-200 shadow-xl dark:bg-zinc-950 dark:border-orange-500/20 animate-float"
            >
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-orange-500/15">
                <GraduationCap className="w-6 h-6 text-blue-600 dark:text-orange-400" />
              </div>
              <div className="text-left">
                <p className="text-xl font-bold leading-none text-zinc-900 dark:text-white">120+</p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">universités clientes</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <motion.section
        {...reveal}
        className="bg-blue-50 border-y border-blue-200 dark:bg-orange-950/40 dark:border-orange-500/20 py-8 px-4"
      >
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((stat, i) => (
            <div key={i} className="space-y-1">
              <p className="text-3xl font-bold text-blue-700 dark:text-orange-300">
                <CountUp value={stat.value} reduce={reduce} />
              </p>
              <p className="text-sm text-zinc-600 dark:text-orange-200/60">{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ── Vision — split : photo campus à gauche, texte à droite ── */}
      <section className="py-24 px-4">
        <motion.div
          {...reveal}
          className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center"
        >
          {/* Photo campus */}
          <div className="relative aspect-4/3 rounded-3xl overflow-hidden border border-zinc-200 dark:border-orange-500/20 shadow-xl shadow-blue-500/10">
            <Image
              src="/images/landing/etudiants-campus-universite-americaine.jpg"
              alt="Étudiants échangeant ensemble sur le campus d'une université"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>

          {/* Texte */}
          <div>
            <span className="px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-blue-700 border border-blue-300 bg-blue-50 dark:text-orange-400 dark:border-orange-500/30 dark:bg-orange-500/5 rounded-full">
              Notre vision
            </span>
            <h2 className="mt-6 text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white leading-tight">
              L&apos;université mérite des outils à sa hauteur
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-zinc-600 dark:text-orange-100/60">
              Trop d&apos;établissements jonglent encore entre tableurs, cahiers et logiciels qui ne
              se parlent pas. GestUniv réunit toute la vie de l&apos;université en un seul endroit —
              pour que le temps des équipes retourne là où il compte : les étudiants.
            </p>

            <ul className="mt-8 flex flex-col gap-4">
              {visionPoints.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-blue-600 dark:text-orange-400" />
                  <span className="text-zinc-700 dark:text-zinc-300">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div {...reveal} className="text-center mb-16">
            <span className="px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-blue-700 border border-blue-300 bg-blue-50 dark:text-orange-400 dark:border-orange-500/30 dark:bg-orange-500/5 rounded-full">
              Fonctionnalités
            </span>
            <h2 className="mt-6 text-4xl md:text-5xl font-bold text-zinc-900 dark:text-orange-200">
              Tout ce dont votre université a besoin
            </h2>
            <p className="mt-4 text-lg text-zinc-600 dark:text-orange-100/60 max-w-2xl mx-auto">
              De l&apos;inscription à la diplomation, chaque processus est automatisé et sécurisé.
            </p>
          </motion.div>

          <motion.div {...stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div key={i} variants={reduce ? undefined : staggerChild}>
                <Card className={`${f.color} border-zinc-200 dark:border-orange-500/10 hover:border-blue-500/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/10 h-full`}>
                  <CardHeader className="pb-3">
                    <div className="p-2 w-fit rounded-lg bg-white dark:bg-black/40 mb-3">{f.icon}</div>
                    <CardTitle className="text-base font-semibold text-zinc-900 dark:text-white">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-zinc-600 dark:text-orange-200/50 text-sm leading-relaxed">
                      {f.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 5 Espaces — Bento grid ── */}
      <section className="py-24 px-4 bg-blue-50/40 dark:bg-orange-950/10">
        <div className="max-w-6xl mx-auto">
          <motion.div {...reveal} className="text-center mb-16">
            <span className="px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-blue-700 border border-blue-300 bg-blue-50 dark:text-orange-400 dark:border-orange-500/30 dark:bg-orange-500/5 rounded-full">
              5 Espaces Dédiés
            </span>
            <h2 className="mt-6 text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white">
              Un espace pour chaque acteur
            </h2>
            <p className="mt-4 text-zinc-600 dark:text-orange-100/60 max-w-xl mx-auto">
              Chaque rôle dispose d&apos;un tableau de bord personnalisé, sécurisé et optimisé pour ses besoins spécifiques.
            </p>
          </motion.div>

          {/* Bento : uniquement les 5 rôles (pas de photos — elles ont leur
              place dans le Hero et la section Vision). Administration occupe la
              grande cellule : c'est le poste de pilotage. */}
          <motion.div
            {...stagger}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:auto-rows-[200px] gap-4"
          >
            <BentoRole d={dashboards[0]} large className="sm:col-span-2 md:col-span-2" />
            <BentoRole d={dashboards[1]} />
            <BentoRole d={dashboards[2]} />
            <BentoRole d={dashboards[3]} />
            <BentoRole d={dashboards[4]} />
          </motion.div>
        </div>
      </section>

      {/* ── Pricing Section ── */}
      <section id="pricing" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div {...reveal} className="text-center mb-12">
            <span className="px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-blue-700 border border-blue-300 bg-blue-50 dark:text-orange-400 dark:border-orange-500/30 dark:bg-orange-500/5 rounded-full">
              Tarifs
            </span>
            <h2 className="mt-6 text-4xl md:text-5xl font-bold text-zinc-900 dark:text-orange-200">
              Transparent et prévisible
            </h2>
            <p className="mt-4 text-zinc-600 dark:text-orange-100/60">
              Choisissez le plan adapté à la taille de votre établissement.
            </p>

            {/* Toggle annuel */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <span className={`text-sm ${!billingAnnual ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-orange-200/40'}`}>Mensuel</span>
              <button
                onClick={() => setBillingAnnual(!billingAnnual)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${billingAnnual ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-orange-900/60'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${billingAnnual ? 'translate-x-6' : ''}`} />
              </button>
              <span className={`text-sm ${billingAnnual ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-orange-200/40'}`}>
                Annuel <span className="text-green-600 dark:text-green-400 text-xs font-semibold">-20%</span>
              </span>
            </div>
          </motion.div>

          <motion.div {...stagger} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLAN_ORDER.map((planId) => {
              const plan = PLANS_CONFIG[planId]
              const meta = planMeta[planId]
              const highlight = Boolean(plan.badge)
              const prix = billingAnnual ? plan.prixAnnuel : plan.prixMensuel
              const surDevis = prix === 0
              const period = billingAnnual ? '/an' : '/mois'

              return (
                <motion.div
                  key={planId}
                  variants={reduce ? undefined : staggerChild}
                  className={`relative rounded-2xl border p-8 flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                    highlight
                      ? 'border-blue-500 bg-blue-50 dark:border-orange-400/50 dark:bg-orange-950/50 dark:animate-pulse-glow'
                      : 'border-zinc-200 bg-white shadow-sm dark:border-orange-500/10 dark:bg-orange-500/5 dark:shadow-none'
                  }`}
                >
                  {highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-orange-500 rounded-full text-xs font-bold text-white">
                      {plan.badge}
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">{meta.nom ?? plan.nom}</h3>
                    <p className="text-zinc-500 dark:text-orange-200/40 text-sm">{meta.description}</p>
                  </div>
                  <div className="mb-6">
                    {surDevis ? (
                      <span className="text-4xl font-bold text-zinc-900 dark:text-white">Sur devis</span>
                    ) : (
                      <>
                        <span className="text-4xl font-bold text-zinc-900 dark:text-white">
                          {prix.toLocaleString('fr-FR')}
                        </span>
                        <span className="text-zinc-500 dark:text-orange-200/40 text-sm ml-1">
                          FCFA{period}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Groupe Limites */}
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-orange-400/70 mb-3">
                    Limites
                  </p>
                  <ul className="space-y-2.5 mb-6">
                    {limiteRows.map((row) => (
                      <li key={row.label} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-600 dark:text-orange-100/70">{row.label}</span>
                        <span className="font-semibold text-zinc-900 dark:text-white">{row.value(plan.features)}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Groupe Fonctionnalités */}
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-orange-400/70 mb-3">
                    Fonctionnalités
                  </p>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {featureRows.map((row) => {
                      const included = Boolean(plan.features[row.key])
                      // "Bientôt" ne se montre que là où la fonctionnalité est
                      // vendue comme incluse : inutile de l'afficher sur un plan
                      // qui ne la propose de toute façon pas (croix barrée).
                      const soon = Boolean(row.soon) && included
                      return (
                        <li key={row.key} className="flex items-center gap-2 text-sm">
                          {included ? (
                            soon ? (
                              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                            ) : (
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                            )
                          ) : (
                            <X className="w-4 h-4 text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 shrink-0" />
                          )}
                          <span
                            className={
                              !included
                                ? 'text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 line-through'
                                : soon
                                  ? 'text-zinc-500 dark:text-zinc-400'
                                  : 'text-zinc-900 dark:text-white'
                            }
                          >
                            {row.label}
                          </span>
                          {row.ia && included && (
                            <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-orange-500/20 dark:text-orange-300">
                              IA
                            </span>
                          )}
                          {soon && (
                            <span className="ml-auto shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              Bientôt
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>

                  <button
                    onClick={handleGetStarted}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 ease-out hover:scale-[1.03] ${
                      highlight
                        ? 'bg-orange-500 hover:bg-orange-600 text-white hover:shadow-lg hover:shadow-orange-500/30'
                        : 'border border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-orange-500/30 dark:text-orange-300 dark:hover:bg-orange-500/10'
                    }`}
                  >
                    {meta.cta} <ArrowRight className="inline w-4 h-4 ml-1" />
                  </button>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-24 px-4 bg-blue-50/40 dark:bg-orange-950/10">
        <div className="max-w-5xl mx-auto">
          <motion.div {...reveal} className="text-center mb-16">
            <span className="px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-blue-700 border border-blue-300 bg-blue-50 dark:text-orange-400 dark:border-orange-500/30 dark:bg-orange-500/5 rounded-full">
              Témoignages
            </span>
            <h2 className="mt-6 text-4xl font-bold text-zinc-900 dark:text-white">
              Ils font confiance à GestUniv
            </h2>
          </motion.div>

          <motion.div {...stagger} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div key={i} variants={reduce ? undefined : staggerChild}>
                <Card className="bg-white border-zinc-200 shadow-sm dark:bg-orange-950/40 dark:border-orange-500/10 dark:shadow-none hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1 h-full">
                  <CardContent className="pt-6">
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: t.stars }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-gold-400 text-gold-400" />
                      ))}
                    </div>
                    <p className="text-zinc-600 dark:text-orange-100/70 text-sm leading-relaxed italic mb-6">
                      &quot;{t.content}&quot;
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm">
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-zinc-900 dark:text-white text-sm font-semibold">{t.name}</p>
                        <p className="text-zinc-500 dark:text-orange-300/40 text-xs">{t.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Security Section ── */}
      <motion.section {...reveal} className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full mb-6">
            <Lock className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-green-700 dark:text-green-400 text-sm font-semibold">Sécurité de niveau professionnel</span>
          </div>
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">
            Confidentialité totale. Zéro compromis.
          </h2>
          <p className="text-zinc-600 dark:text-orange-100/50 mb-10 max-w-xl mx-auto">
            Vos données sont totalement sécurisées et privées.
            Conforme RGPD, journal des activités inviolable et chiffrement de bout en bout.
          </p>
          <motion.div {...stagger} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <Shield className="w-5 h-5" />, label: 'Données privées et sécurisées' },
              { icon: <Lock className="w-5 h-5" />, label: 'Données chiffrées (standard bancaire)' },
              { icon: <FileText className="w-5 h-5" />, label: 'Journal des activités' },
              { icon: <TrendingUp className="w-5 h-5" />, label: 'Disponible 99,9% du temps (garanti par contrat)' },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={reduce ? undefined : staggerChild}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-green-500/20 bg-green-500/5"
              >
                <div className="text-green-600 dark:text-green-400">{item.icon}</div>
                <span className="text-green-800 dark:text-green-300/70 text-xs text-center">{item.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div {...reveal} className="text-center mb-12">
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">Questions fréquentes</h2>
          </motion.div>
          {[
            {
              q: 'Combien de temps pour mettre en route une université ?',
              a: 'Moins de 48 heures. Un parcours guidé, étape par étape, que vous réalisez vous-même : création du compte, import de vos listes d\'étudiants et d\'enseignants depuis un fichier Excel, configuration des filières.',
            },
            {
              q: 'Les données de nos étudiants sont-elles en sécurité ?',
              a: 'Absolument. Vos données sont totalement sécurisées et privées : elles vous sont strictement réservées et ne sont jamais accessibles à des tiers. Nous sommes conformes RGPD (protection des données personnelles).',
            },
            {
              q: 'Peut-on importer nos données existantes ?',
              a: 'Oui, vous pouvez importer vos données depuis des fichiers Excel : étudiants, enseignants, cours et notes historiques.',
            },
            {
              q: 'Y a-t-il une application mobile ?',
              a: 'L\'interface s\'adapte automatiquement à tous les écrans (ordinateur, tablette, téléphone) et fonctionne parfaitement sur mobile. Une application mobile iOS/Android est prévue pour l\'automne 2026.',
            },
          ].map((faq, i) => (
            <motion.div
              key={i}
              initial={reduce ? undefined : { opacity: 0 }}
              whileInView={reduce ? undefined : { opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="border-b border-zinc-200 dark:border-orange-500/10"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between py-5 text-left"
              >
                <span className="text-zinc-800 dark:text-orange-100/80 font-medium">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-blue-600 dark:text-orange-400 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`}
                />
              </button>
              {openFaq === i && (
                <p className="pb-5 text-zinc-600 dark:text-orange-200/50 text-sm leading-relaxed">{faq.a}</p>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA Final ── */}
      <motion.section {...reveal} className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative p-12 rounded-3xl border border-blue-200 bg-blue-50 dark:border-orange-500/20 dark:bg-orange-950/30 overflow-hidden">
            <div className="absolute inset-0 bg-orange-500/5" />
            <div className="relative z-10">
              <GraduationCap className="w-12 h-12 text-blue-600 dark:text-orange-400 mx-auto mb-6 animate-float" />
              <h2 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4">
                Prêt à moderniser votre université ?
              </h2>
              <p className="text-zinc-600 dark:text-orange-200/60 mb-8">
                Rejoignez 120+ établissements qui font confiance à GestUniv. Essai gratuit 30 jours, sans carte bancaire.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleGetStarted}
                  className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-semibold text-lg transition-all duration-300 ease-out hover:scale-105 hover:shadow-xl hover:shadow-orange-500/25"
                >
                  Démarrer gratuitement
                </button>
                <button
                  onClick={handleDemo}
                  className="px-8 py-4 border border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-orange-400/30 dark:text-orange-200 dark:hover:bg-orange-500/10 rounded-full font-semibold text-lg transition-all duration-300 ease-out hover:scale-105"
                >
                  Voir la démo
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Footer ── */}
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
            <span className="hover:text-blue-600 dark:hover:text-orange-400 cursor-pointer transition-colors">Confidentialité</span>
            <span className="hover:text-blue-600 dark:hover:text-orange-400 cursor-pointer transition-colors">CGU</span>
            <span className="hover:text-blue-600 dark:hover:text-orange-400 cursor-pointer transition-colors">Contact</span>
          </div>
        </div>
      </footer>

      <VideoDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </main>
  )
}
