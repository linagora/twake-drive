---
gsd_state_version: 1.0
milestone: v2.4
milestone_name: Document Builder Injection
status: defining_requirements
stopped_at: null
last_updated: "2026-03-15"
last_activity: 2026-03-15 -- Milestone v2.4 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** La chaine de communication complete -- depuis la selection de texte dans OnlyOffice jusqu'a la reinjection du texte modifie par l'IA -- de bout en bout, transparente pour l'utilisateur.
**Current focus:** Defining requirements for v2.4 Document Builder Injection

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-15 — Milestone v2.4 started

## Performance Metrics

**Velocity:**
- Total plans completed: 25 (v1.0: 10, v2.0: 5, v2.1: 6, v2.2: 3, v2.3: 1)

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.4]: Parser Markdown → Document Builder API runs inside plugin OO (ES5, callCommand sandbox)
- [v2.4]: Single undo point via callCommand for all injection operations
- [v2.4]: Progressive scope — inline → images → tableaux → styles custom
- [v2.4]: Post-injection selection covers entire injected block
- [v2.4]: Format preservation strategy to be explored (snapshot, fusion, or hybrid)

### Pending Todos (carried from v2.3)

- Fix "Selected Text" white-on-white in OO dark theme (cosmetic, deferred)
- Button disable on deselection when no text selected (deferred)
- Test context menu integration (deferred)

### Known Technical Constraints

- Plugin code must use ES5 syntax
- OO HTML uses inline styles, not semantic tags (needs normalizer for Turndown)
- PasteHtml has ordered list bug (OO #79263) — must test in OO 9.3.0-138
- callCommand sandbox blocks DOMParser/libraries — all conversion in React app
- No cozy-stack modifications — frontend only
- Document Builder API available inside callCommand (Api.CreateParagraph, Api.CreateRun etc.)

### Blockers/Concerns

(None)

## Session Continuity

Last session: 2026-03-15
Stopped at: Defining requirements
Resume file: None
