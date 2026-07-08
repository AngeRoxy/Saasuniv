'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/ui/navbar'
import Hero from '@/components/ui/animated-shader-hero'
import { SplineScene } from '@/components/ui/splite'
import { Spotlight } from '@/components/ui/spotlight'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  GraduationCap, BookOpen, Users, BarChart3, Shield, Bell,
  CheckCircle2, Star, ArrowRight, Building2, Globe, CreditCard,
  FileText, Zap, Lock, TrendingUp, ChevronDown, Check, X
} from 'lucide-react'
import { motion } from 'framer-motion'
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
const featureRows: { label: string; key: keyof PlanFeatures; ia?: boolean }[] = [
  { label: 'Import CSV', key: 'importCSV' },
  { label: 'Export PDF', key: 'exportPDF' },
  { label: 'Bulletins PDF', key: 'bulletinsPDF' },
  { label: 'Messagerie interne', key: 'messagerieInterne' },
  { label: 'Notifications email', key: 'notificationsEmail' },
  { label: 'Chatbot IA', key: 'chatbotIA', ia: true },
  { label: 'Recommandations IA', key: 'recommandationsIA', ia: true },
  { label: 'Logs d\'audit', key: 'auditLogs' },
  { label: 'Support prioritaire', key: 'supportPrioritaire' },
  { label: 'Multi-campus', key: 'multiCampus' },
  { label: 'Accès API', key: 'apiAccess' },
  { label: 'Sous-domaine personnalisé', key: 'sousDomainePerso' },
]

const features = [
  {
    icon: <GraduationCap className="w-7 h-7 text-orange-400" />,
    title: 'Gestion des Étudiants',
    description: 'Inscription, matricule automatique, suivi de parcours complet et gestion des statuts en temps réel.',
    color: 'bg-orange-500/10',
  },
  {
    icon: <BookOpen className="w-7 h-7 text-yellow-400" />,
    title: 'E-Learning Intégré',
    description: 'Bibliothèque numérique, cours en ligne, suivi de progression et gestion des ressources pédagogiques.',
    color: 'bg-yellow-500/10',
  },
  {
    icon: <BarChart3 className="w-7 h-7 text-amber-400" />,
    title: 'Notes & Évaluations',
    description: 'Calcul automatique des moyennes pondérées, bulletins générés en un clic, classements automatiques.',
    color: 'bg-amber-500/10',
  },
  {
    icon: <Users className="w-7 h-7 text-orange-300" />,
    title: 'Multi-Rôles Complets',
    description: 'Espaces dédiés pour admin, enseignants, étudiants et parents avec droits RBAC stricts.',
    color: 'bg-orange-400/10',
  },
  {
    icon: <CreditCard className="w-7 h-7 text-yellow-300" />,
    title: 'Finance & Scolarité',
    description: 'Suivi des paiements, échéances, historique des reçus et alertes automatiques.',
    color: 'bg-yellow-400/10',
  },
  {
    icon: <Shield className="w-7 h-7 text-red-400" />,
    title: 'Sécurité Multi-Établissement',
    description: 'Isolation absolue des données entre établissements via règles Firebase, conformité RGPD.',
    color: 'bg-red-500/10',
  },
  {
    icon: <Bell className="w-7 h-7 text-amber-300" />,
    title: 'Notifications Intelligentes',
    description: 'Alertes financières, publications de résultats et annonces en temps réel pour tous.',
    color: 'bg-amber-400/10',
  },
  {
    icon: <FileText className="w-7 h-7 text-orange-200" />,
    title: 'Logs d\'Audit & RGPD',
    description: 'Traçabilité immuable des actions critiques et export des données personnelles conforme.',
    color: 'bg-orange-300/10',
  },
]

