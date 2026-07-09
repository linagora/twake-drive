---
phase: 18-token-pipeline-minimal-builder-injection
plan: 01
subsystem: ui
tags: [marked, tokenizer, markdown, onlyoffice-plugin, document-builder]

# Dependency graph
requires:
  - phase: 13-rich-text-reinjection
    provides: PasteHtml pipeline and markdown conversion in View.jsx
provides:
  - marked.umd.js vendored in plugin iframe
  - flattenTokens() function converting marked lexer output to flat paragraph+runs
  - md field in View.jsx response payload for raw markdown transport
affects: [18-02-builder-interpreter]

# Tech tracking
tech-stack:
  added: [marked (UMD bundle in plugin)]
  patterns: [parse-outside-build-inside token pipeline]

key-files:
  created:
    - plugins/onlyoffice-scribe/vendor/marked.umd.js
  modified:
    - plugins/onlyoffice-scribe/index.html
    - plugins/onlyoffice-scribe/scripts/code.js
    - src/modules/views/OnlyOffice/View.jsx

key-decisions:
  - "Vendored marked UMD (42KB) rather than CDN for offline reliability"
  - "flattenTokens uses ES5 syntax consistent with rest of code.js"
  - "md field set to raw text param (which is markdown from AI) -- no separate conversion"

patterns-established:
  - "Token pipeline: marked.lexer() -> flattenTokens() -> flat paragraph+runs array"
  - "Dual payload: View.jsx sends both html (PasteHtml fallback) and md (Builder API path)"

requirements-completed: [PARSE-01, PARSE-02, PARSE-03]

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 18 Plan 01: Token Pipeline + Marked Bundle Summary

**marked UMD vendored in plugin iframe with flattenTokens() converting lexer output to flat paragraph+runs, plus md field in View.jsx response payload**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T07:04:24Z
- **Completed:** 2026-03-16T07:07:41Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Vendored marked.umd.js (42KB) in plugin iframe with correct script load order
- Implemented flattenTokens() that recursively flattens marked's nested token tree into flat paragraph+runs format with bold/italic flags
- Added md field to both handleReplace and handleInsert in View.jsx, preserving html field for PasteHtml fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Bundle marked UMD + add script tag + implement flattenTokens** - `45ea0f9ae` (feat)
2. **Task 2: Add md field to View.jsx response payload** - `42f33f6ed` (feat)

## Files Created/Modified
- `plugins/onlyoffice-scribe/vendor/marked.umd.js` - Vendored marked library for plugin iframe tokenization
- `plugins/onlyoffice-scribe/index.html` - Added script tag for marked.umd.js before code.js
- `plugins/onlyoffice-scribe/scripts/code.js` - Added flattenTokens() function inside IIFE
- `src/modules/views/OnlyOffice/View.jsx` - Added md: text field to response payload in both handlers

## Decisions Made
- Vendored marked UMD (42KB) rather than CDN for offline reliability and version control
- flattenTokens uses ES5 syntax consistent with rest of code.js (var, no arrow functions)
- md field set to raw text param which is markdown from AI -- no separate conversion needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- flattenTokens() is ready for Plan 02 to consume in the Builder API interpreter
- md field flows through the response pipeline; Plan 02 can detect md field presence and branch to Builder API path
- PasteHtml fallback path is fully preserved for graceful degradation

---
*Phase: 18-token-pipeline-minimal-builder-injection*
*Completed: 2026-03-16*
