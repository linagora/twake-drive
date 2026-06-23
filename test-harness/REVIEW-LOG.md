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

| Bundle | statut revue | verdict | ¶/espace ajouté (constat) |
|---|---|---|---|
| A0/insert  | à revoir | — | ¶ vide en TÊTE (visible : tout descend d'1 ligne) |
| A1/insert  | à revoir | — | ¶ vide en QUEUE (entre XXX et P2) |
| A1/replace | à revoir | — | run `" "` traînant après XXX |
| A2/insert  | à revoir | — | ¶ vide en TÊTE + anomalie (P1 resté intact) |
| A2/replace | à revoir | — | double espace autour de XXX (csv=xfail) |
| A3/insert  | à revoir | — | ¶ vide en QUEUE |
| A3/replace | à revoir | — | aucun (`The ` + `XXX`) |
| A4/insert  | à revoir | — | aucun (split propre, XXX en ¶ isolé) |
| A4/replace | à revoir | — | espace repositionnée (`XXX quick brown fox`) |

## Constats transverses ouverts (à statuer pendant la revue)

- **¶ vide parasite** sur les inserts en bord de bloc : A0/A2 en tête, A1/A3 en queue ;
  A4/insert est propre → preuve que ce n'est pas inévitable. **Décision spec clé.**
- **A2** : `@mid`=9 tombe sur l'espace « quick‿brown » → la fixture ne teste pas le vrai
  *milieu de mot*. Fixture à corriger ou cas à dédoubler.
- **A0/replace** : non capturé (`na` — replace sur sélection vide non applicable, FRAG-04).
