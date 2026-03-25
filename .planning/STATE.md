---
gsd_state_version: 1.0
milestone: v2.6
milestone_name: Formatage Complet et References Documentaires
status: unknown
stopped_at: Completed 26-02-PLAN.md
last_updated: "2026-03-25T16:27:07.399Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 3
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** La chaine de communication complete -- depuis la selection de texte dans OnlyOffice jusqu'a la reinjection du texte modifie par l'IA -- de bout en bout, transparente pour l'utilisateur.
**Current focus:** Phase 26 — selections-partielles-de-tableaux

## Current Position

Phase: 26 (selections-partielles-de-tableaux) — EXECUTING
Plan: 2 of 2

## Performance Metrics

**Velocity:**

- Total plans completed: 34 (v1.0: 10, v2.0: 5, v2.1: 6, v2.2: 3, v2.3: 1, v2.4: 6, v2.5: 3)

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.5]: Plugin OO produces markdown (not htmlToMarkdown in Scribe) -- plugin knows OO structure best
- [v2.5]: Scribe defines marker contract for images and table cells -- editors must comply
- [v2.5]: Tables: cell-by-cell extraction with [CELL:r,c] markers, not raw md table to LLM
- [v2.5]: buildMarkdownFromParts state machine handles inline formatting transitions
- [Phase 24.1]: Clone tables via ApiTable.Copy() + InsertContent (supports Replace and Insert)
- [Phase 26]: Intra-cell selections bypass table handling entirely — same code path as paragraph
- [Phase 26]: Partial table Replace uses in-place modification (not clone+InsertContent) to preserve table structure
- [Phase 26]: Insert button disabled for pure partial-table selections; enabled for mixed content

### Pending Todos (carried from v2.3)

- Fix "Selected Text" white-on-white in OO dark theme (cosmetic, deferred)
- Button disable on deselection when no text selected (deferred)
- Test context menu integration (deferred)

### Known Technical Constraints

- Plugin code must use ES5 syntax (no const/let, no arrow functions)
- callCommand sandbox has no DOM APIs -- parse outside, pass tokens via Asc.scope
- No CloneFormatting API in OO -- must read/reapply run properties manually

### Blockers/Concerns

(None)

## Session Continuity

Last session: 2026-03-25T16:27:07.397Z
Stopped at: Completed 26-02-PLAN.md
Resume file: None
