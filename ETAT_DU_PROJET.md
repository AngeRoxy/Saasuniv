# GestUniv — État du projet (14 juillet 2026)

> Ce document remplace la version du 25 juin, devenue fausse : elle décrivait des dashboards
> « tout en mock » alors que la quasi-totalité des modules est désormais branchée sur Firebase,
> et mentionnait des composants (Spline 3D, hero WebGL) qui n'existent plus.

---

## Résumé en une ligne

L'application est **fonctionnelle de bout en bout** sur les 5 rôles : les données affichées viennent
réellement de Firebase. Ce qui reste tient en trois familles : **quelques faux succès résiduels**
(3 `alert()` dans les paramètres admin), **des fonctionnalités vendues dans les plans mais non
implémentées** (PDF, emails, API, multi-campus), et **le paiement réel**.

---

## Stack

| Couche | Technologie |
|---|---|
| Framework | Next.js **16.2.9** (App Router, Turbopack, `proxy.ts` — ex-middleware) |
| UI | React 19.2, Tailwind CSS v4, shadcn/ui + `@base-ui/react`, lucide-react |
| Animation | Framer Motion 12 |
| Backend | Firebase 12 — Auth + Realtime Database (**pas de firebase-admin**, cf. sécurité) |
| IA | API Anthropic (chatbot + recommandations), côté serveur uniquement |
| Emails | Resend |
| Visio | Jitsi (`jitsi-video-call.tsx`) |

**Volumétrie** : 54 pages de dashboard, 6 route handlers, `src/lib/db.ts` ≈ 2 050 lignes (~90 fonctions).

### État de la CI locale

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ propre |
| `npm run build` | ✅ passe (toutes les routes prérendues) |
| `npm run lint` | ❌ **1 erreur** — voir « Reste à faire » |

---

## Architecture de sécurité (état réel)

