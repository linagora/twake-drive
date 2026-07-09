# Stratégie de test — Cas de sélection Scribe

**Créé :** 2026-06-17
**Worktree :** `cozy-drive-selection-tests` / branche `test/selection-cases-harness`
**Spec de référence :** `.planning/SELECTION-CASES.md` (matrices A/B/C, §4bis fusions) · sonde : `.planning/probe-merged-cells.js`
**Statut :** stratégie figée — à dérouler en phases GSD

---

## 1. Objectif & valeur

Vérifier — **automatiquement à terme, manuellement d'abord** — que chaque configuration de sélection de `SELECTION-CASES.md` produit le **comportement attendu** pour les actions Scribe `Insérer` et `Remplacer`, formatage riche et tableaux/fusions compris.

**Valeur cœur :** transformer la colonne « État » des matrices (✅ / ⚠️ / ❌) en un corpus de tests **exécutable et non-régressif**, qui sert *à la fois* de filet de sécurité et de **backlog de bugs exécutable** (chaque ⚠️ = un test rouge qui passera vert à la correction).

## 2. Périmètre

**Dans le périmètre**
- Les cas A0–A8 (paragraphes), T1–T13 (tableaux, fusions incluses), Matrice C (axe contenu).
- Les deux actions : `Insérer`, `Remplacer`.
- Vérification de l'effet **structurel** (styles, runs, retours à la ligne, structure de table, fusions) **et** de la **post-sélection**.

**Hors périmètre**
- La **qualité LLM** : les tests injectent une **fixture déterministe** (ex. `"XXX"`), jamais un appel réseau. On teste sélection→extraction→injection, pas le modèle.
- Le rendu pixel-exact (police, zoom) — non comportemental.
- Cas non supportés actés : tableaux imbriqués (T13), cellules fusionnées en écriture au-delà du spécifié (T12 = lecture/round-trip seulement).

## 3. Architecture : deux couches

Ne pas piloter OO pour ce qu'une fonction pure sait tester.

### Couche A — Unitaire (rapide, sans OO)
Tout ce qui est transformation pure JS, testable en Node/Jest avec fixtures :
- `tableCellMarkers.js` (parsing `[CELL:r,c]`, `validateTableCounts`, aperçu GFM) ;
- pipeline markdown↔structure, règles d'espacement (`&nbsp;`, CommonMark — A2/A4) ;
- `scribeResponse.js` (contrat `{discussion, fragments}`, repli — v3.1) ;
- limites de nature « chaîne » : L#5 (couleur), partie de L#6.

→ Couvre une grande moitié des assertions **sans** OO. Priorité haute, coût bas.

