# Project Research Summary

**Project:** Scribe v3.1 — Contrat de réponse structurée LLM (MCP-ready)
**Domain:** Structured JSON response contract over an unknown OpenAI-compatible proxy, rendered as discussion + fragment cards across two surfaces (chat panel + inline popover) inside OnlyOffice / Cozy Drive
**Researched:** 2026-06-16
**Confidence:** HIGH (architecture derived from codebase; stack based on verified cozy-client source; pitfall risk levels corroborated by arxiv + production reports)

## Executive Summary

V3.1 solves the "blob copy" problem: today, every LLM reply — including meta-discussion ("Here is the translation:") — is inserted verbatim into the document. The contract `{ discussion: string, fragments?: string[] }` with `{{fragment:N}}` position markers cleanly separates conversation from deliverable. The recommended path is prompt-only JSON (no new runtime deps), a ~45-LOC hand-rolled parse + validate module (`scribeResponse.js`), and a context-aware fallback. `response_format` and tool-calling are explicitly rejected as defaults because the cozy-stack proxy is unknown and neither mechanism is documented in cozy-client — they become opt-in behind a dev probe + feature flag only after runtime confirmation.

The single greatest execution risk is not JSON syntax (mechanically recoverable) but **semantic separation failure**: the model produces valid JSON while duplicating fragment text into `discussion`, or leaking meta-discussion ("Voici la traduction :") into a fragment. The dev probe must gate on a duplication check + locale-aware preamble detection across all 5 locales — not merely "valid JSON" — before any card UI is built. A secondary structural landmine is the marker collision between the new `{{fragment:N}}` grammar and the existing `{{REF:scribe-ref-N:…}}` cross-ref markers in `scribeAI.js`, which requires a strict non-overlapping regex and an explicit preservation test. There is also a documented ~10–15% prose-quality degradation when forcing JSON output, mitigated by keeping `discussion` free-form (CoT channel) and constraining only `fragments[]`.

The build order is de-risked and shippable behind a feature flag at every phase: contract module (pure/testable, no UI) → prompt + plumbing (proves no regression, render still uses plain `content`) → dev probe (empirical conformance gate BEFORE any cards) → chat render (multi-turn coherence first, the harder surface) → popover render → hardening (re-ask, i18n, edge corpus). One open semantic question must be resolved in requirements before the render phases: whether `fragments: string[]` represents **alternatives** (pick one) or **sequential pieces** (insert all), as this gates "Insert-all" and card labelling ("Option N" vs "Part N").

## Key Findings

### Recommended Stack

The only guaranteed-to-work mechanism against an unknown proxied model is **prompt-only JSON**: a system prompt instruction with one worked example telling the model to emit `{ discussion, fragments? }`. Verification of `node_modules/cozy-client/dist/models/ai.js` (line 171) confirms that unknown body fields are NOT stripped client-side (`_objectSpread({messages}, options)`), so `response_format` reaches cozy-stack — but cozy-stack passthrough is undocumented and the failure mode (hard 400 on some backends if "json" is absent from prompt, or "unsupported model" on non-recent OpenAI) is asymmetric. Default is therefore prompt-only.

**Core technologies:**
- **Prompt-only JSON contract** (no lib): system/user instruction + one-shot worked example in `SYSTEM_PROMPT` / `CHAT_SYSTEM_PROMPT` — the only mechanism portable across any proxied model
- **Hand-rolled validator** (~15 LOC, no dep): `typeof discussion === 'string'` + array-of-strings check — correct for a 2-field object; JSON Schema kept as a committed documentation artifact for future `json_schema` use
- **Tolerant parse helper** (~30 LOC, no dep): fence-strip → first balanced `{...}` (string-aware brace counter) → trailing-comma repair → `JSON.parse` → context-aware fallback; covers all realistic failure modes without adding bytes

**Optional/probe-gated only:**
- `response_format: { type: 'json_object' }` — behind `flag__scribe.json_response_format`, only if dev probe confirms 200 + clean JSON from the proxy
- `jsonrepair@3.14.0` (~508 KB unpacked) — only if probe shows single-quote / broken-bracket JSON the ~30-LOC helper cannot recover

**Never use:** `response_format` by default; tool/function-calling (`tools` + `tool_choice`); `zod`/`ajv` for this 2-field contract; streaming parsers (endpoint is non-streamed).

### Expected Features

