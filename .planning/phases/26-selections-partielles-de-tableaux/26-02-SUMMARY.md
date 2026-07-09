---
phase: 26-selections-partielles-de-tableaux
plan: 02
subsystem: plugin, ui
tags: [onlyoffice, table-selection, injection, es5, partial-table]

# Dependency graph
requires:
  - phase: 26-selections-partielles-de-tableaux
    provides: "analyzeTableSelection, extractPartialTableCells, partialTableInfo intent data"
provides:
  - "modifyOriginalTableCells -- in-place cell modification for partial table Replace"
  - "buildReducedTableClone -- reduced table with only selected rows/columns for Insert"
  - "Partial table injection routing via isPartialTable flag"
  - "Insert button disabled for pure partial-table selections"
affects: [injection-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-place cell modification for partial tables (no clone+InsertContent)"
    - "Reduced table clone via RemoveRow/RemoveColumn for Insert mode"
    - "Post-operation cell range selection via GetRange on corner cells"

key-files:
  created: []
  modified:
    - plugins/onlyoffice-scribe/scripts/code.js
    - src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx
    - src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx

key-decisions:
  - "Partial table Replace uses in-place modification (not clone+InsertContent) to preserve table structure"
  - "Partial table Insert builds reduced clone with only selected rows/columns via RemoveRow/RemoveColumn"
  - "Insert button disabled when enrichedMd contains only TABLE blocks and partialTableInfo is non-null"
  - "Post-operation selection targets the bounding rectangle of modified cells"

patterns-established:
  - "isPartialTable routing: mode x partial flag determines injection strategy"
  - "tableClones[idx] = null sentinel means in-place modification already done"

requirements-completed: [TBL-01, TBL-02]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 26 Plan 02: Partial Table Injection Routing Summary

**modifyOriginalTableCells for in-place Replace, buildReducedTableClone with RemoveRow/RemoveColumn for Insert, Insert button disabled for pure partial-table selections**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T16:20:53Z
- **Completed:** 2026-03-25T16:25:39Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added modifyOriginalTableCells() for in-place cell modification on partial table Replace (Case 2a)
- Added buildReducedTableClone() that clones table, injects LLM content, then removes unselected rows/columns (Cases 2b/2c/2d)
- Injection routing branches on isPartialTable + mode: in-place for Replace, reduced clone for Insert, full clone for full tables
- Post-operation selection highlights the modified cell range (min/max row/col bounding box)
- Insert button disabled with tooltip for pure partial-table selections (no mixed content)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement partial table injection routing in plugin callCommand** - `86de2d1b1` (feat)
2. **Task 2: Disable Insert button for partial-table-only selections** - `9319ace7c` (feat)

## Files Created/Modified
- `plugins/onlyoffice-scribe/scripts/code.js` - Added modifyOriginalTableCells, buildReducedTableClone, isPartialTable routing, partialTableInfo pass-through, SCRIBE-TABLE null handling, post-op cell selection
- `src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx` - Added insertDisabled prop with disabled attribute and tooltip on Insert button
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` - Added insertDisabled useMemo computation based on partialTableInfo and enrichedMd content

## Decisions Made
- Partial table Replace modifies cells in-place in the original table (not clone+InsertContent), preserving unselected cells and table structure intact
- Partial table Insert uses RemoveRow/RemoveColumn on clone rather than rebuilding from scratch, preserving table formatting
- Insert disabled only for pure partial-table selections; mixed selections (partial table + paragraphs) keep Insert enabled
- Post-operation selection uses paragraph ranges of corner cells to build bounding rectangle

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 26 complete: partial table detection (Plan 01) and injection (Plan 02) fully wired
- Full table selections continue using clone+InsertContent unchanged (no regression)
- Ready for manual testing of all cases: full table Replace/Insert, partial table Replace, partial table Insert with mixed content, Insert disabled for pure partial table

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 26-selections-partielles-de-tableaux*
*Completed: 2026-03-25*
