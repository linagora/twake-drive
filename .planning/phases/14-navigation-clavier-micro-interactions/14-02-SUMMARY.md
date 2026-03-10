---
phase: 14-navigation-clavier-micro-interactions
plan: 02
subsystem: ui
tags: [react, hover, tooltip, ux, micro-interactions]

requires:
  - phase: 14-navigation-clavier-micro-interactions
    provides: keyboard shortcuts and button order (plan 01)
provides:
  - mouse-move gated menu highlighting (no false highlights on open)
  - 1-second delayed tooltip on floating button
affects: []

tech-stack:
  added: []
  patterns: [mousemove-gated hover suppression, delayed tooltip with timer cleanup]

key-files:
  created: []
  modified:
    - src/modules/views/OnlyOffice/Scribe/ScribeActionMenu.jsx
    - src/modules/views/OnlyOffice/Scribe/ScribeFloatingButton.jsx

key-decisions:
  - "Used one-time mousemove listener on Paper element to detect real mouse movement vs menu opening under cursor"
  - "Separated showTooltip state from hovered (opacity) state for independent control"

patterns-established:
  - "mouseMoveEnabled ref pattern: gate onMouseEnter handlers behind physical mouse movement detection"
  - "Timer-based tooltip delay: useRef for setTimeout ID with cleanup on leave/unmount/visibility"

requirements-completed: [MOUSE-01, MICRO-01]

duration: 2min
completed: 2026-03-10
---

# Phase 14 Plan 02: Mouse Hover and Tooltip Micro-interactions Summary

**Mouse-move gated menu highlighting suppression + 1-second delayed tooltip on floating button**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T21:53:51Z
- **Completed:** 2026-03-10T21:55:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Menu items no longer highlight when menu opens under a stationary cursor
- Floating button tooltip appears only after 1 second of continuous hover
- Timer properly cleaned up on mouse leave, visibility change, and unmount

## Task Commits

Each task was committed atomically:

1. **Task 1: Suppress menu item highlight until mouse physically moves** - `a5b187e3e` (feat)
2. **Task 2: Add 1-second tooltip delay to floating button** - `ae054e808` (feat)

## Files Created/Modified
- `src/modules/views/OnlyOffice/Scribe/ScribeActionMenu.jsx` - Added mouseMoveEnabledRef gating all onMouseEnter/onMouseLeave handlers
- `src/modules/views/OnlyOffice/Scribe/ScribeFloatingButton.jsx` - Added showTooltip state with 1000ms timer delay

## Decisions Made
- Used one-time mousemove listener on Paper element rather than a timeout-based approach, because mousemove only fires on actual physical movement
- Separated showTooltip from hovered state so button opacity changes instantly while tooltip is delayed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 14 complete (both plans done)
- Ready for Phase 15 (next phase in milestone v2.2)

---
*Phase: 14-navigation-clavier-micro-interactions*
*Completed: 2026-03-10*