The core value is fixing the "blob copy" anti-pattern. Every major AI writing product (Canvas, Artifacts, Gemini, Notion AI) solves this by separating talk from deliverable — Scribe does it inline via `{{fragment:N}}` cards rather than a separate pane, which is more granular and avoids adding a fourth UI surface.

**Must have (table stakes):**
- **Contract parser + contextual fallback** — without it nothing else works; popover always yields ≥1 insertable fragment, chat degrades to discussion + message-level safety action
- **Pure-discussion (0-fragment) case** — no Insert/Replace UI; chat = plain bubble, popover = fallback to whole-reply-as-1-fragment; this is the single most important correctness behavior
- **`<FragmentCard>` shared component** — visually distinct, read-only `MarkdownPreview`, per-fragment Copy + Insert + (conditional) Replace, reusing `MessageActions` confirmation flash
- **Chat: interleaved discussion + `{{fragment:N}}` cards** in document order
- **Popover: discussion above, fragment card(s) below**, per-fragment actions; quick actions still work via fallback
- **Per-fragment marker fidelity** through the unchanged v2.5 reinjection pipeline (cell markers, images, footnotes, cross-refs must not be split across fragments)

**Should have (differentiators, P2):**
- Multiple alternative fragments as "pick-one" cards (falls out from per-fragment card infrastructure once semantics are settled)
- Insert-all / Replace-with-all (only if fragments confirmed to be sequential pieces)
- Provenance polish: sparkle / accent border reusing `SCRIBE_PURPLE` / `SparkleSvg` (cheap, distinctive)

**Defer (v3.2+):**
- Editable artifact pane (Canvas-style) — the OO document IS the canvas; fragments are read-only preview
- Diff / tracked-changes per fragment — high-effort, brittle with tables/images, post-paste selection already known-broken
- Streaming card rendering — gated on non-streamed endpoint changing

**Unresolved (must settle in requirements):** `fragments: string[]` is semantically ambiguous — ALTERNATIVES (pick-one) vs SEQUENTIAL PIECES (assemble-all). This gates "Insert-all" and card labelling. Do not build Insert-all until resolved.

### Architecture Approach

The contract integrates at **one seam** with minimal blast radius: `callScribeAI` keeps returning a raw string; a new pure module `scribeResponse.js` is called at each surface's call site after transport. Both surfaces already converge on the same `callScribeAI` transport and the same `handleReplace`/`handleInsert` reinjection path in `View.jsx` — which accepts a markdown string and is wholly unaffected by the contract (each fragment is just a string passed through the same existing path). The feature flag is also the kill-switch: when OFF, the parsed result is `{ discussion: raw, fragments: [], valid: true, fellBack: false }`, identical to today's behavior.

**Major components:**
1. **`scribeResponse.js` (NEW — pure module)** — `parseScribeResponse(raw, { surface })`, `serializeAssistantTurnForHistory(parsed)`, `extractChannelMarkers(text, channel)` helper, `SCRIBE_OUTPUT_SCHEMA` (documented artifact); fully unit-testable with no React/network deps; single home for all validation + fallback logic; MCP-forward-compat by defaulting unknown channels to `[]`
2. **Prompt variants in `scribeAI.js` + `ScribeContext.jsx`** — flag-gated contract variants; `buildMessages` marker rules (TABLE/CELL/footnote/REF) apply inside `fragments[]` strings, never in `discussion`
3. **Message model extension in `ScribeContext`** — additive `{ discussion, fragments[], fellBack }` alongside kept `content === discussion` so existing render path keeps working while fragment-card UI layers on top
4. **Multi-turn serialization** — `serializeAssistantTurnForHistory`: `discussion` + compact bracketed fragment-preview note; markers turn-local; history stays plain `{role, content}` strings
5. **`<FragmentCard>` component** — shared between chat and popover; holds `rawFragment` (for reinjection) + `displayFragment` (for preview); per-fragment copy/insert/replace + confirmation flash
6. **`View.jsx` reinjection handlers** — UNTOUCHED; called once per fragment with `rawFragment`; `tableSnapshots` attach automatically

**Key integration seams (file:line):**
- Popover parse: `ScribePopover.jsx:142-148`
- Chat parse: `ScribeContext.jsx:122`
- Multi-turn serialize: `ScribeContext.jsx:104-120` history `.map`
- Flag decision point: call site for BOTH prompt variant and parse (transport stays dumb)
- Untouched: `View.jsx:184-239`, `tableCellMarkers.js`, plugin (ES5), postMessage protocol, cozy-stack endpoint

### Critical Pitfalls

