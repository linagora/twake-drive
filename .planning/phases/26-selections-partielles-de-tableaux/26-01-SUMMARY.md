---
phase: 26-selections-partielles-de-tableaux
plan: 01
subsystem: plugin, ui
tags: [onlyoffice, table-selection, extraction, es5, partial-table]

# Dependency graph
requires:
  - phase: 24-tables-extraction
    provides: "extractTableCells, table range detection, clone+inject injection"
provides:
  - "analyzeTableSelection — classifies full/partial/intra-cell/ambiguous table selections"
  - "extractPartialTableCells — extracts only selected cells from a table"
  - "tableAmbiguity intent data — signals ambiguous selections to React UI"
  - "partialTableInfo intent data — maps table indices to selected cell coordinates"
affects: [26-02, injection-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cell range overlap detection via paragraph GetRange positions"
    - "Intra-cell bypass: table paragraphs within selection fall through to normal extraction"

key-files:
  created: []
  modified:
    - plugins/onlyoffice-scribe/scripts/code.js
    - src/modules/views/OnlyOffice/View.jsx
    - src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx

key-decisions:
  - "Intra-cell selections bypass table handling entirely — same code path as paragraph"
  - "Ambiguous selections show Alert warning and block AI call"
  - "partialTableInfo stored in useRef (not state) in View.jsx since it does not drive renders"
  - "Empty cells included if their row has at least one selected cell"

patterns-established:
  - "analyzeTableSelection returns a classification object for routing extraction logic"
  - "tableAmbiguity flows through intent protocol from plugin to React UI"

requirements-completed: [TBL-01, TBL-02]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 26 Plan 01: Partial Table Selection Detection and Extraction Summary

**analyzeTableSelection classifies full/partial/intra-cell/ambiguous table selections; extractPartialTableCells emits only selected cells; ambiguity Alert blocks AI call in ScribePopover**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T16:13:09Z
- **Completed:** 2026-03-25T16:17:46Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added analyzeTableSelection() that detects four cases: full table, partial (selected rows), intra-cell (selection within one cell), and ambiguous (selection cuts through cell boundary)
- Added extractPartialTableCells() that emits only CELL markers for cells in the selectedCells list
- Modified extraction loop to route through analysis results with proper intra-cell bypass
- Wired tableAmbiguity and partialTableInfo through intent protocol to React UI
- ScribePopover shows MUI Alert warning for ambiguous selections and blocks AI call

## Task Commits

Each task was committed atomically:

1. **Task 1: Add analyzeTableSelection and extractPartialTableCells to plugin extraction** - `2b1ac079b` (feat)
2. **Task 2: Wire ambiguity display in React and pass partial table metadata** - `c322436f8` (feat)

## Files Created/Modified
- `plugins/onlyoffice-scribe/scripts/code.js` - Added analyzeTableSelection, extractPartialTableCells, modified extraction loop, updated return value and buildEditIntentData
- `src/modules/views/OnlyOffice/View.jsx` - Extract tableAmbiguity/partialTableInfo from intent, pass as props, include in respond() callbacks
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` - Ambiguity Alert display, AI call guard, new PropTypes

## Decisions Made
- Intra-cell selections (Case 1) bypass table handling entirely: the isIntraCell flag causes paragraphs within the selection range to fall through to normal markdown extraction, while paragraphs in other cells of the same table are skipped
- Empty cells are auto-included when their row has at least one explicitly selected cell (prevents missing cells in extraction)
- partialTableInfo uses useRef in View.jsx since it only needs to survive until the respond() callback, not trigger re-renders

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Extraction side complete: analyzeTableSelection and extractPartialTableCells ready for use
- partialTableInfo flows through respond() to the plugin injection side
- Plan 02 (injection for partial tables) can now use partialTableInfo to switch between clone+InsertContent (full) and in-place modification (partial)

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 26-selections-partielles-de-tableaux*
*Completed: 2026-03-25*
