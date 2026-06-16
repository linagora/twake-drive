# Pitfalls Research

**Domain:** Adding a structured JSON response contract (`{ discussion, fragments[] }` + `{{fragment:N}}` markers) to an existing LLM writing assistant served over an OpenAI-compatible, non-streamed cozy-stack proxy. Hand-rolled validation, context-aware fallback, multi-turn chat + single-shot inline popover, 5 locales (fr/en/de/es/it).
**Researched:** 2026-06-16
**Confidence:** HIGH for JSON-reliability and writing-quality-degradation findings (multiple sources + an arxiv study + aider's production report); MEDIUM for the contract-specific failure modes (duplication, marker mismatch) — reasoned from the contract design + general LLM behavior, but HIGH that they will occur given how the contract is shaped.

> **Phase vocabulary** (from PROJECT.md v3.1 plan): **contract module** = JSON Schema + `parseScribeResponse` + hand-rolled validation + context-aware fallback; **prompt** = system prompts (popover + chat) that emit the contract; **probe** = dev-only conformance sonde (1 / N / 0 fragments) run before UI work; **render** = chat panel + inline popover rendering of `discussion` + `{{fragment:N}}` cards; **hardening** = re-ask, feature-flag, action-menu migration, tests. Each pitfall below names the phase that owns its mitigation.

---

## The Two Defining Risks (read these first)

The whole point of this contract is **separation of meta-discussion from insertable content**. The single highest-probability way this milestone fails is not a JSON syntax error (those are mechanically recoverable) — it is the model *honoring the JSON shape while violating the separation*. Pitfalls 1 and 2 are the core risks. Everything else is supporting hygiene.

---

## Critical Pitfalls

### Pitfall 1: Fragment text duplicated into `discussion` (separation collapse)

**What goes wrong:**
The model returns valid JSON, but `discussion` *contains the same prose that is also in `fragments[]`* — e.g. `discussion: "Here is the rewrite: 'Le chat dort.' Let me know if you want changes."` while `fragments: ["Le chat dort."]`. The JSON validates. The contract is defeated: the user sees the insertable text twice, the `{{fragment:N}}` card mechanism becomes redundant, and worse, if the discussion copy is the one the user acts on, they lose the cell/footnote/cross-ref markers that only live in the fragment.

**Why it happens:**
LLMs are trained on chat completions where the assistant explains then shows. Splitting "explanation" from "deliverable" is unnatural. With a free-form `discussion: string`, the path of least resistance is to write a normal chat reply into `discussion` and *additionally* fill `fragments[]` to satisfy the schema. The contract asks the model to **withhold** content from one field — a negative instruction, which models follow poorly.

**How to avoid:**
- **Prompt (primary):** Make the contract motivated, not just structural. State the rule positively and with a reason: *"`discussion` is shown to the user as your message; `fragments[]` are the ONLY text that can be inserted into the document. NEVER repeat fragment text inside `discussion`. Refer to fragments by their marker `{{fragment:N}}`."* Give a one-shot example showing `discussion` with a marker and no echoed prose.
- **Probe (must-have gate):** The pass criterion is not "valid JSON" — it must include a **duplication check**: normalize (lowercase, strip whitespace/punctuation) each fragment and assert it does not appear as a substring of `discussion`. Run across all 5 locales and the action set (rewrite/translate/correct/free-prompt). High duplication for any action/language is a prompt-engineering blocker *before* render starts.
- **Contract module:** During validation, run the same substring/similarity check and set `warnings: ['fragment-echoed-in-discussion']`. Render can then strip the echoed run or de-emphasize it.
- **Render:** Treat `fragments[]` as the source of truth for anything insertable; render `discussion` as commentary only. Never let the user act on text living in `discussion`.

**Warning signs:**
- Probe shows fragment strings verbatim inside `discussion`.
- UI shows the same sentence in the chat bubble and a fragment card.
- Users insert text missing cell/footnote markers (copied the discussion copy).

**Phase to address:** prompt (instruction + example), probe (duplication metric is a gate), contract module (detection flag), render (discussion = commentary only).

---

### Pitfall 2: Meta-discussion leaks INTO a fragment (the inverse)

**What goes wrong:**
A fragment contains conversational scaffolding instead of clean insertable text: `fragments: ["Here is the translation: Le chat dort. Hope this helps!"]` or `fragments: ["Sure! Here's a more professional version:\n\nBonjour Madame…"]`. The user inserts it and gets "Here is the translation:" written into their document. This is exactly the failure the contract exists to prevent, occurring inside the field that is supposed to be clean.

**Why it happens:**
Mirror of Pitfall 1. When the model decides to be conversational it doesn't reliably know where the wrapper "belongs," so it bleeds into the deliverable. Translation and tone actions are especially prone (the model treats "Here is the translation:" as part of a helpful answer). Few-shot examples that aren't clean will reinforce this.

**How to avoid:**
- **Prompt:** *"A fragment is the exact text to be inserted into the document, verbatim. It must contain NO preamble, NO 'here is…', NO trailing remarks, NO closing pleasantries. If you want to say something to the user, put it in `discussion`."* Include a contrast example: BAD `"Here is the rewrite: X"`, GOOD `"X"`.
- **Probe:** Add a **locale-aware preamble detector** — heuristics for opener phrases per language (`here is`, `voici`, `hier ist`, `aquí está`, `ecco`, `sure`, `bien sûr`, plus label-`:`-newline at fragment start) and trailing pleasantries. Count hits per locale. Do NOT test English only — German/Italian openers differ structurally.
- **Contract module:** A defensive trim is acceptable only with very high confidence (aggressive stripping risks eating real document content that legitimately starts with "Here is"). Default to **flag + re-ask** over silent mutation.
- **Hardening:** A flagged fragment triggers the re-ask path (one retry with a sharpened instruction) before surfacing to the user.

**Warning signs:**
- Probe preamble-detector fires on translate/tone actions.
- Inserted text contains "Here is", "Voici", trailing "Hope this helps".
- Fragment begins with a label-colon-newline pattern.

**Phase to address:** prompt, probe (locale-aware preamble metric), contract module (flag, conservative trim), hardening (re-ask).

---

### Pitfall 3: Structured output degrades the actual writing quality

**What goes wrong:**
The domain-specific trap that generic "JSON parsing" guides miss entirely. Forcing a *writing* model to emit JSON measurably **lowers the quality of the writing itself** — blander rewrites, weaker translations, lost nuance — because (a) format constraints consume reasoning headroom, and (b) the low temperature (0.3 in `callScribeAI`, often pushed lower for JSON reliability) further flattens output diversity. The feature can ship "working" (valid JSON, clean separation) yet make Scribe's core value *worse* than the v2.x plain-text path.

**Why it happens:**
Documented effect: strict output grammar degrades reasoning ~10–15% ("Let Me Speak Freely?", arxiv 2408.02442), and aider found LLMs write worse code when forced to wrap it in JSON. Capacity goes to bookkeeping (escaping, structure) instead of prose. Teams optimize JSON success rate and never A/B prose quality, so the regression is invisible in the metrics they track.

**How to avoid:**
- **Probe (critical gate):** Don't measure only conformance. Run a **side-by-side prose-quality comparison**: same prompts through (a) the old plain-text path and (b) the new JSON-contract path; score the fragment quality. If JSON fragments are visibly worse, the contract design must change before render.
- **Prompt:** Keep the contract instruction short and late. `buildMessages` already prepends formatting-marker rules, table rules, footnote rules, and cross-ref rules — stacking the JSON contract on top risks total prompt bloat that degrades both adherence *and* quality. Audit combined prompt size.
- **Architecture decision (contract module):** Prefer a "reason-then-format" shape — let `discussion` be genuinely free-form natural language (the model's commentary / CoT) and keep only `fragments[]` strictly constrained. Preserves most writing quality while still extracting clean insertables.
- **Temperature:** Resist dropping temperature to 0 for JSON reliability — it costs translation/rewrite naturalness. Fix reliability with parse tolerance + re-ask, keeping temperature where prose is acceptable.

**Warning signs:**
- Probe side-by-side shows JSON-path fragments blander/shorter.
- Combined system prompt exceeds a few hundred lines of rules.
- Users report "the rewrites got worse" after the contract ships.

**Phase to address:** probe (prose-quality A/B is a gate), prompt (keep contract lean), contract-module/architecture (free-form discussion + constrained fragments), hardening (temperature decision).

---

### Pitfall 4: `{{fragment:N}}` marker / index mismatch (off-by-one, dangling, duplicate, orphan, zero)

**What goes wrong:**
The marker system has its own integrity surface independent of JSON validity:
- **Dangling:** `discussion` says `{{fragment:2}}` but valid indices are 0–1. Render shows a broken/empty card or crashes.
- **Off-by-one base confusion:** model emits 1-based markers while code is 0-based (or vice-versa). Every card shifts by one — the worst kind because it's silent.
- **Duplicate:** `{{fragment:0}}` appears twice; per-occurrence binding yields two cards for one fragment, or insert double-fires.
- **Orphan:** `fragments[1]` exists but no `{{fragment:1}}` marker references it — the fragment is unreachable, user never sees it.
- **Marker with zero fragments:** `discussion` contains `{{fragment:0}}` but `fragments` is empty/absent (model mimics the format when it has nothing to insert).

**Why it happens:**
The model generates the marker text and the array independently, in one pass, with no enforcement that they agree. Index counting is exactly the arithmetic LLMs do unreliably. The format invites it: two places (prose + array) that must stay in sync.

**How to avoid:**
- **Contract module:** Define the marker grammar precisely (regex), **pin the base** (0-based recommended, documented once, tested) and validate the full relation: every marker index ∈ `[0, fragments.length)`; every fragment is referenced by ≥1 marker; dedupe occurrences if render is per-fragment. Emit `warnings` per violation class.
- **Render:** Render a card only for marker indices that resolve to a real fragment; for orphan fragments, choose a policy (append at end / drop with warning) rather than losing them silently. Never index `fragments[N]` without a bounds check.
- **Probe:** Report distribution of (markers found vs fragments returned); specifically flag **0-fragment-but-marker-present** and **fragment-present-but-no-marker** — these reveal whether the model understands when to emit markers at all.
- **Prompt:** *"Fragments are zero-indexed; the first is `{{fragment:0}}`. Every fragment you return MUST be referenced exactly once in `discussion`. If you have no insertable text, return an empty `fragments` array and use NO markers."*

**Warning signs:**
- Render bounds-check rejects/clamps an index.
- Card count ≠ fragment count.
- Probe shows nonzero dangling/orphan rate.
- Inserted text consistently "one off" from what the user clicked.

**Phase to address:** contract module (grammar + relation validation), render (bounds-safe binding, orphan policy), probe (mismatch distribution), prompt (base + reference rule).

---

### Pitfall 5: JSON syntax fragility (fences, prose wrap, trailing commas, bad escapes, smart quotes, wrong root type)

**What goes wrong:**
A naive `JSON.parse(response)` fails on real model output:
- ` ```json … ``` ` code fences around the object.
- Prose preamble/postamble: `"Sure, here's the JSON:\n{…}\nLet me know!"`.
- Trailing commas (`,}` / `,]`) — valid JS, invalid JSON.
- **Unescaped newlines inside string values** — very likely here, since `fragments` carry multi-line prose / markdown / table-cell content; a literal newline in a quoted string is invalid JSON.
- **Unescaped double quotes** inside strings (`"He said "hi""`).
- **Smart/curly quotes** as JSON structural quotes — the model "prettifies" the JSON; `JSON.parse` rejects `{ “discussion”: … }`. High risk for a multilingual assistant trained on fr « », de „ ".
- **Wrong root type:** bare array `["…"]`, bare string, `{ "fragments": "single string" }` (string where array expected), or an extra envelope `{ "response": { … } }`.
- **Truncation:** non-streamed call hits a token cap mid-object → unterminated JSON (less likely non-streamed, but possible on long multi-fragment output).

**Why it happens:**
Training correlates JSON with markdown fences and helpful prose. Models treat JSON as text to render nicely (hence smart quotes, preambles) rather than a machine contract. Multilingual fine-tuning biases toward locale typography. The proxy is non-streamed with hand-rolled validation and (provider/model unknown) **no guaranteed `response_format: json_schema`** — *all* tolerance must live in the parser.

**How to avoid:**
- **Contract module — tolerant `parseScribeResponse`, in order:**
  1. Trim, strip ` ```json `/` ``` ` fences.
  2. **Bracket-extract:** first `{` (or `[`) → matching close with a *string-aware* brace counter (ignores braces inside quoted strings); discards prose before/after.
  3. Normalize **structural** smart quotes only (attempt parse first; repair on failure to avoid corrupting quotes inside string values).
  4. Strip trailing commas before `}`/`]`.
  5. `JSON.parse`. On failure, one repair pass for unescaped newlines/quotes, then re-parse.
  6. Still failing → **context-aware fallback** (Pitfall 7), never throw to the user.
- **Root-type coercion:** bare array → `{ discussion:'', fragments:array }`; bare string → fallback; `fragments` string → `[string]`; unwrap known envelope key. Validate types of `discussion` (string) and `fragments` (string[]) explicitly.
- **Prompt:** Ask for raw JSON, no fences, no commentary, straight ASCII double quotes, with a minimal exact-shape example. (Helps; never sufficient — parser must still be tolerant.)
- **Probe:** Track rate of each repair class (fence-stripped, smart-quote-fixed, trailing-comma, root-coerced) per locale. High rates reveal which instruction is ignored and whether `response_format` is worth investigating.

**Warning signs:**
- Probe shows nonzero (especially per-locale) repair rates.
- `JSON.parse` throws on raw response in logs.
- French/German runs fail structure-parse more than English (smart-quote tell).

**Phase to address:** contract module (tolerant parse + coercion is the whole job), prompt (raw-JSON instruction), probe (repair-class metrics, locale breakdown), hardening (truncation/re-ask).

---

### Pitfall 6: Fragment-content quality defects (empty, prompt-echo, over/under-segmentation)

**What goes wrong:**
Even with valid JSON and clean separation, the *contents* of `fragments[]` can be wrong:
- **Empty / whitespace-only fragment** (`""`, `" "`) → useless or destructive insert/replace.
- **Prompt echo:** fragment repeats the user's instruction or returns the original selection unchanged (the model "inserted" the input). Common for free-prompt.
- **Over-segmentation:** one coherent rewrite split into 6 sentence-level fragments → 6 inserts, lost flow, cell-markers split across fragments.
- **Under-segmentation:** three distinct alternatives lumped into one fragment when the user wanted choices → no value over plain text.

**Why it happens:**
"Fragment" is under-specified; without granularity guidance the model guesses. Echo happens when transform-vs-restate is ambiguous. Segmentation has no natural anchor → high variance across models/languages.

**How to avoid:**
- **Contract module:** Reject/flag empty/whitespace fragments. Detect echo by comparing the fragment against the original selection and the instruction (high similarity → flag). Drop empty fragments and their markers.
- **Prompt:** Define a fragment for this domain: *"Return one fragment per distinct insertable unit. For a single rewrite/translation, return ONE fragment with the whole result. Use multiple fragments only for genuine alternatives or clearly separable blocks."*
- **Probe:** Report fragment-count distribution per action. A translate yielding >1 fragment, or free-prompt echoing input, are red flags surfaced here before render.
- **Render:** For the popover's normal single-fragment case, show one clean card; don't build N-card machinery for the 1-fragment path.

**Warning signs:**
- Probe shows variable fragment counts for translate/rewrite.
- Fragment ≈ original selection (echo).
- Empty cards in UI.

**Phase to address:** contract module (empty/echo detection), prompt (granularity definition), probe (count distribution per action), render (1-fragment fast path).

---

### Pitfall 7: Schema-adherence drift across prompts / languages / long inputs (and a naive context-blind fallback)

**What goes wrong:**
The model honors the contract for short English rewrites in the probe, then **silently abandons it** for: long inputs (drops format under context pressure), certain languages (German/Italian lower than English), or certain actions (free-prompt, where the user's instruction overrides the contract — *"just give me a list"* → markdown list, no JSON). A naive parser then falls back — but if the **fallback is not context-aware**, popover and chat behave wrongly: the popover MUST always yield exactly one insertable fragment (its UI is insert/replace), whereas chat can degrade gracefully to "show as discussion."

**Why it happens:**
System-prompt instructions decay over long contexts and across the input distribution; the probe (short, English, curated) doesn't represent production. Free-prompt is adversarial to a fixed contract. PROJECT.md specifies a *context-aware* fallback — the pitfall is implementing it naively (one fallback for both modes) or testing only the happy path.

**How to avoid:**
- **Contract module — context-aware fallback (per PROJECT.md):**
  - **Popover:** on parse/validate failure, treat the *entire raw model text* (after fence/prose stripping) as a single fragment so insert/replace still works. The popover must never end with zero actionable fragments.
  - **Chat:** on failure, render raw text as `discussion` with no fragment cards (graceful conversational degradation) + a subtle "couldn't structure this" affordance.
- **Probe:** Stress the distribution — **long inputs, all 5 locales, and free-prompt with contract-hostile instructions** ("answer in one word", "give me bullet points"). Conformance measured per (action × locale × length) bucket, not as one aggregate. Buckets below threshold flagged for the roadmap.
- **Prompt:** For free-prompt, frame the contract as transport not content: *"Whatever the user asks, deliver the result inside `fragments[]` and your commentary in `discussion`. The user's instruction governs fragment content, never the response format."*
- **Hardening:** Re-ask on validation failure (one stricter, shorter retry) before falling back.

**Warning signs:**
- Probe conformance varies sharply by bucket (long inputs, non-English, free-prompt low).
- Fallback firing frequently in one mode.
- Popover ever shows "nothing to insert."

**Phase to address:** contract module (two-mode fallback), probe (bucketed conformance, hostile free-prompt), prompt (free-prompt framing), hardening (re-ask).

---

### Pitfall 8: Multi-turn history serialization causing contract loss or fragment re-emission

**What goes wrong:**
In the chat panel, history is replayed each turn. Two contract-specific failures:
- **Re-emitting old fragments:** prior assistant turns (stored as contract objects) get serialized back; the model re-includes old `fragments[]` or references stale `{{fragment:N}}` indices that no longer map to this turn's array. The user gets last turn's rewrite mixed into this one.
- **Contract decay over turns:** the system contract sits at the top, but as turns accumulate the model drifts to plain conversational replies (documented: ~39% multi-turn performance drop for spread tasks). By turn 5, responses may stop being valid contract JSON.
- **Storing the wrong thing in history:** serializing the *rendered* message (discussion + inlined fragment text) re-introduces Pitfall 1's duplication into context, teaching the model across turns to echo.

**Why it happens:**
Chat history misused as state store. Each `{{fragment:N}}` index is *turn-local*, but a flat history makes them look global. Long histories dilute the system instruction. Serializing presentation instead of structure pollutes context.

**How to avoid:**
- **Contract module / render:** Decide explicitly what enters history. Recommended: store assistant turns as **`discussion` text only** (markers replaced by a neutral reference, NOT the full fragment), keeping `fragments[]` out of replayed context entirely — they are turn-local deliverables, not conversation. Kills re-emission and avoids re-teaching duplication.
- **Prompt:** Re-assert the contract on **every** turn (cheap, non-streamed) or via a per-turn user-message reminder, since a single top-of-conversation instruction decays.
- **Contract module:** Scope markers per turn — validate markers only against the *current* response's fragments, so a stale `{{fragment:1}}` can never resolve against a later turn's array.
- **Probe:** Run a **multi-turn conformance test** (≥5 turns), checking fragment counts/markers stay turn-local and the contract holds at turn N.

**Warning signs:**
- Probe multi-turn run shows conformance dropping after turn 3–4.
- This turn's cards contain last turn's text.
- Marker resolution succeeds against a prior turn's fragments.

**Phase to address:** contract module (turn-local marker scope, history serialization policy), prompt (per-turn reassertion), render (store discussion-only in history), probe (multi-turn test).

---

### Pitfall 9: Naive hand-rolled validator blind spots

**What goes wrong:**
The validator passes objects it should reject because "valid JSON + right keys" is checked but deeper invariants are not:
- `discussion` as `null` vs missing vs `""` — three "empty" states treated inconsistently.
- `fragments` as `null`, `[null]`, `[123]` (non-strings), or nested arrays.
- Extra/hallucinated keys silently accepted (`{ discussion, fragments, suggestions:[...] }`) where the real content went into `suggestions`.
- Markers validated as *present* but not as *resolvable* (Pitfall 4's relational check forgotten).
- Whitespace-only `discussion` treated as valid commentary.
- **Marker-grammar collision:** existing Scribe markers `[CELL:r,c]`, `[^scribe-fn-N]`, and especially `{{REF:scribe-ref-N:…}}` (see `buildMessages`) sit *inside* fragments. The new `{{fragment:N}}` grammar must NOT be confused with `{{REF:…}}`. A strict `\{\{fragment:\d+\}\}` is fine; a naive `\{\{.+?\}\}` would mis-parse REF markers as fragment markers and corrupt cross-refs.
- Unicode/normalization: marker matching failing due to NBSP or zero-width chars the model inserted.

**Why it happens:**
Hand-rolled validators grow by example — you add checks for failures you've seen, not the failure space. Type-vs-presence-vs-emptiness is a classic three-way confusion. The pre-existing overlapping marker grammars are a project-specific landmine.

**How to avoid:**
- **Contract module:** Validate against the documented JSON Schema artifact (PROJECT.md plans the schema as a documented artifact — use it as the checklist even though validation is hand-rolled). Per field: presence, type, emptiness handling, coercion. Reject non-string fragment elements; normalize `null`→`''`/`[]`. Allowlist known keys or at least log unexpected ones (they reveal where content escaped).
- **Contract module — marker disambiguation:** Strict `{{fragment:N}}` regex that cannot match `{{REF:…}}`. Explicit test: a fragment containing `{{REF:scribe-ref-3:…}}` parses correctly and the REF marker is preserved unchanged.
- **Hardening (tests):** Build a fixture corpus of malformed/edge responses (every case in Pitfalls 4–9) and run the validator against all of them — the regression net.
- Apply Unicode NFC + NBSP/zero-width stripping before marker matching.

**Warning signs:**
- A `{{REF:…}}` marker disappears/breaks after the new parser.
- `[null]` fragment reaches render.
- Content appears in an unexpected key in logs.

**Phase to address:** contract module (schema-driven validation, marker disambiguation, normalization), hardening (malformed-fixtures regression suite).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `JSON.parse(response)` + try/catch and give up | Fast to write | 10–20% of real responses fail; users hit errors; no recovery | Never — tolerant parse + fallback is the core deliverable |
| Aggressively regex-strip "Here is…" preambles from fragments | Cleans most leaks | Eats real document text starting with those words; silent data loss | MVP only, high-confidence patterns + a flag; prefer flag+re-ask |
| Drop temperature to 0 to stabilize JSON | Fewer parse failures | Blander rewrites/translations — degrades core value (Pitfall 3) | Never as primary fix; use parse tolerance + re-ask |
| Skip the probe, go straight to render | Ships UI faster | Build card UI on a contract the model doesn't honor; rework | Never — PROJECT.md sequences probe before UI |
| Single aggregate conformance number | Simple metric | Hides per-locale / per-action / long-input drift (Pitfall 7) | Never — bucket the metrics |
| Reuse one fallback for popover and chat | Less code | Popover can end with zero insertable fragments | Never — fallback must be context-aware (PROJECT.md mandate) |
| Store rendered message (discussion + fragment text) in chat history | Easy serialization | Re-teaches duplication + re-emission across turns (Pitfall 8) | Never — store structure, replay discussion-only |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| cozy-stack OpenAI-compat proxy (non-streamed) | Assuming `response_format: json_schema` / constrained decoding exists and trusting it | Provider/model unknown; assume NO server-side schema enforcement — all robustness in `parseScribeResponse`. *Investigate* whether the proxy passes `response_format` through (strong boost if so) but never depend on it without verifying per model. |
| Existing Scribe marker grammars (`[CELL]`, `[^fn]`, `{{REF:…}}`) | New `{{fragment:N}}` regex collides with `{{REF:…}}` | Strict non-overlapping regex + explicit preservation test (Pitfall 9) |
| Existing system-prompt rules in `buildMessages` (format/table/footnote/cross-ref) | Append JSON contract on top → prompt bloat degrades adherence AND prose | Audit combined prompt; keep contract lean and late (Pitfall 3) |
| Response extraction (`response?.content \|\| response?.choices?.[0]?.message?.content`) | Parsing the contract before this dual-shape extraction | Extract the raw assistant string first (existing code), then run `parseScribeResponse` on it |

## Performance / Scale Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-asserting full contract every turn + growing history | Token cost climbs, latency up, truncation risk | Compact per-turn reminder; cap/trim replayed history; store discussion-only | Long chat sessions (turn 6+) |
| Truncation of long multi-fragment JSON (non-streamed token cap) | Unterminated JSON, last fragment cut | Detect unterminated structure; re-ask or salvage complete fragments; per-fragment length guidance | Large documents / many fragments |

## Security / Safety Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting fragment text as safe-to-insert without bounds/empty checks | Empty replace destroys a selection; runaway insert | Validate non-empty + length-sane before enabling insert/replace |
| Rendering `discussion` markdown without sanitization in the chat panel | Model-authored markup injected into the panel | Reuse existing react-markdown sanitization path; never `dangerouslySetInnerHTML` raw model output |
| Marker injection — document/user text containing literal `{{fragment:0}}` | Spoofed card / mis-binding | Honor markers only in `discussion`, never in fragment bodies; treat fragment text as opaque |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing both discussion-echo and fragment card | Duplicate content, confusion over what inserts | discussion = commentary only; fragment cards = the deliverable (Pitfall 1) |
| Popover ending with zero insertable fragments on parse failure | Dead-end UI, can't insert | Context-aware fallback: whole raw text → one fragment (Pitfall 7) |
| Surfacing raw JSON / parse errors to the user | Looks broken, breaks trust | Always degrade to readable text; log the failure for probe metrics |
| N-card machinery for the common single-rewrite case | Over-complex popover | 1-fragment fast path (Pitfall 6) |

## "Looks Done But Isn't" Checklist

- [ ] **Parser:** Handles fences, prose wrap, trailing commas, unescaped newlines/quotes, smart quotes (incl. fr « » / de „ "), bare array, bare string, `fragments`-as-string, extra envelope key — verify against a malformed-response fixture corpus.
- [ ] **Separation:** Duplication check (fragment text NOT in discussion) AND preamble check (no "Here is…/Voici…" in fragments) pass across all 5 locales — verify in probe, not just English.
- [ ] **Markers:** Off-by-one base pinned and tested; dangling/duplicate/orphan/zero-fragment all handled — render bounds-safe, no fragment silently lost.
- [ ] **Marker collision:** `{{REF:scribe-ref-N:…}}` inside a fragment survives parsing intact — explicit test.
- [ ] **Fallback:** Popover always yields ≥1 fragment; chat degrades to discussion — verify both modes on a forced parse failure.
- [ ] **Multi-turn:** Contract holds at turn 5; markers turn-local; no old fragments re-emitted — multi-turn probe run.
- [ ] **Writing quality:** Side-by-side prose comparison (JSON path vs old plain-text path) shows no regression — the metric everyone forgets.
- [ ] **Free-prompt:** Contract survives hostile user instructions ("one word", "bullets only") — verify in probe.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Parse failure on a response | LOW | Tolerant repair → re-ask once → context-aware fallback. No user-facing error. |
| Duplication / preamble leak | LOW–MEDIUM | Flag → re-ask with sharpened instruction → render as-is but warn; tighten prompt + add to fixture corpus. |
| Marker mismatch | LOW | Bounds-safe render drops/relocates unresolved cards; validator already flagged; fix base/prompt. |
| Writing-quality regression found late | HIGH | Re-architect contract (free-form discussion + constrained fragments), revisit temperature, trim prompt — costly after render is built, hence probe-first. |
| Multi-turn contract decay | MEDIUM | Switch to per-turn reassertion + discussion-only history; re-run multi-turn probe. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase(s) | Verification |
|---------|--------------------|--------------|
| 1. Fragment echoed into discussion | prompt + probe (gate) + contract module + render | Probe duplication rate ≈ 0 across locales; UI shows no duplicate text |
| 2. Meta-discussion in fragment | prompt + probe + contract module + hardening | Probe preamble-detector ≈ 0; inserted text has no "Here is/Voici" |
| 3. Writing-quality degradation | probe (gate) + prompt + contract/architecture | Side-by-side prose A/B shows no regression |
| 4. Marker / index mismatch | contract module + render + probe + prompt | Fixture tests for dangling/dup/orphan/off-by-one pass; render bounds-safe |
| 5. JSON syntax fragility | contract module + prompt + probe | Malformed-fixture corpus parses; repair-class rates tracked |
| 6. Fragment-content quality | contract module + prompt + probe + render | Empty/echo rejected; count distribution sane per action |
| 7. Adherence drift + naive fallback | contract module + probe + prompt + hardening | Bucketed conformance; both-mode fallback verified |
| 8. Multi-turn drift / re-emission | contract module + prompt + render + probe | Multi-turn probe holds at turn 5; markers turn-local |
| 9. Validator blind spots | contract module + hardening | Schema-driven validation + malformed-fixture regression suite |

## Sources

- "Let Me Speak Freely? A Study on the Impact of Format Restrictions on Performance of LLMs" — [arxiv.org/pdf/2408.02442](https://arxiv.org/pdf/2408.02442) (format constraints degrade reasoning ~10–15%) — HIGH relevance to Pitfall 3.
- "LLMs are bad at returning code in JSON" — [aider.chat](https://aider.chat/2024/08/14/code-in-json.html) (wrapping deliverable content in JSON lowers output quality) — HIGH relevance to Pitfall 3.
- "Why 15% of Your JSON Prompts Fail (And How to Fix It in 2026)" — [tensoria.fr](https://tensoria.fr/en/blog/structured-outputs-llm-production) — failure-rate framing, Pitfall 5.
- "The JSON Parsing Problem That's Killing Your AI Agent Reliability" — [dev.to](https://dev.to/the_bookmaster/the-json-parsing-problem-thats-killing-your-ai-agent-reliability-4gjg) — fences/prose/trailing-comma/escape patterns, Pitfall 5.
- "LLM Structured Output in 2026: Stop Parsing JSON with Regex" — [dev.to](https://dev.to/pockit_tools/llm-structured-output-in-2026-stop-parsing-json-with-regex-and-do-it-right-34pk) — canonicalizer / bracket-matching extraction, Pitfall 5.
- "5 Ways LLMs Break JSON (And How to Fix Them)" — [medium.com](https://medium.com/@mtdevworks2025/5-ways-llms-break-json-and-how-to-fix-them-f67fd8be5ba2) — extract-before-validate, Pitfall 5/9.
- "Why Local LLM JSON Output Breaks and How to Fix It" — [n1n.ai](https://explore.n1n.ai/blog/local-llm-json-output-failure-patterns-fix-2026-04-24) — smart quotes, unescaped backslashes, root-type errors, Pitfall 5.
- "When LLMs Get Lost in Multi-Turn Chats" — [blogs.oracle.com](https://blogs.oracle.com/ai-and-datascience/multiturn-ocistm) (Microsoft/Salesforce ~39% multi-turn drop) — HIGH relevance to Pitfall 8.
- "Stop Using Chat History As Your Agent's State Store" — [blog.raed.dev](https://blog.raed.dev/posts/agentic-workflows-are-not-conversations/) — history-as-state anti-pattern, Pitfall 8.
- "LLM evaluation techniques for JSON outputs" — [promptfoo.dev](https://www.promptfoo.dev/docs/guides/evaluate-json/) — JSON eval / probe strategy.
- Project files: `.planning/PROJECT.md` (v3.1 contract plan, phase vocabulary, context-aware fallback mandate) and `src/modules/views/OnlyOffice/Scribe/scribeAI.js` (existing prompt bloat, marker grammars `[CELL]`/`[^fn]`/`{{REF}}`, temperature 0.3, dual-shape response extraction) — primary, HIGH.

---
*Pitfalls research for: adding a structured `{ discussion, fragments[] }` + `{{fragment:N}}` contract to an LLM writing assistant over an OpenAI-compat non-streamed proxy*
*Researched: 2026-06-16*
