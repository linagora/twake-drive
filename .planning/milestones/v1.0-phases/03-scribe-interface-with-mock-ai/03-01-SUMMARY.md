---
phase: 03-scribe-interface-with-mock-ai
plan: 01
subsystem: ui
tags: [react, cozy-ui, popover, mock-transform, scribe, onlyoffice]

# Dependency graph
requires:
  - phase: 02-contextual-trigger-and-communication-bridge
    plan: 02
    provides: "useCozyBridge hook, ScribeModal component, Replace/Insert/Cancel callbacks in View.jsx"
provides:
  - "SCRIBE_ACTIONS declarative action tree with 4 top-level categories and 11 sub-actions"
  - "mockTransform function producing per-action visibly different text with $ prefix (MOCK-01)"
  - "ScribeResultPanel component with breadcrumb, read-only result text, Replace/Inserer buttons"
  - "ScribePopover container with two-step state machine (menu/result) and MUI Popover positioning"
  - "scribe.styl Scribe-specific styles"
affects: [phase-03-plan-02, phase-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [two-step-popover-state-machine, declarative-action-tree, mock-transform-per-action]

key-files:
  created:
    - src/modules/views/OnlyOffice/Scribe/scribeActions.js
    - src/modules/views/OnlyOffice/Scribe/mockTransform.js
    - src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx
    - src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx
    - src/modules/views/OnlyOffice/Scribe/scribe.styl
  modified: []

key-decisions:
  - "Instant mock transformation (no simulated delay) per research recommendation -- keeps UX snappy"
  - "ScribePopover uses anchorReference=anchorPosition with viewport center -- avoids cross-iframe anchor issues"
  - "Menu step renders placeholder div for Plan 03-02 (interface-first approach)"
  - "Unicode escape sequences for Cyrillic and Vietnamese characters in mockTransform"

patterns-established:
  - "Two-step popover state machine: useState('menu') with ternary rendering menu vs result panel"
  - "Declarative action tree: SCRIBE_ACTIONS array with id/label/icon/children shape"
  - "Mock transform switch pattern: per-actionId transformation with MOCK_PREFIX constant"
  - "ScribePopover prop interface matches ScribeModal (open, selectedText, onReplace, onInsert, onCancel)"

requirements-completed: [UI-01, UI-04, MOCK-01]

# Metrics
duration: ~3min
completed: 2026-03-01
---

# Phase 03 Plan 01: Scribe Core Data and Popover Summary

**Declarative action tree (4 categories, 15 actions), per-action mock transform with $ prefix, ScribeResultPanel with breadcrumb/Replace/Inserer, and ScribePopover two-step state machine container**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-01T09:44:16Z
- **Completed:** 2026-03-01T09:46:54Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments
- Created SCRIBE_ACTIONS declarative action tree covering all 15 action types (4 top-level categories + 11 sub-actions) with cozy-ui icons
- Built mockTransform function handling 14 action IDs plus default fallback, each producing visibly different output with `$ ` line prefix per MOCK-01 spec
- Implemented ScribeResultPanel with breadcrumb header, read-only result text area, and Replace (text variant) / Inserer (primary) action buttons using cozy-ui components
- Created ScribePopover container with two-step state machine (menu/result), MUI Popover with anchorPosition, invisible backdrop, and state reset on open
- Established scribe.styl with result panel layout styles following project Stylus conventions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create action data definitions and mock transform function** - `9dd8d71ae` (feat)
2. **Task 2: Create ScribeResultPanel, ScribePopover, and styles** - `040a6c613` (feat)

## Files Created/Modified
- `src/modules/views/OnlyOffice/Scribe/scribeActions.js` - Declarative action tree with 4 top-level categories (correct grammar, translate, change tone, improve) and 11 sub-actions
- `src/modules/views/OnlyOffice/Scribe/mockTransform.js` - Per-action mock text transformation with $ prefix, covering all action IDs
- `src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx` - Result display component with breadcrumb header, read-only text, Replace/Inserer buttons
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` - Main popover container with two-step state machine, MUI Popover positioning, invisible backdrop
- `src/modules/views/OnlyOffice/Scribe/scribe.styl` - Scribe-specific styles for result panel layout

## Decisions Made
- Used instant mock transformation (no simulated delay) per research recommendation -- loading state deferred to Phase 4 when real AI latency exists
- ScribePopover uses `anchorReference="anchorPosition"` with `{ top: 200, left: window.innerWidth / 2 }` to avoid cross-iframe DOM anchor issues (OO editor is in nested cross-origin iframe)
- Menu step renders a placeholder div with text "Action menu (Plan 03-02)" -- Plan 03-02 will create ScribeActionMenu and wire it into the popover
- Used Unicode escape sequences for Cyrillic (Russian translation marker) and Vietnamese characters in mockTransform for source file portability

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Scribe directory established with 5 files providing the foundation for Plan 03-02
- Plan 03-02 will create ScribeActionMenu.jsx, ScribePromptInput.jsx, and replace the menu placeholder in ScribePopover
- Plan 03-02 will also swap ScribeModal for ScribePopover in View.jsx
- The ScribePopover prop interface matches ScribeModal exactly (open, selectedText, onReplace, onInsert, onCancel) -- drop-in replacement ready
- mockTransform and SCRIBE_ACTIONS are complete and ready for consumption by the action menu

## Self-Check: PASSED

All 5 source files verified present. Both commits (9dd8d71ae, 040a6c613) confirmed in git log. SUMMARY.md created.

---
*Phase: 03-scribe-interface-with-mock-ai*
*Completed: 2026-03-01*
