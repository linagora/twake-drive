# Cas de sélection — spécification de référence

**Créé :** 2026-06-16
**But :** énumérer *exhaustivement* les configurations de sélection possibles dans l'éditeur OnlyOffice et figer le comportement attendu de Scribe pour chacune (extraction, Insérer, Remplacer, post-sélection).
**Sources :** phase 26 (sélections partielles de tableaux), phases 24/24.1 (clone+InsertContent), historique des bugs (`memory/project_phase26_known_issues.md`, `project_phase27_crossref_bug.md`, `project_v25_learnings.md`), et scan de `plugins/onlyoffice-scribe/scripts/code.js` (~3100 lignes).

---

## 1. Modèle général

Toute sélection OO a la forme :

```
[ élément-tête partiel ]?   [ éléments-milieu entiers ]*   [ élément-queue partiel ]?
```

- **Élément** = paragraphe (`P`, inclut titres/listes) ou tableau (`T`).
- **Élément partiel** = un `P` à texte partiel **ou** un `T` dont un sous-ensemble de cellules est sélectionné (chaque cellule sélectionnée l'étant *entièrement*).
- **Contrainte OO forte :** on ne peut **jamais** sélectionner « la moitié de la cellule A + la moitié de la cellule B ». Dans un tableau, la granularité atomique est **la cellule**. Une extrémité de sélection dans un tableau est toujours aimantée sur une frontière de cellule.

Deux axes orthogonaux se croisent avec chaque cas :
- **Action** : `Insérer` (au curseur / après la sélection) vs `Remplacer` (n'existe que si sélection active — FRAG-04).
- **Contenu réinjecté** : texte simple / riche inline (gras, italique, souligné, barré, code, liens) / tableau / image / footnote / cross-ref.

---

## 2. Vocabulaire / notation

### Type d'élément
`P` = paragraphe · `T` = tableau · numérotés dans l'ordre du document (`P2`, `T3`…).

### Position d'une extrémité **dans un paragraphe**
| Code | Sens | Pourquoi ça compte |
|------|------|--------------------|
| `@start` | offset 0, avant le 1er caractère | pas de `&nbsp;` avant à la réinjection |
| `@space` | frontière de mot **précédée d'une espace** (= ton `mid_space`) | règle CommonMark (`*texte *` ≠ italique) ; smart-spacing |
| `@mid` | à l'intérieur d'un mot / entre deux non-espaces | `&nbsp;` requis **des deux côtés** |
| `@end` | après le dernier caractère, **avant** la marque ¶ | pas de `&nbsp;` après |
| `∅` | début == fin → simple curseur (pas de sélection) | `init()` renverrait tout le ¶ ; **Remplacer** masqué |

> Espace = ` ` **et** ` ` (nbsp, charCode 160) — OO utilise souvent 160 (`code.js:516`, regex `WS`). À toujours traiter comme blanc.

### Position d'une extrémité **dans un tableau** (granularité = cellule `C(r,c)`, 0-based)
| Code | Sens | Traitement |
|------|------|-----------|
| `T.intra(r,c)` | sélection **entièrement dans une seule cellule** (texte partiel ou total) | **chemin paragraphe normal**, aucun traitement tableau (`intraCell:true`) |
| `T.cells{…}` | sous-ensemble de cellules, **chacune entière** | extraction/injection cellule par cellule, marqueurs `[CELL:r,c]` |
| `T.full` | toutes les cellules / tableau structurellement englobé | clone + `InsertContent` |

> **Il n'existe pas de position « ambiguë » dans un tableau.** OO aimante toujours une extrémité sur une frontière de cellule (phase 26, impl #4 : « not needed »). Le flag `ambiguous` du code (cas T10) n'est qu'une **garde défensive** sur un échec de détection, pas une géométrie de sélection que l'utilisateur peut viser.

### Notation d'une sélection
`[ tête , queue ]` où chaque extrémité est `P<n>@pos` ou `T<n>.{intra|cells|full}`.

---

## 3. Matrice — paragraphes seuls (sans tableau)

**Convention :** *Insérer* = ajoute le contenu **au point d'insertion (fin de la sélection)**, sans détruire la sélection. *Remplacer* = **détruit la sélection** et la remplace par le contenu.
*Règle Insert transversale :* si une espace suit immédiatement le point d'insertion, l'étendre pour la **consommer** (sinon espace de tête sur la ligne insérée) — `code.js:518-535`.

<!-- cases:table:paragraph:start -->
| # | Sélection *(description)* | Insérer | Remplacer | État / limite |
|---|---|---|---|---|
| A0 | `[P1@x,P1@x]` *(curseur seul (sélection vide))* | ✅ insère au curseur; pas de chip | — absent par défaut (FRAG-04); si exposé se comporte comme Insérer | ✅ · ne pas utiliser init() qui renverrait tout le ¶ |
| A1 | `[P1@start,P1@end]` *(paragraphe entier)* | ✅ nouveau ¶ après le ¶ courant; pas de &nbsp; | ✅ remplace tout le ¶ | ✅ |
| A2 | `[P1@mid,P1@mid]` *(milieu d'un mot)* | ✅ insère au point; &nbsp; des deux côtés | ⚠️ remplace le fragment; &nbsp; des deux côtés | ⚠️ · **L#1** · L1: le suffixe non sélectionné perd ses styles inline (Replace) |
| A3 | `[P1@space,P1@end]` *(après espace -> fin)* | ✅ insère en fin de ¶; pas de &nbsp; après | ✅ remplace; espace de tête déplacée (CommonMark); pas de &nbsp; après | ✅ · **L#6** · L6: post-sélection inline fragile (+2) |
| A4 | `[P1@start,P1@space]` *(début -> mot, espace finale)* | ✅ insère au point; pas de &nbsp; avant | ✅ remplace; espace finale déplacée après le marqueur md | ✅ |
| A5 | `[P1@start,P3@end]` *(plusieurs ¶ entiers)* | ✅ blocs insérés après P3 | ✅ remplace P1..P3; injection ¶ par ¶ en ordre inverse | ✅ · TESTÉ LIVE + golden 2026-06-26 (build .8, driver multi-¶ top-level via branche cross ExpandTo). Insert: 3 ¶ intacts, réponse après P3 (1er ¶ fusionné inline en fin de P3 = smart-spacing standard, 'Beta edit' nouveau ¶). Replace: P1..P3 → exactement 3 ¶. Goldens corpus/A5/{insert,replace} sur a-family. |
| A6 | `[P1@mid,P3@mid]` *(partiel -> entiers -> partiel)* | ✅ insère au point; clipping text-matching | ✅ remplace la plage; clipping text-matching | ✅ · TESTÉ LIVE + golden 2026-06-26 (build .8). Insert: au point (mid P3), P1/P2 + styles intacts. Replace RE-CLASSÉ xfail(L1)→PASS : collapse en 1 ¶ (tête P1 + 'Mid replaced' + queue P3), TEXTE correct ; L1 (perte styles tête/queue) NON REPRODUCTIBLE — tête garde son gras (model+docx) ET queue formatée préservée (sonde a6tail). Cohérent avec re-vérif L#1. Résidu cosmétique = 1 run gras vide. Fixture format-family (P1 gras/ital) pour exercer L1. Goldens corpus/A6/{insert,replace}. |
| A7 | `[P2@start,P4@end] avec ¶ vides` *(¶ vides en bord de sélection)* | ✅ préserver les ¶ vides (split sur double-newline avant lexer) | ✅ idem | ✅ · TESTÉ LIVE + golden 2026-06-27 (build .8). Fixture a7-empty (Intro/VIDE/Middle/VIDE/Outro), sél P2@start..P4@end = vide à chaque bord. EXTRACTION préserve les vides : extMd='\n\nMiddle paragraph\n\n' (split double-newline avant lexer = cœur du cas). Insert : vide de tête préservé, l'insert remplit le ¶ vide cible (P4), blockCount=5. Replace : Intro/'New middle'/¶vide/Outro (5→4), hors-sélection intact, 1 vide résiduel (L#7). Goldens corpus/A7/{insert,replace}. |
| A8 | `>100 ¶` *(sélection très grande)* | ✅ garde de perf: repli extraction texte brut (perte du riche) | ✅ idem | ✅ · TESTÉ LIVE + golden 2026-06-27 (build .8) — 'assumé' → VÉRIFIÉ. Garde code.js:2993 : range.GetAllParagraphs().length > 100 → {text: GetText(), md: ''} (chemin extraction PROD). Seuil EXACT >100 ¶ : 100 ¶→md enrichi (1002, gras préservé) ; 101 ¶→md VIDE + text brut (1008). Fixture a8-large = 120 ¶ (P2 gras = témoin) ; extraction → extMd vide, extText=1198, 'perte du riche' confirmée. Inject normal : insert=120 intacts + réponse fusionnée P120 ; replace=120→1 ¶. Goldens corpus/A8/{insert,replace}. |
<!-- cases:table:paragraph:end -->

---

## 4. Matrice — tableaux

Mêmes conventions Insérer / Remplacer. Rappel : pour un tableau, *Insérer* produit toujours une **copie** (réduite si partielle) placée **après** le tableau / la sélection — l'**original reste intact** ; *Remplacer* modifie **in-place** (ou clone si englobement structurel).

<!-- cases:table:table:start -->
| # | Sélection *(description)* | Insérer | Remplacer | État / limite |
|---|---|---|---|---|
| T1 | `[T1.intra(r,c),T1.intra(r,c)]` *(dans une seule cellule)* | ✅ chemin paragraphe (insère dans la cellule au point) | ✅ chemin paragraphe (remplace le texte de la cellule) | ✅ |
| T2a | `[T1.cells,T1.cells]` *(cellules partielles, sans fusion)* | ✅ copie réduite du tableau insérée après le tableau | ✅ in-place modifyOriginalTableCells; cellules non sél. et vides intactes | ✅ · Insert + Replace VALIDÉS LIVE 2026-06-26 (build .3) : Insert → copie réduite (top-row [[AA,BB]]) après le tableau, original intact ; Replace in-place OK. (no-op antérieur = bug insSimpleInline corrigé) |
| T2b | `[T1.cells,T1.cells]` *(cellules partielles, fusion H traversée)* | ✅ clone complet (jamais RemoveColumn) | ✅ in-place — identique à T2a (round-trip (r,c), S2) | ✅ · Insert + Replace VALIDÉS LIVE 2026-06-26 (build .4) : §4bis#2 implémenté (tableHasMerge → clone COMPLET, skip RemoveColumn) → plus de corruption Q4 ; Replace in-place (gridSpan préservé) ; aperçu GFM désaligné cosmétique |
| T2c | `[T1.cells,T1.cells]` *(cellules partielles, fusion V traversée)* | ✅ clone complet (jamais RemoveRow) | ✅ in-place — identique à T2a (maître édité, continuation vide jamais touchée, S3/S4) | ✅ · Insert + Replace VALIDÉS LIVE 2026-06-26 (build .4) : §4bis#2 implémenté → Insert V-region = clone COMPLET cpr=[3,3,3,2], continuation (2,0) vide, ZÉRO corruption (t2c-insert-fullclone.png) ; Replace in-place OK ; S3 mismatch UX (sélection continuation seule) ; trou détection full S5 — non bloquants |
| T3 | `[T1.full,T1.full]` *(tableau entier englobant)* | ✅ clone complet inséré après le tableau | ✅ clone + InsertContent; post-sélection OK | ✅ · Insert + Replace VALIDÉS LIVE 2026-06-26 : Insert (build .3) → copie complète (w\|x/y\|z) après le tableau, original intact ; Replace (build .5) → [[p,q],[r,s]] in-place (a nécessité le fix isSimpleInline côté replace : avant, inline ne vidait que la 1ère cellule). Goldens corpus/T3/{insert,replace}. |
| T4 | `[P1@mid,T1.C(0,1)]` *(¶ -> finit dans un tableau)* | ✅ après le tableau: ¶/tableaux entiers du début + copie réduite du tableau de fin (cas 2b) | ⚠️ cellules in-place + InsertContent par ¶ (ordre inverse) | ⚠️ · **L#2** · Insert + Replace VALIDÉS LIVE 2026-06-26 (build .7, driver cross-frontière). Spec P1@mid..T1.C(0,1)@end. Insert ✅ : original intact, réponse (¶ 'Head edit' + copie réduite [[AA,BB]]) insérée après le tableau. Replace : DOCUMENT CORRECT (Intro p + Head edit ; cellules (0,0)/(0,1)->AA/BB in-place) mais xfail = L#2 post-sélection collapsed (block:0). Goldens corpus/T4/{insert,replace}. |
| T5 | `[T1.C(1,0),P2@mid]` *(tableau -> finit après)* | ✅ après la fin de sélection: copie réduite tête + ¶/tableaux suivants (cas 2c) | ⚠️ cellules in-place + InsertContent par ¶ | ⚠️ · **L#2** · Insert + Replace VALIDÉS LIVE 2026-06-26 (build .7). Spec T1.C(1,0)@start..P2@mid. Insert ✅ : original intact, copie réduite [[GG,DD]] + ¶ 'Tail edit' insérées après le tableau. Replace : DOCUMENT CORRECT (cellules (1,0)/(1,1)->GG/DD in-place ; Outro tête->'Tail edit', queue 'aragraph' conservée) mais xfail = L#2 post-sélection collapsed (block:2). Goldens corpus/T5/{insert,replace}. |
| T6 | `[T1.C(1,0),T2.C(0,1)]` *(deux tableaux partiels, milieu entier)* | ✅ copie réduite tête + milieu entier + copie réduite queue (cas 2d) | ⚠️ in-place les deux tableaux + InsertContent par ¶ du milieu | ⚠️ · **L#2** · Insert + Replace VALIDÉS LIVE 2026-06-26 (build .7, fixture table-pair NOUVELLE). Spec T1.C(1,0)@start..T2.C(0,1)@end (queue table A + ¶ Middle entier + tête table B). Insert ✅ : 2 tableaux + Intro/Middle/Outro intacts, réponse (réduite [[aa,bb]] + 'Mid edit' + réduite [[cc,dd]]) insérée après table B. Replace : DOCUMENT CORRECT (A row1->[[aa,bb]], Middle->'Mid edit', B row0->[[cc,dd]] in-place) mais xfail = L#2 post-sélection collapsed (block:2). Goldens corpus/T6/{insert,replace}. |
| T8 | `[T1.intra multi-¶]` *(cellule multi-¶ (dont vides))* | ✅ split sur double-newline; injecté in-cellule | ✅ idem | ✅ · Insert + Replace VALIDÉS LIVE 2026-06-26 (build .5) sur cellule (1,1) multi-¶ (Delta/Delta2), contenu multi-¶ : ZÉRO débordement (blockCount=3) -> L#3 'block déborde hors cellule' INFIRMÉ ; 2e ¶ non sélectionné (Delta2) préservé. Résidu ¶ vide = L#7 (cosmétique, commun top-level). Goldens corpus/T8/{insert,replace}. |
| T9 | `[T1.intra avec image]` *(cellule avec image)* | ✅ copie après tableau ; original (avec image) non touché → image préservée | ✅ clone tableau : image de cellule via marqueur+PasteHtml → préservée au save | ✅ · FIXÉ 2026-06-27 (commit 8ee036220, build .9). Replace tableau entier (T1.full, chemin clone) : l'image en cellule survit DÉSORMAIS au save (after.docx 1 media + a:blip ; cellules BetaX/GammaX/DeltaX). Ancien xfail L#8 : reconstructTable/ToJSON + AddDrawing(Copy) perdait le média (0 blip). Fix : images de cellule via marqueur texte + PasteHtml post-InsertContent (upload média serveur) + injectPendingImages scanne les cellules. Insert reste pass (original gardé + clone PasteHtml = 2 media). NB pure-image cell extraction réparée aussi (commit d520064ea). Goldens corpus/T9/{insert,replace(re-capturé pass)}. |
| T10 | `(garde défensive)` *(no_range / no_cell_match — pas un cas utilisateur)* | — bandeau câblé (message trompeur) | — idem | ✅ · ne devrait pas se déclencher; à tester au niveau garde/unitaire, pas en golden |
| T11 | `(mismatch nb cellules)` *(réponse ≠ nb cellules de la sélection)* | ✅ bandeau d'avertissement | ✅ idem | ✅ · VALIDÉ par test unitaire (tableCellMarkers.spec.js, cas « signale un mismatch — T11 ») : validateTableCounts → valid=false, warning 'Table 0: expected 2 cells, got 1', details=[{tableIndex:0,expected:2,actual:1}]. Bandeau câblé UI-Drive : transformCellMarkersForPreview → setCellWarning → ScribeResultPanel (div ambre #fff3cd/#5c3a00). Déclenché UNIQUEMENT sur déficit (actual<expected) — surplus accepté (≥ valide) et PAS sur garde T10 (doute « message trompeur » levé). PAS de golden live OO : bandeau invisible en /example/ (pas d'hôte Drive). Spec exécutée en standalone node 2026-06-26 (20/20) car toolchain jest cassé ici (node_modules symlinké = branche voisine v1.104, swc incompatible). |
| T13 | `[T.intra tableau imbriqué]` *(tableaux imbriqués)* | ❌ non supporté | ❌ non supporté | ❌ hors scope · hors scope |
| T7 | `[T1.full,P2@end]` *(tableau entier + ¶ suivant (insert au bon point))* | ✅ réponse insérée APRÈS la fin de sélection (après le ¶ suivant), PAS entre le tableau et le ¶ | — (non couvert ici) | ✅ · NOUVEAU 2026-06-27 (fix build .10). Sélection {tableau ENTIER + ¶ suivant}, Insert. Spec ligne 59 : Insérer = fin de la sélection → attendu {T1, Outro, F}. BUG reproduit sur .9 (F inséré entre le tableau et Outro = {T,F,P}) car le curseur était placé après le dernier tableau de la réponse sans tenir compte que la sélection dépasse le tableau. Fix : curseur = fin de sélection (bump après tableau seulement si la sélection s'y termine → T3/T2a préservés). Validé live+forcesave : ordre {Intro,T1,Outro,clone,ZZZtail}. Golden corpus/T7/insert. NB T5 a le même défaut latent → re-capture à prévoir. |
<!-- cases:table:table:end -->

---

## 4bis. Cellules fusionnées (T2b/c) — modèle OO confirmé + spécification

> **Note taxonomie (2026-06-26)** : la fusion n'est **pas** une géométrie de sélection mais un **attribut de la table**. `T2b` (fusion H) et `T2c` (fusion V) ont **exactement** la géométrie de `T2a` (`T.cells`, cellules partielles). La fusion ne bascule **qu'un seul** chemin : **Insert** passe de « copie réduite » à « **clone complet** » (car `RemoveRow/Column` corrompt le span — Q4) ; **Replace = in-place, identique à T2a**. Partout ailleurs (T1, T3-full, Replace) la fusion est transparente. *(ex-`T12a/b`, regroupés sous T2 le 2026-06-26.)*

État du code : **aucun traitement de fusion** (`grep merge|span|gridSpan|MergeCells` → rien dans `code.js`) ; phase 26 l'avait déféré. **Modèle OO 9.x confirmé empiriquement** par la sonde `.planning/probe-merged-cells.js` (4 sélections S1–S4 sur une table 4×3 avec 1 fusion V sur (r1,r2,c0) et 1 fusion H sur (r3,c1+c2), résultats archivés 2026-06-17).

### Modèle de données OO (résultats de sonde)

- **Coordonnées `(r,c)` = index logique *dans la ligne*** (`GetRowIndex()`/`GetIndex()`, bornées par `row.GetCellsCount()`), **pas** une colonne visuelle.
- **Fusion horizontale** *(S2)* : la ligne a **moins** de cellules logiques (`grid[3].cellsCount = 2`). La cellule fusionnée occupe **un** index logique (`B3` en `cellIndex:1`) couvrant 2 colonnes visuelles.
- **Fusion verticale** *(S3/S4)* : le **maître** (ligne d'origine) est une cellule normale qui porte le texte (`(1,0)="A1"`). La **continuation** (ligne du dessous) est une **vraie cellule séparée, VIDE** (`(2,0) exists:true, elems:1, text:"\t"`) — elle **ne porte pas** le contenu du maître, et **son ¶ vide n'est jamais retourné** par `range.GetAllParagraphs()` (donc jamais « touchée »).
- **Attribution stable** *(S4)* : le maître apparaît **une seule fois**, à sa propre ligne (`rowIndex:1`). **Aucun décalage ni doublon** — la crainte initiale d'attribution erronée est **infirmée**.
- **Round-trip auto-cohérent :** extraction (`extractTableCells`, `0..GetCellsCount()`) et injection (`table.GetCell(r,c)`) utilisent la *même* indexation logique → le contenu retombe dans la bonne cellule. **Structure préservée sans perte** par `ToJSON(true,true)` (`code.js:2733` : « borders, bg, **merges**, fonts, images »).

### Conséquence : le Replace in-place est sûr pour les deux types de fusion

Aucun repli sur table complète n'est nécessaire pour Replace : l'index logique `(r,c)` round-trip correctement, le maître est édité à sa place, la continuation vide est simplement jamais écrite. **Spec Replace = in-place** (chemin T2 existant), inchangé.

### Résidus réels (revus à la baisse)

1. **Aperçu GFM désaligné (cosmétique, T2b+c)** — `cellsToMarkdownTable` indexe par `(r, cellIndex)` logique. Une ligne fusionnée H produit une cellule de moins → colonne visuelle vide en bout ; une continuation V n'émet pas de cellule col 0. Pipe-table d'aperçu désaligné vs le visuel, **sans corruption du document**. → **Accepté en v1.**
2. **Mismatch visuel/traité (T2c, S3)** — sélectionner *seulement* une ligne de continuation surligne la cellule fusionnée à l'écran, mais son contenu (ancré au maître, non sélectionné) **n'est ni extrait ni édité**. Pas de corruption ; surprise UX possible. → option future : étendre la sélection au maître, ou afficher un indice. **Documenté, non bloquant.**
3. **Trou de détection `full` — CONFIRMÉ (S5, 2026-06-17)** — sélectionner *toute* la table à fusion V donne `hitCount = 10 < totalNonEmptyCells = 11` (la continuation vide `(2,0)` est comptée mais jamais sélectionnable) → **classée `partial`, jamais `full`** ; l'extraction omet `[CELL:2,0]`. **Bénin en pratique** : toutes lignes/colonnes restent représentées → le chemin partiel ne réduit rien → équivaut au clone complet. Ne mord que si une réduction est requise (→ #4). *Incohérence sous-jacente :* `totalNonEmptyCells` compte `elems>0`, la boucle d'inclusion des vides teste `elems===0`. → **fix optionnel** : exclure du compte les cellules à ¶ unique vide.
4. **Insert + réduction de clone — CORRUPTION CONFIRMÉE (Q4, 2026-06-17)** — `RemoveColumn` (`code.js:1497-1521`) d'une colonne traversée par une fusion **horizontale** supprime **tout le span** : retirer la colonne B a effacé `B3` (qui couvrait B+C) → r3 réduite à `A3`, **perte de données**. → **Insert d'une table contenant une fusion (h ou v) ⇒ insérer le clone COMPLET, jamais de `RemoveRow/Column`.** Non négociable.

### Confirmation LIVE (2026-06-26, driver `2026-06-26.2`, fixture `table-merged.docx`)

Le driver étendu (range cross-cellule + `T<n>.full`) a permis de **prouver live** sur le vrai chemin prod :
- **Replace in-place sûr H + V** (décision #1) : T2b (H-merge) → `Hspan` édité in-place, **gridSpan préservé** ; T2c (V-merge) → maître `Vmaster` édité, **continuation `(2,0)` jamais touchée**, `cellsPerRow=[3,3,3,2]` intact. Zéro corruption, zéro débordement. ✅
- **Extraction** : V-cross omet bien `(2,0)` ; `full` = 10 cellules (trou S5 reproduit).
- **Insert de contenu table : VRAI bug prod trouvé ET corrigé (build `2026-06-26.3`, commit `619d198fb`).** Le no-op était double : (1) harnais infidèle (snapshots non câblés — résolu en renvoyant `tableSnapshots` dans le JSON d'extraction, flag-gated/inert en prod) ; (2) **bug prod réel** : `insSimpleInline` classait un contenu UNIQUEMENT-tableau (T2a/T3) en *inline* (il testait le ¶ placeholder `SCRIBE-TABLE-0`, pas le `content[0]` réel = un tableau) → `InsertContent([table], true)` à un curseur replié = no-op. Fix : exclure `content[0].GetClassType()==='table'`. **Validé live** : T3 → copie complète après le tableau (original intact, `t3-insert-fixed.png`) ; T2a → copie réduite `[[AA,BB]]` ; T2b H-row → copie réduite, fusion intacte. → **T2a/T3 Insert = ✅**. **T2b/c Insert = ⚠️** : no-op corrigé, mais la **décision §4bis #2 (fusion → clone complet, jamais RemoveColumn/Row) reste non implémentée** → une sélection à retrait de colonne via un span H peut encore corrompre (Q4). Détail : `REVIEW-LOG.md` (2026-06-26 RÉSOLUTION).

### Décisions (verrouillées après sonde S1-S5 + Q4)

1. **Replace = in-place** pour H et V (pas de repli table complète) — *confirmé sûr (S3/S4)*. ✅
2. **Insert = clone complet** dès qu'une fusion (h ou v) est présente — *obligatoire, corruption `RemoveColumn` confirmée (Q4)*. ✅
3. **Aperçu désaligné** accepté en v1 (cosmétique). ✅
4. **Trou de détection `full` (#3)** : fix optionnel (~5 LOC) — faible priorité car bénin ; sinon documenter comme limite.
5. **Mismatch S3 (#2)** : documenté comme comportement connu (sélection continuation seule = cellule fusionnée non éditée).

---

## 4ter. Injection §5bis **dans une cellule** (T1 / T8) — VALIDÉ LIVE (2026-06-26, OO 9.3.0)

> **Mise à jour 2026-06-26** — La règle v1 ci-dessous (réécriture « in-place cell-aware » pour
> contourner un débordement) **n'est PAS nécessaire** : le test live infirme la prémisse. Section
> conservée pour mémoire, mais la conclusion opérante est **« aucun débordement, on garde
> `buildAndInject` tel quel »**. Voir « Résultats live » ci-dessous.

### Résultats live (driver `T<n>.C(r,c)@pos`, build `2026-06-26.1`, fixture `table-plain.docx`)

Sondé via Chrome MCP — `injectAtSelection` sur cellule (0,0) « Alpha », `dumpState scope:doc` ×retry +
capture d'écran (¶ marks ON). Cas couverts : inline / titre / liste / citation, en **insert** ET **replace**.

- **AUCUN débordement, jamais** — `blockCount` reste **3** (Intro ¶ / table / Outro ¶ intacts ; cellules
  sœurs Beta/Gamma/Delta intactes) dans **tous** les cas. La prémisse « `InsertContent` block
  document-level déborde hors cellule (L#3) » est **infirmée** : le hook **`Select()` une plage DANS la
  cellule au sein du même `callCommand`**, donc `GetRangeBySelect()` rend le ¶ de cellule comme hôte et
  `InsertContent` reste borné à la cellule. (Le crash/débordement observé jadis venait d'une **sélection
  non établie**, pas d'une limite d'OO.)
- **Liste** (`- one\n- two`) → ✅ **puces préservées** (rendu `•→one` / `•→two`, confirmé **à l'écran** ;
  `dumpState` ne lit pas `numPr` donc ne les montre pas en JSON — l'absence en JSON n'est PAS une perte).
- **Titre** (`# Titre`) → ✅ **style `Heading 1` conservé** (pas aplati).
- **Citation** (`> quoted text`) → ⚠️ **style aplati en `Normal`** (pas de style `Quote` ; `dumpState` lit
  pourtant le style ¶ → conclusion fiable). « Souhaité », non bloquant ; cosmétique du pipeline md→HTML.
- **Résidus PARTAGÉS avec le top-level** (pas spécifiques cellule, déjà tracés § « Constats transverses ») :
  - **L#7 ¶ vide parasite** — block injecté encadré d'un ¶ vide : replace → `[∅][block][∅]` ; insert →
    `[∅][block][host]`.
  - **Ordre insert `@end`** — le contenu block s'insère **AVANT** le texte hôte (`[∅][one][two][Alpha]`),
    même classe de défaut que l'insert top-level (positionnement `InsertContent` au curseur fin-de-¶).

### Conséquence pour le plan

Le gros chantier « réécriture in-place cell-aware de `buildAndInject` » **tombe** (overflow inexistant).
Reste uniquement le nettoyage **L#7 / ordre-insert**, **commun au top-level** et déjà planifié hors T-04 —
ne PAS patcher le hot-path à l'aveugle. Impératif §4ter (**listes préservées**) = **TENU**.

<details><summary>Règle v1 (2026-06-26, périmée — gardée pour mémoire)</summary>

Injecter dans une cellule (`intraCell`) passe par le **même `buildAndInject`** que les paragraphes. *Crainte (infirmée) :* la machinerie §5bis serait document-level et `InsertContent` block déborderait (L#3). Règle cible v1 alors envisagée : interdire `InsertContent` block et insérer in-place via `cell.GetContent().AddElement(pos, para)` (comme T8 Replace), avec listes/citations préservées, titre aplatissable, zéro débordement. → **Inutile : le test live montre zéro débordement avec le chemin existant.**

</details>

---

## 5. Matrice — axe « contenu réinjecté » (transversal à tous les cas A/T)

Ces limites dépendent du **type de contenu**, pas de la géométrie de sélection — elles s'appliquent par-dessus n'importe quelle ligne A/T.

<!-- cases:table:content:start -->
| Contenu | Insérer | Remplacer | État / limite |
|---|---|---|---|
| text-simple | ✅ OK | ✅ OK | ✅ |
| rich-inline | ✅ OK (formatage préservé) | ✅ OK | ✅ · gras/italique/barré/code/liens/souligné |
| color | ⚠️ non préservé | ⚠️ non préservé | ⚠️ · **L#5** · L5: couleur non préservée |
| image | ✅ OK (round-trip) | ✅ OK | ✅ |
| footnote | ✅ OK (recréée post-InsertContent) | ✅ OK | ✅ |
| crossref | ⚠️ liens parfois perdus selon le document | ⚠️ idem | ⚠️ · **L#4** · L4: cross-refs perdus selon le document (pré-existant v2.6) |
<!-- cases:table:content:end -->

---

### Légende des limites (inlinées ci-dessus)

- **L#1** — ~~Replace partiel d'un ¶ : le suffixe non sélectionné perd ses styles inline~~ → **VÉRIFIÉ NON REPRODUCTIBLE sur le code actuel (2026-06-24)**. Le chemin inline `InsertContent(content, true)` **préserve** le formatage de caractères du **préfixe ET du suffixe** non sélectionnés, **y compris quand la sélection coupe au milieu d'un run formaté** (run-splitting). Prouvé live sur `format-family.docx` (« quick » gras, « fox » italique) : replace `0..6` → reste `ick`**gras** ; `6..12` → `qu`**gras** + `fox`*ital* conservés ; `0..17` → reste `ox`*ital*. ✅ **Étendu au multi-¶ (A6) 2026-06-26 (build .8)** : le sous-cas « chemin block » jadis suspecté de perdre le formatage du texte traînant est lui aussi **NON REPRODUCTIBLE** — sur `A6` (`P1@mid..P3@mid`) la **tête** garde son gras (`quick` b:1 dans model+`after.docx`) et la **queue** formatée est préservée (sonde dédiée `a6tail.docx`, `flows` gras en queue → reste gras). Seul résidu = un run gras **vide** (sans texte) dans le `.docx` (cosmétique, parent L#7). ⇒ A6 Replace re-classé xfail(L1)→**pass**.
- **L#2** — Replace cross-frontière (¶↔cellule, ou deux tableaux) : **le document résultant est CORRECT** — cellules remplacées in-place + ¶ remplacés in-place, contenu non sélectionné intact. Le seul manque = la **post-sélection** : le curseur retombe collapsed (pas de span sur le contenu remplacé). **VÉRIFIÉ LIVE 2026-06-26 (build .7)** sur T4/T5/T6 ; xfail = cosmétique (curseur), zéro corruption. Goldens `corpus/T{4,5,6}/{insert,replace}`.

  **Pourquoi cet xfail (mécanisme — ne PAS confondre avec « OO ne sait pas sélectionner cross-frontière »)** :
  - **Ce n'est PAS une impossibilité de l'API.** La *mise en place* d'une sélection cross-frontière marche : on prend deux **objets** range vivants (`paragraphe.GetRange()` d'un côté, `cellule…GetRange()` de l'autre) et `rangeA.ExpandTo(rangeB).Select()`. OO calcule l'union des positions réelles des deux objets. C'est ce que fait le driver *avant* le replace (et l'ex-limite « le driver ne sait pas » était fausse — jamais essayée).
  - **La difficulté est la *re*-sélection APRÈS un replace mixte**, pour deux raisons cumulées :
    1. **Le replace mute le doc par deux mécanismes incompatibles** (`code.js:1431-1511`) : cellules éditées **in-place** (`modifyOriginalTableCells`) + ¶ non-tableau remplacés par **`InsertContent(content,true)` qui DÉTRUIT puis recrée** l'objet ¶. → après `InsertContent`, les objets range qu'on voudrait `ExpandTo` sont **morts** (handles invalidés) : on ne peut pas réutiliser les extrémités de la pré-sélection.
    2. **Le seul repli post-mutation — les positions entières absolues** `doc.GetRange(startPos,endPos).Select()` — **ne se compose pas de façon fiable à travers une frontière de cellule** (les entiers comptent les frontières d'éléments d'une manière ambiguë dès qu'on entre/sort d'une cellule). C'est pourquoi le code **skip explicitement** ce cas plutôt que de poser un surlignage faux (`code.js:2048-2054`, commentaire « OO's selection API can't select partial table + text cross-boundary »).
  - **Bilan** : primitive *fiable* (`ExpandTo` sur objets) inutilisable post-mutation (objets détruits) ; primitive *disponible* (positions entières) non fiable cross-frontière → curseur collapsed assumé. Le **document est juste** ; seul le span manque.
  - **Voie de fix éventuelle** (non triviale, fragile) : refaire post-mutation ce que le driver fait pré-mutation — re-localiser les deux extrémités sur le doc muté, récupérer leurs *nouveaux* objets range, `ExpandTo().Select()`. Obstacle réel = identifier « le contenu qu'on vient d'insérer » dans le doc muté (le ¶ recréé par `InsertContent` n'a pas de marqueur stable ; bookmarks fragiles à travers `InsertContent`, cf L#6 / `phase13-paste-select.md`). Gain purement cosmétique → non prioritaire.
- **L#3** — ~~`InsertContent` *block mode* dans une cellule peut déborder hors cellule (multi-¶ intra-cellule)~~ → **INFIRMÉ live (2026-06-26, build .5)** : injection multi-¶ dans une cellule (T8, §4ter) reste **bornée à la cellule, zéro débordement** (le hook `Select()` une plage DANS la cellule → `InsertContent` est scopé à la cellule). Seul résidu : un ¶ vide cosmétique (= L#7), commun au top-level. Goldens `corpus/T8/{insert,replace}`.
- **L#4** — Insert/Replace avec cross-refs perd parfois les liens (pré-existant v2.6, dépend du document).
- **L#5** — Texte coloré non préservé.
- **L#6** — Post-sélection inline : `selectByPositions` (`GetRange(start, start+len+2)`, `+2` = marqueur de début de ¶, `code.js:2627`) — fragile.
- **L#7** — **Insert ajoute un ¶ vide parasite** (bug confirmé live A0/insert, 2026-06-23). `code.js:1479` fait `content.unshift(Api.CreateParagraph())` de façon **inconditionnelle** → une ligne blanche à chaque « Insérer ». **Correctif = la spec §5bis** (le 1ᵉʳ para sans style est injecté *inline*, jamais via un ¶ vide ; le mode block n'insère un ¶ qu'au vrai milieu, sinon avant/après).
- **L#8** — **Style de paragraphe à l'injection** (exigence, 2026-06-23). Couvert par la **spec §5bis** : un 1ᵉʳ para de fixture **sans style** prend le style du ¶ hôte (inline) ; **avec style** (titre/liste/citation/code), il garde son style md (block). Non testable avec `a-family.docx` (¶ *Normal* seul) → **fixture stylée** dédiée requise (cf. `REVIEW-LOG.md`).

### Image au Replace — DEUX bugs distincts (investigation 2026-06-27)

Le « bug image » du Replace n'est **pas** spécifique au tableau : il existe aussi pour une image **dans un paragraphe**. Mais les deux échouent par des mécanismes **différents** :

| | Live après Replace | `.docx` sauvé | Cause racine |
|---|---|---|---|
| **Image en cellule (T9)** | ✅ ré-insérée (rendu OK, `drawingsInCells=1`) | ❌ perdue (0 `a:blip`, 0 media) | Replace structurel **détruit le tableau original** propriétaire de `word/media/imageN.png` → l'image ré-insérée pointe un **média orphelin** → OO le droppe au save (GC des relations média) |
| **Image en paragraphe** | ❌ **perdue dès le live** (0 drawing) | ❌ perdue | L'image est `AddDrawing`'ée dans un paragraphe **détaché** (`content[]`) puis `InsertContent(content)` **ne transporte pas le drawing**. Échoue en mode inline **ET** block (≠ routage `isSimpleInline`). Le chemin tableau marche car `replaceCellContent`/`addBlockToParagraph` écrit le drawing **directement dans la cellule déjà attachée**. |

- **Pas une régression v3.0-complete→HEAD** : le routage `isSimpleInline` est ~identique (HEAD ajoute seulement `&& !table`) ; le helper `restoreImage` est **identique** avant/après le strip+restore du 2026-04-03 (`89ac98a9c`/`12a48b109`). Le bug ¶-image existe déjà à v3.0-complete. Token image introduit `edbaa981b` (2026-03-20), cell images `46ab6443a` (2026-03-30). Seule fenêtre de régression non écartée = **avant v3.0-complete** (testable uniquement en faisant tourner l'ancien code live).
- **Méthodo validée** : `SetName("scribe-img-N")` à l'extraction (`code.js:2809`, callCommand read-write) **persiste** entre callCommands (`Picture 1`→`scribe-img-0`). Pré-cache `Copy()` scanne le doc pour les drawings nommés `scribe-img-*` (`code.js:846-916`). Consommateurs : `addBlockToParagraph`/`addRunsToParagraph`→`AddDrawing` (1053/1322/1570/1648), `restoreImage` (912).
- **Fix probable (¶)** : écrire le drawing **après** insertion dans le ¶ déjà attaché (comme le chemin tableau), pas dans le `content[]` détaché. **Fix (tableau)** : ré-enregistrer/dupliquer le média pour qu'il ne soit pas orphelin au save.
- **Q ouverte (tableau, non liée image)** : `reconstructTable` = `FromJSON(ToJSON(true,true))` — préserve-t-il largeurs de colonnes, bordures, marges, shading ? Seule la perte du **fill image** est documentée ; le reste **non probé**.
- **Outillage** : `gen_fixtures.py:_count_images` **ne gère pas** les images de ¶ top-level (double-normalise les runs) — ne marche que pour les images en **cellule**. Contournement utilisé pour `img-para.docx` : forcer `n_images` dans un build scratchpad.

---

## 5bis. Règles d'injection & d'extraction (style de ¶) — **spec normative (2026-06-24)**

Spec validée avec Ben. Concerne le plugin Scribe (`code.js`) : injection `buildAndInject` + extraction sélection→md (`paragraphToMarkdown`). Rend L#7 obsolète et précise L#8.

**Convention « espace » :** classe blancs complète = espace, espace insécable ` `, tabulation, saut de ligne (`WS = /[\s\n\r\t ]/`).

**Bord de ¶ = saut de ligne (précision normative 2026-06-24) :** le **début de ¶** (aucun caractère avant le point d'insertion) et la **fin de ¶** (le caractère *suivant* est la marque ¶ = retour à la ligne) comptent **comme un blanc** ⇒ **aucune espace ajoutée de ce côté**. C'est ce qui rend `A1 replace` (tout P1 supprimé puis insertion dans un ¶ vide) = **`XXX`** strict, sans espace traînant.

### Unification
**Remplacer = supprimer la sélection (OO gère la suppression/fusion comme il veut), puis insérer** au curseur réduit résultant. → une seule logique : l'**insertion**.

### Extraction (sélection → markdown)
- ¶ **entièrement** sélectionné (début→fin) → le **marqueur de style md est émis** (niveau de titre `#`, chevron de citation `>`, puce/numéro de liste…).
- ¶ **partiellement** sélectionné → **texte simple** (styles *inline* possibles : gras/italique/…) **sans** marqueur de début de ligne.
- ⇒ C'est l'extraction qui détermine si le 1ᵉʳ para de la fixture « a un style » → pilote inline vs block à la réinjection. Boucle cohérente.

### Définition « 1ᵉʳ para de fixture **avec style** »
= titre / liste / citation / bloc de code. **N'en est PAS** le formatage de caractères (gras/italique/souligné/barré/code inline) → un para de texte gras reste « **sans style** ».

### Injection — Cas A : 1ᵉʳ para **sans style**
- **A.1 — 1ᵉʳ para → INLINE** : runs injectés **dans le ¶ hôte** au point d'insertion ; **¶ hôte et son style conservés**. **Espacement symétrique** (1 espace de séparation, jamais double) :
  - *avant* les runs : ajouter une espace **ssi** il existe un caractère précédent **et** qu'il n'est **pas** un blanc (classe WS) ; **rien en début de ¶** (pas de caractère précédent).
  - *après* les runs : ajouter une espace **ssi** il existe un caractère suivant **et** qu'il n'est **pas** un blanc ; **rien en fin de ¶** (le caractère suivant est la marque ¶ = retour à la ligne, donc compté comme blanc).
  - si un blanc existe déjà de ce côté, ne rien ajouter (jamais de double).
- **A.2 — paras suivants (2..n) → BLOCK** (reformulé/clarifié 2026-06-24, validé Ben) : une fois le 1ᵉʳ para fusionné inline (A.1), le **point d'insertion courant** se trouve juste après ses runs. On **scinde le ¶ hôte à ce point** en deux moitiés — **gauche** = préfixe de l'hôte **+ 1ᵉʳ para**, **droite** = suffixe de l'hôte — puis on insère les paras **2..n entre les deux moitiés**, chacun comme **son propre ¶ gardant son style md**.
  - **Invariant split** (cf. ci-dessous) : les **deux moitiés** portent le **style du ¶ hôte**.
  - **Jamais de ¶ vide** : une moitié **vide** (insertion en tout début ou toute fin de l'hôte) **n'est pas matérialisée** — pas de ¶ vide au bord. (Ainsi `@start` → `[1ᵉʳpara]{styleHôte}[2..n]…[suffixe hôte]{styleHôte}` ; `@end` → `[préfixe hôte + 1ᵉʳpara]{styleHôte}[2..n]` sans ¶ vide ; ordre toujours préservé.)

### Injection — Cas B : 1ᵉʳ para **avec style** (titre / liste / citation / code)
- **Tous** les paras → **BLOCK**, **JAMAIS de fusion inline** (même pas le 1ᵉʳ) : on scinde l'hôte au point d'insertion en deux moitiés et on insère **tous** les paras de la fixture **entre les deux moitiés**, chacun comme **son propre ¶ gardant son style md**.
- **L'hôte garde TOUJOURS son propre style** (les deux moitiés = style hôte) ; il **n'adopte JAMAIS** le style de la fixture, **même si les niveaux diffèrent** (insérer un `##` dans un hôte Titre 1 ne transforme pas l'hôte en Titre 2).
- **Jamais de ¶ vide** ; une moitié vide (insertion en tout début/fin) n'est pas matérialisée.
- **Exemple normatif** (hôte `« The quick brown fox »`{Titre 1} entièrement sélectionné, **Insérer** la fixture `« # Injected »`{Titre 1}) :
  - **Attendu** = **2 ¶ séparés** : `[The quick brown fox]{Titre 1}` puis `[Injected]{Titre 1}`.
  - **Interdit** : `[The quick brown fox Injected]` en **1 seul ¶** (fusion) ; et l'hôte qui **perd**/change son style.

> 🔧 **État code (build `2026-06-24.2`) : correctif Cas B appliqué — validation live EN ATTENTE.** Approche **« spacer hôte »** : avant le block `InsertContent`, on **unshift un ¶ vide au style hôte** en `content[0]`. OO fusionne *ce spacer vide* (et non le para stylé) dans la moitié gauche → la moitié garde le **style hôte** (OO stampe le style de `content[0]` sur la cible du merge), et le 1ᵉʳ bloc stylé reste **un ¶ séparé**. Robuste que OO fusionne le spacer ou le laisse autonome : `cleanupLeadingSpacer()` retire l'élément avant le 1ᵉʳ bloc réel **s'il est vide** (pas de ¶ vide au bord, ex. insertion `@start`), sinon le conserve (moitié gauche non vide). `selectByRefs` saute le spacer (`content[1]`). *(Détection « stylé » = heading / list / quote / code ; formatage caractère seul = non stylé. Tables/images = blocs autonomes, pas concernés.)* **À VALIDER live** sur `styled-family` : insérer `# Injected`{Titre 1} dans hôte {Titre 1} entièrement sélectionné → attendu **2 ¶ séparés, hôte garde Titre 1** ; + `@start`/`@mid`/`@end` + replace ; + non-régression a-family (Cas A) / inline.
>
> ⚠️ *Symptôme avant correctif (build `.1`)* : fixture stylée mono-¶ **fusionnée** dans l'hôte (1 ¶) + **hôte adopte le style** de la fixture si niveau différent. Cause : le fix Cas A ne traitait que le 1ᵉʳ para *sans* style.

### INVARIANT « split » — style des deux moitiés (normatif, validé Ben 2026-06-24)
**Chaque fois que l'hôte est scindé** (mode block, insert OU replace — et plus tard lors d'un split de **cellule**), les **DEUX ¶ résultants** (gauche ET droite du point de split) **doivent porter le MÊME style de ¶ que l'hôte d'origine**. Aucun ne doit retomber en *Normal*. *(✅ **CORRIGÉ 2026-06-24** : `buildAndInject` capture le `hostStyle` (¶ hôte, trouvé par itération — robuste aux curseurs collapsed), donne ce style au 1ᵉʳ para injecté plain avant le merge — Cas A — et le ré-applique à la moitié droite (¶ traînant). Validé live `styled-family` block @start/@mid/@end + replace : les deux moitiés de P1 restent `Heading 1`, `Second` reste Normal, zéro ¶ vide ; aucune régression a-family/inline.)*

### Sémantique multi-¶ — TRANCHÉE (option A, Ben 2026-06-24)
Pour un contenu **multi-¶** dont le **1ᵉʳ para est sans style** : **option A** — le 1ᵉʳ para **fusionne inline** dans l'hôte (au point d'insertion, devient la fin de la moitié gauche), les paras **2..n** sont des **blocs** insérés entre les deux moitiés (cf. A.2 reformulé). **Pas d'ordre inversé** (mon ancienne crainte venait de la lecture erronée « blocs avant l'hôte »). L'inline n'est donc **pas** réservé au mono-¶ : il s'applique au 1ᵉʳ para quel que soit le nombre de paras suivants.

### À corriger en même temps
- **L#1** : en inline avec remplacement **partiel**, le **suffixe non sélectionné ne doit pas perdre son formatage** de caractères. → **VÉRIFIÉ OK (2026-06-24)** sur le code actuel (cf. légende L#1) : aucun correctif nécessaire pour le chemin inline.
- **Post-sélection** : couvre le contenu injecté (mécanisme existant, cf. **L#6**).

### Résultats attendus sur `a-family.docx` (fixture `"XXX"` = sans style, mono-¶ → pur inline)
| Cas | Point d'insertion | Attendu (1 ¶, style hôte) |
|---|---|---|
| A0 insert | @start | `XXX The quick brown fox` |
| A1 insert | @end | `The quick brown fox XXX` |
| A2 insert | @mid (off. 9) | `The quick XXX brown fox` *(pas de double espace)* |
| A3 insert | @end | `The quick brown fox XXX` |
| A4 insert | off. 4 | `The XXX quick brown fox` |
| A1 replace | tout P1 suppr. | `XXX` *(aucun voisin → aucune espace)* |
| A3 replace | « quick brown fox » suppr. | `The XXX` |
| A4 replace | « The » suppr. | `XXX quick brown fox` |
| A2 replace | curseur @mid | `The quick XXX brown fox` |

→ vs captures actuelles : **plus aucun ¶ vide**, **plus de double espace** (A2 replace), **plus de `" "` traînant** (A1 replace). Ces bundles deviennent **xfail** jusqu'au correctif `code.js`.

---

## 6. À faire / questions ouvertes

- [x] **Cellules fusionnées (T2b/c) — sonde Q1-Q3 faite (2026-06-17).** Modèle OO confirmé (§4bis) : fusion H → moins de cellules logiques ; fusion V → maître normal + continuation = cellule vide distincte, attribution stable, round-trip `(r,c)` sûr. → Replace in-place validé.
- [x] **S5 (2026-06-17)** — trou de détection `full` **confirmé** : table V-merge pleine → `hitCount 10 < 11` → classée `partial` (bénin, cf §4bis #3).
- [x] **Q4 (2026-06-17)** — **corruption confirmée** : `RemoveColumn` d'une colonne à fusion H supprime tout le span (perte de `B3`). → règle « Insert = clone complet si fusion » désormais **obligatoire** (§4bis #4, décision 2).
- [ ] **T2b/c (fusion) — prêt à planifier.** Impl : Replace in-place (T2a existant) ; Insert ⇒ clone complet si la table contient une fusion (court-circuiter `RemoveRow/Column`) ; fix optionnel du trou `full` (~5 LOC) ; documenter mismatch S3.
- [ ] **T10** : la garde est défensive, mais son message utilisateur est trompeur (parle de « coupe » alors que c'est une incohérence de détection). Soit le rendre silencieux (log dev), soit reformuler. Instrumenter pour savoir s'il se déclenche réellement (notamment sur cellules fusionnées).
- [ ] Tester systématiquement chaque ligne × {Insérer, Remplacer} × {texte, riche, tableau, image, footnote, cross-ref} — colonne « état » à passer en vert/rouge par campagne.

---

*Annexe — fonctions clés :* `analyzeTableSelection` (2483-2579), `buildAndInject` (354-1717), `replaceCellContent` (837-861), `addRunsToParagraph` (1072-1183), `selectByRefs`/`selectByPositions` (1564-1642), `pasteHtml` fallback (1728-1786), clipping text-matching (2795-2835), spacing (510-563 / 1741-1769).
