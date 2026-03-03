---
phase: 06-affinement-ui-ux
plan: 02
subsystem: ui
tags: [scribe, ai-prompts, config-driven, mock-transform, declarative]

# Dependency graph
requires:
  - phase: 05-bouton-scribe-flottant-ancr-la-s-lection
    provides: "Scribe action menu, mockTransform, ScribePopover flow"
provides:
  - "SCRIBE_ACTIONS with prompt templates and mockResult per action"
  - "Config-driven mockTransform via findActionConfig + applyMockResult"
  - "FREE_PROMPT_CONFIG for free-prompt action"
  - "translate-custom {language} placeholder support"
affects: [api-integration, real-ai-backend]

# Tech tracking
tech-stack:
  added: []
  patterns: [config-driven-transform, declarative-action-config, single-source-of-truth]

key-files:
  created: []
  modified:
    - src/modules/views/OnlyOffice/Scribe/scribeActions.js
    - src/modules/views/OnlyOffice/Scribe/mockTransform.js
    - src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx

key-decisions:
  - "mockResult uses string-based DSL (capitalize, wrap:x:y, truncate-half, etc.) instead of function references for serialization readiness"
  - "translate-custom uses {language} placeholder filled at call time via extra param"
  - "FREE_PROMPT_CONFIG kept separate from SCRIBE_ACTIONS array (not a menu-rendered action)"

patterns-established:
  - "Config-driven transform: action config carries both prompt and mockResult, transform reads from config"
  - "Single source of truth: adding an action to SCRIBE_ACTIONS makes it work in menu AND mockTransform"

requirements-completed: [UX-02, UX-03]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 06 Plan 02: Prompt Templates + Config-Driven Transform Summary

**AI prompt templates on every SCRIBE_ACTIONS entry with config-driven mockTransform replacing switch/case**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T00:03:00Z
- **Completed:** 2026-03-03T00:05:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Every action and sub-action in SCRIBE_ACTIONS now carries a `prompt` field with an AI prompt template using `{selectedText}` placeholder
- mockTransform refactored from 14-case switch/case to config-driven approach using `findActionConfig()` + `applyMockResult()`
- FREE_PROMPT_CONFIG exported for free-prompt action with optional `promptPrefix`
- `buildTranslateChildren` generates prompt/mockResult per dynamic language child
- translate-custom supports `{language}` placeholder via extra parameter

## Task Commits

Each task was committed atomically:

1. **Task 1: Add prompt templates to SCRIBE_ACTIONS config** - `f75835598` (feat)
2. **Task 2: Refactor mockTransform to be config-driven** - `c49ad9c1f` (refactor)

## Files Created/Modified
- `src/modules/views/OnlyOffice/Scribe/scribeActions.js` - Added prompt/mockResult fields to all actions, FREE_PROMPT_CONFIG export, updated buildTranslateChildren
- `src/modules/views/OnlyOffice/Scribe/mockTransform.js` - Complete refactor: findActionConfig + applyMockResult replacing switch/case
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` - Minor update: pass extra { language } for translate-custom

## Decisions Made
- mockResult uses a string-based DSL (capitalize, wrap:x:y, truncate-half, suffix:, emojify, bullets) rather than function references -- this keeps the config serializable and ready for potential JSON storage
- translate-custom fills {language} at call time via the extra parameter rather than building the prompt statically -- necessary because the language is user-typed
- FREE_PROMPT_CONFIG is a separate export, not part of the SCRIBE_ACTIONS array, since free-prompt is not rendered as a menu item (it comes from the prompt input)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SCRIBE_ACTIONS is now the single source of truth for all Scribe capabilities
- prompt templates are ready to be sent to a real AI API when mockTransform is replaced
- Adding a new action requires only a single entry in scribeActions.js

## Self-Check: PASSED

- FOUND: src/modules/views/OnlyOffice/Scribe/scribeActions.js
- FOUND: src/modules/views/OnlyOffice/Scribe/mockTransform.js
- FOUND: src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx
- FOUND: .planning/phases/06-affinement-ui-ux/06-02-SUMMARY.md
- FOUND: commit f75835598 (Task 1)
- FOUND: commit c49ad9c1f (Task 2)

---
*Phase: 06-affinement-ui-ux*
*Completed: 2026-03-03*
