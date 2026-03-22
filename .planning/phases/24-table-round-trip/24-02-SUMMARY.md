---
phase: 24-table-round-trip
plan: 02
subsystem: ui
tags: [onlyoffice, table, reinjection, cell-markers, callcommand, es5]

requires:
  - phase: 24-table-round-trip
    provides: "tableCellMarkers.js utilities, rawResult with cell markers, system prompt augmentation"
provides:
  - "Cell marker extraction before marked.lexer in buildAndInject"
  - "Pre-flattened cell runs via Asc.scope.tableCells for callCommand"
  - "In-place cell reinjection preserving table structure (borders, widths, backgrounds)"
  - "Source font family/size preservation per cell"
affects: []

tech-stack:
  added: []
  patterns: ["Pre-extract + pre-flatten pattern: parse cell markers in plugin scope, pass pre-flattened runs via Asc.scope to callCommand sandbox"]

key-files:
  created: []
  modified:
    - plugins/onlyoffice-scribe/scripts/code.js

key-decisions:
  - "Cell text pre-flattened in plugin scope (where marked.lexer + flattenTokens available) rather than inside callCommand sandbox"
  - "Source font read from first run of first paragraph per cell before Clear() -- accepts losing per-run font variations within a cell"
  - "Mixed text+table content: table cells updated in-place, non-table text replacement skipped to preserve table structure (v2.5 limitation)"

patterns-established:
  - "Table round-trip reinjection: extract markers -> pre-flatten -> locate table by selection overlap -> read source fonts -> clear+rebuild cells"
  - "tableRoundTripDone flag guards InsertContent to prevent table destruction"

requirements-completed: [REINJ-02, REINJ-03]

duration: 2min
completed: 2026-03-22
---

# Phase 24 Plan 02: Table Cell Reinjection Summary

**In-place cell reinjection in OO tables preserving structure (borders/widths/backgrounds) with markdown formatting and source font/size per cell**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T22:21:58Z
- **Completed:** 2026-03-22T22:24:12Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Cell markers extracted from LLM response before marked.lexer processes it, preventing corruption of cell content
- Cell text pre-flattened via marked.lexer + flattenTokens in plugin scope (where these are available), then passed to callCommand via Asc.scope.tableCells
- In-place cell reinjection locates the original OO table via GetAllTables + selection range overlap, reads source font per cell, then clears and rebuilds with formatted runs
- Table structure (borders, widths, merged cells, backgrounds) fully preserved -- no new ApiTable created

## Task Commits

Each task was committed atomically:

1. **Task 1: Pre-extract cell markers and pre-flatten runs in plugin scope** - `2ad2bdba3` (feat)
2. **Task 2: In-place cell reinjection in callCommand with source font preservation** - `2f90b7690` (feat)

## Files Created/Modified
- `plugins/onlyoffice-scribe/scripts/code.js` - Cell marker extraction before marked.lexer, pre-flattened runs via Asc.scope.tableCells, in-place cell reinjection with source font preservation, tableRoundTripDone guard on InsertContent

## Decisions Made
- Cell text pre-flattened in plugin scope where marked.lexer and flattenTokens are available, since callCommand sandbox cannot access window.marked
- Source font read from first run of first paragraph per cell before Clear() -- accepts losing per-run font variations within a cell (good enough for v2.5)
- Mixed text+table responses: table cells updated in-place but non-table text replacement skipped to avoid InsertContent destroying the table (v2.5 limitation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Table round-trip pipeline is complete: extraction (Phase 22) -> preview (Plan 24-01) -> reinjection (Plan 24-02)
- End-to-end flow: select table -> Scribe action -> LLM processes cell text -> preview shows GFM table -> Replace updates cells in-place
- Single undo point maintained (all within one callCommand)

---
*Phase: 24-table-round-trip*
*Completed: 2026-03-22*
