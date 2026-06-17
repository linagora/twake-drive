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

| # | Sélection *(description)* | Insérer | Remplacer | État / limite |
|---|---------------------------|---------|-----------|---------------|
| A0 | `[P1@x,P1@x]` ∅ *(curseur seul)* | insère au curseur ; pas de chip ; ne pas utiliser `init()` (renverrait tout le ¶) | par défaut **absent** (FRAG-04, pas de sélection) ; s'il est exposé, se comporte comme *Insérer* (curseur) pour éviter un visuel qui varie | ✅ |
| A1 | `[P1@start,P1@end]` *(¶ entier)* | nouveau ¶ après le ¶ courant ; pas de `&nbsp;` | remplace **tout le ¶** | ✅ |
| A2 | `[P1@mid,P1@mid]` *(milieu d'un mot)* | insère au point ; `&nbsp;` des deux côtés | remplace le fragment ; `&nbsp;` des deux côtés | ⚠️ **L#1** (Replace) : le suffixe non sélectionné perd ses styles inline |
| A3 | `[P1@space,P1@end]` *(après espace → fin)* | insère en fin de ¶ ; pas de `&nbsp;` après | remplace ; espace de tête déplacée (CommonMark) ; pas de `&nbsp;` après | ✅ · ⚠️ **L#6** post-sél. inline fragile |
| A4 | `[P1@start,P1@space]` *(début → mot, espace finale)* | insère au point ; pas de `&nbsp;` avant | remplace ; espace finale déplacée **après** le marqueur md | ✅ |
| A5 | `[P1@start,P3@end]` *(plusieurs ¶ entiers)* | blocs insérés après P3 | remplace P1..P3 ; injection ¶ par ¶ en **ordre inverse** + fusion ¶ de queue | ✅ |
| A6 | `[P1@mid,P3@mid]` *(partiel → entiers → partiel)* | insère au point ; clipping **text-matching** à l'extraction | remplace la plage ; clipping text-matching (pas d'arithmétique de positions, les `\r\n` faussent) | ⚠️ **L#1** (Replace) sur tête/queue |
| A7 | *(¶ vides en bord de sélection)* | préserver les ¶ vides (split `\n\n` **avant** `marked.lexer`) | idem | ✅ |
| A8 | sélection **> 100 ¶** *(très grande)* | **garde de perf** : repli extraction texte brut → perte du riche | idem | ✅ (assumé) |

---

## 4. Matrice — tableaux

Mêmes conventions Insérer / Remplacer. Rappel : pour un tableau, *Insérer* produit toujours une **copie** (réduite si partielle) placée **après** le tableau / la sélection — l'**original reste intact** ; *Remplacer* modifie **in-place** (ou clone si englobement structurel).

