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

> ⚠️ **2026-06-23 : capture v1 obsolète — tous les bundles à RECAPTURER en v2** (sélection visible,
> marques de formatage, `.docx` joint). Voir « Procédure de capture v2 » plus bas. Les verdicts
> déjà posés (colonne ci-dessous) restent acquis et seront re-confirmés sur les bundles v2.

| Bundle | statut revue | verdict | ¶/espace ajouté (constat) |
|---|---|---|---|
| A0/insert  | ✅ REVU | **xfail** | ¶ vide en TÊTE = **FAIL** (confirmé live Ben). Bug `code.js:1479`. Règle L#7. Désiré: `[XXX][P1][P2][P3]` |
| A1/insert  | à revoir | — | ¶ vide en QUEUE (entre XXX et P2) — **probable FAIL** via L#7 (insert @end ⇒ pas de ¶ vide) |
| A1/replace | à revoir | — | run `" "` traînant après XXX |
| A2/insert  | à revoir | — | ¶ vide en TÊTE + anomalie (P1 resté intact) — L#7 + fixture @mid sur espace |
| A2/replace | à revoir | — | double espace autour de XXX (csv=xfail) |
| A3/insert  | à revoir | — | ¶ vide en QUEUE — **probable FAIL** via L#7 (insert @end ⇒ pas de ¶ vide) |
| A3/replace | à revoir | — | aucun (`The ` + `XXX`) |
| A4/insert  | à revoir | — | aucun (split propre, XXX en ¶ isolé) |
| A4/replace | à revoir | — | espace repositionnée (`XXX quick brown fox`) |

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

Statut recapture : **À FAIRE** (nécessite OO + cozy-stack relancés + pilotage Chrome MCP).

### Mécaniques v2 — CONFIRMÉES LIVE (2026-06-23, OO 9.3.0, sur `http://localhost/example/`)

Sondage Chrome MCP `evaluate_script`. Structure : page top a `window.docEditor` (DocsAPI) ;
l'éditeur est dans `iframe[name=frameEditor]` → `frameEditor.contentWindow.Asc.editor` ; le plugin
Scribe (avec hooks) est dans `top>frameEditor>iframe_asc.{…}` (`__scribeTest` présent ⇒ remount OK).

1. **Marques de formatage (¶)** — ✅ `frameEditor.contentWindow.Asc.editor.put_ShowParaMarks(true)`
   (lecture : `get_ShowParaMarks()`). *(`asc_setShowParaMarks` N'EXISTE PAS en 9.3.0.)* Confirmé
   visuellement : ¶ fins de ¶, `·` espaces, `→` tabs s'affichent.
2. **Sélection visible (`before.png`)** — ✅ `window.docEditor.grabFocus()` (top page) : focus l'éditeur
   **sans clic** (donc sans collapse). Séquence : `setSelection` → `grabFocus()` → `before.png`.
3. **Export `.docx`** — ✅ `window.docEditor.downloadAs(...)` (public DocsAPI) **ou**
   `Asc.editor.asc_DownloadAs(new Asc.asc_CDownloadOptions(Asc.c_oAscFileType.DOCX))`. ⏳ reste à
   confirmer pendant la capture : où atterrit le fichier (dossier download du Chrome MCP) pour le
   copier dans `corpus/<CAS>/<mode>/<bundle>.docx`.

**À câbler aussi pour la recapture (flux existant, déjà prouvé T-03) :**
- **Activer les hooks** : poser `__scribeTestForce=true` dans l'iframe plugin (ou
  `localStorage scribe.testHooks='1'`) — sinon `runTestCmd` répond « test hooks disabled ».
- **Charger `a-family.docx`** (upload via la page exemple) au lieu de `sample.docx`.
- **Séquence/bundle** : charger a-family → `put_ShowParaMarks(true)` → activer hooks → `setSelection` →
  `grabFocus` → `before.png` → `injectFixture` → `dumpState` (modèle+sélection) → `after.png` →
  `downloadAs(docx)` → ranger le bundle (préserver `meta.json`).

→ Étape 0 recapture : **prouver le flux complet sur UN bundle** (A0/insert) avant le batch A0–A4.

## Découvertes / décisions de revue (chronologique)

- **2026-06-23 — A0/insert ⇒ xfail.** Bug ¶ vide parasite confirmé live par Ben. Deux règles spec
  ajoutées : **L#7** (break conditionnel à la position) et **L#8** (héritage de style). Spec
  `SELECTION-CASES.md` mise à jour (légende L#7/L#8 + ligne A0). Correctif `code.js:1479` et fixture
  stylée = chantiers de suivi, hors de cette passe de revue.