1. **Separation collapse: fragment text duplicated into `discussion`** — valid JSON, contract defeated. Dev probe must gate on duplication check (normalize + substring match), not merely parse success. `parseScribeResponse` flags `warnings: ['fragment-echoed-in-discussion']`; render treats `discussion` as commentary only, never actionable.

2. **`{{fragment:N}}` marker grammar collides with `{{REF:scribe-ref-N:…}}`** — a naive `\{\{.+?\}\}` regex corrupts cross-ref markers. Strict regex required: `\{\{fragment:\d+\}\}`. Mandatory explicit test: a fragment containing `{{REF:scribe-ref-3:…}}` survives parsing intact.

3. **JSON forcing degrades prose quality ~10–15%** (arxiv 2408.02442; aider production report) — the probe must run a side-by-side prose quality A/B (JSON path vs old plain-text path). Mitigation: keep `discussion` fully free-form (CoT channel), constrain only `fragments[]`. Never drop temperature to 0 for JSON reliability — use parse tolerance + re-ask.

4. **Meta-discussion leaks INTO a fragment** (inverse of pitfall 1) — "Here is the translation:" / "Voici :" / "Hier ist:" prefixes the fragment. Probe must include locale-aware preamble detector across all 5 locales. Response: flag + re-ask rather than aggressive regex-strip (stripping risks eating real document content).

5. **Multi-turn history causes contract decay and stale-fragment re-emission** — `{{fragment:N}}` indices are turn-local; contract adherence drops ~39% by turn 5. Mitigation: store discussion-only in history (+ compact fragment note); re-assert contract each turn; scope marker validation to current response only.

6. **JSON syntax fragility across 5 locales** — primary failure modes: code fences, prose preamble, trailing commas, unescaped newlines inside multi-line fragment strings, smart/curly quotes from French/German fine-tuning. Tolerant parser bracket-extractor must be string-aware. Probe tracks repair-class metrics per locale separately.

7. **Context-blind fallback** — a single fallback for both surfaces is wrong. Popover must always yield ≥1 insertable fragment. Chat degrades to discussion + message-level safety action. Parameterized by `surface` arg in `parseScribeResponse`.

## Implications for Roadmap

Based on research, the recommended structure is 6 phases, each independently shippable behind `flag('drive.office.scribe.structuredResponse')`. The flag's OFF state equals today's behavior exactly — a true kill-switch at any point.

### Phase 1: Contract Module
**Rationale:** Pure module, no UI, no network — everything downstream depends on it. Zero risk. Unblocks all subsequent phases.
**Delivers:** `scribeResponse.js` with `parseScribeResponse(raw, { surface })`, `serializeAssistantTurnForHistory`, `extractChannelMarkers(text, channel)` helper, `SCRIBE_OUTPUT_SCHEMA` artifact; full unit test suite covering valid JSON, fenced JSON, malformed variants, marker/fragment-count mismatch, split-table guard, `{{REF:…}}` preservation, per-surface fallback, per-locale smart-quote repair.
**Addresses:** Contract parser + tolerant fallback (P1 FEATURES); contextual fallback (P1)
**Avoids:** Pitfall 5 (JSON fragility), Pitfall 7 (context-blind fallback), Pitfall 9 (validator blind spots + marker collision)
**MCP note:** `extractChannelMarkers(text, channel)` is generic — a future `{{action:N}}` channel reuses it without touching discussion/fragments consumers.

### Phase 2: Prompt + Plumbing (no new render)
**Rationale:** Wires the contract into both call sites and the message model. With flag ON, render still uses `content`/discussion — behavior is ~identical to today. Proves no regression before any UI is built.
**Delivers:** Flag-gated `SYSTEM_PROMPT` / `CHAT_SYSTEM_PROMPT` contract variants; parse seam after `callScribeAI` in `ScribePopover.jsx` + `ScribeContext.sendMessage`; message model extended (`{ discussion, fragments, fellBack }`, `content === discussion` kept); multi-turn serialization via `serializeAssistantTurnForHistory` in history `.map`; popover-originated assistant entries mirrored as structured fields.
**Avoids:** Pitfall 8 (history serialization / re-emission), Pitfall 3 (keep discussion free-form via prompt design), Pitfall 4 (base pinned in prompt)