| # | Sélection *(description)* | Insérer | Remplacer | État / limite |
|---|---------------------------|---------|-----------|---------------|
| T1 | `[T1.intra(r,c),…]` *(dans **une** cellule)* | **chemin paragraphe** (insère dans la cellule au point) | **chemin paragraphe** (remplace le texte de la cellule) | ✅ |
| T2 | `[T1.cells,T1.cells]` *(lignes/cols partielles)* | **copie réduite** du tableau (lignes/cols non concernées supprimées) insérée après le tableau | **in-place** `modifyOriginalTableCells` ; cellules non sélectionnées **et vides** intactes | ✅ |
| T3 | `[T1.full,T1.full]` *(tableau entier englobant)* | clone complet inséré après le tableau | **clone + `InsertContent`** ; post-sélection OK | ✅ |
| T4 | `[P1@x,T2.cells]` *(¶ → finit dans un tableau)* | après le tableau : 1) ¶/tableaux entiers du début, 2) **copie réduite** du tableau de fin *(cas 2b)* | cellules in-place + `InsertContent` par ¶ (ordre inverse) | ⚠️ **L#2** (Replace) : pas de post-sél. (texte d'un seul côté) |
| T5 | `[T1.cells,P3@x]` *(tableau → finit après)* | après la fin de sélection : 1) copie réduite du tableau de tête, 2) ¶/tableaux suivants *(cas 2c)* | cellules in-place + `InsertContent` par ¶ | ⚠️ **L#2** (Replace) |
| T6 | `[T1.cells,T3.cells]` *(deux tableaux partiels, milieu entier)* | après la fin : 1) copie réduite tête, 2) milieu entier, 3) copie réduite queue *(cas 2d)* | in-place les deux tableaux + `InsertContent` par ¶ du milieu | ⚠️ **L#2** (Replace) |
| T8 | *(cellule multi-¶, dont vides)* | split `\n\n` ; `replaceCellContent` + `AddElement(pos,para)` | idem | ⚠️ **L#3** : block mode peut déborder hors cellule |
| T9 | *(cellule avec image)* | `drawingIndex` scanne **aussi** les ¶ de cellules (absents de `GetAllParagraphs()`) | idem | ✅ |
| T10 | **garde défensive** — *pas un cas de sélection utilisateur* : `table.GetRange()===null` (`no_range`) **ou** aucun ¶ sélectionné ne tombe dans une cellule alors que le test de positions amont jugeait le tableau « chevauchant » (`no_cell_match`, sélection qui frôle la plage du tableau sans contenu de cellule dedans) | **bandeau** câblé (lignes 2718-2726) : « …coupe un tableau de manière ambiguë. Sélectionnez des lignes complètes. » — **message trompeur** (le vrai déclencheur est une incohérence de détection, pas une coupe) | idem | ⚠️ ne devrait pas se déclencher en usage normal (OO interdit l'ambiguïté géométrique, phase 26 impl #4) ; message à revoir |
| T11 | *(mismatch nb de cellules réponse ≠ sélection)* | **bandeau d'avertissement** | idem | ✅ |
| T12a | *(fusion **horizontale** dans la sélection)* | **clone complet** (jamais de `RemoveColumn` — corruption confirmée Q4) | **in-place** ✅ (round-trip `(r,c)` auto-cohérent — *confirmé sonde S2*) | ⚠️ aperçu GFM désaligné (cosmétique) — cf §4bis |
| T12b | *(fusion **verticale** dans la sélection)* | **clone complet** (jamais de `RemoveRow`) | **in-place** ✅ (maître à sa ligne, continuation = cellule vide distincte jamais touchée — *confirmé sonde S3/S4*) | ⚠️ S3 : sélection continuation seule n'édite pas la cellule fusionnée (UX) ; trou détection `full` (S5) — cf §4bis |
| T13 | *(tableaux imbriqués)* | **non supporté** | **non supporté** | ❌ hors scope |

---

## 4bis. Cellules fusionnées (T12) — modèle OO confirmé + spécification

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

1. **Aperçu GFM désaligné (cosmétique, T12a+b)** — `cellsToMarkdownTable` indexe par `(r, cellIndex)` logique. Une ligne fusionnée H produit une cellule de moins → colonne visuelle vide en bout ; une continuation V n'émet pas de cellule col 0. Pipe-table d'aperçu désaligné vs le visuel, **sans corruption du document**. → **Accepté en v1.**
2. **Mismatch visuel/traité (T12b, S3)** — sélectionner *seulement* une ligne de continuation surligne la cellule fusionnée à l'écran, mais son contenu (ancré au maître, non sélectionné) **n'est ni extrait ni édité**. Pas de corruption ; surprise UX possible. → option future : étendre la sélection au maître, ou afficher un indice. **Documenté, non bloquant.**
3. **Trou de détection `full` — CONFIRMÉ (S5, 2026-06-17)** — sélectionner *toute* la table à fusion V donne `hitCount = 10 < totalNonEmptyCells = 11` (la continuation vide `(2,0)` est comptée mais jamais sélectionnable) → **classée `partial`, jamais `full`** ; l'extraction omet `[CELL:2,0]`. **Bénin en pratique** : toutes lignes/colonnes restent représentées → le chemin partiel ne réduit rien → équivaut au clone complet. Ne mord que si une réduction est requise (→ #4). *Incohérence sous-jacente :* `totalNonEmptyCells` compte `elems>0`, la boucle d'inclusion des vides teste `elems===0`. → **fix optionnel** : exclure du compte les cellules à ¶ unique vide.
4. **Insert + réduction de clone — CORRUPTION CONFIRMÉE (Q4, 2026-06-17)** — `RemoveColumn` (`code.js:1497-1521`) d'une colonne traversée par une fusion **horizontale** supprime **tout le span** : retirer la colonne B a effacé `B3` (qui couvrait B+C) → r3 réduite à `A3`, **perte de données**. → **Insert d'une table contenant une fusion (h ou v) ⇒ insérer le clone COMPLET, jamais de `RemoveRow/Column`.** Non négociable.

### Décisions (verrouillées après sonde S1-S5 + Q4)

1. **Replace = in-place** pour H et V (pas de repli table complète) — *confirmé sûr (S3/S4)*. ✅
2. **Insert = clone complet** dès qu'une fusion (h ou v) est présente — *obligatoire, corruption `RemoveColumn` confirmée (Q4)*. ✅
3. **Aperçu désaligné** accepté en v1 (cosmétique). ✅
4. **Trou de détection `full` (#3)** : fix optionnel (~5 LOC) — faible priorité car bénin ; sinon documenter comme limite.
5. **Mismatch S3 (#2)** : documenté comme comportement connu (sélection continuation seule = cellule fusionnée non éditée).

---

## 5. Matrice — axe « contenu réinjecté » (transversal à tous les cas A/T)

Ces limites dépendent du **type de contenu**, pas de la géométrie de sélection — elles s'appliquent par-dessus n'importe quelle ligne A/T.

| Contenu | Insérer | Remplacer | État / limite |
|---------|---------|-----------|---------------|
| texte simple | OK | OK | ✅ |
| riche inline (gras, italique, souligné, barré, code, liens) | OK | OK | ✅ |
| **texte coloré** | non préservé | non préservé | ⚠️ **L#5** |
| image | OK (round-trip) | OK | ✅ |
| footnote | OK (recréée post-InsertContent) | OK | ✅ |
| **cross-ref** (réf. titre / bookmark) | liens parfois perdus selon le document | idem | ⚠️ **L#4** (pré-existant v2.6) |

---

### Légende des limites (inlinées ci-dessus)

- **L#1** — Replace partiel d'un ¶ : le suffixe non sélectionné perd ses styles inline (bug OO `InsertContent`). *(piste : sauver/restaurer le formatage du suffixe, ou splice run-level.)*
- **L#2** — Pas de post-sélection sur Replace mixte « texte d'un seul côté du tableau » (l'API OO ne sait pas sélectionner à cheval sur une frontière de cellule). OK pour : table pure, tout Insert, mixte texte des deux côtés.
- **L#3** — `InsertContent` *block mode* dans une cellule peut déborder hors cellule (multi-¶ intra-cellule) → préférer la modif in-place.
- **L#4** — Insert/Replace avec cross-refs perd parfois les liens (pré-existant v2.6, dépend du document).
- **L#5** — Texte coloré non préservé.
- **L#6** — Post-sélection inline : `selectByPositions` (`GetRange(start, start+len+2)`, `+2` = marqueur de début de ¶, `code.js:2627`) — fragile.

---

## 6. À faire / questions ouvertes

- [x] **Cellules fusionnées (T12) — sonde Q1-Q3 faite (2026-06-17).** Modèle OO confirmé (§4bis) : fusion H → moins de cellules logiques ; fusion V → maître normal + continuation = cellule vide distincte, attribution stable, round-trip `(r,c)` sûr. → Replace in-place validé.
- [x] **S5 (2026-06-17)** — trou de détection `full` **confirmé** : table V-merge pleine → `hitCount 10 < 11` → classée `partial` (bénin, cf §4bis #3).
- [x] **Q4 (2026-06-17)** — **corruption confirmée** : `RemoveColumn` d'une colonne à fusion H supprime tout le span (perte de `B3`). → règle « Insert = clone complet si fusion » désormais **obligatoire** (§4bis #4, décision 2).
- [ ] **T12 — prêt à planifier.** Impl : Replace in-place (T2 existant) ; Insert ⇒ clone complet si la table contient une fusion (court-circuiter `RemoveRow/Column`) ; fix optionnel du trou `full` (~5 LOC) ; documenter mismatch S3.
- [ ] **T10** : la garde est défensive, mais son message utilisateur est trompeur (parle de « coupe » alors que c'est une incohérence de détection). Soit le rendre silencieux (log dev), soit reformuler. Instrumenter pour savoir s'il se déclenche réellement (notamment sur cellules fusionnées).
- [ ] Tester systématiquement chaque ligne × {Insérer, Remplacer} × {texte, riche, tableau, image, footnote, cross-ref} — colonne « état » à passer en vert/rouge par campagne.

---

*Annexe — fonctions clés :* `analyzeTableSelection` (2483-2579), `buildAndInject` (354-1717), `replaceCellContent` (837-861), `addRunsToParagraph` (1072-1183), `selectByRefs`/`selectByPositions` (1564-1642), `pasteHtml` fallback (1728-1786), clipping text-matching (2795-2835), spacing (510-563 / 1741-1769).
