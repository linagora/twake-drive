---
phase: 02-contextual-trigger-and-communication-bridge
plan: 01
subsystem: communication
tags: [postMessage, cozy-bridge, intent-protocol, onlyoffice-plugin, cross-iframe]

# Dependency graph
requires:
  - phase: 01-plugin-onlyoffice-poc
    provides: "Working OO plugin with selection detection, PasteText, InsertContent workaround"
provides:
  - "cozy-bridge protocol module (message format, validators, factory functions)"
  - "CozyBridge host-side class (message listener, intent routing, response sending)"
  - "Plugin with contextual Scribe trigger button and AI_TEXT_EDIT intent casting"
  - "Plugin-side response handler for replace/insert/cancel document modifications"
affects: [02-02, phase-03, phase-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [intent-based-postMessage, cozy-bridge-protocol, promise-with-es5-fallback]

key-files:
  created:
    - src/lib/cozy-bridge/types.js
    - src/lib/cozy-bridge/protocol.js
    - src/lib/cozy-bridge/index.js
  modified:
    - plugins/onlyoffice-scribe/config.json
    - plugins/onlyoffice-scribe/index.html
    - plugins/onlyoffice-scribe/scripts/code.js

key-decisions:
  - "Kept plugin type 'panel' (not 'background') -- Phase 1 confirmed initOnSelectionChanged works with panel, research flagged risk of breaking with background type"
  - "cozy-bridge origin validation only warns on messages that look like cozy-bridge messages, reducing noise from unrelated postMessage traffic"
  - "Plugin uses Promise-based castIntent with typeof guard for ES5 sandbox fallback"

patterns-established:
  - "cozy-bridge:intent message format: {type, version, intentId, action, source, data}"
  - "cozy-bridge:response message format: {type, version, intentId, status, action, data}"
  - "Intent correlation via intentId (UUID or timestamp+random fallback)"
  - "CozyBridge.onIntent(action, handler) pattern for host-side intent routing"

requirements-completed: [PLUG-06, COMM-01]

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 02 Plan 01: Cozy-Bridge Protocol and Plugin Trigger Summary

**Intent-based cozy-bridge protocol module with contextual Scribe trigger button casting AI_TEXT_EDIT intents via postMessage to Cozy Drive**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-28T21:15:58Z
- **Completed:** 2026-02-28T21:19:03Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created standalone cozy-bridge protocol module with message constants, factory functions, and schema validators
- Built CozyBridge host-side class with origin-validated message listening, intent routing, and response sending
- Rebuilt OO plugin with minimal Scribe trigger button (sparkle icon) and full intent lifecycle
- Plugin casts AI_TEXT_EDIT intents via postMessage and handles replace/insert/cancel responses

## Task Commits

Each task was committed atomically:

1. **Task 1: Create cozy-bridge protocol module and CozyBridge host class** - `e38764ddd` (feat)
2. **Task 2: Update plugin with contextual trigger and bidirectional intent communication** - `0e2c62007` (feat)

## Files Created/Modified
- `src/lib/cozy-bridge/types.js` - JSDoc type definitions for IntentMessage and ResponseMessage
- `src/lib/cozy-bridge/protocol.js` - Constants (PROTOCOL_VERSION, MSG_TYPE_*), createIntentMessage, createResponseMessage, validateIntent, validateResponse with 1MB size limit
- `src/lib/cozy-bridge/index.js` - CozyBridge class with onIntent/offIntent, origin validation, destroy cleanup
- `plugins/onlyoffice-scribe/config.json` - Version bumped to 0.2.0, kept panel type with initOnSelectionChanged
- `plugins/onlyoffice-scribe/index.html` - Replaced test panel with minimal 36x36px sparkle trigger button
- `plugins/onlyoffice-scribe/scripts/code.js` - Complete rewrite: castIntent, response handler, handleIntentResponse (replace/insert/cancel), ES5-compatible

## Decisions Made
- Kept plugin type "panel" instead of switching to "background" -- Phase 1 confirmed initOnSelectionChanged works reliably with panel, and research flagged risk that background type might break selection detection
- CozyBridge origin validation selectively warns only on messages with "cozy-bridge:" prefix, avoiding noise from other postMessage traffic (e.g., OO editor internal messages)
- Added offIntent() method to CozyBridge for handler cleanup flexibility (minor addition, consistent with destroy() pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- cozy-bridge protocol module ready for host-side integration in Cozy Drive (Plan 02-02)
- Plugin trigger and intent casting ready for end-to-end testing with ScribeModal
- All cozy-bridge exports (CozyBridge, protocol functions) available for React hook integration

## Self-Check: PASSED

All 6 files verified present. Both task commits (e38764ddd, 0e2c62007) confirmed in git log.

---
*Phase: 02-contextual-trigger-and-communication-bridge*
*Completed: 2026-02-28*
