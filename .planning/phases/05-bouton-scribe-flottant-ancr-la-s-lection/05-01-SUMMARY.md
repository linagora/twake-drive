---
phase: 05-bouton-scribe-flottant-ancr-la-s-lection
plan: 01
subsystem: ui
tags: [postmessage, react, portal, selection, floating-button, cozy-bridge]

# Dependency graph
requires:
  - phase: 02-cozy-bridge-intent-protocol
    provides: "CozyBridge class, intent protocol, useCozyBridge hook"
provides:
  - "MSG_TYPE_SELECTION_STATE constant and validateSelectionState validator"
  - "CozyBridge.onSelectionState() handler for selection-state messages"
  - "useCozyBridge selectionState (hasSelection, text, top, left)"
  - "notifySelectionState() in plugin with mouseup coordinate capture"
  - "Ctrl+K / Cmd+K shortcut for Scribe in OO editor"
  - "ScribeFloatingButton component with portal rendering and position prop"
affects: [05-02-wiring-view-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [fire-and-forget postMessage for state notifications, React portal for overlay positioning]

key-files:
  created:
    - src/modules/views/OnlyOffice/Scribe/ScribeFloatingButton.jsx
  modified:
    - src/lib/cozy-bridge/protocol.js
    - src/lib/cozy-bridge/index.js
    - src/modules/views/OnlyOffice/useCozyBridge.js
    - plugins/onlyoffice-scribe/scripts/code.js
    - src/modules/views/OnlyOffice/Scribe/scribe.styl

key-decisions:
  - "Selection-state messages are fire-and-forget (no intentId, no response) -- separate from intent protocol"
  - "Mouse coordinates captured via mouseup on parent document (same-origin OO editor frame)"
  - "300ms debounce on selection, instant deselection notification"
  - "ScribeFloatingButton uses React portal to document.body with position:fixed"

patterns-established:
  - "Fire-and-forget postMessage: cozy-bridge:selection-state type for one-way state notifications"
  - "Coordinate capture via mouseup on parent document with try/catch for cross-origin safety"

requirements-completed: [UI-FLOAT-01, COMM-04]

# Metrics
duration: 6min
completed: 2026-03-01
---

# Phase 5 Plan 01: Selection State Protocol and Floating Button Component Summary

**Selection-state postMessage protocol with mouseup coordinate capture, Ctrl+K shortcut, and ScribeFloatingButton portal component**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-01T14:34:45Z
- **Completed:** 2026-03-01T14:41:18Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Extended cozy-bridge protocol with MSG_TYPE_SELECTION_STATE and full validator
- Plugin captures mouseup coordinates on parent document and sends debounced selection-state notifications
- Ctrl+K / Cmd+K shortcut registered on parent document triggers AI_TEXT_EDIT intent
- InputHelper POC code fully removed (replaced by floating button approach)
- CozyBridge routes selection-state messages to registered handler
- useCozyBridge hook exposes selectionState with coordinates alongside pendingIntent
- ScribeFloatingButton component renders a pill button via React portal, positioned near selection

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend protocol and CozyBridge for selection-state messages** - `c1da8060b` (feat)
2. **Task 2: Plugin selection-state notification and Ctrl+K shortcut** - `37b0ac823` (feat)
3. **Task 3: Create ScribeFloatingButton component** - `85bb90997` (feat)

## Files Created/Modified
- `src/lib/cozy-bridge/protocol.js` - Added MSG_TYPE_SELECTION_STATE constant and validateSelectionState function
- `src/lib/cozy-bridge/index.js` - Added onSelectionState() method, selection-state routing in _onMessage, cleanup in destroy()
- `src/modules/views/OnlyOffice/useCozyBridge.js` - Added selectionState state, onSelectionState handler, clear on respond()
- `plugins/onlyoffice-scribe/scripts/code.js` - Removed InputHelper POC, added mouseup tracking, notifySelectionState, Ctrl+K handler
- `src/modules/views/OnlyOffice/Scribe/ScribeFloatingButton.jsx` - New floating button component with portal, fade-in, position prop
- `src/modules/views/OnlyOffice/Scribe/scribe.styl` - Added floating button styles (pill shape, shadow, hover effects)

## Decisions Made
- Selection-state messages are fire-and-forget (no intentId, no response) -- kept separate from the intent protocol to avoid unnecessary complexity
- Mouse coordinates captured via mouseup on parent document (same-origin OO editor frame) -- provides accurate viewport positioning for the floating button
- 300ms debounce on selection notification, instant deselection -- prevents flicker during drag-selection while giving immediate feedback on deselection
- ScribeFloatingButton uses React portal to document.body with position:fixed and z-index 99999 -- ensures button renders above all iframe layers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All pieces ready for Plan 05-02 (wiring and View.jsx integration)
- ScribeFloatingButton accepts position prop and buttonRef for popover anchoring
- useCozyBridge returns selectionState with coordinates for button positioning
- Plugin sends selection-state messages that flow through the entire data path

## Self-Check: PASSED

All 6 files verified present. All 3 task commits verified in git log.

---
*Phase: 05-bouton-scribe-flottant-ancr-la-s-lection*
*Completed: 2026-03-01*
