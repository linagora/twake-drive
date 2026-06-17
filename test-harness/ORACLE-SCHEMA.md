# Oracle & hooks dev — schéma et contrat (T-03)

**Créé :** 2026-06-17
**Statut :** partie *pure* (sans OO) — le sérialiseur côté plugin reste à implémenter (session OO).
**Module pur :** `test-harness/oracle/normalizeModel.js` (+ spec). Config : `jest.harness.config.js`.
**Stratégie :** `.planning/TEST-STRATEGY.md` §4-§6.

## 1. Contrat des hooks dev (postMessage)

Le plugin expose **3 handlers dev-only (flag-gated)**. La page top (Chrome MCP `evaluate_script`) envoie un message ; le plugin répond par `postToAncestors()`. Aller-retour corrélé par `reqId`.

```
→ { scribeTest: "setSelection",  reqId, spec }     // spec = notation de SELECTION-CASES (ex. "P1@mid..P1@mid")
← { scribeTestResult: "setSelection", reqId, ok, error? }

→ { scribeTest: "injectFixture", reqId, md, mode }  // mode = "insert" | "replace" ; md = fixture déterministe (PAS de LLM)
← { scribeTestResult: "injectFixture", reqId, ok, error? }

→ { scribeTest: "dumpState",     reqId, scope? }    // scope = "region" (défaut) | "doc"
← { scribeTestResult: "dumpState", reqId, model }   // model = { blocks, selection } (cf §2)
```

Déterminisme : `injectFixture` court-circuite l'appel LLM et passe `md` directement à `buildAndInject(md, mode)`. La sélection post-action est lue par `dumpState` via `GetRangeBySelect()`.

## 2. Schéma du modèle capturé `{ blocks, selection }`

Forme **brute** que `dumpState` doit produire (le normaliseur s'occupe du reste) :

```
model = { blocks: Block[], selection: Selection | null }

Block (paragraphe) = { type: "p", runs: Run[] }
Run = { t: string, b?, i?, u?, s?, code?, link? }
  // b=gras, i=italique, u=souligné, s=barré, code=monospace, link=URL
  // n'émettre que les flags VRAIS (1) ; le texte peut contenir les artefacts OO
  //   (\t séparateur de cellule, \r\n marque de ¶, nbsp) → nettoyés à la normalisation

Block (table) = { type: "table", grid: Cell[][] }   // grid[r][c], index LOGIQUE (cf sonde)
Cell = { blocks: Block[], vmerge?: "master"|"cont", hspan?: number }
  // fusion V : le maître porte le contenu, la continuation = cellule vide distincte (sonde S3/S4)
  // fusion H : la ligne a MOINS de cellules logiques ; hspan>1 sur la cellule fusionnée

Selection = { start: Pos, end: Pos }     // collapsed ajouté par la normalisation si start==end
Pos = { block: int, run?: int, offset?: int }
  // STABLE & block-relatif. Ne JAMAIS stocker les positions OO absolues (volatiles).
```

## 3. Normalisation (forme canonique comparable)

`normalizeModel(captured)` → forme déterministe. Règles (impl. `normalizeModel.js`) :

1. **Whitelist** : seuls les champs connus sont recopiés → tout champ volatil
   (positions OO absolues, `rsid`, `_id`, `rowIndex`/`cellIndex` de la sonde…) est
   **éliminé par construction**.
2. **Texte** : retrait de `\t`, `\r\n`/`\r` (artefacts) ; nbsp (` `) → espace.
3. **Runs** : flags falsy supprimés ; runs purement vides supprimés (bruit), la
   structure du ¶ est conservée (¶ vide → `runs: []`).
4. **Sélection** : `start == end` → `collapsed: true` (cas A0 / curseur).

Propriété garantie (testée) : **idempotence** — `normalize(normalize(x)) === normalize(x)`.

## 4. Comparaison (golden)

`oracle attendu = normalizeModel(capture)`. Le test golden compare deux modèles
**normalisés** par égalité profonde (Jest `toEqual`, diff lisible). Pour le futur
CLI de rejeu (T-05), un differ dédié pourra produire un rapport ciblé.

## 5. Reste à faire (session OO)

- Implémenter les 3 handlers dans le plugin (flag-gated) en produisant **exactement** le schéma §2.
- Valider le round-trip sur 1 cas réel (gate T-03) : `setSelection → injectFixture → dumpState → normalizeModel → comparer à un golden écrit à la main`.
- Confirmer la couverture de `setSelection` par l'API OO pour A0–A8 / T1–T3 (T4–T6 = manuels).
