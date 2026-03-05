---
phase: 08-error-handling
plan: 01
subsystem: ui
tags: [error-handling, retry, scribe, react, cozy-ui]

# Dependency graph
requires:
  - phase: 07-scribe-ai-integration
    provides: callScribeAI, ScribePopover, ScribeResultPanel
provides:
  - classifyScribeError pure function for error classification
  - Error-specific user messages with retry/non-retry distinction
  - Retry mechanism via lastAction state + handleRetry callback
  - Error UI with conditional Retry button and hidden Insert/Replace
affects: [08-error-handling, 09-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [error-classification-function, retry-via-stored-action]

key-files:
  created: []
  modified:
    - src/modules/views/OnlyOffice/Scribe/scribeAI.js
    - src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx
    - src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx

key-decisions:
  - "Check err.name === 'FetchError' (duck typing) instead of instanceof for cross-module error detection"
  - "Use Sync icon from cozy-ui for Retry button (Renew not available)"

patterns-established:
  - "Error classification: pure function mapping error types to {message, canRetry} objects"
  - "Retry pattern: store lastAction state, re-invoke handleActionSelect with stored params"

requirements-completed: [ERR-01, ERR-02, ERR-03]

# Metrics
duration: 2min
completed: 2026-03-06
---

# Phase 8 Plan 1: Error Handling Summary

**Error classification with FetchError/network/empty detection, retry for transient failures, and error-specific UI with hidden Insert/Replace buttons**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-05T23:20:04Z
- **Completed:** 2026-03-05T23:22:08Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- classifyScribeError function classifies errors by type: auth (401/403 permanent), rate-limit (429 retryable), server (5xx retryable), network (retryable), empty response (retryable)
- ScribePopover stores lastAction for retry, uses classifyScribeError in catch, passes error/canRetry/onRetry to result panel
- ScribeResultPanel shows error messages in theme error color, hides Insert/Replace on error, shows Retry button only for retryable errors with proper focus management

## Task Commits

Each task was committed atomically:

1. **Task 1: Add classifyScribeError and wire error classification in ScribePopover** - `aa5781a64` (feat)
2. **Task 2: Update ScribeResultPanel for error and retry UI** - `1a3ef227b` (feat)

## Files Created/Modified
- `src/modules/views/OnlyOffice/Scribe/scribeAI.js` - Added classifyScribeError pure function with all error categories
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` - Wired classifyScribeError, added lastAction/handleRetry, pass error props to result panel
- `src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx` - Error UI with conditional Retry button, error color styling, updated focus management

## Decisions Made
- Used duck typing (err.name === 'FetchError') instead of instanceof for FetchError detection since it comes from a different module
- Used Sync icon from cozy-ui for Retry button since Renew icon is not available

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Error classification and retry in place
- Ready for additional error handling tasks (loading timeouts, etc.)
- All must_haves from plan satisfied

---
*Phase: 08-error-handling*
*Completed: 2026-03-06*