### Phase 3: Dev Probe (conformance gate — BLOCKS phases 4-5)
**Rationale:** The only empirical unknown is whether the model honors the contract. Building card UI on a non-conformant contract means rework. Probe answers this with zero UI sunk cost. Hard gate.
**Delivers:** Dev panel showing `{ discussion, fragments[], valid, fellBack, warnings[] }` + repair-class metrics per locale. Manual exercise matrix: 0/1/N-fragment / table selection / footnote / cross-ref / long input / all 5 locales / free-prompt with contract-hostile instructions. **Pass criteria (all required):** valid JSON rate; duplication rate ≈ 0; preamble-detection rate ≈ 0 per locale; prose-quality A/B shows no regression; tables never split across fragments; `{{REF:…}}` markers preserved. If any criterion fails, tune prompt before proceeding.
**Avoids:** Pitfall 1 (duplication check), Pitfall 2 (locale-aware preamble), Pitfall 3 (prose-quality A/B), Pitfall 7 (bucketed conformance per action × locale × length)

### Phase 4: Chat Render (fragment cards in panel)
**Rationale:** Chat first because multi-turn message model + serialization are the harder coherence problem. Built on confirmed conformance from Phase 3.
**Delivers:** `ChatMessageList`/`AssistantBubble`: split `discussion` on `{{fragment:N}}` markers; render text segments as markdown + fragment tokens as `<FragmentCard>` in document order; chat fallback (when `fellBack=true`: message-level safety action on whole text); per-fragment copy/insert/replace calling `castPanelAction` with `rawFragment`; `<FragmentCard>` shared component (MarkdownPreview + actions + confirmation flash).
**Addresses:** Chat interleaving (P1 FEATURES), `<FragmentCard>` shared component (P1), pure-discussion 0-fragment handling (P1)
**Avoids:** Pitfall 6 (1-fragment fast path), Pitfall 4 (bounds-safe card binding + orphan policy)

### Phase 5: Popover Render (fragment cards in result panel)
**Rationale:** Popover is simpler (typically 1 fragment, no multi-turn). Inherits `<FragmentCard>` from Phase 4. The dual-representation pattern (`rawFragment`/`displayFragment`) maps onto the existing `rawResult`/`result.text` split already in `ScribePopover.jsx`.
**Delivers:** `ScribeResultPanel` renders `fragments[]`; each card holds `rawFragment` + `displayFragment` (per-fragment `transformCellMarkersForPreview`); popover fallback enforced (0/absent fragments → whole raw as 1 fragment, always); quick actions continue to work via single-fragment fallback.
**Addresses:** Popover discussion + fragment card (P1 FEATURES), marker fidelity per fragment (P1)
**Avoids:** Pitfall 7 (popover always ≥1 fragment), Pitfall 6 (1-fragment fast path is the normal popover case)

### Phase 6: Hardening
**Rationale:** Re-ask, flag promotion, i18n, and edge corpus. Builds the regression net. Last, because it tests behavior that Phases 1-5 must have already built correctly.
**Delivers:** Re-ask on validation failure (one retry with stricter instruction, including preamble-detected fragments); i18n for card labels and fallback messages; action-menu migration (old `rawResult` references → `rawFragment`); malformed-response fixture corpus (all Pitfall 5/9 variants) as regression suite; edge tests (empty fragments, giant fragments, marker mismatch warnings, abort mid-parse, popover→chat history consistency); decision on `response_format` flag default; temperature decision confirmed.
**Addresses:** Multiple alternatives / Insert-all (P2 FEATURES) — only after alternatives-vs-pieces semantics settled
**Avoids:** Pitfall 2 (re-ask for preamble leaks), Pitfall 3 (temperature), Pitfall 8 (multi-turn probe at turn 5), Pitfall 9 (fixture corpus regression suite)

### Phase Ordering Rationale

- Contract module before everything: both call sites, both render surfaces, and all tests depend on `scribeResponse.js`. Zero deps, cheapest to build, most expensive to get wrong.
- Prompt + plumbing before probe: the probe needs the contract instructions in the prompt to measure conformance. Flag keeps rendering identical to today — no observable regression window.
- Probe before any card UI (PROJECT.md mandate + PITFALLS research): prose-quality regression found after render is built costs 2-3x to fix; found at the probe it is a prompt-tuning task.
- Chat before popover: multi-turn serialization is the harder coherence problem. Popover is single-shot and inherits `<FragmentCard>` from the chat phase.
- Hardening last: tests the full system and finalizes the flag default — decisions that require observed behavior from Phases 3-5.

### Research Flags

