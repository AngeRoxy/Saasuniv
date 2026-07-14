import Link from 'next/link'
import { Info, Building2, ArrowRight, LogIn } from 'lucide-react'

// ─── /auth/register — plus AUCUNE création de compte en libre-service ─────────
//
// SÉCURITÉ (PROMPT 04) : cette page ne permet plus de créer de rôle privilégié.
// Auparavant elle proposait « super_admin_plateforme » à l'inscription publique,
// ce qui laissait n'importe quel visiteur s'octroyer un accès total à TOUTES les
// universités clientes — faille catastrophique désormais fermée.
//
// Les seules voies de création de compte sont :
//   • par l'administration de l'université (Étudiant / Enseignant / Parent) ;
//   • via la création d'un nouvel établissement (/auth/register-university),
//     qui crée un admin scopé à UNE SEULE université.
//   • le compte super_admin de la plateforme a été amorcé une seule fois via une
//     route de bootstrap temporaire, depuis SUPPRIMÉE (jamais en libre-service ;
//     verrou définitif : /bootstrap/superAdminCreated dans les règles Firebase).
export default function RegisterPage() {
  return (
    <div className="bg-white dark:bg-white/5 border border-orange-500/20 rounded-2xl p-8 shadow-lg shadow-zinc-300/40 dark:shadow-none w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Créer un compte</h1>
        <p className="text-zinc-600 dark:text-orange-200/60 text-sm mt-1">
          Comment obtenir vos accès à GestUniv
        </p>
      </div>

      {/* Message informatif principal */}
      <div className="flex gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
        <Info size={18} className="text-blue-600 dark:text-orange-400 shrink-0 mt-0.5" />
        <p className="text-sm text-zinc-700 dark:text-orange-200/70 leading-relaxed">
          Les comptes sont créés soit par votre <strong className="text-blue-700 dark:text-orange-300">université</strong>{' '}
          (contactez votre administration pour obtenir vos identifiants),
          soit via la <strong className="text-blue-700 dark:text-orange-300">création d&apos;un nouvel établissement</strong>.
        </p>
      </div>

      {/* Voie 1 — membre d'une université existante */}
      <div className="mt-4 rounded-xl border border-orange-500/20 bg-white dark:bg-white/5 p-4">
        <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center mb-3">
          <LogIn size={18} className="text-blue-600 dark:text-orange-400" />
        </div>
        <p className="text-zinc-900 dark:text-white font-semibold text-sm">Vous êtes étudiant, enseignant ou parent&nbsp;?</p>
        <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
          Votre compte est créé par l&apos;administration de votre université. Une fois
          vos identifiants reçus par email, connectez-vous directement.
        </p>
        <Link
          href="/auth/login"
          className="mt-3 inline-flex items-center gap-1.5 text-blue-600 dark:text-orange-400 hover:text-blue-900 dark:hover:text-orange-300 text-sm font-medium transition-colors"
        >
          Aller à la connexion
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Voie 2 — créer une nouvelle université */}
      <div className="mt-3 rounded-xl border border-orange-500/20 bg-white dark:bg-white/5 p-4">
        <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center mb-3">
          <Building2 size={18} className="text-blue-600 dark:text-orange-400" />
        </div>
        <p className="text-zinc-900 dark:text-white font-semibold text-sm">Vous représentez un nouvel établissement&nbsp;?</p>
        <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
          Créez votre université sur GestUniv en libre-service. Vous deviendrez
          l&apos;administrateur de cet établissement.
        </p>
        <Link
          href="/auth/register-university"
          className="mt-3 inline-flex items-center gap-1.5 text-blue-600 dark:text-orange-400 hover:text-blue-900 dark:hover:text-orange-300 text-sm font-medium transition-colors"
        >
          Créer mon université
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-sm">
        <p className="text-zinc-600 dark:text-orange-200/60">
          Déjà un compte ?{' '}
          <Link href="/auth/login" className="text-blue-600 dark:text-orange-400 hover:text-blue-900 dark:hover:text-orange-300 font-medium transition-colors">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
