import type { Metadata } from 'next'
import { Navbar } from '@/components/ui/navbar'
import { Footer } from '@/components/ui/footer'
import { FileText } from 'lucide-react'

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation — GestUniv",
  description: "Conditions régissant l'utilisation de la plateforme GestUniv par les établissements clients.",
}

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: '1. Objet',
    body: (
      <p>
        Les présentes Conditions Générales d&apos;Utilisation (« CGU »)
        régissent l&apos;accès et l&apos;utilisation de la plateforme
        GestUniv, un service en ligne (SaaS) de gestion académique et
        administrative destiné aux établissements d&apos;enseignement
        supérieur. Le client contractuel est l&apos;établissement qui
        souscrit un abonnement ; les présentes CGU s&apos;appliquent
        également, dans la mesure applicable, aux membres qu&apos;il inscrit
        sur la plateforme (administration, enseignants, étudiants, parents).
      </p>
    ),
  },
  {
    title: '2. Acceptation des conditions',
    body: (
      <p>
        La création d&apos;un compte université ou l&apos;utilisation de la
        plateforme vaut acceptation pleine et entière des présentes CGU. Si
        l&apos;établissement n&apos;accepte pas ces conditions, il ne doit pas
        utiliser le service.
      </p>
    ),
  },
  {
    title: '3. Description du service',
    body: (
      <>
        <p>GestUniv propose notamment les fonctionnalités suivantes :</p>
        <ul className="list-disc pl-5 mt-3 space-y-1.5">
          <li>Gestion des étudiants, enseignants, parents et filières ;</li>
          <li>Emploi du temps, cours en ligne et ressources pédagogiques ;</li>
          <li>Saisie des notes, calcul des moyennes et génération de bulletins ;</li>
          <li>Suivi des absences et des paiements de scolarité ;</li>
          <li>Messagerie interne, notifications et journal des activités.</li>
        </ul>
        <p className="mt-3">
          La disponibilité de certaines fonctionnalités dépend du plan
          d&apos;abonnement souscrit (voir la grille tarifaire).
        </p>
      </>
    ),
  },
  {
    title: '4. Compte et responsabilités',
    body: (
      <p>
        L&apos;établissement est seul responsable de la création et de la
        gestion des comptes de ses membres (étudiants, enseignants, parents),
        ainsi que de la bonne utilisation de la plateforme par ces derniers.
        Chaque utilisateur est responsable de la confidentialité de ses
        identifiants de connexion. Toute activité réalisée depuis un compte
        est présumée effectuée par son titulaire.
      </p>
    ),
  },
  {
    title: '5. Abonnement et facturation',
    body: (
      <p>
        L&apos;accès au service est soumis à un abonnement payant, dont les
        tarifs et limites sont détaillés sur la page tarifs de GestUniv. Un
        essai gratuit de 30 jours peut être proposé selon le plan choisi.
        L&apos;abonnement peut être résilié par l&apos;établissement à tout
        moment ; la résiliation prend effet à la fin de la période de
        facturation en cours, sans remboursement au prorata sauf accord
        contraire.
      </p>
    ),
  },
  {
    title: '6. Propriété intellectuelle',
    body: (
      <p>
        GestUniv demeure seul propriétaire du logiciel, de son code, de son
        design et de sa marque. Aucune disposition des présentes CGU ne
        transfère à l&apos;établissement un quelconque droit de propriété
        intellectuelle sur la plateforme. L&apos;établissement conserve
        l&apos;entière propriété des données qu&apos;il saisit ou importe
        dans GestUniv (étudiants, notes, documents, etc.).
      </p>
    ),
  },
  {
    title: '7. Disponibilité du service',
    body: (
      <p>
        GestUniv met en œuvre les moyens raisonnables (« best effort ») pour
        assurer une disponibilité continue du service. Des interruptions
        peuvent néanmoins survenir, notamment pour maintenance, mise à jour
        ou en cas d&apos;incident technique indépendant de notre volonté.
        Aucune garantie de disponibilité à 100 % n&apos;est offerte en dehors
        d&apos;un engagement de niveau de service (SLA) formalisé
        contractuellement avec l&apos;établissement.
      </p>
    ),
  },
  {
    title: '8. Limitation de responsabilité',
    body: (
      <p>
        GestUniv ne saurait être tenu responsable des dommages indirects
        résultant de l&apos;utilisation ou de l&apos;impossibilité
        d&apos;utiliser le service, tels que perte de données consécutive à
        une mauvaise utilisation, interruption d&apos;activité ou perte
        d&apos;opportunité. La responsabilité de GestUniv, si elle est
        engagée, est limitée aux montants effectivement versés par
        l&apos;établissement au titre de son abonnement au cours des douze
        derniers mois.
      </p>
    ),
  },
  {
    title: '9. Résiliation',
    body: (
      <p>
        L&apos;établissement peut résilier son abonnement à tout moment
        depuis son espace d&apos;administration ou en contactant GestUniv.
        GestUniv se réserve le droit de suspendre ou résilier l&apos;accès
        d&apos;un établissement en cas de non-paiement ou d&apos;utilisation
        manifestement contraire aux présentes CGU, après notification
        préalable lorsque cela est raisonnablement possible.
      </p>
    ),
  },
  {
    title: '10. Droit applicable',
    body: (
      <p>
        Les présentes CGU sont soumises au droit ivoirien. Tout litige relatif
        à leur interprétation ou à leur exécution relève de la compétence des
        juridictions d&apos;Abidjan, Côte d&apos;Ivoire, à défaut de
        règlement amiable.
      </p>
    ),
  },
  {
    title: '11. Contact',
    body: (
      <p>
        Pour toute question relative aux présentes CGU, écrivez-nous à{' '}
        <a href="mailto:kouadioroxanne70@gmail.com" className="text-blue-600 dark:text-orange-400 hover:underline">
          kouadioroxanne70@gmail.com
        </a>
        .
      </p>
    ),
  },
]

export default function CguPage() {
  return (
    <main className="bg-white text-zinc-900 dark:bg-black dark:text-white">
      <Navbar />

      <section className="px-4 pt-32 pb-16 md:pt-40">
        <div className="max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-blue-700 border border-blue-300 bg-blue-50 dark:text-orange-400 dark:border-orange-500/30 dark:bg-orange-500/5 rounded-full">
            <FileText className="w-3.5 h-3.5" />
            Conditions générales
          </span>
          <h1 className="mt-6 text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white">
            Conditions générales d&apos;utilisation
          </h1>
          <p className="mt-4 text-zinc-600 dark:text-orange-100/60">
            Dernière mise à jour : août 2026. Ces conditions s&apos;appliquent
            à tout établissement utilisant la plateforme GestUniv.
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
