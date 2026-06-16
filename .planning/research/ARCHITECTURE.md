# Architecture Research

**Domain:** Structured JSON response contract for an in-editor AI writing assistant (Scribe / OnlyOffice / Cozy Drive)
**Researched:** 2026-06-16
**Confidence:** HIGH (all conclusions derived from reading the actual codebase; the LLM-conformance question is the only empirical unknown, deliberately de-risked by the dev probe phase)

## Executive Answer

The contract `{ discussion: string (with {{fragment:N}} markers), fragments?: string[] }` integrates with **minimal risk** by inserting **one new pure module** (`parseScribeResponse`) at exactly one seam — immediately after `callScribeAI` returns its string — and changing nothing upstream of that seam. Both render surfaces already converge on a single transport function (`callScribeAI`) and a single rich-reinjection path (`handleReplace`/`handleInsert` in `View.jsx`, which take a markdown **string** and apply `markdownToHtml` + `tableSnapshots`). Because fragments are just per-fragment markdown strings fed through that **same** existing string path, the rich reinjection (cell-markers, tables, footnotes, cross-refs) is preserved **per fragment with zero changes to the reinjection code** — provided each fragment is reinjected as its own call.

The one genuinely new design decision is **multi-turn serialization**: when replaying history to the LLM, send `discussion` as the assistant turn and append a compact, non-content note that fragments were emitted (recommendation below). Everything else is plumbing.

## Current Architecture (as-built)

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Cozy Drive (React)                               │
│                                                                        │
│  ┌─────────────────┐         ┌──────────────────────────────────┐    │
│  │  POPOVER surface │         │       CHAT surface                │    │
│  │  ScribePopover   │         │  ScribePanel                      │    │
│  │   → ResultPanel  │         │   → ChatMessageList               │    │
│  │   (MarkdownPrev) │         │      → AssistantBubble (Markdown) │    │
│  │                  │         │      → MessageActions             │    │
│  └────────┬─────────┘         └───────────────┬──────────────────┘    │
│           │                                    │                       │
│           │  handleActionSelect                │  sendMessage          │
│           │  buildMessages(...)                │  (rebuilds history)   │
│           └──────────────┬─────────────────────┘                      │
│                          ▼                                             │
│              ┌──────────────────────────┐                             │
│              │  callScribeAI (scribeAI) │  ◄── THE SINGLE SEAM        │
│              │  fetchJSON → /ai/v1/...   │      (returns string today) │
│              └──────────────────────────┘                             │
│                          │                                            │
│           reinjection (both surfaces converge here):                  │
│              ┌──────────────────────────────────────┐                │
│              │  View.jsx handleReplace / handleInsert │               │
│              │  markdownToHtml(text) + tableSnapshots │               │
│              │  → respond() (popover) | castPanelAction() (chat)      │
│              └──────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────────────┘
                          │ postMessage / cozy-bridge intents
                          ▼
        OO Editor iframe → Plugin iframe (PasteHtml / InsertContent / table clone)
