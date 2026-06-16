# Feature Research

**Domain:** AI writing assistant — separating conversational/meta text from insertable artifacts (fragments) across two surfaces (conversational chat panel + inline popover), inside OnlyOffice / Cozy Drive
**Researched:** 2026-06-16
**Milestone context:** v3.1 — structured LLM response contract `{ discussion, fragments?: string[] }` with `{{fragment:N}}` position markers, rendered as per-fragment insertion cards in BOTH chat and popover
**Confidence:** MEDIUM-HIGH (product UX patterns verified across 4+ real products; the structured-output-for-UI rendering pattern is less publicly documented — flagged where relevant)

> Supersedes the prior v3.0 chat-panel feature research previously stored here. This document covers ONLY the v3.1 discussion-vs-fragment separation feature.

## Context: Our Two Surfaces Today

Established from reading the existing code (not assumptions):

- **Chat panel** (`ChatMessageList.jsx` + `MessageActions.jsx`): each assistant reply renders as a single `<Markdown>{content}</Markdown>` blob inside one `AssistantBubble`, with ONE shared `MessageActions` toolbar (copy / insert / replace) acting on the **entire message string**. There is no notion of "this part is talk, that part is insertable."
- **Inline popover** (`ScribeResultPanel.jsx`): one `MarkdownPreview` of the whole `resultText`, with global **Insert** / **Replace** / **Retry** buttons acting on the whole blob. Quick actions (correct/translate/tone/improve/free prompt) feed it. It already carries rich-content concerns (cell markers, `insertDisabled` for partial tables, `cellWarning`).

The v3.1 contract `{ discussion, fragments?: string[] }` with `{{fragment:N}}` markers is the data model. **This research is about the UX that contract should enable** — what to render, what actions per fragment, and what NOT to build.

The core problem this milestone solves is a recognized industry anti-pattern: the **"blob copy"** — meta-discussion ("Here is the translation:") gets copied/inserted into the document along with the actual content. Every mature product surveyed below solves exactly this by separating "the conversation" from "the produced artifact."

## Feature Landscape

### Table Stakes (Users Expect These)

Missing these = the feature feels half-done. Each is tied to our chat and/or popover surface.

| Feature | Why Expected | Complexity | Notes (surface + dependency) |
|---------|--------------|------------|------------------------------|
| **Visually distinct fragment block** (card/box), not styled like prose | Canvas, Artifacts, Gemini, Notion AI all give produced content its own container so users know "this is the deliverable" | LOW-MEDIUM | **Both.** Chat: render `{{fragment:N}}` markers as a bordered/tinted card in the markdown stream. Popover: result body becomes a card with discussion above it. Reuse `MarkdownPreview` inside the card. |
| **Per-fragment Insert** (+ Replace when a selection exists) | Users expect to insert THE CONTENT, not the explanation (Gemini "Insert", Canvas section apply, Notion "Insert below") | MEDIUM | **Both.** Move the action toolbar from message-level to fragment-level. Insert payload = the fragment string only, never the discussion. Replace shown only when `currentSelection` exists (logic already in `MessageActions`). |
| **Per-fragment Copy** of clean content | Copy of clean content (no "Here is…") is the most-used escape hatch. Already exists at message level | LOW | **Both.** Already implemented in `MessageActions` (HTML+text clipboard). Rebind to fragment content. |
| **Discussion renders as normal prose** (no action buttons) | When the model explains *why* or asks a clarifying question, that text must read as conversation, not as something to paste | LOW | **Both.** Discussion = existing markdown bubble minus the action toolbar. Buttons attach only to fragments. |
| **Graceful pure-discussion case** (0 fragments → no insert UI at all) | The model often answers with only talk ("Your text is already correct", a question, an explanation). Showing Insert/Replace on pure talk re-creates the blob problem | LOW-MEDIUM | **Both.** Chat: plain bubble, **no** cards, **no** insert/replace. Popover: per PROJECT.md fallback, collapse to "1 fragment = whole reply" so the existing single-Insert quick-action UX still works. **The single most important correctness behavior.** |
| **Preview before apply** (nothing mutates OO until clicked) | Universal: "Never overwrite the original without confirmation" (Shape of AI) | LOW | **Both.** Already the model in both surfaces. Preserve it; just make the preview per-fragment. |
| **Marker fidelity preserved per fragment** | Existing rich reinjection (`[TABLE:N][CELL:r,c]`, `[IMG:scribe-img-N]`, footnotes) must keep working when content is split | MEDIUM-HIGH | **Both.** Each fragment string must carry its own intact markers; fragments must split on safe boundaries so a marker is never cut across fragments. v2.5 reinjection pipeline unchanged per PROJECT.md. Dependency risk — flag for the parser phase. |

