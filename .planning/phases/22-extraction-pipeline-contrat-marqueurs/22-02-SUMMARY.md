---
phase: 22-extraction-pipeline-contrat-marqueurs
plan: 02
subsystem: plugin
tags: [onlyoffice, callcommand, builder-api, images, tables, markers, es5]

# Dependency graph
requires:
  - phase: 22-extraction-pipeline-contrat-marqueurs
    plan: 01
    provides: "selectionToMarkdown() extraction via callCommand pre-scan"
provides:
  - "Image detection with GetAllDrawingObjects + SetName stable naming"
  - "Block image markers: ![IMG:scribe-img-N](placeholder)"
  - "Inline image markers: {{IMG:scribe-img-N}}"
  - "Table cell extraction with [CELL:r,c]text[/CELL] markers"
  - "Table paragraph deduplication in selection walk"
  - "Performance guard for large selections (>100 paragraphs)"
affects: [23-image-round-trip, 24-table-round-trip]

# Tech tracking
tech-stack:
  added: []
  patterns: ["image marker contract MARK-01 (block vs inline detection)", "table cell marker contract MARK-02 (row,col coordinates)", "Asc.scope counter passing for cross-callCommand state"]

key-files:
  created: []
  modified:
    - plugins/onlyoffice-scribe/scripts/code.js

key-decisions:
  - "callCommand switched to read-write (false) to support SetName on unnamed images; undo point cost accepted (one-time per new image)"
  - "imageCounter passed via Asc.scope for stable naming across selection changes"
  - "Table deduplication via position-based overlap detection (paragraph start within table range)"

patterns-established:
  - "Image marker contract: block = ![IMG:name](placeholder), inline = {{IMG:name}}"
  - "Table marker contract: [CELL:r,c]formatted-text[/CELL] with paragraphToMarkdown for cell content"
  - "Asc.scope counter pattern: pass counter in before callCommand, read back in callback"

requirements-completed: [MARK-01, MARK-02]

# Metrics
duration: 1min
completed: 2026-03-20
---

# Phase 22 Plan 02: Image and Table Marker Contract Summary

**Image detection via GetAllDrawingObjects with SetName stable IDs producing ![IMG:id]/{{IMG:id}} markers, plus table cell extraction with [CELL:r,c]text[/CELL] markers and paragraph deduplication**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-20T13:44:05Z
- **Completed:** 2026-03-20T13:45:32Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added getDrawingMarker() helper: detects images via GetAllDrawingObjects, assigns stable names via SetName, determines block vs inline based on paragraph text content
- Added extractTableCells() helper: enumerates rows/cells via GetRowsCount/GetCellsCount/GetCell, extracts formatted text via paragraphToMarkdown per cell
- Table paragraph deduplication: paragraphs inside table ranges are skipped in main loop, table emitted once as cell markers
- Performance guard: selections >100 paragraphs fall back to plain text extraction
- Switched callCommand to read-write for SetName support with imageCounter via Asc.scope

## Task Commits

Each task was committed atomically:

1. **Task 1: Add image detection with markers and table cell extraction to selectionToMarkdown** - `2c89086a6` (feat)

## Files Created/Modified
- `plugins/onlyoffice-scribe/scripts/code.js` - Added imageCounter state var, getDrawingMarker/extractTableCells helpers inside callCommand, table range detection, restructured paragraph loop with dedup, performance guard, read-write callCommand with Asc.scope counter

## Decisions Made
- Switched callCommand from read-only to read-write to support SetName on unnamed images; the undo point cost is acceptable since it only happens once per new image
- Used Asc.scope.imgCounter pattern to persist counter across callCommand boundary
- Table deduplication uses position-based overlap (paragraph start position within table range boundaries)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MARK-01 and MARK-02 marker contracts are fully implemented in the extraction pipeline
- Phase 23 (image round-trip) can parse ![IMG:id] and {{IMG:id}} markers from LLM responses
- Phase 24 (table round-trip) can parse [CELL:r,c]text[/CELL] markers from LLM responses
- enrichedMd pipeline (from plan 22-01) carries these markers end-to-end through the React stack

---
*Phase: 22-extraction-pipeline-contrat-marqueurs*
*Completed: 2026-03-20*

## Self-Check: PASSED