```

### Component Responsibilities (relevant subset)

| Component | Owns today | Changes for v3.1 |
|-----------|-----------|------------------|
| `scribeAI.js` | Prompt building (`SYSTEM_PROMPT`, `buildMessages`), transport (`callScribeAI` → string), error classify | Prompts emit contract; parse inserted at call sites (not in transport) |
| **`scribeResponse.js` (NEW)** | — | `parseScribeResponse(raw, { surface })`, the JSON-Schema artifact, validation, contextual fallback, `serializeAssistantTurnForHistory()` |
| `ScribeContext.jsx` | Chat state, `sendMessage` (rebuilds history each call), message model | Store `{ discussion, fragments }` on assistant messages; serialize prior turns via new helper |
| `ScribePopover.jsx` | Popover state machine (menu/loading/result), holds `rawResult` for reinjection | Holds `fragments[]`; result panel renders fragment cards |
| `ChatMessageList` / `AssistantBubble` / `MessageActions` | Render assistant markdown + copy/insert/replace on full content | Render `discussion` + fragment cards; actions operate per-fragment |
| `View.jsx` `handleReplace/handleInsert` | Markdown string → HTML + tableSnapshots → plugin | **No change** — already string-in; called once per fragment |
| `tableCellMarkers.js` | Cell/table marker parse + preview transform | **No change**; called per-fragment instead of per-response |

### Key existing facts that shape the design

1. **Single transport seam.** Both surfaces call `callScribeAI(client, messages, opts)` and receive a raw string. This is the only place a parse must be inserted. (scribeAI.js:155)
2. **Reinjection is string-in.** `handleReplace(text)` / `handleInsert(text)` in `View.jsx:184-239` accept a markdown string, run `markdownToHtml`, and attach `tableSnapshots`/`partialTableInfo` from refs. They do **not** care whether the string is a whole response or one fragment.
3. **Popover already separates display vs raw.** `ScribePopover` keeps `rawResult` (markers intact, used for reinjection) separate from `result.text` (display, markers→GFM via `transformCellMarkersForPreview`). Fragments slot directly into this existing dual-representation pattern. (ScribePopover.jsx:44, 144-148, 186-192)
4. **Chat history is rebuilt every send.** `sendMessage` maps `messagesRef.current` into `{role, content}` each call (ScribeContext.jsx:104-120). This is the exact serialization point for prior structured turns.
5. **Popover mirrors into chat history.** `handleActionSelect` already pushes `{role:'user'/'assistant', content}` into the shared message list (ScribePopover.jsx:152-155) — so the message model change must accommodate popover-originated entries too.
6. **cozy-flags is synchronous and already in use.** `flag('drive.office.write')` etc. (helpers.js); dev-toggle via `localStorage` `flag__` prefix. A new flag fits the established pattern with zero new dependency.
7. **Markdown rendering is `react-markdown`** in both `AssistantBubble` (plain) and `MarkdownPreview` (full GFM + rehype-raw + image markers). Fragment cards should reuse `MarkdownPreview` for parity with the popover.

## Recommended Design

### 1. Single shared parse/validate module — `scribeResponse.js`

**Decision: ONE shared module, not per-call parsing.** Per-call parsing would duplicate validation + fallback logic across two surfaces and drift. A single pure module is trivially unit-testable (no React, no network) and is the natural home for the JSON-Schema artifact.

**Where it sits:** logically wraps `callScribeAI`. Two equally valid wirings; **recommend (b)** for the smallest blast radius:

- **(a)** Change `callScribeAI` to return the parsed object. Cleaner long-term, but touches every caller's return-type expectation and the existing `addMessage` mirroring in one commit.
- **(b) Keep `callScribeAI` returning the raw string; add `parseScribeResponse(raw, { surface })` that callers invoke on the result.** Recommended. The transport stays dumb and stable; parsing is opt-in per surface, so the feature flag can choose old-path (use raw string directly) vs new-path (parse) **without touching transport at all**. This is the lowest-risk rollout lever.

**Module surface:**

```js
// scribeResponse.js  (pure, zero deps, fully unit-testable)

export const SCRIBE_OUTPUT_SCHEMA = { /* JSON Schema, documented artifact only */ }

/**
 * @returns {{
 *   discussion: string,            // markdown, may contain {{fragment:N}} markers
 *   fragments: string[],           // [] when none; index N matches marker {{fragment:N}}
 *   valid: boolean,                // passed hand-rolled validation
 *   fellBack: boolean,             // true if raw was treated as fallback
 *   raw: string                    // always preserved for reinjection / re-ask
 * }}
 */
export function parseScribeResponse(raw, { surface }) { /* tolerant parse + validate + fallback */ }

export function serializeAssistantTurnForHistory(parsed) { /* see §2 */ }
```

**Tolerant parse order (hand-rolled, no dep):**
1. Try `JSON.parse(raw)`.
2. If that fails, strip a ```json fenced block and retry (models often wrap).
3. If still failing → fallback (below).
4. On success, validate shape: `discussion` is string; `fragments` absent → `[]`, present → array of strings; coerce nulls.
5. Cross-check `{{fragment:N}}` markers referenced in `discussion` against `fragments.length`; record mismatch as a non-fatal validation warning (do not throw — let the surface decide).

