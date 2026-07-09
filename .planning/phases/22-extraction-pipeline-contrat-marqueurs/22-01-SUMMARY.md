---
phase: 22-extraction-pipeline-contrat-marqueurs
plan: 01
subsystem: plugin
tags: [onlyoffice, callcommand, builder-api, markdown, extraction, es5]

# Dependency graph
requires:
  - phase: 21-code-blocks-tables
    provides: "Builder API injection pipeline (callCommand + flattenTokens)"
provides:
  - "selectionToMarkdown() extraction via callCommand pre-scan"
  - "enrichedMd field in intent data pipeline (plugin -> View -> ScribePopover -> scribeAI)"
  - "Direct document model extraction replacing HTML-based extraction"
affects: [22-02, scribeAI, ScribePopover]

# Tech tracking
tech-stack:
  added: []
  patterns: ["callCommand read-only pre-scan for selection analysis", "enrichedMd priority chain: enrichedMd > htmlToMarkdown > plainText"]

key-files:
  created: []
  modified:
    - plugins/onlyoffice-scribe/scripts/code.js
    - src/modules/views/OnlyOffice/View.jsx
    - src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx
    - src/modules/views/OnlyOffice/Scribe/scribeAI.js

key-decisions:
  - "Plugin-side extraction via callCommand replaces HTML-based extraction (initDataType:'html' kept as trigger only)"
  - "enrichedMd priority chain: enrichedMd > htmlToMarkdown(html) > selectedText preserves backward compat"
  - "escapeMarkdown + paragraphToMarkdown defined inside callCommand body (ES5 sandbox isolation)"

patterns-established:
  - "callCommand read-only pre-scan: run extraction on every selection change, store result in state var"
  - "enrichedMd data flow: plugin builds markdown -> intent data -> React props -> buildMessages extra"

requirements-completed: [EXTR-01, EXTR-04]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 22 Plan 01: Extraction Pipeline Summary

**selectionToMarkdown() pre-scan via Builder API inside callCommand, replacing HTML extraction with direct document model walk; enrichedMd wired through full intent->React pipeline**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T13:37:49Z
- **Completed:** 2026-03-20T13:40:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Built selectionToMarkdown() with escapeMarkdown/paragraphToMarkdown helpers inside callCommand (ES5-compliant, sandbox-isolated)
- Replaced HTML-based extraction (stripOoClasses + GetSelectedText) with Builder API paragraph walking (GetRangeBySelect -> GetAllParagraphs -> element enumeration)
- Wired enrichedMd through the full pipeline: plugin intent data -> View.jsx prop -> ScribePopover extra -> scribeAI.buildMessages textForPrompt

## Task Commits

Each task was committed atomically:

1. **Task 1: Build selectionToMarkdown in callCommand + update init() flow** - `6cdeea846` (feat)
2. **Task 2: Wire enrichedMd through React pipeline** - `1cd0a7c49` (feat)

## Files Created/Modified
- `plugins/onlyoffice-scribe/scripts/code.js` - Added selectionToMarkdown pre-scan in callCommand, updated init() and buildEditIntentData()
- `src/modules/views/OnlyOffice/View.jsx` - Pass enrichedMd from pendingIntent data to ScribePopover
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` - Destructure enrichedMd, pass to buildMessages, update inputMd for dev panels
- `src/modules/views/OnlyOffice/Scribe/scribeAI.js` - buildMessages prefers enrichedMd over htmlToMarkdown(html)

## Decisions Made
- Kept `initDataType: "html"` in config.json as trigger mechanism; init(data) parameter is now ignored
- enrichedMd has priority over htmlToMarkdown(html) which is preserved as fallback for backward compatibility
- All extraction helpers (escapeMarkdown, paragraphToMarkdown) defined inside callCommand body per ES5 sandbox isolation requirement

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Extraction pipeline foundation complete; Plan 22-02 can add image markers (IMG:id) and table cell markers (CELL:r,c) to the selectionToMarkdown function
- enrichedMd data flow is established end-to-end; future phases only need to enrich the callCommand extraction logic

---
*Phase: 22-extraction-pipeline-contrat-marqueurs*
*Completed: 2026-03-20*
