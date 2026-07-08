# GestUniv — État réel du projet (25 juin 2026)

---

## Vue d'ensemble

GestUniv est une application web SaaS multi-établissement de gestion universitaire, destinée aux établissements francophones africains. Elle tourne sur **Next.js 16** (App Router, Turbopack), **TypeScript**, **Tailwind CSS v4**, **shadcn/ui**, et **Firebase** (Auth + Realtime Database).

Le projet est complet côté interface et architecture, mais toutes les données affichées dans les dashboards sont encore **fictives (mock)**. Seuls l'authentification Firebase et la gestion manuelle des étudiants sont branchés sur de vraies données.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 16.2.9 — App Router, Turbopack |
| Langage | TypeScript 5 |
| Style | Tailwind CSS v4 + tw-animate-css |
| Composants UI | shadcn/ui + lucide-react |
| Animations | Framer Motion 12 |
| 3D | @splinetool/react-spline |
| Backend / Auth | Firebase Auth + Firebase Realtime Database |
| Fonts | Geist Sans + Geist Mono (Google Fonts via Next.js) |

---

## Architecture des routes

```
/                            → Landing page publique
/auth/login                  → Connexion (email + Google)
/auth/register               → Inscription membre (étudiant/enseignant/parent/super-admin)
/auth/register-university    → Création d'une université (tunnel 3 étapes)
/dashboard/admin/*           → Espace administrateur université
/dashboard/teacher/*         → Espace enseignant
/dashboard/student/*         → Espace étudiant
/dashboard/parent/*          → Espace parent/tuteur
/dashboard/super-admin/*     → Espace super-administrateur plateforme
```

**Middleware** (`src/proxy.ts`) : passe-plat côté serveur, sans garde réelle. La protection des routes est déléguée entièrement côté client via `AuthContext` dans chaque `layout.tsx`.

---

## Ce qui existe et fonctionne

### 1. Landing page (`/`)

Page marketing complète, thème noir/orange/ambre :

- **Navbar** fixe avec scroll-blur, liens ancres, menu mobile animé (Framer Motion), boutons Connexion / Essai gratuit.
- **Hero animé** (`animated-shader-hero.tsx`) : fond WebGL shader cosmique interactif orange/ambre, badge de confiance, headline en deux lignes, sous-titre, deux CTA principaux.
- **Barre de stats** : 4 métriques fictives (120+ universités, 85 000+ étudiants, 99.9% uptime, <48h onboarding).
- **Section Fonctionnalités** (8 cartes) : gestion étudiants, e-learning, notes, multi-rôles, finance, sécurité, notifications, audit RGPD.
- **Section 3D Spline** : scène 3D interactive chargée depuis `prod.spline.design`, avec spotlight Framer Motion, liste de features à gauche.
- **Section 5 dashboards** : présentation des 5 espaces (Admin, Enseignant, Étudiant, Parent, Super Admin) avec icônes animées.
- **Section Tarifs** : 3 plans (Standard 49 000 FCFA, Premium 149 000 FCFA, Enterprise sur devis), toggle mensuel/annuel (-20%), mise en avant du plan Premium.
- **Témoignages** : 3 avis fictifs de directeurs d'universités africaines, avec étoiles.
- **Section Sécurité** : 4 badges (multi-établissement, AES-256, audit RGPD, SLA 99.9%).
- **FAQ** : 4 questions/réponses déroulantes (accordion).
- **CTA final** : bloc d'appel à l'action centré avec deux boutons.
- **Footer** : logo, copyright 2026, liens Confidentialité / CGU / Contact (non fonctionnels).

### 2. Thème et design system

- Thème par défaut : **orange/ambre sur fond noir**.
- Thème alternatif **bleu** disponible via classe `html.theme-blue` — remplace toutes les couleurs orange/ambre/yellow par des équivalents bleu/indigo/violet via CSS custom properties.
- Mode clair/sombre géré par Tailwind (`dark:` variant) avec variables OKLCH.
- `ThemeToggle` disponible globalement dans le layout racine.
- Animations CSS globales : `fade-in-down`, `fade-in-up`, `gradient-shift`, `float`, `pulse-glow`, `spotlight`.