**Contextual fallback (LOCKED decisions, implemented in the module, parameterized by `surface`):**
- `surface === 'popover'` → treat the entire raw string as **one fragment**: `{ discussion: '', fragments: [raw], valid:false, fellBack:true }`. The popover's job is to produce insertable content, so a fragment is the correct default.
- `surface === 'chat'` → treat raw as **discussion** with **no fragments**, and let the chat surface attach a message-level safety insert/replace action over the whole text: `{ discussion: raw, fragments: [], valid:false, fellBack:true }`.

This keeps the two LOCKED fallback behaviors as data (the `surface` arg), not as branching logic scattered in components.

### 2. Multi-turn serialization — RECOMMENDATION

This is the one decision with real coherence stakes. When `sendMessage` replays history, each prior **assistant** turn was a structured object `{ discussion, fragments }`. Options:

- **Option A — discussion only.** Send just `discussion`. Simple, but the model loses the fact that it previously produced insertable content; a follow-up like "make that shorter" has no referent because the fragment text is gone from context.
- **Option B — discussion + compact fragment note (RECOMMENDED).** Send `discussion`, then append a compact, clearly-delimited note listing the fragments the assistant previously produced, so follow-ups can reference them. Example serialized assistant content:

  ```
  <discussion text>

  [Previously produced 2 insertable fragments:
  1) <fragment 0 text, truncated to ~N chars>
  2) <fragment 1 text, truncated>]
  ```

- **Option C — re-emit full contract JSON as the assistant turn.** Round-trips faithfully but bloats context, risks the model echoing stale JSON, and couples history format to wire format.

**Recommendation: Option B.** Rationale:
- Coherence: the model can answer "shorten the second paragraph you wrote" because the fragment text is present.
- Cost control: truncate long fragments (the user can re-select source text if precise editing is needed — the selection-context mechanism already exists).
- Format isolation: history stays plain `{role, content}` strings, so nothing downstream of `callScribeAI` (which sends `messages` verbatim) needs to understand the contract.
- Implement as `serializeAssistantTurnForHistory(parsed)` in `scribeResponse.js`, called from `sendMessage`'s history `.map`. Keep the note text **English and stable** (it is an instruction-channel string the model reads, not UI — matches the existing English-prompt convention in `SYSTEM_PROMPT`), not in i18n.

Note: popover-originated assistant entries currently mirror the **whole** AI text into history (ScribePopover.jsx:154). After v3.1 they should mirror the parsed `{discussion, fragments}` so a later chat follow-up sees them consistently — store the structured fields (see §3), and let `serializeAssistantTurnForHistory` handle both origins uniformly.

### 3. Message model in `ScribeContext`

Extend the assistant message object (additive, backward-compatible):

```js
{
  id, role: 'assistant', timestamp,
  content: string,            // KEEP: = discussion (so existing AssistantBubble/MarkdownPreview still works unchanged)
  discussion: string,         // NEW: same as content; explicit name for clarity
  fragments: string[],        // NEW: [] when none
  fellBack: boolean           // NEW: drives the message-level safety action on chat fallback
}
```

Why keep `content === discussion`: `ChatMessageList`/`AssistantBubble`/`MessageActions` already read `content`; leaving it populated means the **old render path keeps working** while the new fragment-card UI is layered on top reading `fragments`. This is the seam that lets render work ship incrementally behind the flag.

`user` and `error` messages are unchanged.

### 4. Per-fragment rich reinjection — impact assessment

**Verdict: nothing breaks, provided each fragment is reinjected as its own `handleReplace`/`handleInsert` call.** Detailed reasoning:

