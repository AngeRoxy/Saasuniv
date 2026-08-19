# Règles de sécurité Firebase RTDB — documentation

> Le format JSON de `database.rules.json` n'autorise pas les commentaires ; ce
> fichier documente **chaque nœud** et la justification de sa règle.

Rôles réels du codebase (anglais) : `admin_universite`, `teacher`, `student`,
`parent`, `super_admin_plateforme`. (Les libellés français ne servent qu'à
l'affichage — cf. `src/types/member.ts`.)

Expression d'isolation réutilisée partout :
`root.child('users').child(auth.uid).child('universityId').val() === $universityId`
→ « l'appelant appartient bien à cette université ». Le `super_admin_plateforme`
est toujours exempté (accès plateforme).

## `/users/$uid`

| Opération | Règle | Pourquoi |
|---|---|---|
| `.read` | soi-même **ou** super admin | Un utilisateur lit son profil ; le super admin peut tout lire (checklist #4). |
| `.write` | soi-même **ou** super admin | Idem écriture. |
| `role` `.validate` | enum stricte **ET** valeur inchangée si déjà posée (sauf super admin) | **Anti-élévation de privilèges** : empêche un étudiant de réécrire son propre `role` en `super_admin_plateforme` via une requête RTDB directe. Le rôle ne peut être fixé qu'à la création, ou modifié par le super admin. |
| `email` `.validate` | regex email | Format valide (checklist #7). |
| `universityId` `.validate` | inchangé si déjà posé (sauf super admin) | Empêche un membre de se « téléporter » dans une autre université. |

## `/universities` (racine)

- `.read` : super admin uniquement (liste globale des établissements).
- Pas de `.write` racine : la création passe par `$universityId/.write`.

## `/universities/$universityId`

- `.read` : membre de CETTE université **ou** super admin → **isolation inter-université en lecture** (checklist #1). Se propage à tous les enfants.
- `.write` (nœud lui-même) : uniquement à la **création** (`!data.exists()`) par l'admin de cette université ou le super admin → inscription libre-service.

### Champs commerciaux / abonnement
- `plan` : écriture admin (même université) **UNIQUEMENT si `newData.val() === 'trial'`** — préserve le tunnel d'essai libre-service (`initTrial`), mais un admin ne peut plus s'auto-attribuer `standard`/`premium`/`enterprise`. Super admin : toute valeur. `.validate` enum `trial|standard|premium|enterprise`. **Correctif** (risque résiduel #3 de `SECURITY_AUDIT.md`, « facturation auto-déclarative ») : le passage à un plan payant n'est plus possible que via le webhook GeniusPay (SDK Admin, contourne les règles) après confirmation réelle du paiement — voir `/universities/$universityId/abonnementPaiements`.
- `trialEndsAt`, `trialStatus` : écriture admin (même université) ou super admin — toujours écrits côté client par le flux d'essai (`initTrial`/`checkTrialExpired`).
- `convertedAt`, `convertedPlan` : **super admin uniquement** désormais (plus d'écriture admin) — ces champs ne sont plus posés que par le webhook GeniusPay via le SDK Admin (contourne cette règle) au moment d'une conversion payante réelle.

### `/universities/$universityId/abonnementPaiements/$paiementId`  ← **nœud ajouté (paiement GeniusPay)**
- Historique des paiements d'abonnement (à distinguer de `paiements`, qui sont les échéances de scolarité PAR ÉTUDIANT — schéma totalement différent, ne pas confondre).
- **Aucune règle `.write` explicite → écriture refusée par défaut pour tout client authentifié** (admin comme super admin). Volontaire : seules les routes serveur `/api/geniuspay/create-payment` et `/api/geniuspay/webhook` écrivent ce nœud, via le SDK Admin (`src/lib/server/firebase-admin.ts`) qui contourne les règles — un admin ne peut donc jamais forger une entrée « réussi » directement en base.
- `.read` : hérité de `$universityId` (membre de cette université ou super admin) → l'admin peut lire l'historique de sa propre université sans route dédiée.
- `status` (`active|inactive|suspended`) : **super admin uniquement** + `.validate` enum. **Correction** : empêche l'admin d'une université suspendue de se réactiver lui-même.
- `name`, `slug`, `adminUid`, `createdAt` : admin (même université) ou super admin.

### `/members/$memberUid`
- `.write` : super admin ; admin (même université) ; **ou** le membre lui-même, à condition de ne PAS modifier `email`, `filiere`, `niveau`, `matricule`, `role`, `statutScolarite`, `campusId`, `campusIds`, `chargeHoraire`, `filiereObsolete`, `parentUid`, `enfantUids` — et, pour `student`/`parent`, pas non plus `displayName` (checklist #6, Règle 3 — application côté serveur, pas seulement UI).
- `email` `.validate` : regex email. `role` `.validate` : enum stricte.
- **Correctif (audit du 2026-08-19)** : `statutScolarite`, `campusId`, `campusIds`, `chargeHoraire`, `filiereObsolete`, `parentUid`, `enfantUids` manquaient à la liste de comparaison protégeant l'auto-écriture — un membre pouvait donc se les réattribuer lui-même via un appel REST direct (ex. un étudiant en « abandon de scolarité » pouvait remettre `statutScolarite` à `actif` et contourner le blocage de connexion). Corrigé en étendant la même comparaison `newData`/`data`.

### Nœuds administrables (admin même université ou super admin)
`manual_students`, `campus`, `filieres`, `matieres`, `semestres`, `emploi_du_temps`,
`examens`, `paiements`, `config`, `annonces`, `deliberations`.

- `campus` ← **nœud ajouté (multi-campus)** : mêmes lecture/écriture que les autres
  nœuds administrables. La règle métier « un campus avec des filières
  rattachées ne peut pas être supprimé » est appliquée **côté application**
  (`deleteCampus` dans `src/lib/db.ts`), pas dans la règle RTDB — cohérent avec
  le style déjà utilisé pour la justification des absences.

- `examens` : **écriture strictement réservée à l'administration** (admin même université ou super admin) — même règle que `emploi_du_temps`. Contrairement aux absences, **aucune délégation à l'enseignant** : l'enseignant/surveillant ne fait que consulter. Lecture héritée du nœud université (intra-université). Épreuves datées, nœud totalement séparé de l'emploi du temps de cours.

- `config` (ex. `config/seuilAlerte`) : écriture admin (même université) ou super admin ; lecture héritée par tout membre → sert le **seuil d'alerte des absences injustifiées** (RÈGLE 3).

### `absences/$absenceId` (marquage + justification par le créateur enseignant ; admin = lecture + suppression)
- `.write` scindée par opération (grâce à `data.exists()`/`newData.exists()`, chaque absence ayant son propre `$absenceId`) :
  - **Création** (`!data.exists() && newData.exists()`) : `teacher` (même université) uniquement. L'admin n'est **jamais** en classe et ne peut pas savoir qui est réellement présent — il n'a donc plus le droit de créer une absence (retiré de l'UI ET de la règle).
  - **Modification / justification** (`data.exists() && newData.exists()`) : `teacher` **et** `data.child('marqueParUid').val() === auth.uid` — seul l'enseignant qui a lui-même marqué l'absence peut la justifier (motif/référence). L'admin ne peut plus modifier une absence, y compris pour la justifier. Les absences héritées sans `marqueParUid` (créées avant ce champ) ne sont modifiables par personne d'autre que le super admin — échec fermé assumé.
  - **Suppression** (`data.exists() && !newData.exists()`) : `admin_universite` (même université) **ou** `teacher` créateur (`data.child('marqueParUid').val() === auth.uid`) — l'admin corrige une erreur grave, l'enseignant peut retirer une absence qu'il a lui-même mal saisie.
  - `super_admin_plateforme` : toute opération, comme partout ailleurs.

### `appels/$appelId`  ← **nœud ajouté (appel de classe + historique de présence)**
- `$appelId` = `${creneauId}__${date}` (une seule entrée par créneau + date). Contient désormais la liste complète `etudiants: [{ uid, displayName, statut, justifie? }]` en plus des métadonnées (`faitParUid`, `faitParNom`, `updatedAt`) — sert à la fois d'indicateur « appel déjà fait » ET d'historique de présence consultable (`teacher/absences/historique`). Pas de `presents`/`absents` stockés : dérivés de `etudiants` à la lecture (`compterPresences`), pour ne pas dupliquer une donnée qui pourrait diverger de la liste réelle.
- `.write` : `teacher` (même université) ou super admin — **pas de vérification que le créneau appartient bien à CET enseignant** : comme pour `sessions_direct` et l'ancienne conception de `absences`, l'association enseignant↔créneau se fait par **nom** (`Creneau.enseignant`), pas par uid, donc la règle RTDB ne peut pas le vérifier nativement. Risque résiduel assumé, cohérent avec le reste du module emploi du temps. L'UI ne propose que les créneaux de l'enseignant connecté (`c.enseignant === teacherName`).
- `.read` : **aucune règle propre → hérite du `.read` de `$universityId`** (ligne « universities/$universityId » : tout membre de la même université, ou super admin). Ça couvre bien l'enseignant créateur, mais ça ne le limite pas non plus à SES appels : n'importe quel membre de l'université (collègue enseignant, admin, étudiant, parent) peut lire tout `/appels` en connaissant/devinant un chemin. **Même limite RTDB déjà documentée en bas de ce fichier** (« la lecture accordée à `$universityId` se propage à tous les enfants ») — restreindre la lecture au seul créateur est structurellement impossible ici : un `.read` plus permissif à l'ancêtre `$universityId` rend tout `.read` plus restrictif au niveau enfant sans effet. La page `teacher/absences/historique` filtre donc côté client (`a.faitParUid === user.uid`) ; l'isolement réel repose sur l'isolation inter-université (checklist #1), pas sur une isolation par utilisateur au sein d'une même université.

### Notes & moyennes (saisie enseignant)
- `notes` : écriture `teacher` (même université) ou super admin ; `$noteId/note` `.validate` = nombre **0–20** (checklist #7).
- `moyennes` : idem ; `$semestreId/$studentUid` `.validate` = nombre **0–20**.

### `recommandations/$etudiantUid`  ← **nœud ajouté**
- `.write` : même université **et** (soi-même **ou** `admin_universite`/`teacher`), sinon super admin. **Correction** : ce nœud n'avait AUCUNE règle → toute écriture était refusée (fonction IA cassée) et sa structure n'était pas isolée. La règle rétablit la fonction ET garantit l'isolation.

### Ressources & messages
- `ressources` : `teacher`/`admin_universite` (même université) ou super admin.
- `messages` : tout membre de l'université ou super admin.
- `messages/$messageId/fromUid` `.validate` : `newData.val() === auth.uid` — **correctif (audit du 2026-08-19)** : aucune règle ne vérifiait auparavant l'expéditeur, un membre pouvait écrire un message avec le uid d'un AUTRE membre comme `fromUid` (usurpation d'identité aux yeux du destinataire). N'affecte pas `markMessageRead`/`deleteMessage`, qui ne touchent jamais ce champ.

## `/super_admin`
- `.read` / `.write` : `super_admin_plateforme` exclusivement (checklist #5).

## `/loginAttempts/$emailHash`  ← **nœud ajouté (anti brute-force)**
- `.read` : **`true` (public, non authentifié)** — inchangé. Ces compteurs sont lus AVANT toute connexion, quand `auth == null` : impossible de conditionner par un rôle. `$emailHash` = email rendu Firebase-safe (`hashEmailForKey`, cf. `src/lib/db.ts`). Aucune règle au niveau du **parent** `loginAttempts` → on ne peut PAS lister/énumérer l'ensemble des tentatives ; on accède seulement à un hash déjà connu. Donnée sans valeur en lecture (juste un compteur associé à un email déjà connu de l'appelant).
- `.write` : **corrigé (audit du 2026-08-19)** — n'est plus `true` sans condition. Toujours sans `auth` (impossible avant connexion), mais chaque transition de valeur est désormais bornée :
  - **Suppression** (`remove()`, utilisé par `resetLoginAttempts` après succès et par le nettoyage auto de `checkLoginLocked`) : autorisée seulement si le nœud n'a pas de verrou actif (`lockedUntil` null ou déjà expiré). Empêche un attaquant de supprimer le compteur d'une victime pour prolonger son propre brute-force au-delà du verrou.
  - **Écriture** (`attemptsCount`) : ne peut plus être fixée à une valeur arbitraire — uniquement `1` (création, ou reprise après verrou expiré) ou `data.attemptsCount + 1` (incrément strict de 1). Aucune écriture n'est possible tant qu'un verrou actif (non expiré) existe déjà.
  - **`lockedUntil`** : doit être `null`, ou un timestamp strictement futur plafonné à **24h maximum** (`now + 86400000`) — marge sur le verrou applicatif réel de 15 min (`LOGIN_LOCK_DURATION_MS`), mais bloque un verrou forgé « permanent ». Ne peut être posé que lorsque `attemptsCount` atteint `MAX_LOGIN_ATTEMPTS` (5, cf. `src/types/security.ts` — **à garder synchronisé** avec cette valeur codée en dur dans la règle).
  - **`lastAttemptAt`** : doit rester proche de l'heure serveur réelle (`now`, entre -10 min et +5 min) — empêche un horodatage fantaisiste.
- **Faille corrigée** : avant ce correctif, `.write: true` sans aucune borne sur `lockedUntil` permettait à un attaquant non authentifié de poser directement un verrou arbitrairement long (des années) sur l'email de n'importe quelle victime, en un seul appel REST — un déni de service ciblé et persistant, plus grave que le compromis initialement documenté (qui visait juste le compteur normal, pas un verrou forgé). Voir `SECURITY_AUDIT.md`.
- **Risque résiduel assumé** : sans authentification pré-connexion possible, un attaquant peut toujours reproduire l'attaque en envoyant 5 écritures façonnées (incréments de 1, comme un vrai flux d'échecs) plutôt qu'une seule — le verrou reste plafonné à 24h et doit être reposé à chaque expiration, ce qui élève significativement le coût par rapport à l'attaque en un coup d'avant correctif. Firebase Auth (`auth/too-many-requests`) reste la ligne de défense principale contre le brute-force réel des mots de passe ; ce nœud n'est qu'une couche UX supplémentaire.

## Vérifications de la checklist
- ✅ Aucune règle `".read": true` / `".write": true` non conditionnée, **sauf `/loginAttempts/$emailHash.read` (exception anti brute-force documentée ci-dessus — `.write` n'est plus `true` sans condition depuis le 2026-08-19)** (checklist #3).
- ✅ Toutes les règles exigent `auth != null`.
- ⚠️ **Limite RTDB connue** : la lecture accordée à `$universityId` se propage à tous les enfants ; un membre peut donc lire *tous* les nœuds de SON université (y compris les notes/paiements d'autres étudiants). RTDB ne permet pas de restreindre une lecture héritée au niveau enfant. Voir « Risques résiduels » dans `SECURITY_AUDIT.md`.