### 3. Authentification Firebase

Fichier : `src/lib/auth.ts`

Fonctions opérationnelles et branchées sur Firebase :

- `loginWithEmail(email, password)` — connexion email/mot de passe
- `loginWithGoogle()` — connexion OAuth Google (popup)
- `registerAdmin(email, password, universityId, displayName)` — crée le compte Firebase Auth + enregistre le profil dans `/users/{uid}` avec rôle `admin_universite`. En cas d'échec DB, rollback (suppression du compte Auth créé).
- `registerMember(email, password, universityId, displayName, role)` — crée le compte + écrit dans `/users/{uid}` ET `/universities/{universityId}/members/{uid}` en transaction atomique. Même rollback en cas d'échec.
- `logout()` — déconnexion Firebase
- `getCurrentUser()` — retourne l'utilisateur courant

**Page `/auth/login`** :
- Formulaire email + mot de passe
- Bouton Google OAuth
- Gestion d'erreurs Firebase traduite en français (11 codes d'erreur mappés)
- Après connexion : récupère le profil Firebase DB avec timeout 4s, puis redirige vers le dashboard selon le rôle

**Page `/auth/register`** :
- 4 rôles sélectionnables : Enseignant, Étudiant, Parent, Super Admin
- Tunnel 3 étapes : sélection rôle → infos personnelles → code université (sauf super admin)
- Barre de progression
- Validations côté client avant chaque étape
- Redirection vers le dashboard approprié après inscription

**Page `/auth/register-university`** :
- Tunnel 3 étapes : infos établissement → compte admin → plan tarifaire
- Étape 1 : nom université, slug (auto-généré + éditable, validé), pays, type d'établissement (7 options)
- Étape 2 : prénom, nom, email, mot de passe, confirmation
- Étape 3 : choix du plan (Standard / Premium / Enterprise)
- À la soumission : `registerAdmin()` + `createUniversity()` → redirige vers `/dashboard/admin`
- Rollback Firebase si erreur DB

### 4. Base de données Firebase (Realtime Database)

Fichier : `src/lib/db.ts`

**Structure des données** :
```
/users/{uid}
  email, displayName, role, universityId, createdAt

/universities/{universityId}
  name, slug, plan, createdAt, adminUid, status (active/inactive/suspended)
  /members/{uid}
    displayName, email, role, createdAt, filiere?, niveau?, telephone?, matricule?, statut?
  /manual_students/{key}
    displayName, email, role, telephone?, filiere?, niveau?, matricule?, statut?, createdAt
```

**Fonctions disponibles** :
- `getUserProfile(uid)` — lecture profil utilisateur
- `createUniversity(id, data)` — création université
- `getUniversity(id)` — lecture université
- `getUniversityMembers(id, role?)` — liste membres filtrée par rôle
- `updateMemberProfile(id, uid, data)` — mise à jour partielle membre
- `addManualStudent / updateManualStudent / removeManualStudent / getManualStudents` — CRUD étudiants manuels (sans compte Firebase Auth)
- `getAllUniversities()` — liste toutes les universités (super admin)
- `updateUniversityStatus(id, status)` — change statut université

**Règles de sécurité** (`database.rules.json`) :
- `/users/{uid}` : lecture/écriture uniquement par l'utilisateur lui-même
- `/universities/{id}` : lecture/écriture par les membres de cette université OU super_admin_plateforme
- `/super_admin/*` : accès exclusif super_admin_plateforme
- Toutes les règles nécessitent `auth != null`

### 5. AuthContext (état global d'authentification)

Fichier : `src/context/AuthContext.tsx`

- Écoute `onAuthStateChanged` Firebase
- Charge automatiquement le `UserProfile` depuis la DB à chaque changement de session
- Expose `{ user, profile, loading }` à toute l'application via `useAuth()`
- Chaque layout de dashboard redirige vers `/auth/login` si `!loading && !user`

---

## Dashboards — ce qui existe

### Dashboard Admin (`/dashboard/admin/*`)