Trois couches, aucune ne dépend de `firebase-admin` (indisponible dans l'environnement) :

1. **`src/proxy.ts`** — garde *optimiste* sur `/dashboard/*` : lit deux cookies httpOnly
   (`gestuniv_session` = idToken, `gestuniv_role` = rôle lu **côté serveur** dans `/users/{uid}`
   par `/api/session`). Il vérifie la présence et le format JWT, pas la signature. Son rôle est
   d'éliminer le flash de contenu protégé et de bloquer les accès de rôle croisés par URL directe.
2. **Route handlers** — `verifyFirebaseToken()` via l'API REST Identity Toolkit (vérification réelle).
3. **Règles RTDB** (`database.rules.json`) — isolation stricte par `universityId`. C'est ici que
   se joue la sécurité des données.

Le super-admin est verrouillé : la route `/bootstrap` a été supprimée après amorçage et le drapeau
`/bootstrap/superAdminCreated=true` empêche toute nouvelle création. Détail complet et risques
résiduels assumés dans [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

⚠️ **Les règles RTDB doivent être déployées manuellement** (`firebase deploy --only database`) —
plusieurs modules récents (absences, examens, rattrapage, parcours, sessions_direct) en dépendent.

---

## Ce qui est fait et branché sur Firebase

### Authentification & cycle de vie
- Connexion email/mot de passe + Google, mot de passe oublié, confirmation de réinitialisation.
- Inscription membre (étudiant / enseignant / parent — le rôle super-admin est neutralisé).
- Création d'université (tunnel 3 étapes) avec ouverture automatique de la **période d'essai**.
- Garde « première connexion » (`premiere-connexion-guard.tsx`), verrouillage après échecs de
  connexion répétés (`recordFailedLoginAttempt` / `checkLoginLocked`).
- Création de membres par l'admin via `/api/create-member` + envoi de l'email d'accès (Resend).
- Changement d'email d'un membre par l'admin via `/api/admin-update-email`.

### Admin (20 pages)
Étudiants, enseignants, parents, filières (+ matières et crédits), semestres, emploi du temps
(créneaux + détection de conflits), examens (+ conflits salle/personne à date précise), consultation
des notes, absences (+ seuil d'alerte configurable), finances/paiements, annonces, journal d'audit
(agrégat réel des écritures, réservé au plan Premium), import CSV (parsing réel + création de comptes),
facturation/plans, clôture d'année (délibération, redoublement, progression de niveau), paramètres, profil.

### Enseignant (12 pages)
Saisie des notes + **rattrapage** (`getNoteRetenue` = source unique), moyennes, absences, examens
assignés, emploi du temps, ressources, messagerie, annonces, **cours en ligne (visio Jitsi)**, profil.

### Étudiant (10 pages) & Parent (9 pages)
Notes, absences, paiements, examens, emploi du temps, annonces, profil. L'étudiant a en plus les cours
en ligne ; le parent voit ses enfants rattachés (`syncParentEnfants`) et dispose de la messagerie.

### Super-admin (4 pages)
Tableau de bord à KPI réels (étudiants, MRR, taux de conversion, alertes), liste des universités
(suspendre/réactiver réellement persisté), revenus (MRR calculé depuis les plans réels).

### Plans, essai et IA
- `src/lib/plans.ts` = **source de vérité unique** des tarifs et feature flags.
- `usePlan` / `PlanGate` / `useTrial` / `TrialBanner`, limites appliquées sur étudiants, enseignants
  et filières.
- Chatbot IA (gate `chatbotIA`) et recommandations IA (gate `recommandationsIA`), clé Anthropic
  serveur-only.

---

## Ce qu'il reste à faire

### 1. Bloquants — faux succès encore en place

| Endroit | Problème |
|---|---|
| [settings/page.tsx:99](src/app/dashboard/admin/settings/page.tsx#L99) | `handleSaveFrais` → `alert()`, **rien n'est écrit en base** |
| [settings/page.tsx:100](src/app/dashboard/admin/settings/page.tsx#L100) | `handleSaveCalendrier` → idem |
| [settings/page.tsx:102-107](src/app/dashboard/admin/settings/page.tsx#L102-L107) | `handleCloture` → annonce une clôture qui n'a pas lieu (le vrai module est `/admin/closing`) |

C'est le chantier identifié de longue date : ces trois boutons mentent à l'utilisateur. Le reste de la
page (informations générales) est correctement persisté via `updateUniversity`.

### 2. Incohérence visible : les pages d'accueil des rôles sont périmées

`student/page.tsx`, `teacher/page.tsx` et `parent/page.tsx` affichent encore un bloc `ComingSoon`
« Notes, absences et paiements… ce module n'est pas encore connecté » — **alors que ces modules sont
branchés et accessibles depuis la sidebar**. L'utilisateur lit un message qui contredit ce qu'il voit
juste à côté. Il faut remplacer ces `ComingSoon` par de vrais KPI (moyenne, absences, prochain cours,
solde), les données étant déjà toutes disponibles dans `db.ts`.

### 3. Écarts entre les plans vendus et le code

Fonctionnalités **annoncées dans la grille tarifaire** (landing + `/admin/billing`) mais **inexistantes** :

- `exportPDF` et `bulletinsPDF` — aucune génération de PDF nulle part ;
- `notificationsEmail` — les annonces sont in-app uniquement, aucun email n'est envoyé ;
- `multiCampus`, `apiAccess`, `supportPrioritaire` — aucun code correspondant ;
- `sousDomainePerso` — le `PlanGate` existe dans les paramètres, mais la valeur saisie n'est pas exploitée.

Inversement, **deux fonctionnalités payantes ne sont pas protégées** : la messagerie interne
(`messagerieInterne`, Premium) et l'import CSV (`importCSV`) sont accessibles sans vérification de plan.
Un client Standard y accède alors qu'il ne les a pas achetées.

### 4. Modules encore vides

- [teacher/classes](src/app/dashboard/teacher/classes/page.tsx) — `ComingSoon` (l'affectation
  enseignant↔classe existe pourtant via les créneaux).
- [super-admin/settings](src/app/dashboard/super-admin/settings/page.tsx) — `ComingSoon`.
- **Ressources enseignant** : uniquement des **liens URL** saisis à la main. Pas d'upload de fichier
  (Firebase Storage n'est pas branché).

### 5. Paiement réel

La conversion de plan dans `/admin/billing` est **simulée** (le dialogue le dit explicitement).
Il n'y a aucun prestataire de paiement intégré — pour le marché visé, ce sera vraisemblablement
CinetPay / Wave / Orange Money plutôt que Stripe.

### 6. Qualité

- **1 erreur ESLint** qui fait échouer `npm run lint` :
  [video-demo-modal.tsx:17](src/components/ui/video-demo-modal.tsx#L17) — écriture dans
  `onCloseRef.current` pendant le rendu (règle `react-hooks/refs`). Le build passe malgré tout, mais
  cette famille de règles a déjà cassé `next build` sur ce projet : à corriger (déplacer l'affectation
  dans un `useEffect`).
- 5 avertissements (variables inutilisées, dépendances de hooks).
- **Aucun test, aucune CI.**

---

## Variables d'environnement

```
ANTHROPIC_API_KEY            # chatbot + recommandations (serveur)
RESEND_API_KEY               # emails d'accès
INTERNAL_API_SECRET          # protège /api/send-access-email
NEXT_PUBLIC_FIREBASE_*       # 8 clés client (API_KEY, AUTH_DOMAIN, DATABASE_URL, PROJECT_ID,
                             #  STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID, MEASUREMENT_ID)
```

---

## Pièges connus (à lire avant de toucher au code)

1. **Les classes `orange-*` / `amber-*` rendent du BLEU.** La palette est remappée dans
   `globals.css` — ne jamais faire de rechercher/remplacer sur les noms de couleur.
2. **Next.js 16 ≠ Next.js que vous connaissez.** Consulter `node_modules/next/dist/docs/` avant
   d'écrire du code (cf. `AGENTS.md`). Le middleware s'appelle `proxy.ts`.
3. Un module « déjà là mais différent du cahier des charges » se complète, il ne se réécrit pas.
4. Jamais de `catch {}` silencieux ni de mise à jour locale optimiste sur une écriture Firebase.

---

## Ordre de traitement suggéré

1. Corriger l'erreur ESLint (5 min, débloque `npm run lint`).
2. Supprimer les 3 `alert()` de `/admin/settings` — persister frais et calendrier, retirer la
   fausse clôture (le vrai module existe déjà).
3. Remplacer les `ComingSoon` des accueils étudiant / enseignant / parent par de vrais KPI.
4. Gater `messagerieInterne` et `importCSV` (fuite de fonctionnalités payantes).
5. Décider, pour chaque feature vendue non implémentée : la construire ou la retirer de la grille
   tarifaire. Les bulletins PDF sont probablement le plus attendu par les clients.
6. Intégrer un paiement réel.