- **Cell/table markers (`[TABLE:N]`/`[CELL:r,c]`, `tableCellMarkers.js`).** These operate on a string. If the model keeps a whole table inside a single fragment (which the prompt must instruct — see risk below), `transformCellMarkersForPreview` and `validateTableCounts` work on that fragment string exactly as they do today on the whole response. The popover's `rawResult`-vs-`displayMd` split becomes per-fragment: each card holds `rawFragment` (markers intact, for reinjection) and `displayFragment` (markers→GFM, for preview).
- **`tableSnapshots` / `partialTableInfo`.** These are carried in refs in `View.jsx` and attached to **every** reinjection call regardless of payload (View.jsx:191, 221). Reinjecting fragment-by-fragment still attaches them — no change. The plugin matches `[TABLE:N]` markers in the incoming text against snapshots, so as long as a given fragment contains the markers for the snapshot it references, it works.
- **Footnotes (`[^scribe-fn-N]`) and cross-refs (`{{REF:...}}`).** Pure inline string markers preserved through `markdownToHtml`; fragment splitting is transparent to them.

**The real risk is splitting an atomic structure across fragments.** If the model puts `[TABLE:0]` in fragment 0 and `[CELL:1,2]...[/CELL]` of that same table in fragment 1, validation will see incomplete tables and reinjection will produce a broken table. **Mitigation (prompt-level, belongs in the prompt phase):** instruct the model that each fragment must be independently insertable and must never split a table/footnote/code-block/image across fragments. The dev probe (phase 3) must specifically exercise a table selection to confirm the model honors this. Add a validation guard in `parseScribeResponse`: if any fragment contains an unmatched `[TABLE:`/`[CELL:`/`[/TABLE]` marker, mark `valid:false` and surface the existing cell-mismatch warning UI.

### 5. Feature-flag / rollout strategy (cozy-flags)

Use the established synchronous `flag()` API (helpers.js pattern), dev-toggleable via `localStorage` `flag__` prefix.

- **Flag:** `flag('drive.office.scribe.structuredResponse')` (boolean).
- **Single decision point:** in each surface's call site, after `callScribeAI` returns:
  ```js
  const raw = await callScribeAI(client, messages, opts)
  const parsed = flag('drive.office.scribe.structuredResponse')
    ? parseScribeResponse(raw, { surface })
    : { discussion: raw, fragments: [], valid: true, fellBack: false, raw }
  ```
  When OFF, the response is shaped as "all discussion, no fragments, raw available" — which is **identical to today's behavior** because the chat renders `content`/discussion and the popover uses `raw` for reinjection. This makes the flag a true no-op kill-switch.
- **Prompt selection also gated by the same flag:** `buildMessages`/`CHAT_SYSTEM_PROMPT` emit contract instructions only when the flag is on (pass the flag value into the prompt builder, or read it at the call site and choose the prompt variant). Critical: never ask for the contract while parsing in plain mode, or vice-versa.
- **Rollout sequence:** dev-only via localStorage → cozy-stack flag for internal accounts → general enable. Because OFF == today, rollback is instant and safe.

### 6. Forward-compat: "MCP-ready" without a server

Goal: adding an `actions` channel (editor commands the model can request) later must be **non-breaking**. Shape now so that later is purely additive:

- **Reuse JSON-Schema formalism, no runtime dep.** `SCRIBE_OUTPUT_SCHEMA` is a documented JS object mirroring MCP's `outputSchema` / `structuredContent` convention. The parsed object is the `structuredContent`. Validation is hand-rolled against this schema's intent (not a validator library).
- **Top-level object is open for extension.** Contract today: `{ discussion, fragments? }`. Tomorrow: `{ discussion, fragments?, actions? }` where `actions: [{ name, arguments }]`. Because `parseScribeResponse` already (a) parses the whole object, (b) ignores unknown keys, and (c) returns a normalized struct, adding `actions` means: extend the returned struct with `actions: []` default, add a `parseActions` branch, and add a new consumer. Existing consumers reading `discussion`/`fragments` are untouched.
- **Make `parseScribeResponse` return shape additive-friendly now:** always include `fragments: []` and reserve the convention that future channels default to empty arrays/objects. Document in the module header that consumers must tolerate unknown keys and absent channels.
- **Keep the marker convention generic.** `{{fragment:N}}` is one instance of a `{{channel:ref}}` placeholder family. When `actions` arrive, an analogous `{{action:N}}` placeholder in `discussion` can render an inline "Apply" affordance — same parsing machinery (regex over discussion, index into a channel array). Implement the fragment marker scan as a small reusable helper (`extractChannelMarkers(text, channel)`), not a one-off regex, so the action channel reuses it.
- **No server, no transport change.** This stays a client-side prompt+parse contract over the existing OpenAI-compat endpoint. "MCP-ready" = the **schema and parsed-struct shape** are MCP-compatible, so a future migration to real tool-calling/MCP is a swap of the producer, not a redesign of consumers.

