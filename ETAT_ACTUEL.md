# État actuel de GestUniv

Date de rédaction : 2026-08-03. Basé sur une lecture directe du code
(`src/app/dashboard/**`, `src/lib/db.ts`, `src/lib/storage.ts`,
`SECURITY_AUDIT.md`) — pas uniquement sur l'historique de mémoire, qui
contenait des informations datées (30 jours) et en partie dépassées.

Stack : Next.js 16 (App Router) + Firebase (Auth + Realtime Database) + shadcn
+ Tailwind v4. SaaS multi-établissement, isolation logique par
`universityId` dans une RTDB unique. 5 rôles : `admin_universite`, `teacher`,
`student`, `parent`, `super_admin_plateforme`.

---

## 1. Ce qui fonctionne (persistance Firebase réelle)

Quasiment tous les modules métier sont construits et branchés sur de vraies
données — le chantier de retrait des données fictives (juin 2026) est
terminé et de nombreux modules ont été ajoutés depuis.

### Identité / structure
- Étudiants, enseignants, parents (CRUD complet, import CSV)
- Filières, matières, semestres
- Profils (les 4 rôles, `useAuth` + `updateOwnProfile`)
- Abandon de scolarité et réorientation en cours d'année (étudiants)
- **Multi-campus** (Phases 1-4, terminé) : une université peut gérer
  plusieurs campus/sites. `campusId` obligatoire sur filière/étudiant
  (unique) et enseignant (plusieurs possibles), sur créneau et examen.
  Migration douce idempotente (`migrerVersMultiCampus`) crée un « Campus
  principal » et backfille tout l'historique (filières, membres, créneaux,
  examens). Sélecteur de campus dans l'UI admin (filières, étudiants,
  enseignants, emploi du temps, examens, import CSV) uniquement si
  l'université en compte plusieurs — transparent et sans changement visuel
  sinon. Détection de conflits d'emploi du temps/examens : la SALLE (et le
  groupe filière/niveau) reste bornée PAR CAMPUS (une salle homonyme sur 2
  campus n'est plus un faux conflit), mais l'ENSEIGNANT/SURVEILLANT est
  vérifié sur TOUS les campus — une personne physique ne peut pas être à
  deux endroits en même temps (bug corrigé après test : l'ancienne version
  bornait aussi ce cas par campus, à tort).
  Règle RTDB `filieres/$filiereId/campusId` valide que le campus référencé
  existe réellement ; `/api/create-member` fait de même pour les membres.
  Non gouverné par le plan tarifaire : le flag `multiCampus` de
  `plans.ts` (Enterprise uniquement) n'est câblé nulle part comme garde
  d'accès — la fonctionnalité est utilisable sur tous les plans.

### Pédagogie
- **Emploi du temps** : créneaux (filière/niveau/semestre · jour · heure ·
  matière · salle · enseignant), vue par rôle (admin création, teacher/
  student/parent consultation), remplacement ponctuel d'enseignant,
  annulation ponctuelle (jour férié/grève/imprévu), ancrage sur la semaine
  réelle
- **Examens** : nœud séparé de l'emploi du temps, détection de conflits
  (salle/personne à date précise)
- **Notes** : saisie enseignant, lecture admin (lecture seule)/étudiant/
  parent, moyenne (I1+I2+2×E)/4, distinction « en attente » vs 0/20,
  **rattrapage** (extension additive), **redoublement** (parcours annuel,
  progression de niveau conditionnelle)
- **Clôture de semestre** : moyennes calculées, décisions Admis/Redoublant/
  Diplômé, délibération
- **Cours en ligne** : visioconférence Jitsi (seul flux temps réel `onValue`
  de l'app), assignation enseignant via créneaux
- **Ressources pédagogiques** : liens gérés par l'enseignant, consultés par
  l'étudiant (pas d'upload binaire, cf. §3 Storage)
- **Mes classes (enseignant)** : vue lecture seule agrégée depuis les
  créneaux

### Vie administrative
- **Absences** : saisie, seuil d'alerte configurable, consultation par rôle
- **Finances/paiements** : CRUD, statut « en retard » dérivé
- **Notifications/annonces** : diffusion admin, consultation 3 rôles
- **Messages** : envoi/réception, marquage lu, suppression
- **Audit** : journal d'activité agrégé (membres, annonces, paiements,
  absences, ressources, créneaux) — pas d'instrumentation dédiée des
  mutations
- **Import CSV** : étudiants/enseignants

### Multi-établissement (super-admin plateforme)
- Dashboard KPIs réels (universités, étudiants, MRR/conversion calculés)
- Gestion universités (suspendre/réactiver réel)
- Page Revenus (dérivée de `getAllUniversities` + config des plans)
- Page Paramètres (compte + à-propos, périmètre volontairement réduit)

### Autres
- Chatbot avec contexte de données réelles (lecture REST + idToken appelant,
  isolation par université vérifiée côté serveur)
- Thème clair/sombre, accent bleu (palette remappée dans `globals.css`)
- Garde de session/rôle sur `/dashboard/*` via cookie httpOnly posé par
  `POST /api/session` (pas de flash de contenu protégé)

---

