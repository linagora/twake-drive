---
gsd_state_version: 1.0
milestone: v2.6
milestone_name: Formatage Complet et References Documentaires
status: complete
stopped_at: Milestone v2.6 complete
last_updated: "2026-04-02T22:00:00.000Z"
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 6
  completed_plans: 6
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** La chaine de communication complete -- depuis la selection de texte dans OnlyOffice jusqu'a la reinjection du texte modifie par l'IA -- de bout en bout, transparente pour l'utilisateur.
**Current focus:** Milestone v2.6 complete — all phases shipped

## Current Position

Phase: 27 (references-documentaires) — COMPLETE
Milestone v2.6 — ALL 3 PHASES COMPLETE (25, 26, 27)

## Performance Metrics

**Velocity:**

- Total plans completed: 37 (v1.0: 10, v2.0: 5, v2.1: 6, v2.2: 3, v2.3: 1, v2.4: 6, v2.5: 3, v2.6: 3)

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
- [Phase 27]: Cross-refs recreated as hyperlinks with patched internal anchor (u0.ma="", u0.Us=anchor)
- [Phase 27]: Heading cross-refs require auto-created bookmark on target paragraph
- [Phase 27]: Footnotes recreated post-InsertContent via AddFootnote() with saved content text
- [Phase 27]: Bookmark name fuzzy matching (space/underscore normalization) for cross-ref targets

### Pending Todos (carried from v2.3)

- ✓ Fix "Selected Text" white-on-white in OO dark theme — resolved: original label no longer exists, floating button updated with dark theme support via useTheme()
- ✓ Button disable on deselection — resolved: button is hidden (not disabled) when no text selected via HIDE_SCRIBE_BUTTON polling, better UX
- ✓ Context menu integration — resolved: implemented in plugin code.js (AddContextMenuItem + attachContextMenuClickEvent), needs manual verification

### Known Technical Constraints

- Plugin code must use ES5 syntax (no const/let, no arrow functions)
- callCommand sandbox has no DOM APIs -- parse outside, pass tokens via Asc.scope
- No CloneFormatting API in OO -- must read/reapply run properties manually
- OO hyperlink internal props: u0.ma (URL), u0.Us (anchor), u0.YD (tooltip) — minified, version-dependent

### Blockers/Concerns

(None)

## Session Continuity

Last session: 2026-04-02T22:00:00.000Z
Stopped at: Milestone v2.6 complete
Resume file: .planning/ROADMAP.md
