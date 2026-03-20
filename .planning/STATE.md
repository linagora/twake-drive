---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: Objets Complexes et Blocs Etendus
status: unknown
stopped_at: Roadmap v2.5 created, ready to plan Phase 21
last_updated: "2026-03-20T10:15:43.385Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 2
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** La chaine de communication complete -- depuis la selection de texte dans OnlyOffice jusqu'a la reinjection du texte modifie par l'IA -- de bout en bout, transparente pour l'utilisateur.
**Current focus:** Phase 21 — blocs-etendus

## Current Position

Phase: 21 (blocs-etendus) — EXECUTING
Plan: 1 of 2

## Performance Metrics

**Velocity:**

- Total plans completed: 31 (v1.0: 10, v2.0: 5, v2.1: 6, v2.2: 3, v2.3: 1, v2.4: 6)

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.4]: "Parse outside, build inside" -- tokenize MD in plugin iframe, interpret tokens via Asc.scope in callCommand
- [v2.4]: Two selection strategies (selectByRefs / selectByPositions) for inline vs block mode
- [v2.5]: Plugin OO produces markdown (not htmlToMarkdown in Scribe) -- plugin knows OO structure best
- [v2.5]: Scribe defines marker contract for images and table cells -- editors must comply
- [v2.5]: Tables: cell-by-cell extraction with [CELL:r,c] markers, not raw md table to LLM
- [v2.5]: Table cell formatting: md formatting + font/size from 1st paragraph source cell (accept losing colors)
- [v2.5]: Images: ID markers only, image data never sent to LLM, Copy/AddDrawing for reinsertion

### Pending Todos (carried from v2.3)

- Fix "Selected Text" white-on-white in OO dark theme (cosmetic, deferred)
- Button disable on deselection when no text selected (deferred)
- Test context menu integration (deferred)

### Known Technical Constraints

- Plugin code must use ES5 syntax (no const/let, no arrow functions)
- callCommand sandbox has no DOM APIs -- parse outside, pass tokens via Asc.scope
- No CloneFormatting API in OO -- must read/reapply run properties manually
- ApiImage has no public GetSrc() -- use ToJSON/FromJSON for serialization
- Drawing objects (images) must be wrapped in paragraph via AddDrawing, not directly in InsertContent

### Blockers/Concerns

(None)

## Session Continuity

Last session: 2026-03-20
Stopped at: Roadmap v2.5 created, ready to plan Phase 21
Resume file: None
Resume command: /gsd:plan-phase 21
