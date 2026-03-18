---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Scribe Chat Panel
status: planning
stopped_at: Phase v3.0-03 context gathered
last_updated: "2026-03-18T22:24:16.994Z"
last_activity: 2026-03-18 -- Completed v3.0-02 Chat Core
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 10
  completed_plans: 9
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** L'utilisateur peut interagir avec l'IA de maniere fluide -- actions rapides inline ou chat conversationnel dans un panneau lateral -- pour transformer et manipuler le contenu de son document OnlyOffice.
**Current focus:** Phase v3.0-03 - Selection Context + Document Actions

## Current Position

Phase: v3.0-03 of v3.0-04 (Selection Context + Document Actions)
Plan: not yet planned
Status: Ready to plan
Last activity: 2026-03-18 -- Completed v3.0-02 Chat Core

Progress: [█████░░░░░] 50%

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

Last session: 2026-03-18T22:24:16.992Z
Stopped at: Phase v3.0-03 context gathered
Resume file: .planning/phases/v3.0-03-selection-context-document-actions/v3.0-03-CONTEXT.md
