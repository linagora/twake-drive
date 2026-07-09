---
phase: 20-injection-polish
plan: 01
subsystem: editor-injection
tags: [onlyoffice, builder-api, smart-spacing, callcommand, es5]

# Dependency graph
requires:
  - phase: 19-extended-markdown
    provides: "Builder API injection with full inline/block element support"
provides:
  - "Smart spacing at injection boundaries for replace mode (space runs before/after)"
  - "Paragraph separator for insert mode via Builder API"
  - "Trailing space consumption in insert mode"
affects: [20-02-post-injection-selection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adjacent character detection via doc.GetRange before/after selection"
    - "Space text runs (Api.CreateRun + AddText) for boundary spacing in Builder API path"
    - "Leading paragraph separator for insert mode content separation"

key-files:
  created: []
  modified:
    - plugins/onlyoffice-scribe/scripts/code.js

key-decisions:
  - "Space runs via Builder API instead of HTML entities -- consistent with Builder injection path"
  - "Insert mode uses leading paragraph separator + trailing space consumption for clean separation"
  - "Undo restores content but not selection state -- OO API limitation, deferred"

patterns-established:
  - "Spacing detection: read 5 chars before/after selection via doc.GetRange, test with WS regex"
  - "Space injection: prepend/append space runs to content array boundaries"

requirements-completed: [INJ-03]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 20 Plan 01: Smart Spacing Summary

**Adjacent character detection and space text runs in Builder API injection for correct word boundaries in replace and insert modes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T17:45:00Z
- **Completed:** 2026-03-19T17:53:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Smart spacing for replace mode: space runs added before/after injected content when adjacent non-whitespace detected
- Insert mode refined: leading paragraph separator and trailing space consumption for clean content separation
- Edge cases handled: no spurious spaces at document start/end boundaries
- Pattern mirrors proven pasteHtml spacing approach but uses Builder API text runs

## Task Commits

Each task was committed atomically:

1. **Task 1: Add spacing detection and space runs to buildAndInject** - `6d52e6874` + `4583b93bd` (feat)
2. **Task 2: Verify smart spacing in OO editor** - checkpoint, approved by user

## Files Created/Modified
- `plugins/onlyoffice-scribe/scripts/code.js` - Added adjacent char detection (WS regex, doc.GetRange), space run injection at content boundaries, paragraph separator for insert mode

## Decisions Made
- Space runs via Builder API (Api.CreateRun + AddText(" ")) instead of HTML entities -- stays consistent with the Builder injection path rather than mixing approaches
- Insert mode uses leading paragraph separator plus trailing space consumption for clean separation between existing and injected content
- Undo restores content but not selection state -- confirmed as OO API limitation, deferred (not a regression)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Insert mode refinement across two commits**
- **Found during:** Task 1
- **Issue:** Initial implementation needed refinement for insert mode -- trailing space consumption and paragraph separator interaction required adjustment
- **Fix:** Second commit (4583b93bd) refined insert mode with proper leading paragraph separator and trailing space consumption
- **Files modified:** plugins/onlyoffice-scribe/scripts/code.js
- **Verification:** Manual testing in OO editor confirmed correct behavior
- **Committed in:** 4583b93bd

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Minor iteration on insert mode implementation. No scope creep.

## Issues Encountered
- Undo restores injected content but not the selection state around it -- this is an OO API limitation where InsertContent does not preserve cursor context on undo. Deferred as cosmetic.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Smart spacing complete for both replace and insert modes
- Ready for Phase 20 Plan 02: post-injection selection via sentinel markers
- The spacing runs are compatible with future selection tracking (they are standard Builder API elements)

---
*Phase: 20-injection-polish*
*Completed: 2026-03-19*
