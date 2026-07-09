---
phase: 24-table-round-trip
plan: 01
subsystem: ui
tags: [markdown, gfm, tables, cell-markers, preview, llm-prompt]

requires:
  - phase: 22-callcommand-extraction
    provides: "enrichedMd with [CELL:r,c]...[/CELL] markers from plugin extraction"
provides:
  - "tableCellMarkers.js utility: parseCellMarkers, validateCellCount, cellsToMarkdownTable, transformCellMarkersForPreview"
  - "ScribePopover pre-processes cell markers for preview, preserves raw markers for reinjection"
  - "scribeAI augments system prompt with cell marker preservation instruction"
affects: [24-02-table-reinjection]

tech-stack:
  added: []
  patterns: ["cell marker transform pipeline: raw LLM -> display (pipe-table) + raw (for reinjection)"]

key-files:
  created:
    - src/modules/views/OnlyOffice/Scribe/tableCellMarkers.js
  modified:
    - src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx
    - src/modules/views/OnlyOffice/Scribe/scribeAI.js
    - src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx

key-decisions:
  - "Dual storage: rawResult preserves cell markers for reinjection while result.text gets display-friendly pipe-table"
  - "Cell count validation uses >= (LLM may duplicate but should not drop cells)"
  - "Warning banner inline in result panel with theme-aware colors (dark/light)"

patterns-established:
  - "Transform pipeline pattern: LLM response -> transformCellMarkersForPreview -> displayMd (preview) + raw (reinjection)"
  - "System prompt augmentation: conditional append based on enrichedMd content detection"

requirements-completed: [EXTR-03, MARK-03, MARK-04]

duration: 3min
completed: 2026-03-22
---

# Phase 24 Plan 01: Cell Marker Parsing and Preview Summary

**Cell marker parser + GFM pipe-table preview transform with dual-path (display vs raw) for table round-trip pipeline**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T22:17:20Z
- **Completed:** 2026-03-22T22:20:16Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created tableCellMarkers.js with four utility functions for parsing, validating, and transforming cell markers
- Wired pre-processing into ScribePopover so preview shows formatted GFM tables instead of raw markers
- Preserved raw cell markers in separate state for plugin reinjection (Plan 24-02)
- Augmented LLM system prompt to explicitly instruct cell marker preservation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tableCellMarkers.js utility module** - `858afbfd1` (feat)
2. **Task 2: Wire cell marker pre-processing into ScribePopover and augment system prompt** - `67fa13047` (feat)

## Files Created/Modified
- `src/modules/views/OnlyOffice/Scribe/tableCellMarkers.js` - Utility module: parseCellMarkers, validateCellCount, cellsToMarkdownTable, transformCellMarkersForPreview
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` - Imports transform, adds rawResult/cellWarning state, pre-processes LLM result, sends raw markers to onReplace/onInsert
- `src/modules/views/OnlyOffice/Scribe/scribeAI.js` - Conditional system prompt augmentation when enrichedMd contains [CELL: markers
- `src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx` - Accepts cellWarning prop, displays themed warning banner above preview

## Decisions Made
- Dual storage pattern: rawResult keeps original LLM text with cell markers for reinjection, result.text gets the display-friendly pipe-table version
- Cell count validation uses >= comparison (LLM may duplicate cells but should not drop them)
- Warning banner uses inline styles with theme-aware colors matching existing pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- scribeAI.js verification test could not run standalone due to webpack `@/` alias imports -- verified by code inspection instead. The logic is a simple conditional string append.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- tableCellMarkers.js provides all parsing/validation utilities needed by Plan 24-02 (table reinjection)
- rawResult flows through onReplace/onInsert to the plugin, ready for buildAndInject cell-by-cell reinjection
- System prompt augmentation ensures LLM preserves cell markers for the round-trip

---
*Phase: 24-table-round-trip*
*Completed: 2026-03-22*
