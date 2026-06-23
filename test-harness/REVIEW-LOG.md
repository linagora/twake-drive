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

## Découvertes / décisions de revue (chronologique)

- **2026-06-23 — A0/insert ⇒ xfail.** Bug ¶ vide parasite confirmé live par Ben. Deux règles spec
  ajoutées : **L#7** (break conditionnel à la position) et **L#8** (héritage de style). Spec
  `SELECTION-CASES.md` mise à jour (légende L#7/L#8 + ligne A0). Correctif `code.js:1479` et fixture
  stylée = chantiers de suivi, hors de cette passe de revue.
