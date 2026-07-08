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
- `plan` : écriture admin (même université) ou super admin ; `.validate` enum `trial|standard|premium|enterprise`. ⚠️ **Volontairement laissé écrivable par l'admin** pour préserver le tunnel d'essai libre-service (`initTrial`/`convertTrial`). Risque résiduel documenté dans `SECURITY_AUDIT.md`.
- `trialEndsAt`, `trialStatus`, `convertedAt`, `convertedPlan` : idem (écrits côté client par le flux d'essai).
- `status` (`active|inactive|suspended`) : **super admin uniquement** + `.validate` enum. **Correction** : empêche l'admin d'une université suspendue de se réactiver lui-même.
- `name`, `slug`, `adminUid`, `createdAt` : admin (même université) ou super admin.

### `/members/$memberUid`
- `.write` : super admin ; admin (même université) ; **ou** le membre lui-même, à condition de ne PAS modifier `email`, `filiere`, `niveau`, `matricule`, `role` — et, pour `student`/`parent`, pas non plus `displayName` (checklist #6, Règle 3 — application côté serveur, pas seulement UI).
- `email` `.validate` : regex email. `role` `.validate` : enum stricte.

### Nœuds administrables (admin même université ou super admin)
`manual_students`, `filieres`, `matieres`, `semestres`, `emploi_du_temps`,
`examens`, `paiements`, `config`, `annonces`, `deliberations`.

- `examens` : **écriture strictement réservée à l'administration** (admin même université ou super admin) — même règle que `emploi_du_temps`. Contrairement aux absences, **aucune délégation à l'enseignant** : l'enseignant/surveillant ne fait que consulter. Lecture héritée du nœud université (intra-université). Épreuves datées, nœud totalement séparé de l'emploi du temps de cours.

- `config` (ex. `config/seuilAlerte`) : écriture admin (même université) ou super admin ; lecture héritée par tout membre → sert le **seuil d'alerte des absences injustifiées** (RÈGLE 3).

### `absences` (marquage enseignant + admin)
- `.write` : `admin_universite`/`teacher` (même université) ou super admin. L'enseignant peut **marquer** une absence pour ses cours ; **seul l'admin justifie** — ce dernier point est appliqué **côté application** (l'UI enseignant n'offre pas la justification), la règle RTDB restant au grain du rôle. **Risque résiduel assumé** cohérent avec la lecture intra-université déjà documentée. Voir `SECURITY_AUDIT.md`.

### Notes & moyennes (saisie enseignant)
- `notes` : écriture `teacher` (même université) ou super admin ; `$noteId/note` `.validate` = nombre **0–20** (checklist #7).
- `moyennes` : idem ; `$semestreId/$studentUid` `.validate` = nombre **0–20**.

### `recommandations/$etudiantUid`  ← **nœud ajouté**
- `.write` : même université **et** (soi-même **ou** `admin_universite`/`teacher`), sinon super admin. **Correction** : ce nœud n'avait AUCUNE règle → toute écriture était refusée (fonction IA cassée) et sa structure n'était pas isolée. La règle rétablit la fonction ET garantit l'isolation.

### Ressources & messages
- `ressources` : `teacher`/`admin_universite` (même université) ou super admin.
- `messages` : tout membre de l'université ou super admin.

## `/super_admin`
- `.read` / `.write` : `super_admin_plateforme` exclusivement (checklist #5).

## `/loginAttempts/$emailHash`  ← **nœud ajouté (anti brute-force)**
- `.read` / `.write` : **`true` (public, non authentifié)** — **exception assumée**. Ces compteurs sont lus/écrits AVANT toute connexion, quand `auth == null` : impossible de conditionner par un rôle. `$emailHash` = email rendu Firebase-safe (`hashEmailForKey`, cf. `src/lib/db.ts`).
- Aucune règle `.read`/`.write` au niveau du **parent** `loginAttempts` → on ne peut PAS lister/énumérer l'ensemble des tentatives ; on accède seulement à un hash déjà connu.
- `.validate` : structure verrouillée (`attemptsCount` ≥ 0, `lastAttemptAt`/`lockedUntil` numériques ou null, `email` string, `$other: false`).
- **Risque résiduel** : n'importe qui peut réinitialiser ou poser le compteur d'un email donné (dénoter/verrouiller un login ciblé). Impact limité — données sans valeur, verrou 15 min max ; Firebase Auth (`auth/too-many-requests`) reste une seconde ligne de défense côté fournisseur. Voir `SECURITY_AUDIT.md`.

## Vérifications de la checklist
- ✅ Aucune règle `".read": true` / `".write": true` non conditionnée, **sauf `/loginAttempts` (exception anti brute-force documentée ci-dessus)** (checklist #3).
- ✅ Toutes les règles exigent `auth != null`.
- ⚠️ **Limite RTDB connue** : la lecture accordée à `$universityId` se propage à tous les enfants ; un membre peut donc lire *tous* les nœuds de SON université (y compris les notes/paiements d'autres étudiants). RTDB ne permet pas de restreindre une lecture héritée au niveau enfant. Voir « Risques résiduels » dans `SECURITY_AUDIT.md`.
