---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Scribe Chat Panel
status: active
stopped_at: null
last_updated: "2026-03-10"
last_activity: 2026-03-10 -- Milestone v3.0 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** L'utilisateur peut interagir avec l'IA de maniere fluide -- actions rapides inline ou chat conversationnel dans un panneau lateral -- pour transformer et manipuler le contenu de son document OnlyOffice.
**Current focus:** Defining requirements for v3.0

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-10 — Milestone v3.0 started

Progress: [░░░░░░░░░░] 0%

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

Last session: 2026-03-10
Stopped at: Milestone v3.0 started, defining requirements
Resume file: None
