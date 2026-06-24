# T-04 — Revue des bundles de capture (log d'avancement)

**Créé :** 2026-06-23 · **Worktree :** `cozy-drive-selection-tests` / `test/selection-cases-harness`

## But

Revue humaine-pilote des bundles capturés sous `corpus/<CAS>/<mode>/`. Pour chaque
bundle : confronter le comportement **capturé** au comportement **attendu**
(`.planning/SELECTION-CASES.md` §3, lignes 62-73), décider d'un **verdict**, et
**tracer explicitement** tout ¶ vide / espace ajouté — l'ajout de lignes vides et
d'espaces **fait partie de la spécification** (décision Ben 2026-06-23), donc chaque
occurrence doit être statuée *attendu* ou *pas attendu*, pas seulement constatée.

## Protocole (par bundle, ordre A0→A4, `insert` puis `replace`)

1. Claude présente : cas, spec de sélection, attendu (matrice), résultat (texte) + ouvre `before.png` / `after.png`.
2. Ben tranche : **verdict** + statut de chaque ¶ vide / espace ajouté (attendu / pas attendu).
3. Claude écrit le verdict dans `corpus/<CAS>/<mode>/meta.json` :
   - `verdict` ∈ `{pass, xfail, review}` (`pass`=béni ; `xfail`=bug connu, golden=sortie buggy actuelle, rouge attendu ; `review`=non bénissable en l'état, ex. fixture à corriger)
   - `comment` = règle ¶/espace retenue + notes
4. Quand une règle ¶/espace devient **normative**, la répercuter dans `SELECTION-CASES.md` (colonne « État / limite »).
5. Mettre à jour la **checklist** ci-dessous, puis **commit** (`test(T-04): verdict <CAS>/<mode> …`).

## Reprise après perte de session

- **Comportement attendu** : `.planning/SELECTION-CASES.md` §3 (lignes 62-73) + légende L#1–L#6 (152-159).
- **Verdicts** : champ `verdict`/`comment` de chaque `corpus/<CAS>/<mode>/meta.json`.
- **Avancement** : la checklist ci-dessous → reprendre au premier bundle « à revoir ».
- Relire ce fichier, puis reprendre le défilé au protocole étape 1.

Fixture source `a-family.docx` (identique pour tous) : `P1="The quick brown fox"`
(offsets `@start`=0, `@space`=4, `@mid`=9, `@end`=19) · `P2="Jumps over the dog"` · `P3="Lazy river flows"`.

## Checklist (9 bundles)

> ✅ **2026-06-23 : les 9 bundles A0–A4 sont RECAPTURÉS en v2** (sélection visible via grabFocus,
> marques ¶ affichées, `.docx` édité joint). Tous les `model.json` v2 sont **byte-identiques** à la v1
> ⇒ la recapture reproduit exactement l'ancienne ; les bugs constatés sont réels, pas des artefacts.
> Reste à faire : la **revue cas par cas** (verdicts) sur les bundles v2 nets — reprendre à A1/insert.

| Bundle | statut revue | verdict | ¶/espace ajouté (constat) |
|---|---|---|---|
| A0/insert  | ✅ REVU + **recapturé v2** | **xfail** | ¶ vide en TÊTE = **FAIL** (confirmé live + `after.png` v2 avec ¶). Bug `code.js:1479`. Règle L#7. Désiré: `[XXX][P1][P2][P3]` |
| A1/insert  | recapturé v2 — à revoir | — | ¶ vide en QUEUE (entre XXX et P2) — **probable FAIL** via L#7 (insert @end ⇒ pas de ¶ vide) |
| A1/replace | recapturé v2 — à revoir | — | run `" "` traînant après XXX |
| A2/insert  | recapturé v2 — à revoir | — | ¶ vide en TÊTE + anomalie (P1 resté intact) — L#7 + fixture @mid sur espace |
| A2/replace | recapturé v2 — à revoir | — | double espace autour de XXX (csv=xfail) |
| A3/insert  | recapturé v2 — à revoir | — | ¶ vide en QUEUE — **probable FAIL** via L#7 (insert @end ⇒ pas de ¶ vide) |
| A3/replace | recapturé v2 — à revoir | — | aucun (`The ` + `XXX`) |
| A4/insert  | recapturé v2 — à revoir | — | aucun (split propre, XXX en ¶ isolé) |
| A4/replace | recapturé v2 — à revoir | — | espace repositionnée (`XXX quick brown fox`) |

## Spec d'injection/extraction FINALISÉE (2026-06-24) → `SELECTION-CASES.md §5bis`

Règles validées avec Ben (remplacent L#7, précisent L#8). Résumé :
- **Replace = suppression (gérée par OO) + insertion** → une seule logique : l'insertion.
- **Extraction sélection→md** : ¶ entièrement sélectionné → marqueur de style md émis ; ¶ partiel → texte simple sans marqueur. C'est ce qui décide « 1ᵉʳ para avec/sans style » à la réinjection.
- **Injection** : 1ᵉʳ para *sans style* → **inline** dans l'hôte (style hôte conservé, espacement symétrique) ; paras suivants ou 1ᵉʳ para *avec style* (titre/liste/citation/code) → **block**, **jamais de ¶ vide** (avant/après aux bords, split au seul vrai milieu).
- Tableau des résultats attendus sur a-family dans §5bis.

**Conséquence sur les bundles** : sous cette spec, A0/A1/A2/A3 insert + A1/A2 replace ne sont plus conformes (¶ vide / double espace / `" "` traînant) → **xfail** jusqu'au correctif `code.js`. À répercuter dans les `meta.json` lors de la reprise de revue.

## Impact implémentation (où coder le correctif)

**Tout est dans le plugin Scribe `plugins/onlyoffice-scribe/scripts/code.js`** — *pas* d'API/SDK OO, *pas* de React Cozy Drive :
- **Injection** `buildAndInject` : supprimer le `content.unshift(Api.CreateParagraph())` inconditionnel (l.1479) ; implémenter inline-1ᵉʳ-para + block-reste avec gestion des bords (zéro ¶ vide) ; espacement symétrique ; unifier insert/replace sur la décision inline/block selon « 1ᵉʳ para a un style ».
- **Extraction** `paragraphToMarkdown` (~l.2840-2859) : n'émettre les marqueurs de début de ligne (`#`/`>`/`-`) **que** pour les ¶ entièrement sélectionnés ; ¶ partiel → texte + inline seulement.
- **L#1** : préserver le formatage du suffixe en inline partiel.
- API OO utilisées déjà dispo (SetStyle/GetStyle/InsertContent/GetRangeBySelect…) → **aucun patch SDK**.

**Côté harnais (ce worktree)** : étendre l'oracle `dumpState` (`paraToBlock`, ~l.3244) pour capturer le **style de ¶** (nom + niveau) + `normalizeModel.js` ; régénérer les goldens ; poser les xfail.

**Décision worktree (2026-06-24)** : on développe le correctif `code.js` **ici** (selection-tests, OO y est monté → boucle TDD contre le harnais), puis on le **porte** dans `scribe-in-right-panel`. Ce dernier a du dev v3.1 en cours **mais ne touche pas `code.js`** → portage de `code.js` **sans conflit**.

## Étape 1 — Oracle étendu au style de ¶ (FAIT, 2026-06-24)

- `code.js` `paraToBlock` (hook dumpState) capture `style` (nom de style, omis si "Normal") + `lvl`
  (niveau outline si ≥0). API confirmée live : `para.GetStyle().GetName()`, `para.GetOutlineLvl()`.
- `normalizeModel.js` : passe-plat `style`/`lvl` ; **absence ⇒ Normal implicite** → goldens Normal
  **inchangés** (aucun `style` émis). + 2 tests ajoutés dans `normalizeModel.spec.js`.
- **Validé live** : ¶ *Titre 1* → `{…,"style":"Heading 1"}` ; ¶ Normal → pas de `style`.

### ⚠️ Dev-env — 2 pièges confirmés
- **Cache plugin `immutable`** : `code.js` est servi sous `/<version>/sdkjs-plugins/scribe/` avec
  `Cache-Control: immutable, max-age=1an`. Un edit n'est PAS pris par un simple hard reload (l'iframe
  plugin est chargée en asynchrone). **Solution : ouvrir l'éditeur dans un contexte navigateur isolé**
  (`new_page isolatedContext`) → cache vierge → code frais. (Purger les `.gz` ne suffit pas ; le serveur
  voit bien le nouveau fichier, c'est le navigateur qui cache.)
- **jest du harnais : config dédiée OBLIGATOIRE.** Lancer les tests harnais avec
  `env NODE_ENV=test node_modules/.bin/jest -c jest.harness.config.js` (roots=test-harness + plugin swc
  `@swc-contrib/mut-cjs-exports`). La config **par défaut** (`jest.config.js`, roots=src) a l'ancien nom
  de plugin `swc_mut_cjs_exports` qui **ne se résout plus** dans le `node_modules` symlinké → elle
  échoue (ce n'est PAS un blocueur harnais, juste la mauvaise config). **Oracle : 13/13 verts** via la
  config harnais, dont les 2 nouveaux tests de style.

## Étape 2 — Fixture stylée (FAIT, 2026-06-24)

`styled-family.docx` (générée par `gen_fixtures.py` étendu) = miroir de a-family (mêmes textes/offsets,
specs A0–A5 réutilisables) mais **P1=Titre 1, P2=Titre 2, P3=Normal**. Validée live : oracle capture
`style:"Heading 1"`/`"Heading 2"` sur P1/P2, rien sur P3. → support de l'**axe A (style hôte)** prêt.

**Reste (étape 3)** : capturer les cas stylés (styled-family A0–A5 × insert/replace) = preuve du
comportement **actuel** sur hôte stylé (l'injection ne propage pas le style de ¶ aujourd'hui → xfail
attendus sur l'axe A) ; puis poser les xfail (a-family + styled) selon §5bis. **Puis étape 4** : correctif `code.js`.

## Constats transverses ouverts (à statuer pendant la revue)

- **L#7 — ¶ vide parasite à l'insertion (BUG confirmé, A0/insert)** : `code.js:1479`
  `content.unshift(Api.CreateParagraph())` inconditionnel. **Règle spec retenue** : ajouter un
  retour à la ligne **uniquement si insertion au milieu d'un ¶** ; rien au `@start`/`@end`.
  → impacte A0 (tête), A1/A3 (queue, insert @end) ⇒ à statuer FAIL en cascade ; A2/A4 (insert @mid)
  ⇒ le ¶/break y est *attendu*. Correctif code.js à planifier (hors T-04).
- **L#8 — Héritage de style à l'insertion (exigence)** : le ¶ recevant la fixture doit hériter du
  style du ¶ hôte (Titre N1, etc.). **Non testable avec `a-family.docx`** (¶ *Normal* uniquement).
  → **TODO fixture** : créer une fixture stylée (ex. `styled-family.docx` : un ¶ *Heading 1*, un
  *Heading 2*, un *Normal*) et dériver des cas A* « stylés » pour couvrir L#8.
- **A2** : `@mid`=9 tombe sur l'espace « quick‿brown » → la fixture ne teste pas le vrai
  *milieu de mot*. Fixture à corriger ou cas à dédoubler.
- **A0/replace** : non capturé (`na` — replace sur sélection vide non applicable, FRAG-04).

## Procédure de capture v2 (décidée 2026-06-23, Ben)

La capture v1 (commits T-04 initiaux) est jugée insuffisante pour trancher sans ambiguïté.
**Tous les bundles A0–A4 sont à RECAPTURER** avec la procédure v2 ci-dessous, puis la revue
reprend sur les bundles propres. Conclusions de revue déjà acquises (A0/insert xfail, A1/insert
fail) restent valides — fondées sur test live + `code.js:1479`, indépendamment de la preuve.

Améliorations v2 (vs v1) :
1. **Sélection visible dans `before.png`** — capturer `before.png` **après** `setSelection`, en
   gardant le focus dans l'iframe éditeur pour que OO **rende le surlignage** de la sélection.
2. **Marques de formatage activées** — afficher les caractères invisibles (¶, espaces, sauts) sur
   `before.png` ET `after.png`. C'est le cœur de la revue (¶ vides, espaces traînants).
   *(à câbler : bouton ¶ de la barre OO via MCP, ou API `asc_setShowParaMarks(true)` — à confirmer.)*
3. **`.docx` dans le dossier du bundle** — exporter le `.docx` résultat dans `corpus/<CAS>/<mode>/`
   (vérité-terrain ré-ouvrable + backstop OOXML de `TEST-STRATEGY.md §4`).

Invariants v2 :
- **`meta.json` (verdict + comment) est humain → JAMAIS écrasé** par une recapture. La recapture
  régénère seulement `before.png` / `after.png` / `capture.json` / `model.json` / `<bundle>.docx`.
- Reste fidèle au vrai chemin de prod : injection via le hook `injectFixture` → `buildAndInject`
  (prouvé identique à la prod, court-circuite seulement le LLM).

Statut recapture : **✅ FAIT** (A0–A4, 9 bundles, 2026-06-23 — voir bandeau checklist).

### Mécaniques v2 — CONFIRMÉES LIVE (2026-06-23, OO 9.3.0, sur `http://localhost/example/`)

Sondage Chrome MCP `evaluate_script`. Structure : page top a `window.docEditor` (DocsAPI) ;
l'éditeur est dans `iframe[name=frameEditor]` → `frameEditor.contentWindow.Asc.editor` ; le plugin
Scribe (avec hooks) est dans `top>frameEditor>iframe_asc.{…}` (`__scribeTest` présent ⇒ remount OK).

1. **Marques de formatage (¶)** — ✅ `frameEditor.contentWindow.Asc.editor.put_ShowParaMarks(true)`
   (lecture : `get_ShowParaMarks()`). *(`asc_setShowParaMarks` N'EXISTE PAS en 9.3.0.)* Confirmé
   visuellement : ¶ fins de ¶, `·` espaces, `→` tabs s'affichent.
2. **Sélection visible (`before.png`)** — ✅ `window.docEditor.grabFocus()` (top page) : focus l'éditeur
   **sans clic** (donc sans collapse). Séquence : `setSelection` → `grabFocus()` → `before.png`.
3. **Export `.docx`** — ✅ **via forcesave côté serveur** (le `downloadAs()` DocsAPI ne dépose AUCUN
   fichier dans le Chrome piloté par MCP — téléchargements auto supprimés). Méthode prouvée :
   1. lire la clé du doc : `window.docEditor.config.document.key` ;
   2. `POST http://localhost/command/` `{"c":"forcesave","key":"<key>"}` (JWT off en dev → `error:0`) ;
   3. `GET http://localhost/example/download?fileName=<file>` → `.docx` **édité** (sans forcesave,
      l'endpoint renvoie l'ORIGINAL, la sauvegarde callback ne se déclenche pas en session).

### Procédure v2 PROUVÉE de bout en bout (A0/insert, 2026-06-23) — séquence par bundle

0. Upload `a-family.docx` sur `http://localhost/example/` → **EDIT** (page éditeur).
1. `frameEditor.contentWindow.Asc.editor.put_ShowParaMarks(true)`.
2. Localiser l'iframe plugin (walk frames pour `__scribeTest`) et poser `pw.__scribeTestForce=true`.
3. `await pw.__scribeTest({action:'setSelection', spec})`.
4. `window.docEditor.grabFocus()` → `take_screenshot` → `before.png`.
5. `await pw.__scribeTest({action:'injectFixture', md, mode})`.
6. `await pw.__scribeTest({action:'dumpState'})` → `{blocks, selection}`.
   ⚠️ **1ᵉʳ appel peut renvoyer `{error:"dumpState parse...undefined"}`** (dump émis trop tôt après
   l'injection) → **réessayer** (le 2ᵉ appel réussit). À industrialiser : retry x2 sur cette erreur.
7. `take_screenshot` → `after.png`.
8. forcesave + download (cf. mécanique 3) → `<CAS>-<mode>.docx`.
9. Assembler le bundle : `capture.json` (spec/mode/setRes/inj/stable/blocks/selection), `model.json`
   (= `normalizeModel({blocks,selection})` via `oracle/normalizeModel.js`), PNG, `.docx`.
   **Préserver `meta.json`** (verdict/comment humains) ; ne mettre à jour que `capturedVia`/`capturedAt`
   + `captureVersion:"v2"`.

→ A0/insert recapturé v2 : modèle **identique à v1** (`[∅][XXX][P1][P2][P3]`) ; `after.png` (¶ visibles)
montre le `¶` vide seul en tête sans ambiguïté ; `.docx` édité confirmé (5 `<w:p>`, `XXX` présent).
Flux validé → **GO pour le batch A0–A4 (puis A5–A8, T*)**.

## Découvertes / décisions de revue (chronologique)

- **2026-06-23 — A0/insert ⇒ xfail.** Bug ¶ vide parasite confirmé live par Ben. Deux règles spec
  ajoutées : **L#7** (break conditionnel à la position) et **L#8** (héritage de style). Spec
  `SELECTION-CASES.md` mise à jour (légende L#7/L#8 + ligne A0). Correctif `code.js:1479` et fixture
  stylée = chantiers de suivi, hors de cette passe de revue.
- **2026-06-23 — Procédure capture v2 prouvée sur A0/insert.** Flux complet validé via Chrome MCP
  (¶ marks + grabFocus + injectFixture + dumpState + forcesave .docx). Modèle v2 = v1 (le bug est
  réel, pas un artefact). Bundle `corpus/A0/insert` régénéré v2 (PNG avec ¶, capture.json, model.json,
  A0-insert.docx) ; `meta.json` verdict `xfail` préservé. Procédure prouvée écrite ci-dessus. **GO batch.**
- **2026-06-23 — Batch A1–A4 recapturé v2 (8 bundles).** Même session éditeur, `asc_undoAllChanges()` entre chaque bundle (retour aux 3 ¶ propres, vérifié), pas de re-upload. Tous les `model.json` v2 byte-identiques à v1 (fidélité prouvée). Chaque bundle : before/after.png (¶ visibles), capture.json, model.json, `<CAS>-<mode>.docx` (forcesave). `meta.json` verdicts préservés (A1–A4 encore `null` → à statuer). **Prochain : revue cas par cas sur bundles v2.**
