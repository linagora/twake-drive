---
gsd_state_version: 1.0
milestone: v2.6
milestone_name: Formatage Complet et References Documentaires
status: planning
stopped_at: Milestone v2.6 started
last_updated: "2026-03-23"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** La chaine de communication complete -- depuis la selection de texte dans OnlyOffice jusqu'a la reinjection du texte modifie par l'IA -- de bout en bout, transparente pour l'utilisateur.
**Current focus:** Defining requirements for v2.6

## Current Position

Phase: Not started (defining requirements)
Plan: —

## Performance Metrics

**Velocity:**

- Total plans completed: 34 (v1.0: 10, v2.0: 5, v2.1: 6, v2.2: 3, v2.3: 1, v2.4: 6, v2.5: 3)

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
- [v2.5]: Plugin-side extraction via callCommand replaces HTML-based extraction; enrichedMd priority chain preserves backward compat
- [Phase 22]: callCommand switched to read-write for SetName on images; imageCounter via Asc.scope for stable naming
- [Phase 23]: Inline markers normalized to standard image syntax before both preview and lexer paths
- [Phase 23]: ToJSON/FromJSON as primary image serialization strategy over Copy() -- self-contained JSON survives document mutations
- [Phase 23]: Copy() replaces ToJSON/FromJSON as primary strategy -- ToJSON loses bitmap data, Copy() preserves it
- [Phase 23]: OO API lacks inline drawing position info -- patched sdkjs with ApiRun.GetInlineDrawings() (PR pending upstream)
- [Phase 23.2]: Inline getInlineDrawings with ternary fallback; oo-dev-setup.sh already clean
- [Phase 24]: Dual storage: rawResult preserves cell markers for reinjection while result.text gets display-friendly pipe-table
- [Phase 24]: Cell text pre-flattened in plugin scope; source font per cell before Clear(); mixed content skips text replacement to preserve table (v2.5)

- [Phase 24.1]: Rearchitecture table round-trip: clone table via ApiTable.Copy() + insert via InsertContent (supports both Replace and Insert modes). Add [TABLE:N] markers to extraction. In-place modification removed.
- [Phase 24.1]: TABLE:N wrappers at emission site (not inside extractTableCells) for reusability; backward compat for bare CELL markers
- [Phase 24.1]: Placeholder tokens (__SCRIBE_TABLE_N__) survive marked.lexer as paragraph text for content loop detection; table clones in object keyed by index for sparse access

### Roadmap Evolution

- Phase 23.1 inserted after Phase 23: OO SDK Patch — ApiRun.GetInlineDrawings (URGENT)
- Phase 23.2 inserted after Phase 23: Image round-trip cleanup (URGENT)
- Phase 24.1 inserted after Phase 24: Table round-trip rearchitecture — clone + InsertContent (URGENT)

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

Last session: 2026-03-23T13:35:19.186Z
Stopped at: Completed 24.1-02-PLAN.md
Resume file: None
Resume command: /gsd:execute-phase 22-02
