'use client'

import { useState } from 'react'
import { Navbar } from '@/components/ui/navbar'
import { Footer } from '@/components/ui/footer'
import { Mail, MessageCircle, Send, CheckCircle2 } from 'lucide-react'

const WHATSAPP_NUMBER = '2250173187134'
const CONTACT_EMAIL = 'kouadioroxanne70@gmail.com'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? "L'envoi a échoué. Veuillez réessayer.")
      } else {
        setSent(true)
      }
    } catch {
      setError('Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="bg-white text-zinc-900 dark:bg-black dark:text-white">
      <Navbar />

      <section className="px-4 pt-32 pb-24 md:pt-40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-blue-700 border border-blue-300 bg-blue-50 dark:text-orange-400 dark:border-orange-500/30 dark:bg-orange-500/5 rounded-full">
              Contact
            </span>
            <h1 className="mt-6 text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white">
              Parlons de votre établissement
            </h1>
            <p className="mt-4 text-zinc-600 dark:text-orange-100/60 max-w-xl mx-auto">
              Une question, une démo, un projet de migration ? Écrivez-nous ou
              écrivez-nous directement sur WhatsApp, nous répondons rapidement.
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-8 items-start">
            {/* Coordonnées directes */}
            <div className="md:col-span-2 flex flex-col gap-4">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center gap-4 p-5 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-orange-500/10 dark:bg-orange-500/5 dark:shadow-none hover:border-blue-500/60 transition-all duration-300"
              >
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-orange-500/15 shrink-0">
                  <Mail className="w-5 h-5 text-blue-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">Email</p>
                  <p className="text-sm text-zinc-600 dark:text-orange-200/60 truncate">{CONTACT_EMAIL}</p>
                </div>
              </a>

              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-5 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-orange-500/10 dark:bg-orange-500/5 dark:shadow-none hover:border-blue-500/60 transition-all duration-300"
              >
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-orange-500/15 shrink-0">
                  <MessageCircle className="w-5 h-5 text-blue-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">WhatsApp</p>
                  <p className="text-sm text-zinc-600 dark:text-orange-200/60">+225 01 73 18 71 34</p>
                </div>
              </a>

              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-semibold text-sm transition-all duration-300 ease-out hover:scale-105"
              >
                <MessageCircle className="w-4 h-4" />
                Discuter sur WhatsApp
              </a>
            </div>

            {/* Formulaire */}
            <div className="md:col-span-3 bg-white dark:bg-white/5 border border-zinc-200 dark:border-orange-500/20 rounded-2xl p-8 shadow-sm dark:shadow-none">
              {sent ? (
                <div className="flex flex-col items-center text-center gap-4 py-8">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-orange-400" />
                  </div>
                  <p className="text-zinc-900 dark:text-white text-sm leading-relaxed max-w-sm">
                    Votre message a bien été envoyé. Nous vous répondrons à
                    l&apos;adresse indiquée dans les meilleurs délais.
                  </p>
                  <button
                    onClick={() => {
                      setSent(false)
                      setName('')
                      setEmail('')
                      setSubject('')
                      setMessage('')
                    }}
                    className="mt-2 text-blue-600 dark:text-orange-400 hover:underline text-sm font-medium"
                  >
                    Envoyer un autre message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Nom</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Votre nom"
                        required
                        disabled={loading}
                        className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 disabled:opacity-50"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vous@exemple.com"
                        required
                        disabled={loading}
                        className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Sujet</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Objet de votre message"
                      required
                      disabled={loading}
                      className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 disabled:opacity-50"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-zinc-600 dark:text-orange-200/60 text-sm font-medium">Message</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Décrivez votre besoin ou votre question…"
                      required
                      disabled={loading}
                      rows={5}
                      className="bg-zinc-50 dark:bg-black/40 border border-orange-500/20 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-orange-200/30 focus:outline-none focus:border-orange-400/60 disabled:opacity-50 resize-none"
                    />
                  </div>

                  {error && (
                    <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-full py-3 transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    {loading ? 'Envoi…' : 'Envoyer le message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