**Layout** (`admin/layout.tsx`) :
- Sidebar fixe 256px avec logo GestUniv, navigation 12 liens, université courante, bouton déconnexion
- Topbar sticky avec titre de page dynamique et avatar utilisateur
- Protection : redirige vers `/auth/login` si non connecté
- Liens sidebar : Tableau de bord, Étudiants, Enseignants, Cours, Notes, Finances, Import, Notifications, Audit, Paramètres, Clôture (rouge), Mon profil

**Pages Admin existantes** :

`/dashboard/admin` — Tableau de bord
- KPI cards : total étudiants, enseignants, cours actifs, paiements en attente (données fictives)
- Alertes dismissables : paiements en retard, absences excessives
- Flux d'activité récente (6 événements fictifs)
- Actions rapides : 4 liens vers modules principaux

`/dashboard/admin/students` — Gestion des étudiants
- Chargement réel depuis Firebase (membres Auth + étudiants manuels)
- Fallback sur 15 étudiants fictifs si Firebase vide ou erreur
- Tableau paginé (10 par page) avec recherche full-text (nom/prénom/email/filière/matricule)
- Filtre par filière
- Badge "Inscrit" pour les étudiants avec compte Firebase Auth
- Actions : ajouter (modal), modifier (modal), supprimer (dialog de confirmation), toggle statut Actif/Inactif
- Matricule auto-généré au format `STU-{année}-{n°}` 
- Persistance Firebase : écriture dans `manual_students` ou `members` selon le type

`/dashboard/admin/grades` — Saisie des notes
- Sélecteurs filière (5), cours (variable selon filière), semestre
- Tableau de 10 étudiants par filière (données fictives)
- Notes éditables inline (champ numérique 0-20, step 0.25)
- Mentions calculées en temps réel (TB/B/AB/P/F avec codes couleur)
- Note rouge si < 10
- Commentaire enseignant éditable inline
- Moyenne promotion calculée en temps réel
- Bouton "Tout enregistrer" → toast de confirmation (pas de persistance Firebase réelle)
- Bouton "Exporter PDF" (pas fonctionnel)

`/dashboard/admin/import` — Import CSV/Excel
- Onglets : étudiants / enseignants
- Zone drag & drop (ou click) pour sélection fichier .csv/.xlsx
- Barre de progression simulée à l'import (10% toutes les 150ms)
- Message de succès
- Aperçu du modèle CSV téléchargeable
- Historique des imports fictifs
- Pas de traitement réel du fichier côté serveur

`/dashboard/admin/teachers` — Gestion enseignants (page existante, non lue en détail)
`/dashboard/admin/courses` — Gestion des cours
`/dashboard/admin/finances` — Gestion financière
`/dashboard/admin/notifications` — Notifications
`/dashboard/admin/audit` — Audit Logs
`/dashboard/admin/settings` — Paramètres
`/dashboard/admin/closing` — Clôture annuelle
`/dashboard/admin/profile` — Profil administrateur

### Dashboard Étudiant (`/dashboard/student/*`)

**Layout** : sidebar + topbar, protection auth, logout

`/dashboard/student` — Tableau de bord
- Carte de bienvenue avec nom/université/email Firebase réels
- KPI cards (données fictives) : moyenne générale 14.5/20, crédits validés 78/120, 8 cours, 1 paiement en attente
- Tableau des dernières notes (fictif) : 4 matières avec note, coefficient, mention colorée
- Liste des prochains cours (fictif) : 3 cours avec jour, horaire, salle

Pages supplémentaires : `/courses`, `/grades`, `/payments`, `/schedule`, `/profile`

### Dashboard Enseignant (`/dashboard/teacher/*`)

Pages : page principale, `/classes`, `/grades`, `/messages`, `/resources`, `/profile`

### Dashboard Parent (`/dashboard/parent/*`)

Pages : page principale, `/absences`, `/grades`, `/messages`, `/payments`, `/profile`

### Dashboard Super Admin (`/dashboard/super-admin/*`)

**Layout** : sidebar + topbar dédiés, protection auth