### Differentiators (Competitive Advantage)

Aligned with Core Value (fluid manipulation of OO content). Not required for a working v1, but valuable.

| Feature | Value Proposition | Complexity | Notes (surface + dependency) |
|---------|-------------------|------------|------------------------------|
| **Interleaved fragments inside one reply** (discussion → card → more discussion → card) | The `{{fragment:N}}` position-marker design is *more* granular than Canvas/Artifacts (which keep all artifact on a separate pane). Lets the model say "I split this into two parts:" then show both in context | MEDIUM | **Chat (headline feature).** Split the discussion string on `{{fragment:N}}` tokens; render text segments as markdown and fragment tokens as cards in document order. Popover usually has 1 fragment, so this mostly benefits chat. |
| **Multiple alternative fragments as "pick-one" cards** | When the model returns several phrasings/translations, present comparable cards each with its own Insert (the documented "Variations" pattern: 3–5 well-differentiated options) | MEDIUM | **Both.** Falls out almost for free from per-fragment cards: N fragments → N cards. Must decide alternatives (pick one) vs sequential pieces (insert all) — contract is ambiguous; resolve in requirements. |
| **Insert-all / Replace-with-all** when fragments are sequential pieces | Saves N clicks for "intro / body / conclusion" assembled into the doc (Gemini "Accept all" precedent) | LOW-MEDIUM | **Both.** Only meaningful if fragments are ordered pieces, NOT alternatives. Defer until alternatives-vs-pieces semantics resolved. |
| **Subtle "AI produced" affordance on cards** (sparkle / accent border reusing `SCRIBE_PURPLE`) | Reinforces provenance; codebase already has the purple sparkle motif | LOW | **Both.** Reuse `SparkleSvg` / `SCRIBE_PURPLE` from `ChatMessageList.jsx`. Cheap polish. |
| **Confirmation flash per fragment** (existing check-icon swap) | Immediate "this fragment was inserted" feedback without closing the panel — supports inserting several fragments in sequence | LOW | **Both.** `MessageActions` already has `showConfirmation` (1.5s check). Reuse per card. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Editable artifact pane** (type into the fragment, Canvas-style live editing) | Canvas/Artifacts envy; "tweak before inserting" | Huge scope: needs a second editor + sync + conflicts — and we *already have* OnlyOffice as the editor. Explicitly conflicts with "édition collaborative — complexité excessive" (Out of Scope) | Insert into OO, then edit in OO. The document IS the canvas. Keep fragments read-only preview cards. |
| **Auto-insert / auto-apply** (skip preview) | "Faster" | Violates the universal "never overwrite without confirmation" rule; OO mutations + fragile undo (known issues). Re-introduces the blob problem if discussion leaks in | Always require an explicit click. Preview is the validated UX (Key Decisions). |
| **Diff / tracked-changes per fragment** (Gemini accept/reject gutter, JetBrains) | Looks professional for "edit my selection" | Reinjection goes through PasteHtml/Builder API, not a diff engine; inline diff against live OO content is high-effort and brittle with tables/images; post-paste selection is already known-broken | Replace = clean overwrite of selection (current behavior). Skip diff for v3.1. |
| **Forcing every reply to contain a fragment** (always show Insert) | Simpler contract; "consistent UI" | This is literally the bug being fixed | Honor the 0-fragment case as first-class (table stakes). |
| **Streaming the fragment cards token-by-token** | Modern chat feel | Endpoint is non-streaming (Key Decisions); parsing partial `{ discussion, fragments }` mid-stream is fragile, markers may be incomplete | Keep non-streaming for v3.1; existing "typing" spinner; render cards once parsed. |
| **More than ~5 alternative cards** | "Give me lots of options" | Research: 3–5 differentiated options beat 10 that blur; long card lists overwhelm and slow the panel | Cap/scroll if over-produced; prompt for few, distinct fragments. |
| **Separate full-screen artifact workspace** (Artifacts/Canvas dual-pane) | Flagship parity | We already have Drive → OO → plugin panes plus a side panel; a fourth surface is layout chaos and conflicts with the v4.0 separate-app deferral | Inline cards within chat + popover. The OO document is the workspace. |

## Feature Dependencies