// Métadonnées d'affichage par plan (descriptions & CTA). Les prix, limites
// et feature flags proviennent exclusivement de PLANS_CONFIG.
const planMeta: Record<string, { description: string; cta: string }> = {
  standard: { description: 'Idéal pour les petits établissements', cta: 'Démarrer gratuitement' },
  premium: { description: 'Pour les universités en croissance', cta: 'Essai 30 jours gratuit' },
  enterprise: { description: 'Pour les grandes institutions', cta: 'Demander un devis' },
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
    content: 'L\'isolation multi-établissement nous rassure. Nos données sont étanches et sécurisées. L\'onboarding en 48h était impressionnant.',
    stars: 5,
  },
  {
    name: 'Mme. Aïcha Traoré',
    role: 'DGA — Académie des Sciences de Bamako',
    content: 'Enfin un SaaS conçu pour l\'Afrique. Les notifications par SMS et l\'interface en français ont séduit nos équipes immédiatement.',
    stars: 5,
  },
]

const dashboards = [
  { icon: <Building2 className="w-6 h-6" />, label: 'Administration', color: 'text-orange-400', desc: 'Pilotez l\'ensemble de l\'établissement' },
  { icon: <BookOpen className="w-6 h-6" />, label: 'Enseignants', color: 'text-yellow-400', desc: 'Saisie de notes et ressources pédagogiques' },
  { icon: <GraduationCap className="w-6 h-6" />, label: 'Étudiants', color: 'text-amber-400', desc: 'Résultats, cours et espace personnel' },
  { icon: <Users className="w-6 h-6" />, label: 'Parents', color: 'text-orange-300', desc: 'Suivi en temps réel de l\'enfant' },
  { icon: <Globe className="w-6 h-6" />, label: 'Super Admin', color: 'text-red-400', desc: 'Monitoring global de la plateforme' },
]

const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
}

