# Schéma de la matrice de cas (CSV = source de vérité)

**Créé :** 2026-06-17
**Source de vérité :** `cases.csv` (cas A/B) + `content-fixtures.csv` (axe contenu, matrice C)
**Spec narrative :** `SELECTION-CASES.md` (modèle, notation, définitions des limites L#1–L#6)
**Stratégie :** `TEST-STRATEGY.md`

## Principe

- Le **CSV est la source de vérité unique** des cas de test. Toute vue markdown du tableau (dans `SELECTION-CASES.md` ou ailleurs) est **générée depuis le CSV, à sens unique (CSV ⇒ MD)** — **jamais éditée à la main**.
- Les cellules peuvent contenir des **marques markdown** (`**gras**`, `&nbsp;`, etc.) ; elles sont réinjectées telles quelles dans la vue MD.
- La **prose-spec** (ce qu'est `L#1`, ce que signifie `@mid`, l'analyse §4bis) reste dans `SELECTION-CASES.md` ; le CSV la **référence** (colonne `limits`), il ne la duplique pas.
- Édition humaine : ouvrir le CSV comme une **grille** (Excel/LibreOffice) ; commiter en **texte** (diffs git lisibles — raison du choix CSV plutôt que `.xlsx`).

## `cases.csv` — colonnes

| Colonne | Sens |
|---|---|
| `id` | identifiant **stable** du cas (A0…A8, T1…T13). Clé pour la provenance, le delta, le nommage des goldens. |
| `group` | `paragraph` \| `table` \| `guard` |
| `selection` | notation de la sélection (cf §2 de `SELECTION-CASES.md`). **Contient des virgules → champ quoté.** |
| `description` | libellé court du cas |
| `driving` | comment poser la sélection : `auto` (API OO) \| `manual` (drag souris — cas cross-boundary T4–T6) \| `na` (garde, pas une sélection) |
| `fixture` | contenu déterministe injecté (jamais de LLM) — token nommé, cf §Fixtures |
| `expected_insert` | comportement attendu pour **Insérer** (prose, marques md autorisées) |
| `status_insert` | verdict attendu côté Insérer (cf §Statuts) |
| `expected_replace` | comportement attendu pour **Remplacer** |
| `status_replace` | verdict attendu côté Remplacer |
| `limits` | limites référencées (`L1`…`L6`, séparées par `;`) — définies dans `SELECTION-CASES.md` |
| `notes` | libre |

## `content-fixtures.csv` — axe contenu (matrice C)

Axe **orthogonal** : un type de contenu réinjecté, à appliquer **sélectivement** sur 2–3 cas représentatifs (pas en produit cartésien complet). Colonnes : `content`, `fixture`, `expected_insert`, `expected_replace`, `status`, `limits`, `notes`.

## Vocabulaire `status`

| Valeur | Sens |
|---|---|
| `pass` | comportement correct attendu → golden capturé puis **béni visuellement** une fois |
| `xfail` | **bug connu** → golden **écrit à la main** (sortie *désirée*), test rouge attendu jusqu'à correction |
| `na` | non applicable (ex. A0 Remplacer = pas de sélection ; gardes T10) |
| `deferred` | comportement non encore spécifié (ex. écriture en cellules fusionnées au-delà du round-trip) |
| `unsupported` | hors scope acté (ex. T13 tableaux imbriqués) |

## Vocabulaire `driving`

`auto` = sélection posée par l'API OO (`GetRange().Select()`, positions char) — A0–A8, T1–T3, T8–T12. `manual` = nécessite un drag souris car l'API ne sait pas représenter la sélection (limite L#2) — **T4–T6**. `na` = pas une sélection utilisateur (T10).

## Fixtures nommées

| Token | Contenu injecté |
|---|---|
| `XXX` | texte simple déterministe |
| `multi-para` | deux paragraphes (teste le split / block mode) |
| `image` | une image inline |
| autres | voir `content-fixtures.csv` (`rich-inline`, `color`, `footnote`, `crossref`) |

## Règle d'expansion (cas → scénarios → goldens)

Le harness **dérive** les scénarios de test depuis le CSV :

```
pour chaque ligne de cases.csv :
  pour chaque mode ∈ {insert, replace} où status_<mode> ≠ na :
    scénario = (id, mode, selection, fixture, expected_<mode>, status_<mode>)
    [optionnel] × content-fixtures sélectionnées (sur cas représentatifs)
    → 1 golden : { source.docx, action, expected.model.json, expected.selection.json }
```

`expectedRef`/chemin du golden = **dérivé** (`<id>-<mode>[/<content>]`), pas une colonne source.

## Provenance & delta

- Chaque run de capture **embarque un snapshot** `cases.snapshot.csv` dans le bundle de résultats.
- L'outil calcule le **delta** entre matrice courante et précédente via `id` stable + **hash** des champs exécutables (`selection`, `fixture`, `expected_*`, `status_*`) :
  - ajouté → à capturer ; modifié → golden invalidé, **re-bénir** ; inchangé → **sauté** ; supprimé → archivé.
- ⇒ l'humain n'est re-sollicité que pour le **delta**.

## Contrat de génération CSV ⇒ MD (à implémenter en T-02)

- Un script lit `cases.csv` et **régénère** les blocs de tableau markdown dans les fichiers qui le référencent (zone délimitée par des marqueurs, ex. `<!-- cases:table:paragraph -->` … `<!-- /cases:table -->`).
- Le MD généré est **read-only** : toute modif passe par le CSV.
