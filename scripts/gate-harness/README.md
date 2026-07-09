# Scribe gate harness

Headless batch harness for the **v3.1-03 HARD GATE** (`PROBE-01`). It drives the
real Scribe inline prompt against the live cozy-stack LLM proxy, parses + scores
each response with the **production** measurement engine, and emits a
`probe-corpus` envelope + aggregate that backs the go/no-go verdict in
`.planning/phases/v3.1-03-…/v3.1-03-GATE.md`.

The gate measures **semantic separation** (duplication / preamble leakage) and
two **zero-tolerance hard blockers** — split tables and broken cross-references —
not merely "is the JSON valid".

## Faithfulness model (zero drift)

- **Measurement** (`parseScribeResponse` + `scribeProbe`) is loaded from the real
  `src/modules/views/OnlyOffice/Scribe/*.js` at runtime via `data:` import — it
  can never diverge from production.
- **Prompt prefix** is a verbatim copy in `prompt.mjs` (because `scribeAI.js`
  imports cozy-ui/turndown and can't load in plain node). `run.mjs`
  `assertPromptInSync()` re-reads the live source and **aborts (exit 2)** if any
  copied string has drifted.

## Files

| File | Role |
|------|------|
| `fixtures.mjs` | Synthetic translate/rewrite/correct inputs (5 locales) + auto-loads `captured/*.json` |
| `prompt.mjs` | Verbatim prod prompt assembly; `v1` = prod baseline, `v2` = experimental candidate |
| `run.mjs` | Mints a cozy-stack token, calls the LLM proxy, scores, writes `out/` |
| `captured/` | Table / REF / footnote inputs carrying the OO plugin marker grammar (see below) |
| `out/` | Timestamped corpus envelopes from each run (git-ignored evidence scratch) |

## Run

Requires the `cozy-stack` CLI on PATH and the oo-dev / cozy-stack runtime up.

```bash
# baseline (current prod prompt)
node scripts/gate-harness/run.mjs --variant v1 --domain alice.localhost:8080

# candidate (hardened separation contract)
node scripts/gate-harness/run.mjs --variant v2 --domain alice.localhost:8080
```

Flags: `--variant v1|v2`, `--domain`, `--concurrency 4`, `--limit N`,
`--temperature 0.3`, `--out path.json`.

Each run prints the aggregate (dupRate, preambleRate, splitTableCount,
refBrokenCount, fragDist, coverage) scored by the production `scribeProbe`, and
writes the full corpus to `out/corpus-<timestamp>.json`.

## Table / REF capture workflow

The two hard blockers (GATE thresholds **#4 split-table** / **#5 broken-REF**,
coverage **#8/#9**) need inputs that carry the OO plugin marker grammar:

- table: `[TABLE:N][CELL:r,c]…[/CELL]…[/TABLE]`
- cross-ref: `{{REF:scribe-ref-N:visible text}}`
- footnote: `[^scribe-fn-N]` (folded into the same REF-integrity set-diff)

The harness measures the **model's output** on these — the inputs are only the
selection content; the instruction comes from the action template.

### Capture file shape

Drop any number of `captured/*.json` files; `fixtures.mjs` loads them all:

```json
{
  "source": "seed",            // "seed" = hand-authored | "live" = exported from the app
  "cases": [
    {
      "id": "cap-table-fr-1",
      "surface": "popover",     // optional, defaults to "popover"
      "action": "translate-en", // an id present in prompt.mjs ACTION_TEMPLATES
      "locale": "en",           // OUTPUT language (drives perLocale coverage)
      "tags": { "hasTable": true, "hasRef": false },
      "input": "Résultats :\n[TABLE:0][CELL:0,0]…[/CELL][/TABLE]"
    }
  ]
}
```

`buildMessages()` auto-injects the TABLE / FOOTNOTE / REF clauses whenever the
corresponding markers appear in `input`, exactly like production.

### Getting real (`source: "live"`) captures

`table-ref-seed.json` (`source: "seed"`) is grammar-faithful and lets the gate
run today, but the most credible verdict uses real plugin output:

1. In the live OO/Drive runtime, select document content containing a table /
   cross-reference / footnote and trigger a Scribe action.
2. Open the dev panel (DevPanelGrid) → the parsed-response viewer shows the
   captured `inputMd`. Use the corpus **export** control to dump the recorded
   samples (`scribeProbe.exportCorpus`), or copy the `inputMd` directly.
3. Save the table/REF inputs as a `captured/<name>.json` with `source: "live"`
   and the correct `hasTable`/`hasRef` tags.
4. Re-run `run.mjs --variant v2`.

> `run.mjs` never touches the curated `.planning/…/probe-corpus.json` — merging a
> run's `out/` into the durable corpus is a deliberate, separate step.

## Pronouncing the verdict

When a `--variant v2` run shows **N ≥ 30**, all 5 locales, `dupRate`/`preambleRate`
≤ their frozen thresholds, **`splitTableCount` = 0** and **`refBrokenCount` = 0
with table/REF coverage > 0**: freeze the threshold values in `GATE.md` §2, paste
the aggregate into §7, pronounce **PASS** in §6, and adopt `v2` as the prod
prompt. Any hard-blocker breach on real cases → revisit the contract before any
card rendering (v3.1-04/05).
