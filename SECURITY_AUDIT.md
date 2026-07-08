# Audit de sécurité GestUniv — durcissement production

Date : 2026-07-01 · Portée : règles Firebase RTDB, proxy serveur, Route Handlers.
Contexte : SaaS multi-établissement, une seule RTDB, isolation logique par
`universityId`. Rôles réels (anglais) : `admin_universite`, `teacher`,
`student`, `parent`, `super_admin_plateforme`.

Détail règle par règle : voir [`database.rules.md`](database.rules.md).

---

## 1. Failles trouvées & corrections appliquées

### 🔴 Critique

| # | Faille | Correction |
|---|---|---|
| 1 | **Élévation de privilèges** : `/users/$uid` était écrivable par soi-même sans validation → un `student` pouvait réécrire son propre `role` en `super_admin_plateforme` (ou changer son `universityId`) via une requête RTDB directe, contournant totalement l'UI. | `.validate` sur `role` (enum stricte **+** valeur immuable une fois posée, sauf super admin) et sur `universityId` (immuable, sauf super admin). |
| 2 | **Nœud `recommandations` sans règle** : aucune règle explicite → écritures refusées (fonction IA cassée) et structure non isolée par université. | Règle ajoutée sur `recommandations/$etudiantUid` : même université + propriétaire/staff, sinon super admin. Rétablit la fonction ET l'isolation. |
| 3 | **`/api/send-access-email` ouvert** : tout utilisateur authentifié (même d'une autre université) pouvait POSTer et envoyer des emails à en-tête GestUniv (spam/phishing). Aucun client légitime n'appelle cette route (l'envoi réel passe par un import direct). | Route verrouillée derrière un **secret interne partagé** (`INTERNAL_API_SECRET`, header `x-internal-secret`). Fail-closed : refusée si le secret n'est pas configuré. |

### 🟠 Élevé

| # | Faille | Correction |
|---|---|---|
| 4 | **Réactivation par soi-même** : `status` (`active/suspended`) était écrivable par l'admin → un admin d'université suspendue pouvait se réactiver. `updateUniversityStatus` n'est appelé que par le super admin. | `status` restreint au **super admin** + `.validate` enum. |
| 5 | **Chatbot inter-université** : `/api/chatbot` ne vérifiait pas que `context.universityId` correspondait à l'université réelle de l'appelant. | Vérification de cohérence : `context.universityId === caller.universityId` (sauf super admin), sinon `403`. |
| 6 | **Recommandations croisées** : `/api/recommandations` faisait confiance à `etudiantUid`/`universityId` du body. | Cohérence serveur : appelant de la même université **et** propriétaire (`uid === etudiantUid`) ou `admin`/`teacher`, sinon `403`. + validation des notes 0–20. (La règle RTDB `recommandations` applique la même isolation à l'écriture.) |

### 🟡 Moyen (validation de format / défense en profondeur)

| # | Faille | Correction |
|---|---|---|
| 7 | Pas de validation de format côté serveur/règles. | `.validate` : `email` (regex) sur `/users` et `/members`, `note`/`moyenne` (nombre 0–20), `role` (enum), `plan`/`status` (enum). Route `create-member` : email valide + `displayName` non vide après trim (en plus de l'enum de rôle et de `assertAdminCaller` déjà présents). |
| 8 | `displayName` modifiable par `student`/`parent` sur leur propre nœud membre via écriture directe (Règle 3 appliquée seulement en UI). | Règle `/members/$memberUid` : pour `student`/`parent`, `displayName` doit rester inchangé lors d'une écriture par soi-même (en plus de `email`/`filiere`/`niveau`/`matricule`/`role`). |

### 🔵 Infrastructure — Proxy serveur (Partie 2)

`src/proxy.ts` ne faisait rien (passe-plat). Remplacé par une **garde serveur**
exécutée avant le rendu de `/dashboard/*` :

- **Approche A retenue** (le projet n'a pas `firebase-admin`, cf.
  `src/lib/verify-token.ts`). Cookie httpOnly posé par une nouvelle route
  `POST /api/session` :
  - `gestuniv_session` = idToken Firebase (présence + format JWT vérifiés) ;
  - `gestuniv_role` = rôle lu **côté serveur** depuis `/users/{uid}` (jamais
    depuis le client) → garde de rôle fiable.
- Le proxy : (1) redirige vers `/auth/login` si le cookie de session est
  absent/malformé (élimine le flash de contenu protégé) ; (2) applique une garde
  de rôle (un `student` sur `/dashboard/admin/*` est renvoyé vers son propre
  dashboard).
- Cycle de vie du cookie centralisé dans `AuthContext` via `onIdTokenChanged`
  (connexion, inscription, renouvellement horaire du token, déconnexion). Les
  pages login/register posent le cookie **avant** la navigation (évite un rebond).
- Le proxy Next 16 tourne sur le **runtime Node.js** par défaut (plus d'Edge) —
  aucune config supplémentaire nécessaire.

Fichiers ajoutés/modifiés : `src/proxy.ts`, `src/app/api/session/route.ts`,
`src/lib/session-client.ts`, `src/lib/server/caller.ts`,
`src/context/AuthContext.tsx`, `src/app/auth/login/page.tsx`,
`src/app/auth/register/page.tsx`, `src/app/auth/register-university/page.tsx`,
routes `chatbot` / `recommandations` / `create-member` / `send-access-email`,
`database.rules.json` (+ `database.rules.md`).

Vérifié : `npx tsc --noEmit` passe sans erreur. Aucun flow existant modifié dans
sa logique métier (les corrections ajoutent des gardes, ne réécrivent rien).

---

## 2. Limitations & risques résiduels

1. **Lecture intra-université trop large (priorité haute).**
   La règle `.read` sur `/universities/$universityId` se propage à tous les
   enfants : un membre authentifié peut lire **tous** les nœuds de SA propre
   université (notes, paiements, absences, coordonnées d'autres étudiants) via
   une requête REST directe, même si l'UI ne l'expose pas. RTDB **ne permet pas**
   de révoquer une lecture héritée au niveau enfant.
   *Non corrigé* pour ne pas casser les dashboards qui lisent des collections
   entières (enseignant/admin lisant toutes les notes, étudiant lisant la liste
   des membres pour les noms). **Correctif recommandé** : restructurer en
   sous-arbres par utilisateur (`/notes/{studentUid}/...`) avec `.read`
   conditionnée à `auth.uid === studentUid || rôle staff`, et déplacer les
   grants de lecture au niveau de chaque nœud.

2. **Proxy = contrôle optimiste, pas cryptographique.**
   Sans `firebase-admin`, le proxy vérifie la *présence/format* du cookie, pas la
   signature ni l'expiration du token. Un attaquant peut forger un cookie au bon
   format pour charger la **coquille** d'un dashboard — mais **aucune donnée** ne
   se charge (les lectures RTDB exigent un vrai token). Le rôle, lui, provient du
   serveur et n'est pas falsifiable côté client. Compromis acceptable pour une
   garde anti-flash ; l'autorité reste sur les règles RTDB + Route Handlers.
   **Idéal** : ajouter `firebase-admin` et vérifier le token dans le proxy
   (runtime Node.js déjà par défaut en Next 16).

3. **Facturation auto-déclarative (risque commercial).**
   `plan`/`trialEndsAt`/`trialStatus`/`convertedAt`/`convertedPlan` restent
   écrivables par l'admin (tunnel d'essai/conversion libre-service). Un admin
   technique pourrait forcer `plan = "enterprise"` gratuitement.
   *Laissé en l'état* pour ne pas casser le libre-service (signalé comme demandé).
   **Correctif recommandé** : déplacer ces écritures côté serveur derrière une
   vérification de paiement, puis restreindre ces champs au super admin.

4. **`send-access-email` nécessite `INTERNAL_API_SECRET`.**
   La route HTTP est désormais fail-closed. Si un usage HTTP légitime apparaît,
   configurer `INTERNAL_API_SECRET` et l'envoyer via `x-internal-secret`. Le flux
   de création de compte actuel n'est pas impacté (il appelle `sendAccessEmail()`
   par import direct).

5. **`verifyFirebaseToken` via Identity Toolkit REST** valide le token mais
   ajoute une latence réseau par requête et dépend de la disponibilité de
   `identitytoolkit.googleapis.com`. `firebase-admin` (vérification locale de
   signature) serait plus robuste et moins coûteux.

---

## 3. Checklist avant lancement commercial réel

- [ ] **Ajouter `firebase-admin`** (Admin SDK) : vérification cryptographique des
      tokens dans le proxy + écritures serveur privilégiées sûres (facturation,
      changement de rôle, suspension).
- [ ] **Restructurer les lectures intra-université** (risque résiduel #1) pour
      un vrai cloisonnement au niveau ligne (row-level).
- [ ] **Déplacer la facturation côté serveur** derrière un fournisseur de
      paiement (webhooks signés `/api/webhooks/*`) ; retirer l'écriture `plan`
      côté client.
- [ ] **Rate limiting** sur toutes les routes API (login, chatbot, recommandations,
      create-member, session) — ex. Upstash/Redis ou WAF — contre le
      bruteforce et l'abus des appels IA (coût Anthropic).
- [ ] **Logs d'audit centralisés** (qui a créé/modifié/supprimé quoi, quand) —
      actuellement l'UI « Audit » est fictive ; brancher une collecte réelle
      append-only.
- [ ] **Monitoring & alerting** (erreurs 4xx/5xx, pics d'appels IA, échecs
      d'écriture RTDB, tentatives d'accès de rôle croisé bloquées par le proxy).
- [ ] **Rotation & gestion des secrets** (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`,
      `INTERNAL_API_SECRET`) hors `.env` en clair → coffre (Vault/Secret Manager).
- [ ] **En-têtes de sécurité** (CSP, HSTS, X-Frame-Options, Referrer-Policy) via
      `next.config.ts` `headers()`.
- [ ] **Validation d'entrée exhaustive** (Zod) sur tous les Route Handlers, pas
      seulement les champs critiques.
- [ ] **Tests de sécurité automatisés** : test du proxy
      (`unstable_doesProxyMatch`), tests des règles RTDB avec l'émulateur
      Firebase (matrice rôle × nœud × université).
- [ ] **Conformité RGPD** : politique de rétention, export/suppression des
      données étudiant, consentement, chiffrement au repos documenté.
- [ ] **Sauvegardes RTDB** régulières + procédure de restauration testée.
- [ ] **Revue du plafond du chatbot** (historique, `max_tokens`) et filtrage des
      prompts pour éviter l'exfiltration de contexte.