## 2. Fonctionnalités absentes ou volontairement désactivées

- **Firebase Storage désactivé** (`STORAGE_ENABLED = false` dans
  `src/lib/storage.ts`) — plan Blaze indisponible. Concerné : avatar upload,
  upload de fichiers dans les ressources pédagogiques. Réactivation prévue
  en une ligne, code déjà écrit et intact.
- **Facturation self-service non vérifiée côté paiement** : `plan`,
  `trialEndsAt`, `trialStatus`, etc. restent modifiables par l'admin
  d'université sans passage par un vrai fournisseur de paiement (risque
  commercial documenté, accepté sciemment — voir `SECURITY_AUDIT.md` §2.3).
- **Pas de modèle "classe" formel** — les regroupements (classes,
  assignations enseignant) se déduisent par correspondance de **nom** sur
  les créneaux d'emploi du temps, pas par référence stricte (id). Fonctionne
  mais fragile si un nom de matière/enseignant est renommé sans cascade
  (une cascade de suppression existe pour les cas de suppression, pas de
  renommage).
- **Catalogue de cours admin** (`admin/courses`) : construit mais sans
  fiction — à vérifier si toute la persistance nécessaire est bien reliée
  (le module existe, contrairement à l'état "non persisté" décrit dans une
  mémoire antérieure — à reconfirmer si besoin d'un usage précis).

---

## 3. Limitations de sécurité connues (acceptées, documentées)

Voir `SECURITY_AUDIT.md` pour le détail. Résumé des risques résiduels
volontaires :

1. **Lecture intra-université trop large** (priorité haute, non corrigée) :
   la règle `.read` sur `/universities/$universityId` cascade à tous les
   enfants — un membre authentifié peut lire toutes les données de SA
   propre université via une requête REST directe (notes, paiements,
   coordonnées d'autrui), même si l'UI ne l'expose pas. RTDB ne permet pas
   de révoquer une lecture héritée au niveau enfant ; correctif recommandé :
   restructurer en sous-arbres par utilisateur.
2. **Proxy = contrôle optimiste, pas cryptographique** : pas de
   `firebase-admin`, donc le cookie de session est vérifié en présence/
   format, pas en signature. Le rôle vient du serveur (non falsifiable),
   mais un attaquant pourrait charger la coquille d'un dashboard sans
   données réelles (les lectures RTDB exigent un vrai token).
3. **Facturation auto-déclarative** (cf. §2 ci-dessus).
4. **`send-access-email`** fail-closed derrière `INTERNAL_API_SECRET`,
   nécessite configuration si un usage HTTP externe apparaît.

---

## 4. Dette technique / points de vigilance connus

- **Toute nouvelle collection RTDB écrite côté client doit recevoir sa
  propre règle `.write`** dans `database.rules.json` — un `.write` parent
  ne peut pas être restreint plus bas, et l'absence de règle bloque
  silencieusement l'écriture. Plusieurs modules récents (rattrapage,
  redoublement, remplacement/annulation créneaux) ont nécessité un
  redéploiement de règles.
- **Correspondance par nom** (matière/enseignant) plutôt que par id dans
  plusieurs modules (créneaux, absences, classes) — la cascade de
  suppression gère les cas de suppression d'entité mais pas le renommage.
- **Next.js 16** a des ruptures de compatibilité par rapport aux
  connaissances générales du modèle (cf. `AGENTS.md`) — toujours vérifier
  `node_modules/next/dist/docs/` avant d'écrire du code touchant aux
  conventions Next (routing, runtime, etc.).
- Pièges lint récurrents Next 16 : `set-state-in-effect`/`purity` cassent
  `next build` → pattern de fix = effet inline en IIFE + flag `active`.
- **Messagerie interne non cloisonnée par campus** : `MessagesView` propose
  TOUS les étudiants/enseignants/parents de l'université comme contacts,
  sans jamais avoir filtré par filière ni par campus (comportement
  préexistant au multi-campus, pas une régression) — un étudiant du campus
  A peut contacter n'importe qui du campus B. Accepté tel quel pour
  l'instant (audit Phase 4 du multi-campus) ; à trancher si un cloisonnement
  par campus devient un besoin produit.
- **`plans.ts.features.multiCampus`** (Enterprise uniquement) n'est câblé
  nulle part comme garde d'accès (`PlanGate`/`hasFeature`) : la
  fonctionnalité multi-campus est en réalité disponible sur tous les
  plans. Décision produit à prendre : soit ajouter un vrai `PlanGate`,
  soit aligner `multiCampus: true` sur les plans où elle doit être vendue.

---

## 5. Sources

Ce document synthétise :
- Lecture directe de `src/app/dashboard/**/page.tsx` (comptage et inspection
  des usages de `ComingSoon` — confirmé comme repli d'état vide, pas comme
  placeholder de page entière, sauf mention contraire ci-dessus)
- `SECURITY_AUDIT.md`
- `src/lib/storage.ts`
- Historique git (`git log`) des 15 derniers commits
- Mémoire de session (recoupée avec le code, certaines entrées dataient de
  juin 2026 et sous-estimaient l'avancement réel — ce document les met à
  jour)
