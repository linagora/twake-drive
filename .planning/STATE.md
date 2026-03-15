---
gsd_state_version: 1.0
milestone: v2.4
milestone_name: Document Builder Injection
status: ready_to_plan
stopped_at: null
last_updated: "2026-03-15"
last_activity: 2026-03-15 -- Roadmap created for v2.4
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 6
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** La chaine de communication complete -- depuis la selection de texte dans OnlyOffice jusqu'a la reinjection du texte modifie par l'IA -- de bout en bout, transparente pour l'utilisateur.
**Current focus:** Phase 18 -- Token Pipeline + Minimal Builder Injection

## Current Position

Phase: 18 of 20 (Token Pipeline + Minimal Builder Injection)
Plan: 0 of 2 in current phase
Status: Ready to plan
Last activity: 2026-03-15 -- Roadmap created for v2.4

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 25 (v1.0: 10, v2.0: 5, v2.1: 6, v2.2: 3, v2.3: 1)
- v2.4 plans completed: 0/6

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.4]: "Parse outside, build inside" -- tokenize MD in plugin iframe, interpret tokens via Asc.scope in callCommand
- [v2.4]: marked bundled in plugin code.js for tokenization
- [v2.4]: Single undo point via single callCommand for all Builder API calls
- [v2.4]: Post-injection selection deferred to Phase 20 (sentinel marker strategy needs spike)
- [v2.4]: PasteHtml fallback preserved throughout migration

### Pending Todos (carried from v2.3)

- Fix "Selected Text" white-on-white in OO dark theme (cosmetic, deferred)
- Button disable on deselection when no text selected (deferred)
- Test context menu integration (deferred)

### Known Technical Constraints

- Plugin code must use ES5 syntax (no const/let, no arrow functions)
- callCommand sandbox has no DOM APIs -- parse outside, pass tokens via Asc.scope
- Asc.scope payload size limit unknown -- test with realistic payloads in Phase 18
- Post-insertion selection unreliable -- InsertContent does not return element refs
- Redo broken after callCommand (confirmed OO bug, no fix)

### Blockers/Concerns

(None)

## Session Continuity

Last session: 2026-03-15
Stopped at: Roadmap created, ready to plan Phase 18
Resume file: None