### Couche B — Intégration (OO piloté, oracle golden)
Ce qui dépend réellement d'OO : **extraction selon la sélection** et **effet structurel de l'injection** (c'est là que vivent les fusions T12, L#1, L#3, la post-sélection L#2). Pilotée via la boucle de la §5-§6.

## 4. L'oracle : modèle sémantique + sélection (pas de pixels)

**Principe fondateur :** OO *rend* à partir du modèle. Donc **égalité de modèle ⇒ égalité visuelle**, à deux exceptions près :
1. la **sélection/curseur** après l'action n'est **pas** dans le `.docx` sauvé → la capturer **séparément** via `GetRangeBySelect()` (la sonde sait le lire) ;
2. quelques effets purement-rendu (police, zoom) — exclus, hors comportement.

→ **Oracle = `{ model, selection }`** capturé juste après l'action. Couvre tout, **post-sélection comprise**, sans jamais comparer de pixels.

**Représentation :**
- **primaire : modèle JSON sémantique** (¶→runs→{bold,italic,underline,strike,code,link…}, tables→cellules→{texte, merge}) — lisible, assertable, stable aux versions, **réutilise la sonde** ;
- **backstop optionnel : `.docx` normalisé** (OOXML, strip `w:rsid`/IDs) pour un « rien d'autre n'a bougé » à 100 % ;
- **screenshot** : **aide humaine** au moment de bénir le golden, **jamais** juge automatique.

## 5. Pilotage d'entrée

| Étape | Mécanisme | Faisabilité |
|---|---|---|
| Charger doc source + reset (undo/reload) | scriptable | ✅ |
| Poser sélection A0–A8, T1–T3 | **API OO** (`GetRange().Select()`, positions char comme `selectByPositions`) | ✅ |
| Poser sélection **T4–T6** (texte + tableau à cheval) | l'API ne sait pas (limite **L#2**) → **drag souris** | ❌ → **manuel** |
| Déclencher action déterministe (fixture, sans LLM) | hook dev → `buildAndInject(md, mode)` | ✅ |
| Capturer `{model, selection}` | sonde `callCommand` | ✅ |

**Cross-origin :** `evaluate_script` (Chrome MCP, page top) **ne peut pas** atteindre `Asc.plugin` (iframe OO cross-origin). → canal **postMessage** : la page top envoie `{setSelection, injectFixture, dumpState}` au plugin, qui répond en JSON. Le plugin `postToAncestors()` existe déjà. ⇒ **~3 handlers dev-only (flag-gated)** à ajouter au plugin.

## 6. Production des goldens — humain-pilote d'abord

> La valeur irréductible est la **passe de revue humaine**. L'automatisation rejeu/compare optimise la *récurrence*, pas la *première couverture*.

**Phase 1 (manuelle, prioritaire) — un outil de capture+revue (IHM) :**
- liste de cas générée depuis le **CSV** (la matrice) : id, description, comportement attendu, statut ;
- par cas : **avant** | **après** | **attendu** | **valider / invalider + commentaire** ;
- l'humain fait l'action **à la main dans OO** (souris) → dodge les T4–T6 et teste tôt la **fidélité de capture** ;
- **capture systématique des DEUX représentations** : screenshot (jugement humain *maintenant*) **+** modèle JSON `{model, selection}` (compare machine *plus tard*) — sinon il faudra **tout refaire** le jour de l'automatisation ;
- sortie = corpus béni : un dossier par cas `{ before, after(screenshot+model), expected, verdict, comment }`.

**Politique de blessing :**
- cas ✅ : capturer → **vérifier visuellement une fois** → geler le golden ;
- cas ⚠️ : **ne pas** geler la sortie actuelle (buggée) → golden **écrit à la main** = sortie *désirée* → test **xfail** jusqu'à correction.

**Phase 2 (automatisation rejeu/compare) — différée, déclencheur clair :** à activer **au passage en mode correction des ⚠️** (besoin de re-vérifier sans tout refaire). La comparaison `{model,selection}` normalisés → deep-diff est la partie la plus simple ; seul vrai travail = la **normalisation** (strip IDs volatils).

## 7. Corpus & matrice CSV (source de vérité)

- **Source de vérité = un CSV** (cellules avec marques md autorisées) contenant les champs **exécutables** : `id`, `selection`, `mode`, `fixture`, `expectedRef`, `status`, + cellules de prose (`expectedInsert`, `expectedReplace`, `notes`). **Pas de split** : tout le tableau dans ce seul fichier.
- **Génération à sens unique CSV ⇒ MD** : les vues markdown du tableau (dans `SELECTION-CASES.md` ou ailleurs) sont **générées** depuis le CSV ; jamais éditées à la main. La **prose-spec** (modèle, notation, définitions L#1–L#6, §4bis) reste dans `SELECTION-CASES.md` comme glossaire référencé par les cellules.
- **Édition humaine** : le CSV s'ouvre comme une grille (Excel/LibreOffice) → ergonomie tableur **et** diffs git texte (≠ `.xlsx` binaire, qui casserait provenance/delta).
- **Provenance** : chaque run de capture **embarque un snapshot** du CSV (`cases.snapshot.csv`) → un bundle ancien reste interprétable contre *sa* matrice.
- **Delta** : `id` stable + **hash** de la définition exécutable → l'outil compare nouvelle vs ancienne matrice et ne re-sollicite l'humain que pour le **delta** (ajouté / modifié→re-bénir / inchangé→sauté / supprimé→archivé).

## 8. Requirements (à tracer en phases)

- [ ] **TEST-U-01** : couche unitaire Jest couvrant marqueurs de cellules, espacement, contrat — sans OO.
- [ ] **TEST-MTX-01** : matrice de cas en **CSV** source de vérité + générateur CSV⇒MD + schéma des champs exécutables.
- [ ] **TEST-PROBE-01** : ~3 hooks dev flag-gated dans le plugin (`setSelection`, `injectFixture`, `dumpState`) via postMessage.
- [ ] **TEST-ORACLE-01** : sérialiseur `{model, selection}` + normalisation déterministe (strip IDs) + deep-diff lisible.
- [ ] **TEST-IHM-01** : outil de capture+revue piloté par le CSV (avant/après/attendu/verdict+commentaire), double capture screenshot+modèle, blessing & xfail.
- [ ] **TEST-PROV-01** : snapshot CSV + delta par id/hash entre runs.
- [ ] **TEST-REPLAY-01** *(phase 2, différé)* : rejeu auto + comparaison vs golden, déclenché au passage en mode fix.

## 9. Roadmap proposée (phases GSD)

| Phase | But | Requirements |
|-------|-----|--------------|
| **T-01** Couche unitaire | Jest sur fonctions pures (marqueurs, espacement, contrat) — valeur immédiate, zéro OO | TEST-U-01 |
| **T-02** Matrice CSV + générateur | CSV source de vérité, schéma, CSV⇒MD, provenance/delta | TEST-MTX-01, TEST-PROV-01 |
| **T-03** Spike oracle (dé-risquage) | hooks dev + sérialiseur+normalisation prouvés de bout en bout sur **1 cas** | TEST-PROBE-01, TEST-ORACLE-01 |
| **T-04** IHM capture+revue (prod manuelle) | produire le corpus béni sur tous les cas pilotables ; T4–T6 manuels | TEST-IHM-01 |
| **T-05** *(différé)* Rejeu + compare auto | non-régression automatique, au passage en mode fix | TEST-REPLAY-01 |

**Ordre & gate :** T-01 et T-02 en parallèle (indépendants d'OO) ; **gate de dé-risquage à T-03** (si l'oracle ne sort pas un diff propre et stable, on réajuste avant T-04) ; T-05 explicitement reporté.

## 10. Risques & questions ouvertes

- **Couverture API de sélection** (T-03) : poser par API tous les `@start/@space/@mid/@end` et les blocs de cellules T2 — à confirmer (le code le suggère via `selectByPositions`).
- **Canal postMessage dev** : aller-retour `evaluate_script` ↔ plugin ↔ JSON fiable/synchronisable.
- **Reset déterministe** entre cas (reconstruire la table fixture par API + undo/reload).
- **Normalisation OOXML/modèle** : stabilité entre 2 exécutions (le vrai coût de l'oracle).
- **T4–T6** : restent manuels tant qu'on n'investit pas dans le drag canvas.
- **Coordination OO** : `oo-dev` monte le plugin depuis le checkout *partagé* → re-pointer le mount (`oo-dev-setup.sh`) le jour où le harness lance OO, en se coordonnant avec la session v3.1.

## 11. Décisions verrouillées (récap)

1. **Deux couches** : unitaire (pur JS) + intégration (golden). Ne pas piloter OO pour du pur.
2. **Oracle = `{model, selection}`** sémantique ; visual = f(model) ; **pas de pixels** comme juge.
3. **Fixture déterministe** (pas de LLM) pour isoler sélection+injection.
4. **Production manuelle humain-pilote d'abord** ; **double capture** screenshot+modèle ; rejeu/compare **différé** au mode fix.
5. **Goldens ⚠️ écrits à la main** (désirés), **xfail** jusqu'à correction — pas de gel du bug.
6. **CSV = source de vérité** de la matrice (marques md OK) ; **CSV ⇒ MD** à sens unique ; prose-spec dans `SELECTION-CASES.md`.
7. **Provenance** : snapshot CSV par run ; **delta** par id stable + hash.
8. **T4–T6 = manuels** (limite L#2 de l'API de sélection).
9. **Chantier isolé** dans le worktree `cozy-drive-selection-tests` / `test/selection-cases-harness`.

---

*Stratégie figée 2026-06-17. Prochaine étape GSD : dérouler T-01/T-02, puis le spike T-03.*
