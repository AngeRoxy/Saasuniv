import type { Metadata } from 'next'
import { Navbar } from '@/components/ui/navbar'
import { Footer } from '@/components/ui/footer'
import { ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — GestUniv',
  description: "Comment GestUniv collecte, utilise et protège les données personnelles des établissements et de leurs membres.",
}

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: '1. Responsable du traitement',
    body: (
      <>
        <p>
          GestUniv est édité par Roxanne Kouadio, à Abidjan, Côte d&apos;Ivoire
          ([À compléter] — forme juridique et numéro RCCM). Pour toute
          question relative à la présente politique ou à vos données
          personnelles, vous pouvez nous contacter à l&apos;adresse{' '}
          <a href="mailto:kouadioroxanne70@gmail.com" className="text-blue-600 dark:text-orange-400 hover:underline">
            kouadioroxanne70@gmail.com
          </a>
          .
        </p>
      </>
    ),
  },
  {
    title: '2. Données collectées',
    body: (
      <>
        <p>Selon le rôle de l&apos;utilisateur au sein de l&apos;établissement, GestUniv traite :</p>
        <ul className="list-disc pl-5 mt-3 space-y-1.5">
          <li>Identité : nom, prénom, email, numéro de téléphone ;</li>
          <li>Données académiques : matricule, filière, notes, absences, emploi du temps, bulletins ;</li>
          <li>Données financières : historique des paiements de scolarité et échéances ;</li>
          <li>Photo de profil, uniquement si cette fonctionnalité est activée par l&apos;établissement ;</li>
          <li>Données techniques de connexion (journal des activités) à des fins de sécurité et de traçabilité.</li>
        </ul>
      </>
    ),
  },
  {
    title: '3. Finalité du traitement',
    body: (
      <p>
        Ces données sont exclusivement utilisées pour la gestion académique et
        administrative de l&apos;établissement client : inscription, suivi de
        scolarité, gestion des notes et des absences, communication interne
        (messagerie, notifications), facturation et suivi des paiements.
      </p>
    ),
  },
  {
    title: '4. Base légale',
    body: (
      <p>
        Le traitement repose sur l&apos;exécution du contrat liant
        l&apos;établissement à GestUniv, ainsi que sur l&apos;intérêt
        légitime de GestUniv à assurer le bon fonctionnement, la sécurité et
        l&apos;amélioration continue du service.
      </p>
    ),
  },
  {
    title: '5. Durée de conservation',
    body: (
      <p>
        Les données sont conservées pendant toute la durée de la relation
        contractuelle entre l&apos;établissement et GestUniv, puis archivées
        ou supprimées selon les obligations légales applicables et les
        instructions de l&apos;établissement à la résiliation du service.
      </p>
    ),
  },
  {
    title: '6. Destinataires des données',
    body: (
      <>
        <p>
          Les données ne sont accessibles qu&apos;à l&apos;établissement
          client concerné (isolation stricte entre établissements) et ne sont
          jamais vendues ni cédées à des tiers à des fins commerciales.
        </p>
        <p className="mt-3">
          Elles peuvent être traitées par des prestataires techniques
          nécessaires au fonctionnement du service, dans le cadre de leurs
          propres engagements de confidentialité :
        </p>
        <ul className="list-disc pl-5 mt-3 space-y-1.5">
          <li>Firebase / Google Cloud — hébergement et base de données ;</li>
          <li>Resend — envoi des emails transactionnels (identifiants d&apos;accès, notifications).</li>
        </ul>
      </>
    ),
  },
  {
    title: '7. Vos droits',
    body: (
      <p>
        Conformément aux réglementations applicables en matière de protection
        des données personnelles, vous disposez d&apos;un droit d&apos;accès,
        de rectification et de suppression de vos données. Ces demandes
        doivent être adressées en priorité à l&apos;administration de votre
        établissement, qui reste responsable de la gestion des comptes de ses
        étudiants, enseignants et parents. À défaut de réponse, vous pouvez
        nous contacter directement.
      </p>
    ),
  },
  {
    title: '8. Sécurité',
    body: (
      <p>
        Les données transitent et sont stockées de façon chiffrée. Chaque
        établissement dispose d&apos;un espace strictement isolé : aucun
        utilisateur d&apos;un établissement ne peut accéder aux données d&apos;un
        autre établissement.
      </p>
    ),
  },
  {
    title: '9. Cookies',
    body: (
      <p>
        GestUniv utilise uniquement des cookies techniques nécessaires au
        fonctionnement du service (maintien de la session, préférence de
        thème). Aucun cookie publicitaire ni traceur tiers à des fins
        marketing n&apos;est utilisé.
      </p>
    ),
  },
  {
    title: '10. Contact',
    body: (
      <p>
        Pour toute question relative à cette politique de confidentialité ou
        à l&apos;exercice de vos droits, écrivez-nous à{' '}
        <a href="mailto:kouadioroxanne70@gmail.com" className="text-blue-600 dark:text-orange-400 hover:underline">
          kouadioroxanne70@gmail.com
        </a>
        .
      </p>
    ),
  },
]

export default function ConfidentialitePage() {
  return (
    <main className="bg-white text-zinc-900 dark:bg-black dark:text-white">
      <Navbar />

      <section className="px-4 pt-32 pb-16 md:pt-40">
        <div className="max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-blue-700 border border-blue-300 bg-blue-50 dark:text-orange-400 dark:border-orange-500/30 dark:bg-orange-500/5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            Confidentialité
          </span>
          <h1 className="mt-6 text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white">
            Politique de confidentialité
          </h1>
          <p className="mt-4 text-zinc-600 dark:text-orange-100/60">
            Dernière mise à jour : août 2026. Cette politique explique
            comment GestUniv collecte, utilise et protège les données
            personnelles traitées dans le cadre du service.
          </p>

          <div className="mt-12 flex flex-col gap-10">
            {sections.map((s) => (
              <div key={s.title}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">{s.title}</h2>
                <div className="text-zinc-600 dark:text-orange-100/70 leading-relaxed text-sm md:text-base">
                  {s.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