## Build Order (de-risked: probe before UI)

Respects the LOCKED "dev probe before UI" decision. Each phase is independently shippable behind the flag.

```
Phase 1: Contract module (no UI, no network)
  - scribeResponse.js: SCRIBE_OUTPUT_SCHEMA, parseScribeResponse(raw,{surface}),
    serializeAssistantTurnForHistory, extractChannelMarkers helper
  - Full unit test suite: valid JSON, fenced JSON, malformed, missing fragments,
    marker/fragment-count mismatch, split-table guard, popover-fallback, chat-fallback
  - Rationale: pure + testable; everything downstream depends on it; zero risk

Phase 2: Prompt + plumbing (flag wired, NO new render)
  - SYSTEM_PROMPT / CHAT_SYSTEM_PROMPT contract variants, gated by flag
  - Insert parse seam after callScribeAI in BOTH call sites (ScribePopover, ScribeContext.sendMessage)
  - Message model extended ({discussion, fragments, fellBack}); content=discussion kept
  - Multi-turn serialization via serializeAssistantTurnForHistory in sendMessage
  - With flag ON, render still uses content/discussion → behavior ~ today (proves no regression)

Phase 3: Dev probe (empirical conformance gate)
  - Reuse scribeDevMode pattern: a dev panel / console log showing parsed
    {discussion, fragments[], valid, fellBack} for the last call
  - Manually exercise: 0-fragment, 1-fragment, N-fragment, table selection,
    footnote/cross-ref selection
  - GATE: confirm the model honors the contract AND never splits tables across
    fragments BEFORE building card UI. If conformance is poor, tune prompt here.

Phase 4: Chat render (fragment cards in panel)
  - ChatMessageList/AssistantBubble: render discussion (existing) + fragment cards
  - Each card: MarkdownPreview(displayFragment) + per-fragment copy/insert/replace
    calling panelActions with rawFragment
  - Chat fallback: message-level safety action when fellBack (whole-text insert/replace)

Phase 5: Popover render (fragment cards in result panel)
  - ScribeResultPanel: replace single rawResult/result.text with fragments[]
  - Each fragment keeps {rawFragment, displayFragment}; reuse transformCellMarkersForPreview per fragment
  - Popover fallback: single fragment = whole raw (already the default)

Phase 6: Hardening
  - Re-ask LLM on invalid parse (one retry with a stricter "return valid JSON" nudge)
  - Migrate menu actions / finalize flag default; i18n for new card labels
  - Edge tests: empty fragments, giant fragments, marker mismatch warnings,
    abort mid-parse, popover→chat history consistency
```

