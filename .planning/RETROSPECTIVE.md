# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v3.0 — Scribe Chat Panel

**Shipped:** 2026-04-04
**Phases:** 4 | **Plans:** 7

### What Was Built
- Conversational chat side panel in Cozy Drive (flex sibling layout alongside OO iframe)
- Multi-turn AI chat with Markdown rendering, error handling, loading states
- Selection context integration: chip in input, composite AI prompt with selection markers
- Message actions (Copy/Replace/Insert) bridged to OO plugin via panelActions
- Drag-resizable panel width (ResizeHandle + ScribeContext state)
- Inline popover + panel coexistence with shared conversation history
- Post-milestone: protocol simplification (SHOW/HIDE polling → SELECTION_CHANGED), selection-subscribe, delay removal

### What Worked
- Flex sibling layout pattern: OO iframe resizes naturally with CSS flex — no JS resize dispatch needed
- ScribeContext centralized state cleanly — popover and panel share conversation without prop drilling
- panelActions bridge pattern: View.jsx passes respond handlers into context, MessageActions consumes them
- Post-milestone refinement cycle: shipping v3.0 first, then simplifying the protocol, was the right sequencing

### What Was Inefficient
- v3.0-MILESTONE-AUDIT was run before v3.0-04 completion and never re-audited — caused stale "gaps_found" status for weeks
- SHOW/HIDE polling was carried into v3.0 from v1.0 and only simplified after milestone — should have been cleaned up earlier
- OO cross-origin focus steal from ChatInput textarea required workaround (focus guard) — not documented until post-milestone

### Patterns Established
- SELECTION_CHANGED one-way intent: plugin sends selection updates only when panel is open (selection-subscribe)
- messagesRef pattern: stable sendMessage callback that reads latest messages without re-renders
- addMessage() callback for external message injection (popover → shared chat)
- selectionDismissedRef: tracks dismissed selection text to prevent chip re-showing until new selection

### Key Lessons
1. Protocol simplification should happen as part of the milestone, not after — carry-forward complexity from v1.0 added unnecessary latency and polling
2. Flex sibling layout is the right pattern for side panels in iframe-heavy apps — avoids cross-origin resize issues entirely
3. Focus management in cross-origin iframe setups needs explicit guards — OO steals focus unpredictably
4. Milestone audits should be re-run after the last phase completes, not before

### Cost Observations
- Sessions: ~6-8 (including post-milestone refinements)
- Notable: v3.0 was the largest milestone — 4 phases spanning 3 weeks, but post-milestone refinements were fast (1 day)

---

## Milestone: v2.1 — Formatage Riche

**Shipped:** 2026-03-09
**Phases:** 4 | **Plans:** 6

### What Was Built
- HTML extraction from OO selections with class stripping and graceful fallback
- Bidirectional HTML↔Markdown conversion pipeline (Turndown + marked)
- Markdown rendering in result panel (react-markdown + remark-gfm, theme-aware)
- PasteHtml rich text reinsertion with smart spacing and backward compat
- Full formatting round-trip: bold, italic, headings, lists, tables, code blocks survive OO→LLM→OO

### What Worked
- "Thin plugin, smart host" pattern — keeping conversion logic in React (where libraries are available) and only calling OO APIs from the plugin
- TDD approach for scribeConversion.js — tests caught edge cases early (img rule override, marked ESM import)
- UAT at the end confirmed everything works end-to-end, caught no regressions
- Phase sequencing was clean — each phase built on the previous with clear handoff points

### What Was Inefficient
- Post-paste selection research consumed time but all approaches failed with PasteHtml — should have been deferred earlier
- SUMMARY.md was not generated during initial execution (missing workflow step) — had to backfill

### Patterns Established
- HTML+text dual payload pattern: respond() sends both fields for backward compat
- Smart spacing: check adjacent characters before injecting nbsp
- Regex class stripping for OO HTML (ES5 compatible, no DOMParser in plugin sandbox)
- unwrapSingleParagraph for inline paste without wrapping p tags

### Key Lessons
1. OO plugin sandbox is extremely limited — plan for ES5 + no DOMParser from the start
2. PasteHtml is good enough for basic rich text but has limitations (ordered list bug, no selection control) — Document Builder API needed for complex scenarios
3. Conversion pipeline should always have fallback paths — graceful degradation is critical for production

### Cost Observations
- Sessions: ~4-5
- Notable: v2.1 was efficient — 3 days for a complete rich text pipeline, most time in research/validation rather than implementation

---

## Milestone: v2.2 — Ameliorations UX

**Shipped:** 2026-03-11
**Phases:** 2 | **Plans:** 3

### What Was Built
- Ctrl+Shift+I keyboard shortcut replacing Ctrl+I to avoid OO italic conflict
- Result panel button order fix (Insert left, Replace right) with natural Tab flow
- Mouse-move gated menu highlighting — no false highlights on menu open
- 1-second delayed tooltip on floating button with proper timer cleanup
- Draggable result panel via click-drag on background/header (DOM walk exclusion for interactive elements)
- Resizable result panel with bottom-right grip handle and content reflow

### What Worked
- Small, focused milestone — 6 tight requirements, 2 phases, shipped in 2 days
- Plans executed with zero deviations — clear specs meant no ambiguity
- Audit confirmed 6/6 requirements satisfied before completion
- DOM walk exclusion pattern was elegant — no separate drag handle needed

### What Was Inefficient
- Nothing notable — this was the cleanest milestone yet

### Patterns Established
- Shift modifier for custom shortcuts to avoid native OO conflicts
- mouseMoveEnabled ref pattern: gate onMouseEnter behind physical mouse movement detection
- Document-level listener pattern: add on mousedown, remove on mouseup + unmount cleanup
- Drag offset state in parent applied to anchorPosition for MUI Popover repositioning

### Key Lessons
1. Small milestones with clear UX requirements execute fastest — no ambiguity, no rework
2. Interaction patterns (drag, resize) work well with document-level listeners + cleanup
3. MUI Popover can be repositioned via anchorPosition offset — no need to fight the component

### Cost Observations
- Sessions: ~2
- Notable: Fastest milestone — 2 days, 3 plans, all executed in minutes each

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 6 | 10 | Initial GSD workflow, mock AI |
| v2.0 | 3 | 5 | Faster execution, real API integration |
| v2.1 | 4 | 6 | TDD pattern, UAT verification, research-first approach |
| v2.2 | 2 | 3 | Fastest milestone, zero deviations, clean UX focus |
| v3.0 | 4 | 7 | Largest milestone, side panel architecture, post-milestone refinement cycle |

### Top Lessons (Verified Across Milestones)

1. Research phases pay off — understanding OO APIs and limitations before coding prevents rework
2. Fallback patterns are essential — every feature needs a degradation path
3. "Thin plugin, smart host" — minimize code in constrained environments (OO plugin ES5 sandbox)
4. Small, focused milestones with clear UX specs execute cleanly — no ambiguity means zero rework
