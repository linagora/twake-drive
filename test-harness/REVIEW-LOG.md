# T-04 — Revue des bundles de capture (log d'avancement)

**Créé :** 2026-06-23 · **Worktree :** `cozy-drive-selection-tests` / `test/selection-cases-harness`

## But

Revue humaine-pilote des bundles capturés sous `corpus/<CAS>/<mode>/`. Pour chaque
bundle : confronter le comportement **capturé** au comportement **attendu**
(`.planning/SELECTION-CASES.md` §3, lignes 62-73), décider d'un **verdict**, et
**tracer explicitement** tout ¶ vide / espace ajouté — l'ajout de lignes vides et
d'espaces **fait partie de la spécification** (décision Ben 2026-06-23), donc chaque
occurrence doit être statuée *attendu* ou *pas attendu*, pas seulement constatée.

## Taxonomie des corpus — matrice 2×2 (hôte × fixture) — 2026-06-25

Les bundles sont rangés par **deux axes orthogonaux** : le **style de ¶ de l'hôte**
(Normal vs Titre/liste/citation/code) et le **style de ¶ de la fixture injectée**.
Dans chaque root, sous-structure identique : `A0..A4/{insert,replace}/` + bundle standard.

| Root | Hôte | Fixture | Couvre |
|---|---|---|---|
| `corpus/` | Normal (`a-family.docx`) | sans style (`XXX`) | §5bis Cas A (inline pur) — **9/9 pass** |
| `corpus-styledHost/` | stylé (`styled-family.docx`, H1) | sans style (`XXX`) | Cas A sur hôte stylé — *ex-`corpus-styled/`, renommé 2026-06-25* — **9/9 pass** (recapturé rouge→vert : XXX inline hérite H1) |
| `corpus-styledFixture/` | Normal (`a-family.docx`) | **stylée** (`# Injected`) | §5bis Cas B sur hôte Normal — **9/9 pass** (créé 2026-06-26) |
| `corpus-styledHost-styledFixture/` | stylé (`styled-family.docx`, H1) | **stylée** (`# Injected`) | §5bis Cas B sur hôte stylé — **9/9 pass** |