```
[Contract parser: parseScribeResponse -> { discussion, fragments[] }]
    └──requires──> [JSON contract + tolerant parsing + contextual fallback]   (v3.1 data layer)

[Fragment cards in chat]
    └──requires──> [Contract parser]
    └──requires──> [{{fragment:N}} marker splitter for the discussion string]
    └──reuses────> [MessageActions]  (rebind from message-level to fragment-level)
    └──reuses────> [react-markdown / MarkdownPreview]

[Fragment cards in popover]
    └──requires──> [Contract parser]
    └──reuses────> [ScribeResultPanel body + global Insert/Replace -> per-fragment]
    └──requires──> [popover fallback: 0/absent fragments => treat whole reply as 1 fragment]

[Per-fragment Insert/Replace]
    └──requires──> [marker fidelity preserved per fragment]
    └──reuses────> [existing v2.5 rich reinjection (tables/images/footnotes)] — UNCHANGED

[Insert-all]
    └──requires──> [decision: fragments = alternatives (pick one) vs pieces (assemble)]
    └──conflicts──> [alternatives semantics]  (don't ship insert-all if fragments are alternatives)

[Pure-discussion handling] ──enhances──> [all surfaces]  (suppresses fragment UI entirely)
```

### Dependency Notes

- **All UI depends on the parser:** the cards are a pure render of `{ discussion, fragments }`. Parser + tolerant fallback (already in PROJECT.md target features) must land before/with the rendering phases. The PROJECT.md "Sonde dev" probe (confirm the model actually emits 1/N/0 fragments) should gate the UI work.
- **Marker fidelity is the cross-cutting risk:** splitting one reply into fragment strings must not cut a `[TABLE:N]…[CELL:r,c]` or `[IMG:scribe-img-N]` marker across fragments, or the v2.5 reinjection breaks. Flag for the contract/parser phase.
- **Alternatives vs pieces is unresolved:** `fragments: string[]` doesn't say whether they are competing options or sequential parts. This drives whether "Insert all" exists and whether cards read "Option 1 / Option 2" vs "Part 1 / Part 2". Resolve in requirements before building Insert-all.
- **Share one component across surfaces:** chat reuses `MessageActions`; popover reuses `ScribeResultPanel`. Minimize new code by extracting a single `<FragmentCard>` used by both, to avoid chat/popover divergence.

## MVP Definition

### Launch With (v3.1)

Minimum to fix the blob problem on both surfaces.

- [ ] **Contract parser + tolerant fallback** — without it nothing renders; pure-discussion fallback lives here — *essential*
- [ ] **Pure-discussion (0 fragments) correctness** — no insert/replace UI; chat = plain bubble, popover = collapse to whole-reply-as-1-fragment — *the most important behavior*
- [ ] **`<FragmentCard>` shared component** — visually distinct, read-only `MarkdownPreview`, per-fragment Copy + Insert + (conditional) Replace, reusing `MessageActions` logic + confirmation flash
- [ ] **Chat: interleave discussion + `{{fragment:N}}` cards** in document order
- [ ] **Popover: discussion above, fragment card(s) below**, per-fragment actions; quick actions still work via fallback
- [ ] **Per-fragment marker fidelity** through the unchanged v2.5 reinjection pipeline

### Add After Validation (v3.1.x)

- [ ] **Multiple alternative fragments as "pick-one" cards** — once N-fragment replies are observed in the dev probe and alternatives-vs-pieces is decided
- [ ] **Insert-all / Replace-with-all** — only if fragments are confirmed to be sequential pieces
- [ ] **Provenance polish** (sparkle/accent on cards)

### Future Consideration (v3.2+)

- [ ] **Editor-action evolution** (PROJECT.md long-term vision: fragments → editor actions) — defer
- [ ] **Diff / tracked-changes per fragment** — only if a strong "edit my selection" need emerges; high effort, brittle with OO
- [ ] **Streaming rendering of cards** — gated on backend streaming support (not in v3.1)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Contract parser + tolerant fallback | HIGH | MEDIUM | P1 |
| Pure-discussion (0-fragment) handling | HIGH | LOW | P1 |
| Per-fragment Insert/Replace/Copy (`<FragmentCard>`) | HIGH | MEDIUM | P1 |
| Distinct fragment card styling | HIGH | LOW | P1 |
| Chat interleaving via `{{fragment:N}}` | HIGH | MEDIUM | P1 |
| Popover discussion + fragment card | HIGH | MEDIUM | P1 |
| Per-fragment marker fidelity | HIGH | MEDIUM-HIGH | P1 |
| Multiple-alternatives "pick one" cards | MEDIUM | MEDIUM | P2 |
| Insert-all (sequential pieces) | MEDIUM | LOW-MEDIUM | P2 |
| Provenance polish (sparkle/accent) | LOW | LOW | P2 |
| Editable artifact pane | LOW (have OO) | HIGH | P3 (anti) |
| Diff / tracked-changes | MEDIUM | HIGH | P3 (defer) |
| Streaming cards | LOW | MEDIUM | P3 (blocked) |