**Why this order de-risks:** Phases 1-2 change behavior to ~identical-to-today (parse exists, render doesn't use it), so any regression is plumbing, not UX. Phase 3 answers the only empirical unknown (model conformance) with zero UI sunk cost. Cards (4-5) are built only after conformance is proven. Chat-before-popover because the chat surface's message model and serialization are the harder coherence problem and benefit from being exercised first.

## Integration Points (precise seams)

| Seam | File:line (as-built) | Change |
|------|---------------------|--------|
| Transport return | `scribeAI.js:155` `callScribeAI` | Keep returning raw string (recommended); add parse at call sites |
| Popover parse | `ScribePopover.jsx:142-148` (after `callScribeAI`, where `rawResult`/`transformCellMarkersForPreview` already live) | `parseScribeResponse(text,{surface:'popover'})`; fan out to fragments |
| Chat parse | `ScribeContext.jsx:122` (`responseText = await callScribeAI`) | `parseScribeResponse(responseText,{surface:'chat'})`; store structured fields |
| Multi-turn serialize | `ScribeContext.jsx:104-120` (history `.map`) | Replace assistant-turn mapping with `serializeAssistantTurnForHistory` |
| Prompt emit | `scribeAI.js:24` `SYSTEM_PROMPT`, `buildMessages`; `ScribeContext.jsx:13` `CHAT_SYSTEM_PROMPT` | Flag-gated contract variants |
| Message model | `ScribeContext.jsx:124-132` (assistant push), `ScribePopover.jsx:152-155` (mirror) | Add `{discussion, fragments, fellBack}` |
| Chat render | `ChatMessageList.jsx:178-183` (assistant branch) + `MessageActions.jsx` | Fragment cards + per-fragment actions |
| Popover render | `ScribeResultPanel` (consumed at `ScribePopover.jsx:259-277`) | Fragment list |
| Reinjection | `View.jsx:184-239` `handleReplace/handleInsert` | **NO CHANGE** — call once per fragment with `rawFragment` |
| Flag | new `drive.office.scribe.structuredResponse` (pattern: `helpers.js`) | Gate parse + prompt |

### New vs Modified components

- **New:** `scribeResponse.js` (+ spec), fragment-card sub-component (can live inside `ScribeResultPanel` and `ChatMessageList` or be shared `FragmentCard.jsx`).
- **Modified:** `scribeAI.js` (prompts), `ScribeContext.jsx` (model + serialize + parse), `ScribePopover.jsx` (fragments state), `ScribeResultPanel`, `ChatMessageList.jsx`, `MessageActions.jsx`.
- **Untouched (important):** `View.jsx` reinjection handlers, `tableCellMarkers.js`, `scribeConversion.js`, the plugin (ES5), the postMessage protocol, the cozy-stack endpoint.

## Anti-Patterns to Avoid

### Parsing in the render components
**What people do:** `JSON.parse` inside `ChatMessageList`/`ResultPanel`.
**Why wrong:** duplicates fallback logic across two surfaces, untestable, drifts.
**Instead:** all parse/validate/fallback in `scribeResponse.js`; components consume the struct.

### Reinjecting concatenated fragments
**What people do:** join fragments into one string and call `handleReplace` once.
**Why wrong:** defeats the per-fragment selection/action UX and re-introduces the ambiguity the contract exists to remove; also risks gluing markers across fragment boundaries.
**Instead:** reinject one fragment per `handleReplace`/`handleInsert` call (the handlers are already idempotent and string-in).

### Changing the wire/history format to carry JSON
**What people do:** store/replay full contract JSON as the assistant message content.
**Why wrong:** context bloat, model echoes stale JSON, couples history to wire format.
**Instead:** history is plain strings; `serializeAssistantTurnForHistory` produces a compact discussion+note (Option B).

### Coupling the flag to transport
**What people do:** branch inside `callScribeAI`.
**Why wrong:** makes the kill-switch touch the network layer and the prompt builder inconsistently.
**Instead:** flag chosen at the call site for BOTH prompt variant and parse; transport stays dumb.

### Letting fragments split atomic structures silently
**What people do:** trust the model to keep tables whole.
**Why wrong:** broken tables on reinjection, hard-to-debug.
**Instead:** prompt constraint + `parseScribeResponse` guard that flags unmatched table/cell markers; verified in the dev probe.

## Sources

- Codebase (HIGH): `scribeAI.js`, `ScribeContext.jsx`, `ScribePopover.jsx`, `tableCellMarkers.js`, `ChatMessageList.jsx`, `MessageActions.jsx`, `MarkdownPreview.jsx`, `ScribePanel.jsx`, `View.jsx`, `helpers.js`, `.planning/PROJECT.md`
- MCP `outputSchema` / `structuredContent` convention (formalism reuse only; no server) — Model Context Protocol tool-result structured-content spec
- Project memory: v2.5 marker contract, cozy-flags `flag__` localStorage dev-toggle, ES5 plugin constraint

---
*Architecture research for: structured LLM response contract integration (Scribe v3.1)*
*Researched: 2026-06-16*
