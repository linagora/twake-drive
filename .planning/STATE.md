---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: Contrat de réponse structurée LLM
status: planning
last_updated: "2026-06-16T15:11:24.472Z"
last_activity: 2026-06-16
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-04)

**Core value:** L'utilisateur peut interagir avec l'IA de maniere fluide -- actions rapides inline ou chat conversationnel dans un panneau lateral -- pour transformer et manipuler le contenu de son document OnlyOffice.
**Current focus:** v3.0 complete -- post-milestone refinements shipped

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-06-16 — Milestone v3.1 started

## Post-Milestone Refinements (2026-04-03 to 2026-04-04)

After v3.0-04 completion, three commits refined the plugin protocol and documentation:

1. **89ac98a9c** -- Simplify plugin protocol: remove SHOW/HIDE_SCRIBE_BUTTON polling, replace with SELECTION_CHANGED one-way intent. Remove keyboard shortcut delay. Add focus guard on ChatInput textarea. Instant Popover open (transitionDuration=0). Both floating buttons always visible.
2. **12a48b109** -- Restore full plugin code.js (2800+ lines with v2.5/v2.6 features). Add selection-subscribe protocol (plugin only sends SELECTION_CHANGED when panel is open). Remove popover timer delay.
3. **318a751fc** -- Document patched OO SDK setup and upstream PR dependency in plugin README.

## Performance Metrics

**Velocity:**

- Total plans completed: 24 (v1.0: 10, v2.0: 5, v2.1: 6, v2.2: 3)
- v2.1 average duration: ~5 min/plan
- v2.1 total execution time: ~32 min

**By Phase (v2.1):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 10 Extraction Rich Text | 2 | 4min | 2min |
| 11 Pipeline de Conversion | 2 | 9min | 4.5min |
| 12 Preview Markdown | 1 | 2min | 2min |
| 13 Reinjection Pipeline | 1 | 15min | 15min |
| Phase v3.0-01 P01 | 2min | 2 tasks | 6 files |
| Phase v3.0-02 P01 | 3min | 2 tasks | 6 files |
| Phase v3.0-03 P01 | 3min | 2 tasks | 7 files |
| Phase v3.0-03 P02 | 2min | 1 task | 6 files |
| Phase v3.0-04 P01 | 2min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.
Recent decisions affecting v3.0:

- Side panel in Cozy Drive (not OO native plugin) for more UI control and cozy-ui components
- Complementary inline + panel modes (keep quick actions, add chat for longer exchanges)
- cozy-ui components without modification for ecosystem consistency
- ScribeContext provider to centralize state (currently scattered across View.jsx, useCozyBridge, ScribePopover)
- Existing OnlyOfficeAIAssistantPanel proves flex sibling layout pattern (30% width side panel)
- Zero new npm dependencies needed
- Plugin code.js needs zero changes -- all selection data already flows via existing intents
- [Phase v3.0-01]: Null-safe useScribe access in View.jsx for graceful fallback
- [Phase v3.0-02]: Chat system prompt separate from inline SYSTEM_PROMPT (conversational vs transform-only)
- [Phase v3.0-02]: messagesRef pattern for stable sendMessage callback
- [Phase v3.0-02]: addMessage() callback for external message injection from popover
- [Phase v3.0-03]: selectionDismissedRef tracks dismissed text to prevent chip re-showing until new selection
- [Phase v3.0-03]: Selection persists after sending for follow-up questions
- [Phase v3.0-03]: Composite AI prompt uses delimited markers for selection context
- [Phase v3.0-03]: panelActions bridge pattern -- View.jsx passes respond handlers into ScribeContext for MessageActions
- [Phase v3.0-03]: Rich HTML clipboard copy via ClipboardItem API with text/plain fallback
- [Phase v3.0-04]: Horizontal flex layout in ScribePanel for resize handle placement
- [Phase v3.0-04]: Removed width transition to avoid laggy feel during real-time drag

### Pending Todos (carried from v2.3)

- ✓ Fix "Selected Text" white-on-white in OO dark theme — resolved
- ✓ Button disable on deselection — resolved
- ✓ Context menu integration — resolved

### Known Technical Constraints

- Plugin code must use ES5 syntax
- OO iframe resize has no callback -- must validate empirically in Phase v3.0-01
- Cross-origin iframe blocks resize dispatch -- rely on CSS flex sizing
- No cozy-stack modifications -- frontend only

### Blockers/Concerns

- OO iframe resize behavior is undocumented -- Phase v3.0-01 is a go/no-go gate

## Session Continuity

Last session: 2026-04-04
Stopped at: Post-milestone refinements complete
Resume file: N/A (milestone complete)