## Competitor Feature Analysis

| Feature | Claude Artifacts | ChatGPT Canvas | Google Docs Gemini | Notion AI | **Our Approach (v3.1)** |
|---------|------------------|----------------|--------------------|-----------|--------------------------|
| Separate talk vs artifact | Separate side pane, isolated from chat | Side-by-side doc pane | Floating card, generated text below prompt | Inline AI block separate from page text | **Inline fragment cards within the reply** (chat) / card below discussion (popover) — no extra pane |
| Insert into document | Manual (artifact is the doc) | Edit in pane / apply | Explicit **Insert** button | **Insert below / Replace** | Per-fragment **Insert / Replace / Copy** |
| Edit before insert | Ask AI in chat (not typeable) | Direct in-pane editing | Refine then insert | Refine then insert | **Read-only preview**; edit in OO after insert |
| Multiple alternatives | Re-prompt | Regenerate | Refine/regenerate | Regenerate | **N fragments → N cards** (P2: pick-one) |
| Pure discussion (no artifact) | Stays in chat, no pane | No canvas opened | Plain answer | Plain answer | **0 fragments → no insert UI** (first-class) |
| Apply granularity | Whole artifact | Section-level edits | Accept / Accept all / Reject all (diff) | Per block | **Per-fragment**; Insert-all later, **no diff** |
| Position markers in explanation | No (pane is monolithic) | No | No | No | **`{{fragment:N}}` interleaving — our differentiator** |

**Takeaway:** the big products separate by a **dedicated pane**; Scribe can't add a fourth pane and doesn't need to. The `{{fragment:N}}` interleave is genuinely more granular than Canvas/Artifacts and is the right bet — but the universal, non-negotiable lesson across all of them is the **pure-discussion / never-auto-apply** discipline.

## Sources

- [Altar.io — Claude Artifacts, ChatGPT Canvas, Perplexity Spaces](https://altar.io/next-gen-of-human-ai-collaboration/) (dual-pane context vs workspace separation) — MEDIUM
- [XsOne — ChatGPT Canvas vs Claude Artifacts technical deep-dive](https://xsoneconsultants.com/blog/chatgpt-canvas-vs-claude-artifacts/) (artifact isolation, section editing) — MEDIUM
- [Shape of AI — Variations pattern](https://www.shapeof.ai/patterns/variations) (3–5 options, "never overwrite without confirmation", branched/convergent/preset) — HIGH (canonical UX pattern reference)
- [MindStudio — Multi-variation generation](https://www.mindstudio.ai/blog/multi-variation-generation-ai-agent) (3–5 differentiated variants) — MEDIUM
- [Google Docs Help — Write & edit with Gemini](https://support.google.com/docs/answer/13951448?hl=en) and [Computerworld — Help me write](https://www.computerworld.com/article/1627842/how-to-use-help-me-write-ai-writing-tool-google-docs-gmail.html) (Insert button, Refine, Accept/Accept all/Reject all) — MEDIUM-HIGH
- [Notion — Everything you can do with Notion AI](https://www.notion.com/help/guides/everything-you-can-do-with-notion-ai) (Insert below, inline AI block) — MEDIUM
- [JetBrains AI Assistant — In-editor generation](https://www.jetbrains.com/help/ai-assistant/in-editor-code-generation.html) (accept/reject per change, gutter revert — informs why we skip diff) — MEDIUM
- [Orwellix — AI writing assistants tested](https://orwellix.com/blog/posts/writing-with-ai/best-ai-writing-assistant-for-editing-documents) (tracked-changes per-edit accept/reject) — LOW-MEDIUM
- Existing codebase: `ChatMessageList.jsx`, `MessageActions.jsx`, `ScribeResultPanel.jsx`, `.planning/PROJECT.md` (current surfaces, v2.5 reinjection, v3.1 target features) — HIGH

---
*Feature research for: AI writing assistant — discussion/fragment separation across chat panel + inline popover*
*Researched: 2026-06-16*
