---
phase: 05-bouton-scribe-flottant-ancr-la-s-lection
plan: 02
subsystem: ui
tags: [floating-button, view-integration, popover-anchoring, trigger-intent, side-panel-removal]

# Dependency graph
requires:
  - phase: 05-bouton-scribe-flottant-ancr-la-s-lection
    plan: 01
    provides: "ScribeFloatingButton component, useCozyBridge selectionState, selection-state protocol"
provides:
  - "Floating button wired into View.jsx render tree with iframe-to-host coordinate conversion"
  - "ScribePopover anchors to floating button DOM element via anchorEl prop"
  - "trigger-intent postMessage protocol: host tells plugin to cast AI_TEXT_EDIT"
  - "Plugin listens for cozy-bridge:trigger-intent messages"
  - "Side panel HTML stripped to minimal shell (no visible UI)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [trigger-intent message for host-initiated plugin actions, anchorEl popover anchoring]

key-files:
  created: []
  modified:
    - src/modules/views/OnlyOffice/View.jsx
    - src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx
    - plugins/onlyoffice-scribe/scripts/code.js
    - plugins/onlyoffice-scribe/index.html

key-decisions:
  - "Floating button click sends trigger-intent to plugin rather than creating synthetic intent -- keeps all intents originating from plugin"
  - "Iframe-relative coordinates converted to host-page coordinates via iframe.getBoundingClientRect()"
  - "ScribePopover accepts anchorEl for element anchoring, falls back to anchorPosition"
  - "Plugin side panel kept as minimal shell (plugin type panel requires index.html) but no visible UI"

patterns-established:
  - "trigger-intent postMessage: cozy-bridge:trigger-intent type for host-to-plugin action triggering"
  - "Coordinate space conversion: iframe viewport coords + iframe.getBoundingClientRect() = host-page coords"

requirements-completed: [UI-FLOAT-02]

# Metrics
duration: ~15min (across 2 commits)
completed: 2026-03-03
verified: 2026-03-03 (human verification approved)
---

# Phase 5 Plan 02: Wire Floating Button into View.jsx and Popover Anchoring Summary

**Floating button integrated into View.jsx, ScribePopover anchored to button element, trigger-intent protocol, side panel minimized**

## Performance

- **Completed:** 2026-03-01 (code), 2026-03-03 (verified)
- **Tasks:** 2 (1 auto + 1 human verification)
- **Files modified:** 4

## Accomplishments
- View.jsx renders ScribeFloatingButton with visibility based on selectionState and pendingIntent
- Iframe-relative selection coordinates converted to host-page coordinates via getBoundingClientRect()
- triggerScribe callback sends cozy-bridge:trigger-intent to plugin iframe on button click
- ScribePopover accepts anchorEl prop and anchors to floating button DOM element
- Plugin code.js listens for trigger-intent messages and casts AI_TEXT_EDIT in response
- Plugin index.html stripped of visible UI (no button, no hint text)
- Full flow verified: select text -> button appears -> click -> popover -> Replace/Insert/Cancel

## Task Commits

1. **Task 1: Wire floating button and update popover anchoring** - `90f79f694` + `c7afdb7b1` (feat)
2. **Task 2: Human verification** - Approved 2026-03-03

## Files Modified
- `src/modules/views/OnlyOffice/View.jsx` - Added ScribeFloatingButton import/render, selectionState destructuring, hostPosition coordinate conversion, triggerScribe callback, anchorEl prop to ScribePopover
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` - Added anchorEl prop with element-based anchoring, fallback to anchorPosition
- `plugins/onlyoffice-scribe/scripts/code.js` - Added cozy-bridge:trigger-intent message listener that triggers castIntent
- `plugins/onlyoffice-scribe/index.html` - Stripped to minimal shell (script tags only, no visible UI)

## Verification Results

All flows verified manually:
- Floating button appears near selection, disappears on deselect
- Button click opens ScribePopover anchored to button position
- Button disappears when popover opens
- Ctrl+K shortcut opens popover
- Context menu "Scribe" entry works
- Replace action replaces document text
- Insert action adds text after original
- Side panel shows no visible trigger

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

None

## Phase 5 Complete

Both plans (05-01 and 05-02) are complete. Phase 5 delivered:
- Floating Scribe button positioned near text selection (primary trigger)
- Ctrl+K keyboard shortcut (power-user trigger)
- Context menu entry (alternative trigger)
- Intent-based protocol (trigger-intent for host-to-plugin communication)
- Side panel minimized (no longer a visible trigger)

---
*Phase: 05-bouton-scribe-flottant-ancr-la-s-lection*
*Completed: 2026-03-03*