`/dashboard/super-admin` — Vue d'ensemble plateforme
- KPI cards (fictifs) : 12 universités actives, MRR 1 470 000 FCFA, 8 420 étudiants, 94% renouvellement
- Tableau des universités (5 entrées fictives) avec statuts : Actif, Essai, Suspendu
- Boutons Suspendre/Réactiver avec `confirm()` natif (état local uniquement, non persisté)
- Panneau d'alertes (3 alertes fictives) : paiement en retard, quota stockage, nouvelle inscription

Pages supplémentaires : `/universities`, `/revenue`, `/settings`

---

## Ce qui manque / n'est pas encore branché

### Données fictives dans les dashboards
- KPIs admin, enseignant, étudiant, parent : tous hardcodés, aucun fetch Firebase
- Flux d'activité récente : hardcodé
- Notes : mock local, "Tout enregistrer" ne persiste pas en DB
- Cours, finances, absences, emplois du temps, messages : tous fictifs
- Import CSV : parsing et écriture réels non implémentés
- Suspension d'université : état local, non écrit en Firebase
- Audit logs : UI fictive, aucune collecte réelle

### Fonctionnalités absentes
- Notifications push/email réelles
- Génération de bulletins PDF
- Calcul de moyennes pondérées depuis la DB
- Module messagerie interne
- Gestion des absences avec seuils
- Paiements en ligne
- Clôture d'année académique (archivage)
- SSO / LDAP
- Application mobile
- Sous-domaine personnalisé par université
- API REST / webhooks

### Guard middleware côté serveur
`src/proxy.ts` ne fait aucune vérification — toute la protection est client-side via `useEffect` dans les layouts. Un utilisateur non connecté voit un flash de chargement avant la redirection.

### ThemeToggle
Le composant existe dans le layout global mais son implémentation interne n'a pas été vérifiée dans ce relevé.

---

## Fichiers sources principaux

| Fichier | Rôle |
|---|---|
| `src/app/layout.tsx` | Layout racine : fonts Geist, AuthProvider, ThemeToggle |
| `src/app/globals.css` | Design tokens OKLCH, animations CSS, thème bleu alternatif |
| `src/app/page.tsx` | Entrée `/` → LandingPage |
| `src/components/landing-page.tsx` | Page marketing complète |
| `src/components/ui/navbar.tsx` | Navbar fixe avec scroll + mobile |
| `src/components/ui/animated-shader-hero.tsx` | Hero WebGL |
| `src/components/ui/splite.tsx` | Wrapper Spline 3D |
| `src/components/ui/spotlight.tsx` | Effet spotlight Framer Motion |
| `src/components/ui/theme-toggle.tsx` | Toggle clair/sombre/bleu |
| `src/lib/firebase.ts` | Init Firebase (config via `.env.local`) |
| `src/lib/auth.ts` | Fonctions Auth Firebase |
| `src/lib/db.ts` | Fonctions CRUD Firebase Realtime DB |
| `src/context/AuthContext.tsx` | Context React session utilisateur |
| `src/proxy.ts` | Middleware Next.js (passe-plat) |
| `database.rules.json` | Règles sécurité Firebase RTDB |
| `src/app/auth/login/page.tsx` | Connexion |
| `src/app/auth/register/page.tsx` | Inscription membre |
| `src/app/auth/register-university/page.tsx` | Création université |
| `src/app/dashboard/admin/layout.tsx` | Layout sidebar admin |
| `src/app/dashboard/admin/page.tsx` | Tableau de bord admin |
| `src/app/dashboard/admin/students/page.tsx` | CRUD étudiants (branché Firebase) |
| `src/app/dashboard/admin/grades/page.tsx` | Saisie notes (mock) |
| `src/app/dashboard/admin/import/page.tsx` | Import CSV (simulation) |
| `src/app/dashboard/super-admin/page.tsx` | Vue plateforme (mock) |
| `src/app/dashboard/student/page.tsx` | Dashboard étudiant (mock) |

---

## Variables d'environnement requises

Toutes dans `.env.local` (jamais committées) :

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_DATABASE_URL
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
```

---

## Commandes

```bash
npm run dev      # Serveur de développement (port 3000, Turbopack)
npm run build    # Build de production (41 routes statiques + middleware)
npm run start    # Serveur de production
npm run lint     # ESLint
```