> **Cas B** = fixture *avec style* → règle §5bis « block, jamais de fusion inline, hôte garde son style ».
> **27/27 bundles recapturés (2026-06-26), verdict `pass` groupé (Ben).** Build `2026-06-25.2` :
> l'espace parasite en tête du bloc stylé est **corrigé** (smart-spacing supprimé en mode block,
> `code.js` commit `caed3dde6`) → `Injected` net ; hôte garde son style (H1 ou Normal) sur toutes les
> moitiés de split, zéro fusion / ¶ vide. Fixture `styled-family.docx` : vrais Heading 1/2 (commit `35bf99926`).
>
> **Layout des bundles recapturés (6 fichiers, pas de `before.png`)** : `before.docx`, `after.docx`
> (vérifié au contenu via forcesave+verify-retry), `after.png` (¶ visibles), `capture.json`, `model.json`
> (golden normalisé), `meta.json` (verdict). Le `before.png` est **omis** (sélection déterministe depuis le
> `spec` ; `before.docx` = entrée pristine) — régénérable à la demande. ⚠️ **Piège forcesave OO** : sur une
> session « martelée » (dizaines d'inject/undo) le forcesave renvoie `error:4` (rien à sauver) ; capturer
> sur un **upload frais par root** + verify-retry du download (le callback de save est asynchrone, ~1 cycle de lag).

## Procédure de recapture — RÈGLES NON NÉGOCIABLES (normatif, retour Ben 2026-06-26)

1. **Nettoyer AVANT de recapturer.** Supprimer d'abord **tous** les fichiers des anciens bundles ciblés,
   y compris les résidus à l'ancien nom (`before.png` périmés, `<CAS>-<mode>.docx`, etc.). Un seul jeu de
   fichiers par bundle, layout uniforme — jamais d'ancien mélangé au nouveau.

2. **Tout produire EN UNE SEULE PASSE.** Pour chaque bundle, dans la **même** ouverture d'éditeur et la
   **même** injection, capturer dans la foulée : `before.png` (après `setSelection`+`grabFocus`) → injecter
   → `after.png` → `after.docx` → écrire `capture/model/meta.json`. **INTERDIT** : faire une passe « modèles »
   puis ré-ouvrir / ré-injecter pour l'évidence. Chaque cas n'est injecté **qu'une fois** ; l'éditeur Chrome MCP
   est déjà ouvert pendant le test, donc screenshots + docx s'y font **au même moment** (coût nul de ré-ouverture).

**Jeu COMPLET attendu par bundle (7 fichiers)** : `before.png`, `after.png`, `before.docx`, `after.docx`,
`capture.json`, `model.json`, `meta.json`. *(La passe 2026-06-26 a livré 6/7 — `before.png` omis ; à NE PAS
reproduire : la prochaine recapture inclut `before.png` dès la même passe.)*

**Fiabilité (obligatoire)** : **upload pristine par root** (jamais une session martelée → forcesave `error:4`) ;
**verify-retry** du download (`after.docx` re-téléchargé jusqu'à ce que son texte = le résultat live, le callback
de save OO laggant ~1 cycle). Outils prêts : `scratchpad/docxtext.py` + `verify_docx.sh` (schéma réutilisable).

## Protocole (par bundle, ordre A0→A4, `insert` puis `replace`)

1. Claude présente : cas, spec de sélection, attendu (matrice), résultat (texte) + ouvre `before.png` / `after.png`.
2. Ben tranche : **verdict** + statut de chaque ¶ vide / espace ajouté (attendu / pas attendu).
3. Claude écrit le verdict dans `corpus/<CAS>/<mode>/meta.json` :
   - `verdict` ∈ `{pass, xfail, review}` (`pass`=béni ; `xfail`=bug connu, golden=sortie buggy actuelle, rouge attendu ; `review`=non bénissable en l'état, ex. fixture à corriger)
   - `comment` = règle ¶/espace retenue + notes
4. Quand une règle ¶/espace devient **normative**, la répercuter dans `SELECTION-CASES.md` (colonne « État / limite »).
5. Mettre à jour la **checklist** ci-dessous, puis **commit** (`test(T-04): verdict <CAS>/<mode> …`).

## Format de présentation d'un bundle (à Ben, en revue) — normalisé 2026-06-24

Gabarit fixe pour présenter un bundle :
- **Titre** : `<CAS>/<mode>` + badge verdict (✅ pass · ❌ xfail · 🟠 review).
- **Bundle** : chemin `test-harness/corpus/<CAS>/<mode>/` (pour ouvrir les fichiers).
- **spec** · **fixture** · **mode**.
- **Before — état initial (langage naturel)** : décrire le document de départ **et** la sélection
  (ex. « Document `a-family` : 3 ¶ Normal. Sélection = tout le ¶1 “The quick brown fox”. »).
  Preuves : `before.png` (sélection visible + marques ¶), `before.docx` (document initial).
- **After — état obtenu (langage naturel)** : décrire le résultat ¶ par ¶, **expliciter** chaque
  espace / ¶ ajouté ou manquant (ex. « ¶1 = “XXX” + un espace traînant + marque ¶ ; ¶2/¶3 inchangés ;
  3 ¶, aucun ¶ vide. »). Preuves : `after.png`, `after.docx`, `model.json` (golden), `capture.json` (brut).
- **Attendu (§5bis)** : le texte cible.
- **Verdict + écart** : pass, ou xfail/review **avec l'écart précis** (chaque espace/¶ doit être *statué*).

**Layout normalisé du bundle** (≥7 fichiers, before/after symétriques) :
`before.png` · `after.png` · `before.docx` (= **document initial**, copie de la fixture pristine) ·
`after.docx` (= **état obtenu**, forcesave) · `capture.json` (brut) · `model.json` (golden normalisé) ·
`meta.json` (verdict humain) [+ `cases.row.snapshot.csv` selon le cas].
*(Les anciens bundles `<CAS>-<mode>.docx` ont été renommés `after.docx` ; `before.docx` ajouté le 2026-06-24.)*

## Reprise après perte de session

- **Comportement attendu** : `.planning/SELECTION-CASES.md` §3 (lignes 62-73) + légende L#1–L#6 (152-159).
- **Verdicts** : champ `verdict`/`comment` de chaque `corpus/<CAS>/<mode>/meta.json`.
- **Avancement** : la checklist ci-dessous → reprendre au premier bundle « à revoir ».
- Relire ce fichier, puis reprendre le défilé au protocole étape 1.

Fixture source `a-family.docx` (identique pour tous) : `P1="The quick brown fox"`
(offsets `@start`=0, `@space`=4, `@mid`=9, `@end`=19) · `P2="Jumps over the dog"` · `P3="Lazy river flows"`.

## Checklist (9 bundles)

> ✅ **2026-06-24 : les 9 bundles A0–A4 sont RECAPTURÉS en v3** (= post-correctif `code.js` §5bis,
> hook atomique `injectAtSelection`, ¶ marks via `put_ShowParaMarks`, sélection visible via `grabFocus`,
> `.docx` édité via forcesave). Upload pristine `a-family (4).docx`, **une seule session**, `asc_undoAllChanges`
> entre chaque bundle. **9/9 = pass** (texte = §5bis exact, un seul ¶, plus AUCUN ¶ vide ; les 9 `.docx`
> ont 3 `<w:p>`). *(A1/replace était l'unique xfail — espace traînant `XXX␣` — corrigé le 2026-06-24,
> cf. §Étape 4 (g) ; recapturé sur `a-family (5).docx` → `XXX` strict.)*
>
> ⏪ Historique v2 (2026-06-23) : capture *avant* correctif, `model.json` byte-identiques v1 (bugs réels,
> pas artefacts). Les goldens v3 **remplacent** les v2 (sortie §5bis correcte au lieu de la sortie buggy).

| Bundle | statut revue | verdict | résultat v3 (§5bis) / constat |
|---|---|---|---|
| A0/insert  | ✅ REVU + **recapturé v3** | **pass** | `XXX The quick brown fox` — INLINE, **plus de ¶ vide** (bug L#7 corrigé). 1 espace après, rien avant |
| A1/insert  | ✅ REVU + **recapturé v3** | **pass** | `The quick brown fox XXX` — insert @end, 1 espace avant, **pas de trailing**, plus de ¶ vide |
| A1/replace | ✅ REVU + **recapturé v3 (post-fix)** | **pass** | `XXX` — **espace traînant corrigé** (§Étape 4 (g)). Tout P1 supprimé puis insertion dans ¶ vide → `XXX` strict, aucun voisin, un seul ¶ |
| A2/insert  | ✅ REVU + **recapturé v3** | **pass** | `The quick XXX brown fox` — curseur @mid bien placé (hook atomique), pas de double espace |
| A2/replace | ✅ REVU + **recapturé v3** | **pass** | `The quick XXX brown fox` — **double espace résolu** (ex-csv xfail) |
| A3/insert  | ✅ REVU + **recapturé v3** | **pass** | `The quick brown fox XXX` — insert @end, plus de ¶ vide |
| A3/replace | ✅ REVU + **recapturé v3** | **pass** | `The XXX` — hôte `The ` conservé, pas de trailing |
| A4/insert  | ✅ REVU + **recapturé v3** | **pass** | `The XXX quick brown fox` — split inline propre |
| A4/replace | ✅ REVU + **recapturé v3** | **pass** | `XXX quick brown fox` — pas d'espace avant (début de ¶) |

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

## Étape 3a — Cas stylés capturés (FAIT, 2026-06-24) → `corpus-styledHost/`

9 bundles `corpus-styledHost/<CASE>/<mode>/` (A0–A4 × insert/replace ; A0/replace=na) sur `styled-family.docx`
(hôte P1=*Titre 1*). Flux v2 identique (clé forcesave = `__1styled-family.docx...`). Comportement **actuel**
de l'axe A (style hôte) — la preuve rouge :

- **REPLACE (A1–A4)** : le résultat **conserve *Titre 1*** ✓ (l'inline-merge reste dans le ¶ hôte). Conforme
  §5bis côté style ; restent les bugs d'espacement (A1 `" "` traînant, A2 double espace) → xfail spacing only.
- **INSERT (A0–A4)** : style **cassé** (multi-modes) :
  - XXX inséré **toujours en Normal** (jamais le style hôte — §5bis veut l'inline avec style hôte).
  - A1/A3 insert : le **texte hôte perd *Titre 1*** (→ Normal) et le **¶ vide parasite vole *Titre 1***.
  - A0/A2 insert : ¶ vide en tête (Normal), hôte intact mais XXX en Normal.
  - A4 insert : split → 2ᵉ moitié garde *Titre 1*, mais « The » (1ʳᵉ moitié) **perd** le style.
- → Tous les INSERT stylés = **xfail** (style + ¶ vide). REPLACE stylés = style OK, xfail spacing pour A1/A2.

Verdicts `meta.json` laissés à `null` (revue cas par cas à venir). `.docx` joints : OO renumérote les
styleId (663/664 = Heading1/2) — le NAME via l'oracle fait foi, le `.docx` est un backstop.

## Étape 4 — Correctif `code.js` §5bis (EN COURS, 2026-06-24)

`buildAndInject` insert : supprimé le `content.unshift(Api.CreateParagraph())` (bug L#7) ; 1 ¶ plain →
**inline** dans l'hôte (garde le style) ; multi/stylé → block ; `needSpaceBefore/After` symétriques
calculés pour l'insert ; `selectByRefs` corrigé (content[0] = 1ᵉʳ vrai ¶). Commit WIP.

**Validation live (a-family propre) :**
- A4 (plage `start..space`) → `The XXX quick brown fox` ✅ (inline, **plus de ¶ vide**).
- A0 (@start) → `XXX The quick brown fox` ✅.
- A1 (@end, plage) → `The quick brown foxXXX  ` ❌ — espacement en **fin de ¶** faux (pas d'espace avant,
  double après) → à corriger.

**DÉCOUVERTE MAJEURE (limitation harnais, pas un bug prod) :** un **curseur collapsed** posé par le hook
`setSelection` **ne survit pas** jusqu'au callCommand `injectFixture` — il **retombe à l'offset 0**
(prouvé : setSelection renvoie s=9, mais dumpState juste après lit offset 0). Les **plages** survivent.
→ **Ça explique rétroactivement « l'anomalie A2 »** (insert au début) : ce n'était jamais un bug
d'injection, juste le curseur collapsed réinitialisé. ⇒ Les cas **A0/A2 (curseurs)** ne sont **pas
testables** tant que le harnais ne fait pas **setSelection + injectFixture dans le MÊME callCommand**
(ou un hook atomique `setSelectionAndInject`). À faire avant de pouvoir valider A0/A2.

**(a) Hook atomique — FAIT (2026-06-24).** Nouveau hook `injectAtSelection(spec,md,mode)` : pose la
sélection dans le MÊME callCommand que `buildAndInject` (pré-pas flag-gated `Asc.scope._testSelSpec`,
inerte en prod). Validé base propre — **A0/A2/A4 insert matchent §5bis** (`XXX The quick brown fox` /
`The quick XXX brown fox` / `The XXX quick brown fox`) ; **A2 corrigé** (curseur @mid placé au bon
endroit, plus au début). ⚠️ Pollution serveur par auto-save : la recapture doit se faire en **une seule
session** depuis un upload pristine (pas de reload mid-batch).

**(b) Espacement @end — FAIT (2026-06-24).** Détection avant/après désormais char-exacte : on trouve le
¶ hôte par itération (GetParagraph non fiable), on calcule l'offset char dans son texte, `aChar=''` en
fin de ¶ → pas d'espace traînant. **Les 4 inserts A matchent §5bis** : A0 `XXX The quick brown fox`,
A1 @end `The quick brown fox XXX` (espace avant, pas de traînant), A2 `The quick XXX brown fox`,
A4 `The XXX quick brown fox`. (Validé via le hook atomique sur base propre.)

**Axe A (style de ¶) — VALIDÉ avec le fix (2026-06-24).** Re-test live sur styled-family (hôte Titre 1) :
le XXX inséré (fixture sans style) est désormais **inline dans le ¶ hôte → hérite de « Heading 1 »**
(`XXX XXX quick brown fox{Heading 1}` pour A0/A2/A4), **plus aucun ¶ vide, plus de vol de style**.
C'était l'objectif §5bis. Les bundles `corpus-styledHost/` (pré-fix : XXX en Normal + ¶ vide) sont donc la
preuve « avant » ; à recapturer pour le « après ».

**(d) font-run — BLOQUÉ sur groundwork (investigué 2026-06-24).** Sonde live : `para.GetTextPr().GetFontSize()`
= **null** pour la marque de ¶ d'un Titre 1 → racine du fallback `srcFont` vers le défaut. Et sur
`styled-family`, le run du Titre 1 ET `GetDefaultTextPr` renvoient la **même taille (20)** → la différence
visuelle titre/corps **n'est pas observable via GetFontSize**. De plus `GetFontSize` renvoie la taille
*résolue* (pas l'override explicite) → impossible de distinguer hérité/forcé sans churn sur tous les goldons.
⇒ **Prérequis (d)** : (1) fixture stylée avec **tailles explicites distinctes** (pas que des styles built-in) ;
(2) décision oracle run-font (capturer l'override explicite, pas la taille résolue). Ne PAS toucher `srcFont`
à l'aveugle (non validable sur la fixture actuelle, et `srcFont` est sur le hot-path de toute injection).

**(g) Espacement @end en mode REPLACE — FAIT (2026-06-24).** Le smart-spacing du *replace* lisait le
caractère suivant via `doc.GetRange(repEnd, repEnd+5)` (positions absolues = unités élément) → quand tout
le ¶ hôte est sélectionné, `repEnd` tombe sur le `GetEndPos()` du ¶ et la lecture avant **fuit dans le ¶
suivant** (« Jumps… ») → espace traînant parasite (`A1/replace = "XXX "`). **Fix** : lire le voisin
**clampé à son ¶ hôte** (même approche que l'insert) — un bord de ¶ compte comme un saut de ligne (blanc)
⇒ pas d'espace. Validé live sur `a-family (5).docx` : **A1/replace → `XXX` strict**, A2/A3/A4 replace
**inchangés** (pas de régression). Conforme à la précision §5bis « bord de ¶ = saut de ligne ». Corpus
a-family = **9/9 pass**.

**(e) Extraction md conditionnelle — FAIT (2026-06-24).** Les marqueurs de style de ¶ (titre `#`,
puce/numéro de liste) ne sont émis **que** si le ¶ est **entièrement** sélectionné (`clipStart===0 &&
clipEnd===0`) ; un ¶ partiel → texte + inline seulement, **sans** marqueur (→ réinjection inline, pas
block). Fix dans `window.Asc.plugin.init` (extraction réelle, hot-path prod). Nouveau dev-hook
**`extractSelection`** (lance la vraie extraction `init()`, renvoie `{text, md}`) = capture **côté
extraction** (pendant de `injectFixture`), réutilisable pour les cellules tableau. Validé live sur
`styled-family (1).docx` : P1 *Titre 1* entier → `# The quick brown fox`, partiel → `The` (plain) ;
P2 *Titre 2* entier → `## …`, partiel → plain ; P3 Normal → plain. ⚠️ `extractSelection` poll le
sentinel `__pending__` (la callback d'`init()` est asynchrone — un simple no-op callCommand courait
plus vite qu'elle).

**(f) L#1 — VÉRIFIÉ OK (2026-06-24), pas de correctif.** Sondé live sur une **nouvelle fixture
`format-family.docx`** (miroir d'a-family, même texte 19 chars/offsets, mais « quick » **gras** + « fox »
*italique*). Le chemin inline `InsertContent(content, true)` **préserve** le formatage char du préfixe ET
du suffixe non sélectionnés, **même en run-splitting** (sélection coupant un run formaté) : replace `0..6`
→ reste `ick`**[b]** ; `6..12` → `qu`**[b]** + `fox`*[i]* ; `0..17` → reste `ox`*[i]*. La légende L#1
était **stale** (chemin pré-§5bis). Outillage ajouté pour ce test : **offset numérique** dans les specs de
sélection (`P1@6`, `P1@17`) — `resolveOffset`/`_toff` acceptent désormais un entier (en plus de
start/space/mid/end). ⚠️ **Seul résidu** : le chemin **block** (replace multi-¶) reconstruit le texte
traînant via `GetText()` plain (`code.js` ~l.1643) → formatage perdu sur ce sous-cas → à traiter avec (c).

**(c) Block « zéro ¶ vide aux bords » + formatage traînant — FAIT en partie (2026-06-24).** Le mode
**block** se déclenche pour un contenu injecté **multi-¶** (ex. `"First\n\nSecond"`) ou un 1ᵉʳ para stylé.
OO splitte le ¶ hôte au point d'insertion ; le reste à droite devient un ¶ traînant. **Fix** (helper unique
`cleanupTrailingBlockPara`, branché sur insert ET replace block) : on **supprime** ce ¶ traînant **seulement
s'il est vide** (insertion au bord) ; **non vide → on le garde tel quel** (split au vrai milieu, demi-droite
qui garde le style hôte ET son **formatage de run**). → corrige (1) le **¶ vide en @end** (insert) et
(2) le **résidu (f)** : le texte traînant garde gras/italique, plus de `\r` (fini le rebuild `GetText()` plain).
Validé live `format-family` : @end insert = 4 blocs (plus de ¶ vide) ; @mid = split propre ; replace partiel
→ `[First][Second ][quick{gras} brown fox{ital}]`. **Inline simple-para inchangé** (axe A styled : `XXX`
@mid garde `Heading 1`, pas de régression).

✅ **VOLET STYLE-SUR-SPLIT — RÉSOLU + IMPLÉMENTÉ (2026-06-24).** Décision Ben : **(1)** les deux moitiés du
split gardent **toujours** le style hôte (invariant §5bis, désormais normatif) ; **(2)** sémantique multi-¶ =
**option A** (1ᵉʳ para plain fusionné inline dans la moitié gauche, paras 2..n en blocs entre les moitiés —
*pas* d'ordre inversé, mon ancienne lecture était fausse). **Fix code** : `buildAndInject` capture `hostStyle`
(¶ hôte par itération, robuste aux curseurs collapsed) → l'applique au 1ᵉʳ para injecté plain (Cas A, avant
merge) + à la moitié droite (¶ traînant). **Validé live `styled-family`** : @start/@mid/@end insert + replace →
les 2 moitiés de P1 restent `Heading 1`, `Second` Normal, zéro ¶ vide. **Zéro régression** (a-family block Normal
OK ; single-para inline intact). Doc §5bis A.2 reformulée + invariant + sémantique tranchée.

ⓘ Historique (avant fix) — le bug constaté : sur un hôte **stylé** (Titre 1), le mode
block fait **perdre le style de l'hôte à la demi-GAUCHE du split** (OO applique le style *Normal* du 1ᵉʳ para
injecté à la fusion) : `@mid → "The quick First"{Normal} / "Second"{Normal} / " brown fox"{Heading 1}`
(droite OK, **gauche cassée**) ; `@end → "The quick brown fox First"{Normal}` (l'hôte **perd Titre 1**).
C'est lié à la sémantique **§5bis « 1ᵉʳ para sans style → INLINE »** mal définie pour le **multi-¶** : aujourd'hui
le 1ᵉʳ para injecté n'est PAS fusionné inline au `@start` (`[First][Second][hôte]`, hôte intact) mais l'EST au
`@mid`/`@end` — incohérent. **À trancher avec Ben** : (a) la demi-gauche/hôte doit-elle re-garder le style hôte
après split ? (b) que signifie « 1ᵉʳ para inline » quand le contenu est multi-¶ (fusion + reste en blocs, et où) ?
Tant que non tranché : **ne pas patcher à l'aveugle** la ré-application de style (hot-path, risque de régression).

**Reste étape 4 :** (c) **volet style-sur-split** ci-dessus (ouvert, à spécifier) ; (d) cf ci-dessus (bloqué groundwork).
**Étape de consolidation recommandée** : recapturer a-family avec le fix (les inserts passent du ¶-vide-buggy
au correct §5bis) en UNE session (upload pristine), puis figer les verdicts pass. Enfin port vers scribe-in-right-panel.

⚠️ **Hygiène recapture** : le documentserver **auto-sauvegarde** → la source serveur se pollue entre
sessions. Pour recapturer proprement : **un upload pristine + UNE seule session** (undo-all entre bundles,
jamais de reload mid-batch). Chaque re-upload du même nom est dédupliqué (`a-family (N).docx`).

## Étape de consolidation — recapture a-family v3 (FAIT, 2026-06-24)

Recapture des 9 bundles A0–A4 × insert/replace **avec le correctif `code.js` §5bis en place**, en
**UNE seule session** (oo-dev monté sur CE worktree). Flux par bundle : upload pristine →
`a-family (4).docx`, éditeur ouvert en `isolatedContext` frais (cache plugin `immutable`),
`put_ShowParaMarks(true)`, plugin `__scribeTestForce=true` ; puis pour chaque bundle
`asc_undoAllChanges()` → `setSelection(spec)`+`grabFocus()`→`before.png` →
**`injectAtSelection(spec,"XXX",mode)`** (hook atomique : sélection + `buildAndInject` dans le MÊME
callCommand) → `dumpState` ×2 (stable) → `after.png` → forcesave + download `.docx` → assemblage
(`capture.json` brut, `model.json` via `oracle/normalizeModel.js`, `meta.json` verdict).

**Résultat : 8/9 = pass, 1 xfail.** Tous les `.docx` ont **3 `<w:p>`** (le ¶ vide parasite L#7 a
**disparu partout**). Texte = §5bis exact sur 8 bundles (cf. tableau checklist). Doc-key forcesave lu
sur `window.config.document.key` (et non `docEditor.config` — non exposé dans ce build de l'exemple).

**Seul reste rouge — `A1/replace` = `XXX␣` (espace traînant).** Attendu §5bis = `XXX` (aucun voisin
→ aucune espace). Le correctif (b) « espacement @end » ne traitait que l'**insert** ; en **replace**
plein-¶ le smart-spacing ajoute encore un run `" "` après XXX quand le ¶ devient vide à droite.
→ **À corriger dans `buildAndInject`** : ne pas émettre `aChar`/espace après si le côté droit est vide
après suppression (replace). Bundle gelé en **xfail** (golden = sortie buggy), à rebénir après ce fix.

**Reste après consolidation :** (le fix replace-trailing-space ci-dessus) puis les points (c)/(d)/(e)/(f)
de l'étape 4, et enfin le **port de `code.js` → `scribe-in-right-panel`** (sans conflit, il n'y touche pas).
Note : l'ancien `statusFromCsv` de A2/replace = `xfail` (double espace) est désormais **résolu** (verdict
`pass`) — à répercuter dans `cases.csv` au prochain passage CSV⇒MD.

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
  régénère seulement `before.png` / `after.png` / `after.docx` / `capture.json` / `model.json`
  (`before.docx` = document initial, statique = copie de la fixture).
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
8. forcesave + download (cf. mécanique 3) → **`after.docx`** ; copier la fixture pristine → **`before.docx`**.
9. Assembler le bundle : `capture.json` (spec/mode/setRes/inj/stable/blocks/selection), `model.json`
   (= `normalizeModel({blocks,selection})` via `oracle/normalizeModel.js`), `before/after.png`, `before/after.docx`.
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
- **2026-06-26 — Driver étendu (cross-cellule + table entière) + axe REPLACE tableaux VALIDÉ LIVE ; INSERT table = NO-OP découvert.** Build `2026-06-26.2`. Le driver accepte désormais `T<n>.C(r1,c1)@..T<n>.C(r2,c2)@` (range cross-cellule, même table) et `T<n>.full` (table entière) ; `selSpecSupported` remplace la garde intra-only ; les deux résolveurs jumeaux gagnent une branche `ExpandTo(1er ¶ cellule début → dernier ¶ cellule fin)`. **Code frais chargé sans redémarrer oo-dev** (contexte isolé neuf). Validations live :
  - **Sélection + extraction prod** : `C(0,0)..C(0,1)` → `[TABLE:0][CELL:0,0]Alpha[CELL:0,1]Beta` ; `T1.full` (table-plain) → 4 cellules dont `(1,1)=Delta\n\nDelta2`. Sur **table-merged** : V-cross `C(1,0)..C(2,2)` extrait `[1,0]Vmaster,[1,1]B1,[1,2]C1,[2,1]B2,[2,2]C2` — **`(2,0)` continuation OMISE** (conforme §4bis) ; H-row `C(3,0)..C(3,1)` → 2 cellules logiques `[3,0]M30,[3,1]Hspan` ; `full` = 10 cellules (trou S5).
  - **REPLACE in-place = ✅ confirmé live, zéro corruption** : T2a (table-plain top-row `AA|BB`), T3 (full `w|x/y|z`), **T2c** (V-merge : Vmaster→VM*, **continuation (2,0) jamais touchée**, `cellsPerRow=[3,3,3,2]` préservé), **T2b** (H-merge : Hspan édité in-place, **gridSpan préservé**). `blockCount=3` partout. → **décision §4bis #1 (Replace in-place sûr H+V) prouvée live.**
  - **INSERT de contenu table = no-op OBSERVÉ** (table-plain T2a/T3 ET table-merged full) : doc strictement inchangé (écran `merged-full-insert.png`). ⚠️ **VOIR CORRECTION ci-dessous (même date)** : cette observation s'est révélée **non concluante** (harnais `injectAtSelection` sans snapshots d'extraction, `hasSnap=false`) → conclusion « bug » rétractée, verdicts Insert remis à ✅ d'origine, à vérifier en IHM réelle.
- **2026-06-26 (CORRECTION) — le « INSERT table = no-op confirmé bug » est RÉTRACTÉ ; reste un no-op OBSERVÉ mais non concluant.** Deux causes de non-fiabilité découvertes après coup : (1) le harnais `injectAtSelection` **court-circuite l'état snapshots d'extraction** — au moment de l'inject `hasSnap=false` (sonde fiable sur `window` du plugin), alors qu'en prod les snapshots ToJSON arrivent par relais postMessage de l'hôte (`code.js:2097-2100`) ; (2) mon instrumentation interne était **inexploitable** : `Asc.scope` **ne persiste PAS d'un `callCommand` à un autre** (test direct : write puis read séparé → `UNSET`), donc tous les « sinks » lus indiquaient null par artefact, pas par non-exécution. Conséquence : impossible de conclure sur la cause du no-op avec ce harnais. De plus le code prod a **déjà** une logique de repositionnement curseur-après-tableau (`code.js:1773-1794`), donc l'hypothèse « curseur piégé » n'est pas le manque supposé. **Actions** : fix prod `2026-06-26.3` (repositionnement curseur — redondant et inopérant) **REVERTÉ** (working tree revenu à `2026-06-26.2`) ; verdicts `cases.csv` T2a/T3 Insert remis à **✅ d'origine** avec réserve « non validé live, à vérifier en IHM réelle » ; T2b/c Insert = **xfail (Q4)** restauré (la sonde RemoveColumn de 2026-06-17 reste la seule preuve). **Le harnais actuel ne teste pas fidèlement l'Insert tableau** (il faut soit l'IHM réelle, soit câbler le relais snapshots dans le harnais). Les résultats **Replace in-place restent valides** (chemin in-place, sans dépendance aux snapshots).
- **2026-06-26 — Driver intra-cellule `T<n>.C(r,c)@pos` VALIDÉ LIVE + §4ter infirmé.** OO 9.3.0, build `code.js` `2026-06-26.1`, fixture `table-plain.docx` (oo-dev monté sur CE worktree). Driver : `injectAtSelection('T1.C(0,0)@start..@end', md, mode)` cible bien la cellule (0,0) (inline replace : `Alpha → XXX`, propre, 0 débordement). **Cœur du résultat : AUCUN débordement** dans tous les cas testés (inline/titre/liste/citation × insert/replace) — `blockCount` reste 3, Intro/Outro + cellules sœurs intactes. **La règle cible §4ter (réécriture in-place pour cause de débordement) tombe** : le hook `Select()` la plage DANS la cellule au sein du même `callCommand`, donc `InsertContent` reste borné à la cellule (le crash/overflow d'avant venait d'une sélection non établie). **Listes = puces PRÉSERVÉES** (confirmé à l'écran, `cell-list.png` ; `dumpState` ne lit pas `numPr`). **Titre = `Heading 1` conservé.** **Citation = style aplati `Normal`** (souhaité, non bloquant). Résidus = **L#7 ¶ vide parasite** (`[∅][block][∅]`) + **ordre insert `@end`** (block avant le texte hôte) — **partagés avec le top-level**, déjà tracés, hors hot-path à l'aveugle. Spec `SELECTION-CASES.md §4ter` réécrite (Résultats live + règle v1 repliée en `<details>`). **Prochain : fixture `table-merged.docx` (T2b/c) puis campagne de capture des bundles T*.**