Phases needing empirical validation during planning:
- **Phase 3 (Dev Probe):** The entire feature's viability gates on this. Plan for 1-2 days of prompt iteration if duplication or preamble rates are high. The pass criteria are multi-dimensional — "valid JSON" alone is not sufficient.
- **Phase 6 (Hardening — alternatives vs pieces decision):** `fragments: string[]` ambiguity must be resolved in requirements before Phase 6 can finalize Insert-all and card labelling. Product decision, not a technical one.

Phases with standard patterns (no research phase needed):
- **Phase 1 (Contract Module):** Pure JS module, well-defined API, full unit test suite. Standard engineering.
- **Phase 2 (Prompt + Plumbing):** Mechanical wiring at documented seams. All integration points identified to file:line in ARCHITECTURE.md.
- **Phase 4 (Chat Render) + Phase 5 (Popover Render):** React component work over a validated data model. Standard UI engineering once Phase 3 confirms conformance.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | `cozy-client/dist/models/ai.js` verified directly; npm package sizes verified; `response_format` passthrough undocumented but client-side passthrough behavior confirmed |
| Features | HIGH | Derived from reading actual component code; UX patterns corroborated by 4+ real products |
| Architecture | HIGH | All integration seams identified to file:line from codebase; reinjection path verified as string-in and untouched; single open empirical unknown (model conformance) deliberately gated by probe |
| Pitfalls | HIGH (risk identification) / MEDIUM (severity estimates) | JSON fragility + quality degradation backed by arxiv study + aider production report; duplication/preamble rates reasoned from contract design |

**Overall confidence:** HIGH

### Gaps to Address

- **`response_format` passthrough:** Whether cozy-stack forwards or rejects unknown body fields is empirically unknown. Handle during Phase 3 probe (measures HTTP status when flag enabled). Does not block any other phase.
- **Alternatives vs sequential pieces semantics:** Must be settled in requirements before Phase 6. Phases 1-5 are unaffected by this decision.
- **Prose quality under JSON contract:** The ~10-15% degradation is a documented aggregate; actual degradation on Scribe's action set and locales is unknown until Phase 3 A/B. If unacceptable, the contract design itself must change — the highest-stakes unknown and the reason the probe is a hard gate.
- **Fragment marker base (0-indexed vs 1-indexed):** Must be pinned in Phase 1 and documented. 0-based recommended (consistent with array access). Not a risk once pinned.

## Sources

### Primary (HIGH confidence)
- `node_modules/cozy-client/dist/models/ai.js` — `ChatCompletionOptions` typedef; `chatCompletion()` body-build via `_objectSpread` (unknown fields not stripped client-side)
- Codebase: `scribeAI.js`, `ScribeContext.jsx`, `ScribePopover.jsx`, `tableCellMarkers.js`, `ChatMessageList.jsx`, `MessageActions.jsx`, `ScribeResultPanel.jsx`, `View.jsx`, `helpers.js` — all integration seams verified to file:line
- `.planning/PROJECT.md` — v3.1 locked decisions, phase vocabulary, context-aware fallback mandate, marker grammar contracts
- "Let Me Speak Freely?" — arxiv.org/pdf/2408.02442 — format constraints degrade reasoning ~10-15%
- aider.chat/2024/08/14/code-in-json.html — wrapping deliverable in JSON lowers output quality (production report)
- blogs.oracle.com/ai-and-datascience/multiturn-ocistm — ~39% multi-turn performance drop (Microsoft/Salesforce study)

### Secondary (MEDIUM confidence)
- https://docs.cozy.io/en/cozy-stack/ai/ — official `/ai/v1/chat/completions` docs; only `messages` + `temperature` documented
- OpenAI JSON mode requirements (community.openai.com, portkey.ai, learn.microsoft.com/azure) — "must include json" 400, model support matrix
- npm registry (2026-06-16) — verified package sizes for jsonrepair, zod, ajv, best-effort-json-parser
- Shape of AI — shapeof.ai/patterns/variations — Variations UX pattern (3-5 options, never-auto-apply)
- Google Docs / Gemini, Notion AI, Canvas/Artifacts product research — competitor feature matrix

### Tertiary (LOW confidence)
- vLLM/llama.cpp/Ollama structured-output support docs — consistency of `response_format` across self-hosted engines; cannot verify against actual cozy-stack backend
- tensoria.fr, dev.to, medium.com JSON parsing failure-rate articles — framing and failure taxonomy; high variance in claimed rates

---
*Research completed: 2026-06-16*
*Ready for roadmap: yes*
