# GestUniv — État du projet (14 juillet 2026, après la passe de 8 correctifs)

---

## Résumé en une ligne

L'application est **fonctionnelle de bout en bout** sur les 5 rôles, les données viennent réellement
de Firebase, et **il ne reste plus aucun faux succès**. Ce qui reste : **des fonctionnalités vendues
dans les plans mais non implémentées** (PDF, emails, API, multi-campus) et **le paiement réel**.

## ⚠️ À faire avant / après le prochain déploiement

1. **Redéployer les règles RTDB** — `firebase deploy --only database`
   (validation 0-20 ajoutée sur `interro1` / `interro2` / `examen` ; sans ça les évaluations sont rejetées).
   **Indépendant de Storage, toujours requis.**
2. Décider si l'import CSV reste inclus dans le plan Standard (cf. « Écarts plans » plus bas).

### Firebase Storage — DÉSACTIVÉ (plan Blaze indisponible)

Storage n'a **pas pu être activé** (le plan Blaze requis n'accepte pas les cartes prépayées de la
cliente). Tout ce qui en dépend est **neutralisé proprement derrière un flag**, sans rien supprimer :

- Flag unique `STORAGE_ENABLED = false` dans [storage.ts](src/lib/storage.ts).
- Upload de fichiers (ressources) et photos de profil : **masqués**. Le champ lien URL des ressources
  et l'avatar par défaut (initiales/icône) restent pleinement fonctionnels.
- `storage.rules` et `firebase.json` conservés mais **non déployés** (inoffensifs tant qu'inutilisés).

**Réactivation quand un moyen de paiement Blaze sera disponible** : Console → Blaze → activer Storage,
puis passer `STORAGE_ENABLED` à `true` (une seule ligne), puis `firebase deploy --only storage`.
Procédure détaillée en tête de `storage.rules`.

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

## Fait dans la passe du 14 juillet (8 correctifs)

| # | Correctif | Effet |
|---|---|---|
| 1 | Erreur ESLint `react-hooks/refs` | `npm run lint` repasse à **0 erreur** |
| 2 | Faux succès de `/admin/settings` | Frais + calendrier **réellement persistés** (`config/frais`, `config/calendrier`) ; fausse clôture remplacée par un lien vers `/admin/closing` |
| 3 | `ComingSoon` périmés des accueils | Vrais KPI étudiant / enseignant / parent (`useStudentSummary`, `useTeacherSummary`, `KpiCard`) |
| 4 | Fuite de fonctionnalité payante | `PlanGate` sur la messagerie interne et l'import CSV |
| 5 | Firebase Storage | Upload de fichiers pour les ressources — **codé puis désactivé** (flag, Blaze indispo, voir plus haut) |
| 6 | Notes | 3 évaluations par matière : (I1 + I2 + 2×E) / 4 |
| 7 | Photos de profil | Upload avatar codé puis **désactivé** avec le même flag ; avatar par défaut (initiales) partout |
| 8 | Import CSV enseignants | Colonne `filieres` multi-valuée (séparateur `;`), résolution par nom |

Bonus trouvés en chemin et corrigés : le bouton « Sauvegarder » du sous-domaine n'avait **aucun handler**,
et le lien « Changer de plan » pointait vers `/pricing`, **route inexistante** (404).

---

## Ce qu'il reste à faire

### 1. Écarts entre les plans vendus et le code

Fonctionnalités **annoncées dans la grille tarifaire** (landing + `/admin/billing`) mais **inexistantes** :

- `exportPDF` et `bulletinsPDF` — aucune génération de PDF nulle part (probablement le plus attendu des clients) ;
- `notificationsEmail` — les annonces sont in-app uniquement, aucun email n'est envoyé ;
- `multiCampus`, `apiAccess`, `supportPrioritaire` — aucun code correspondant ;
- `sousDomainePerso` — la valeur est désormais **persistée** (`config/sousDomaine`) mais **pas exploitée** :
  aucun routage par sous-domaine n'existe.

Pour chacune : la construire, ou la retirer de la grille tarifaire. Vendre ce qui n'existe pas est le
risque commercial le plus concret du produit aujourd'hui.

**Décision tarifaire en attente** : `importCSV` vaut `true` sur **les trois plans**, Standard compris.
Le `PlanGate` est posé mais laisse donc passer. Si l'import doit devenir payant, basculer le booléen
dans [plans.ts](src/lib/plans.ts) — c'est un choix commercial, pas un correctif (il retirerait une
fonctionnalité à des clients qui l'ont déjà).

### 2. Paiement réel

La conversion de plan dans `/admin/billing` est **simulée** (le dialogue le dit explicitement).
Aucun prestataire intégré — pour le marché visé, plutôt CinetPay / Wave / Orange Money que Stripe.

### 3. Modules encore vides

- [teacher/classes](src/app/dashboard/teacher/classes/page.tsx) — `ComingSoon` (l'affectation
  enseignant↔classe existe pourtant via les créneaux : `useTeacherSummary` la calcule déjà).
- [super-admin/settings](src/app/dashboard/super-admin/settings/page.tsx) — `ComingSoon`.

### 4. Limite de sécurité assumée (Storage)

Les règles Firebase Storage **ne peuvent pas lire la RTDB** : « écriture réservée aux enseignants de
cette université » n'est pas exprimable sans custom claim, donc sans `firebase-admin`. Les règles
vérifient ce qui l'est (authentification, propriétaire d'un avatar, type MIME, taille) ; le contrôle
de rôle reste applicatif. Détail et voie de sortie en tête de [storage.rules](storage.rules).
Même nature de risque résiduel que le proxy optimiste (cf. [SECURITY_AUDIT.md](SECURITY_AUDIT.md)).

### 5. Qualité

- `npm run lint` : **0 erreur**, 4 avertissements (variables inutilisées, dépendances de hooks).
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
3. **`react-hooks` casse le build.** Deux règles mordent régulièrement : pas de `setState` synchrone
   dans un effet (`set-state-in-effect`), et pas de hook après un retour anticipé (`rules-of-hooks`).
4. **`note.note` est la note de la matière**, désormais dérivée des 3 évaluations. Ne pas la
   contourner : `getNoteRetenue()` reste la source unique (rattrapage prioritaire).
5. Un module « déjà là mais différent du cahier des charges » se complète, il ne se réécrit pas.
6. Jamais de `catch {}` silencieux ni de mise à jour locale optimiste sur une écriture Firebase.