export default function LandingPage() {
  const router = useRouter()
  const [billingAnnual, setBillingAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [demoOpen, setDemoOpen] = useState(false)

  const handleGetStarted = () => {
    router.push('/auth/register-university')
  }

  const handleDemo = () => {
    setDemoOpen(true)
  }

  return (
    <main className="bg-black text-white overflow-x-hidden">
      <Navbar />

      {/* ── Hero Section ── */}
      <Hero
        trustBadge={{
          text: 'La plateforme de référence pour les universités francophones',
          icons: ['🎓', '✨'],
        }}
        headline={{
          line1: 'Gérez votre université',
          line2: 'de façon intelligente',
        }}
        subtitle="Un SaaS complet sécurisé pour centraliser l'intégralité des flux académiques, financiers et pédagogiques de votre établissement."
        buttons={{
          primary: { text: 'Démarrer un essai gratuit', onClick: handleGetStarted },
          secondary: { text: 'Demander une démo', onClick: handleDemo },
        }}
      />

      {/* ── Stats Bar ── */}
      <motion.section
        {...fadeInUp}
        className="bg-orange-950/40 border-y border-orange-500/20 py-8 px-4"
      >
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: '120+', label: 'Universités clientes' },
            { value: '85 000+', label: 'Étudiants gérés' },
            { value: '99.9%', label: 'Uptime garanti' },
            { value: '< 48h', label: 'Onboarding complet' },
          ].map((stat, i) => (
            <div key={i} className="space-y-1">
              <p className="text-3xl font-bold text-orange-300">
                {stat.value}
              </p>
              <p className="text-sm text-orange-200/60">{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ── Features Section ── */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <span className="px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-orange-400 border border-orange-500/30 rounded-full bg-orange-500/5">
              Fonctionnalités
            </span>
            <h2 className="mt-6 text-4xl md:text-5xl font-bold text-orange-200">
              Tout ce dont votre université a besoin
            </h2>
            <p className="mt-4 text-lg text-orange-100/60 max-w-2xl mx-auto">
              De l&apos;inscription à la diplomation, chaque processus est automatisé et sécurisé.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
              >
                <Card className={`${f.color} border-orange-500/10 hover:border-orange-400/30 transition-all duration-300 hover:-translate-y-1 h-full`}>
                  <CardHeader className="pb-3">
                    <div className="p-2 w-fit rounded-lg bg-black/40 mb-3">{f.icon}</div>
                    <CardTitle className="text-base font-semibold text-white">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-orange-200/50 text-sm leading-relaxed">
                      {f.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3D Spline Interactive Section ── */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeInUp} className="text-center mb-10">
            <span className="px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-orange-400 border border-orange-500/30 rounded-full bg-orange-500/5">
              Expérience Interactive
            </span>
            <h2 className="mt-6 text-4xl font-bold text-white">
              Une interface pensée pour l&apos;avenir
            </h2>
          </motion.div>

          <motion.div {...fadeInUp}>
            <Card className="w-full h-125 bg-black/96 relative overflow-hidden border-orange-500/20">
              <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" size={300} />
              <div className="flex h-full">
                {/* Left */}
                <div className="flex-1 p-8 relative z-10 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-6">
                    <Zap className="w-5 h-5 text-orange-400" />
                    <span className="text-orange-400 text-sm font-semibold uppercase tracking-wider">Nouvelle Génération</span>
                  </div>
                  <h3 className="text-4xl md:text-5xl font-bold text-white">
                    Tableau de bord 3D
                  </h3>
                  <p className="mt-4 text-neutral-300 max-w-xs leading-relaxed">
                    Visualisez vos données académiques et financières dans un espace 3D interactif. Drag, zoom, explorez.
                  </p>
                  <div className="mt-8 flex flex-col gap-3">
                    {['Analytique temps réel', 'Rapports automatisés', 'Vue multi-campus'].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-orange-200/70">
                        <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Right — 3D Scene */}
                <div className="flex-1 relative">
                  <SplineScene
                    scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                    className="w-full h-full"
                  />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ── 5 Dashboards Section ── */}
      <section className="py-24 px-4 bg-orange-950/10">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <span className="px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-orange-400 border border-orange-500/30 rounded-full bg-orange-500/5">
              5 Espaces Dédiés
            </span>
            <h2 className="mt-6 text-4xl md:text-5xl font-bold text-white">
              Un espace pour chaque acteur
            </h2>
            <p className="mt-4 text-orange-100/60 max-w-xl mx-auto">
              Chaque rôle dispose d&apos;un dashboard personnalisé, sécurisé et optimisé pour ses besoins spécifiques.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {dashboards.map((d, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="group"
              >
                <div className="p-6 rounded-xl border border-orange-500/10 bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-400/30 transition-all duration-300 text-center space-y-3">
                  <div className={`${d.color} flex justify-center group-hover:animate-float`}>{d.icon}</div>
                  <p className={`font-semibold text-sm ${d.color}`}>{d.label}</p>
                  <p className="text-xs text-orange-200/40 leading-snug">{d.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Section ── */}
      <section id="pricing" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeInUp} className="text-center mb-12">
            <span className="px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-orange-400 border border-orange-500/30 rounded-full bg-orange-500/5">
              Tarifs
            </span>
            <h2 className="mt-6 text-4xl md:text-5xl font-bold text-orange-200">
              Transparent et prévisible
            </h2>
            <p className="mt-4 text-orange-100/60">
              Choisissez le plan adapté à la taille de votre établissement.
            </p>

            {/* Toggle annuel */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <span className={`text-sm ${!billingAnnual ? 'text-white' : 'text-orange-200/40'}`}>Mensuel</span>
              <button
                onClick={() => setBillingAnnual(!billingAnnual)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${billingAnnual ? 'bg-orange-500' : 'bg-orange-900/60'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${billingAnnual ? 'translate-x-6' : ''}`} />
              </button>
              <span className={`text-sm ${billingAnnual ? 'text-white' : 'text-orange-200/40'}`}>
                Annuel <span className="text-green-400 text-xs font-semibold">-20%</span>
              </span>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLAN_ORDER.map((planId, i) => {
              const plan = PLANS_CONFIG[planId]
              const meta = planMeta[planId]
              const highlight = Boolean(plan.badge)
              const prix = billingAnnual ? plan.prixAnnuel : plan.prixMensuel
              const surDevis = prix === 0
              const period = billingAnnual ? '/an' : '/mois'

              return (
                <motion.div
                  key={planId}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  className={`relative rounded-2xl border p-8 flex flex-col ${
                    highlight
                      ? 'border-orange-400/50 bg-orange-950/50 animate-pulse-glow'
                      : 'border-orange-500/10 bg-orange-500/5'
                  }`}
                >
                  {highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-orange-500 rounded-full text-xs font-bold text-black">
                      {plan.badge}
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-white mb-1">{plan.nom}</h3>
                    <p className="text-orange-200/40 text-sm">{meta.description}</p>
                  </div>
                  <div className="mb-6">
                    {surDevis ? (
                      <span className="text-4xl font-bold text-white">Sur devis</span>
                    ) : (
                      <>
                        <span className="text-4xl font-bold text-white">
                          {prix.toLocaleString('fr-FR')}
                        </span>
                        <span className="text-orange-200/40 text-sm ml-1">
                          FCFA{period}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Groupe Limites */}
                  <p className="text-xs font-semibold uppercase tracking-wider text-orange-400/70 mb-3">
                    Limites
                  </p>
                  <ul className="space-y-2.5 mb-6">
                    {limiteRows.map((row) => (
                      <li key={row.label} className="flex items-center justify-between text-sm">
                        <span className="text-orange-100/70">{row.label}</span>
                        <span className="font-semibold text-white">{row.value(plan.features)}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Groupe Fonctionnalités */}
                  <p className="text-xs font-semibold uppercase tracking-wider text-orange-400/70 mb-3">
                    Fonctionnalités
                  </p>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {featureRows.map((row) => {
                      const included = Boolean(plan.features[row.key])
                      return (
                        <li key={row.key} className="flex items-center gap-2 text-sm">
                          {included ? (
                            <Check className="w-4 h-4 text-green-400 shrink-0" />
                          ) : (
                            <X className="w-4 h-4 text-zinc-600 shrink-0" />
                          )}
                          <span className={included ? 'text-white' : 'text-zinc-600 line-through'}>
                            {row.label}
                          </span>
                          {row.ia && included && (
                            <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-300">
                              IA
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>

                  <button
                    onClick={handleGetStarted}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-105 ${
                      highlight
                        ? 'bg-orange-500 hover:bg-orange-600 text-black hover:shadow-lg hover:shadow-orange-500/30'
                        : 'border border-orange-500/30 text-orange-300 hover:bg-orange-500/10'
                    }`}
                  >
                    {meta.cta} <ArrowRight className="inline w-4 h-4 ml-1" />
                  </button>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-24 px-4 bg-orange-950/10">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <span className="px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-orange-400 border border-orange-500/30 rounded-full bg-orange-500/5">
              Témoignages
            </span>
            <h2 className="mt-6 text-4xl font-bold text-white">
              Ils font confiance à GestUniv
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              >
                <Card className="bg-orange-950/40 border-orange-500/10 hover:border-orange-400/20 transition-all duration-300 h-full">
                  <CardContent className="pt-6">
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: t.stars }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-orange-100/70 text-sm leading-relaxed italic mb-6">
                      &quot;{t.content}&quot;
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-400 flex items-center justify-center text-black font-bold text-sm">
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-white text-sm font-semibold">{t.name}</p>
                        <p className="text-orange-300/40 text-xs">{t.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security Section ── */}
      <motion.section {...fadeInUp} className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full mb-6">
            <Lock className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm font-semibold">Sécurité Enterprise</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Données isolées. Zéro compromis.
          </h2>
          <p className="text-orange-100/50 mb-10 max-w-xl mx-auto">
            Chaque université dispose d&apos;un espace 100% étanche via les règles Firebase.
            Conformité RGPD, audit logs immuables, chiffrement bout-en-bout.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <Shield className="w-5 h-5" />, label: 'Multi-établissement isolé' },
              { icon: <Lock className="w-5 h-5" />, label: 'Chiffrement AES-256' },
              { icon: <FileText className="w-5 h-5" />, label: 'Audit logs RGPD' },
              { icon: <TrendingUp className="w-5 h-5" />, label: 'SLA 99.9%' },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-green-500/10 bg-green-500/5">
                <div className="text-green-400">{item.icon}</div>
                <span className="text-green-300/70 text-xs text-center">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div {...fadeInUp} className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white">Questions fréquentes</h2>
          </motion.div>
          {[
            {
              q: 'Combien de temps pour onboarder une université ?',
              a: 'Moins de 48 heures. Notre tunnel self-service guide l\'administrateur étape par étape : création du compte, import CSV des étudiants/enseignants, configuration des filières.',
            },
            {
              q: 'Les données de nos étudiants sont-elles en sécurité ?',
              a: 'Absolument. Chaque université est isolée via les règles Firebase. Aucun croisement de données n\'est possible entre établissements. Nous sommes conformes RGPD.',
            },
            {
              q: 'Peut-on importer nos données existantes ?',
              a: 'Oui, nous supportons l\'import via fichiers CSV/Excel pour les étudiants, enseignants, cours et notes historiques.',
            },
            {
              q: 'Y a-t-il une application mobile ?',
              a: 'L\'interface est entièrement responsive et fonctionne parfaitement sur mobile. Une application native iOS/Android est prévue pour Q3 2026.',
            },
          ].map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="border-b border-orange-500/10"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between py-5 text-left"
              >
                <span className="text-orange-100/80 font-medium">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-orange-400 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`}
                />
              </button>
              {openFaq === i && (
                <p className="pb-5 text-orange-200/50 text-sm leading-relaxed">{faq.a}</p>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA Final ── */}
      <motion.section {...fadeInUp} className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative p-12 rounded-3xl border border-orange-500/20 bg-orange-950/30 overflow-hidden">
            <div className="absolute inset-0 bg-orange-500/5" />
            <div className="relative z-10">
              <GraduationCap className="w-12 h-12 text-orange-400 mx-auto mb-6 animate-float" />
              <h2 className="text-4xl font-bold text-white mb-4">
                Prêt à moderniser votre université ?
              </h2>
              <p className="text-orange-200/60 mb-8">
                Rejoignez 120+ établissements qui font confiance à GestUniv. Essai gratuit 30 jours, sans carte bancaire.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleGetStarted}
                  className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-black rounded-full font-semibold text-lg transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-orange-500/25"
                >
                  Démarrer gratuitement
                </button>
                <button
                  onClick={handleDemo}
                  className="px-8 py-4 border border-orange-400/30 hover:border-orange-400/50 text-orange-200 rounded-full font-semibold text-lg transition-all duration-300 hover:bg-orange-500/10"
                >
                  Voir la démo
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Footer ── */}
      <footer className="border-t border-orange-500/10 py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-orange-400" />
            <span className="font-bold text-white text-lg">GestUniv</span>
            <span className="text-orange-400/40 text-xs">SaaS</span>
          </div>
          <p className="text-orange-200/30 text-sm text-center">
            © 2026 GestUniv. Tous droits réservés. Conforme RGPD.
          </p>
          <div className="flex gap-6 text-xs text-orange-200/30">
            <span className="hover:text-orange-400 cursor-pointer transition-colors">Confidentialité</span>
            <span className="hover:text-orange-400 cursor-pointer transition-colors">CGU</span>
            <span className="hover:text-orange-400 cursor-pointer transition-colors">Contact</span>
          </div>
        </div>
      </footer>

      <VideoDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </main>
  )
}
