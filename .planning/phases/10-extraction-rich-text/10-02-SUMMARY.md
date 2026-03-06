---
phase: 10-extraction-rich-text
plan: 02
subsystem: ui
tags: [onlyoffice, postmessage, html-extraction, scribe-plugin]

requires:
  - phase: 10-extraction-rich-text/01
    provides: HTML extraction via initDataType:html, lastSelectedHtml state, stripOoClasses
provides:
  - buildEditIntentData() helper in code.js with html/format fields
  - selectedHtml prop on ScribePopover via View.jsx
  - Full postMessage pipeline from OO plugin to React for HTML content
affects: [11-markdown-conversion, scribe-popover]

tech-stack:
  added: []
  patterns: [intent-data-builder-pattern, optional-html-field-backward-compat]

key-files:
  created: []
  modified:
    - plugins/onlyoffice-scribe/scripts/code.js
    - src/modules/views/OnlyOffice/View.jsx

key-decisions:
  - "Reuse stored lastSelectedHtml from init() for context menu (no re-fetch needed since selection unchanged)"
  - "Temporary console.log for HTML verification added in View.jsx (to remove in Phase 11)"

patterns-established:
  - "buildEditIntentData() centralizes intent data construction with optional fields"

requirements-completed: [EXTR-02]

duration: 2min
completed: 2026-03-06
---

# Phase 10 Plan 02: Intent Protocol HTML Extension Summary

**buildEditIntentData() helper adds html/format fields to all 4 AI_TEXT_EDIT triggers with backward-compatible omission when no HTML available**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T19:50:17Z
- **Completed:** 2026-03-06T19:52:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added buildEditIntentData() helper centralizing intent data with optional html/format fields
- Updated all 4 AI_TEXT_EDIT trigger points (floating button, context menu, Ctrl+I, toolbar)
- Passed selectedHtml prop through View.jsx to ScribePopover for Phase 11 consumption
- Added console.log verification for HTML data arrival in React

## Task Commits

Each task was committed atomically:

1. **Task 1: Add html/format fields to all AI_TEXT_EDIT intent triggers** - `3e9f4efd8` (feat)
2. **Task 2: Pass html data through to ScribePopover in View.jsx** - `982cf1376` (feat)

## Files Created/Modified
- `plugins/onlyoffice-scribe/scripts/code.js` - buildEditIntentData() helper, updated all 4 trigger points
- `src/modules/views/OnlyOffice/View.jsx` - selectedHtml prop, HTML verification console.log

## Decisions Made
- Reuse stored lastSelectedHtml from init() for context menu trigger (selection unchanged between menu open and click)
- Added temporary console.log in View.jsx useEffect for development verification (to be removed in Phase 11)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- HTML content flows end-to-end from OO plugin through postMessage to React ScribePopover
- Phase 11 (Markdown conversion) can consume selectedHtml prop directly
- Backward compatible: intents without HTML still work (text-only fallback)

---
*Phase: 10-extraction-rich-text*
*Completed: 2026-03-06*
