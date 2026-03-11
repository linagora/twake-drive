---
phase: 14-navigation-clavier-micro-interactions
plan: 01
subsystem: ui
tags: [keyboard-shortcut, focus-management, onlyoffice-plugin, accessibility]

requires:
  - phase: 05-floating-button-ui-polish
    provides: floating button with Ctrl+I shortcut and result panel with focus trap
provides:
  - "Ctrl+Shift+I shortcut for Scribe (no conflict with OO italic)"
  - "Correct result panel button order: Insert left, Replace right"
  - "Natural Tab order matching visual order in result panel"
affects: []

tech-stack:
  added: []
  patterns:
    - "Shift modifier for custom shortcuts to avoid native OO conflicts"

key-files:
  created: []
  modified:
    - plugins/onlyoffice-scribe/scripts/code.js
    - src/modules/views/OnlyOffice/Scribe/ScribeFloatingButton.jsx
    - src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx

key-decisions:
  - "Ctrl+Shift+I chosen over other combos to avoid all OO native shortcut conflicts"

patterns-established:
  - "Custom keyboard shortcuts use Shift modifier to avoid OO native shortcut conflicts"

requirements-completed: [NAV-01, NAV-02]

duration: 1min
completed: 2026-03-10
---

# Phase 14 Plan 01: Keyboard Shortcut Fix + Button Order Summary

**Ctrl+Shift+I replaces Ctrl+I to avoid OO italic conflict; result panel buttons reordered Insert-left Replace-right for natural Tab flow**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-10T21:51:10Z
- **Completed:** 2026-03-10T21:52:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Changed Scribe shortcut from Ctrl+I to Ctrl+Shift+I in both primary and fallback keydown handlers
- Updated floating button tooltip to display Ctrl+Shift+I
- Swapped result panel button render order so Insert is left and Replace is right, matching the existing focus order array

## Task Commits

Each task was committed atomically:

1. **Task 1: Change shortcut to Ctrl+Shift+I and update tooltip** - `97e85d0c5` (feat)
2. **Task 2: Fix result panel button visual order** - `e2a240000` (fix)

## Files Created/Modified
- `plugins/onlyoffice-scribe/scripts/code.js` - Shortcut condition updated to require shiftKey + uppercase "I"
- `src/modules/views/OnlyOffice/Scribe/ScribeFloatingButton.jsx` - Tooltip text updated to Ctrl+Shift+I
- `src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx` - Insert and Replace buttons swapped in render order

## Decisions Made
- Used uppercase "I" in key check since Shift held produces uppercase key value

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Shortcut conflict resolved, ready for further keyboard navigation work in 14-02
- Result panel focus order now matches visual order

---
*Phase: 14-navigation-clavier-micro-interactions*
*Completed: 2026-03-10*
