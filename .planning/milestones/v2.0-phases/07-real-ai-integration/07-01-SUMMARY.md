---
phase: 07-real-ai-integration
plan: 01
subsystem: ai
tags: [llm, openai-format, fetchJSON, abort-controller, prompt-engineering, cozy-stack]

# Dependency graph
requires:
  - phase: 05-floating-button
    provides: ScribePopover with action selection and result panel
provides:
  - scribeAI module with callScribeAI, buildMessages, deriveLoadingMessage, SYSTEM_PROMPT
  - Prompt construction for all action types (grammar, tone, translate, free-prompt)
  - AbortController-compatible API call wrapper
affects: [07-02-wiring, 08-error-handling]

# Tech tracking
tech-stack:
  added: []
  patterns: [fetchJSON-direct-call-for-signal-support, prompt-template-interpolation, gerund-loading-messages]

key-files:
  created:
    - src/modules/views/OnlyOffice/Scribe/scribeAI.js
  modified: []

key-decisions:
  - "Use fetchJSON directly instead of chatCompletion() to support AbortController signal for request cancellation"
  - "Defensive response extraction: check response.content || response.choices[0].message.content"
  - "Switch-map approach for loading messages: known labels map to natural gerund forms, fallback to label+ellipsis"

patterns-established:
  - "fetchJSON direct call: client.stackClient.fetchJSON('POST', '/ai/v1/chat/completions', body, { signal }) for AbortController support"
  - "Prompt template interpolation: replace {selectedText} and {language} placeholders from scribeActions.js prompt fields"
  - "findActionConfig: shared lookup pattern across mockTransform.js and scribeAI.js (searches SCRIBE_ACTIONS, children, dynamic translate children)"

requirements-completed: [API-02, API-03]

# Metrics
duration: 1min
completed: 2026-03-03
---

# Phase 7 Plan 1: scribeAI Module Summary

**LLM API call wrapper with prompt builder for all Scribe actions, using fetchJSON directly for AbortController cancellation support**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-03T23:08:59Z
- **Completed:** 2026-03-03T23:10:18Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created scribeAI.js module with 4 exports: callScribeAI, buildMessages, deriveLoadingMessage, SYSTEM_PROMPT
- Prompt construction handles all action types: direct actions (grammar), children (tone-professional), dynamic translate children (translate-en), translate-custom with user-typed language, and free-prompt with guardrail template
- API call uses fetchJSON directly (not chatCompletion) to preserve AbortController signal for request cancellation
- Loading messages derive naturally from action labels using gerund forms

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scribeAI.js module** - `80d2ce7d4` (feat)

## Files Created/Modified
- `src/modules/views/OnlyOffice/Scribe/scribeAI.js` - LLM API call wrapper, prompt builder, system prompt, loading message derivation

## Decisions Made
- **fetchJSON over chatCompletion:** Research confirmed chatCompletion() merges options into request body instead of fetch options, preventing AbortController signal passthrough. Using fetchJSON directly is a one-liner that replicates chatCompletion internally while supporting cancellation (LOAD-02 requirement).
- **Defensive response extraction:** Copied double-check pattern from AIAssistantPanel (response.content || response.choices[0].message.content) for robustness against response format variations.
- **Loading message approach:** Used a lookup map of known labels to gerund forms rather than a programmatic gerund converter. Simpler, more predictable, and covers all current action labels. Fallback to label+ellipsis for unknown actions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- scribeAI.js module ready for Plan 07-02 to wire into ScribePopover
- callScribeAI accepts a CozyClient instance (from useClient hook) and messages array
- buildMessages produces the correct message format for all action types
- deriveLoadingMessage provides action-specific loading text for the loading state

## Self-Check: PASSED

- FOUND: src/modules/views/OnlyOffice/Scribe/scribeAI.js
- FOUND: .planning/phases/07-real-ai-integration/07-01-SUMMARY.md
- FOUND: commit 80d2ce7d4

---
*Phase: 07-real-ai-integration*
*Completed: 2026-03-03*
