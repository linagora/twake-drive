---
phase: 02-contextual-trigger-and-communication-bridge
plan: 02
subsystem: communication
tags: [react-hook, postMessage, cozy-bridge, scribe-modal, cozy-ui, onlyoffice-integration]

# Dependency graph
requires:
  - phase: 02-contextual-trigger-and-communication-bridge
    plan: 01
    provides: "CozyBridge class, cozy-bridge protocol module, plugin trigger with intent casting"
provides:
  - "useCozyBridge React hook wrapping CozyBridge lifecycle with pendingIntent state"
  - "ScribeModal component (ConfirmDialog) for displaying selected text and Replace/Insert/Cancel actions"
  - "Full round-trip communication: plugin selection -> intent -> modal -> user action -> response -> document modification"
affects: [phase-03, phase-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [useCozyBridge-hook, scribe-modal-confirm-dialog, ancestor-frame-traversal]

key-files:
  created:
    - src/modules/views/OnlyOffice/useCozyBridge.js
    - src/modules/views/OnlyOffice/ScribeModal.jsx
  modified:
    - src/modules/views/OnlyOffice/View.jsx
    - src/lib/cozy-bridge/index.js
    - plugins/onlyoffice-scribe/scripts/code.js
    - src/modules/views/OnlyOffice/useConfig.jsx

key-decisions:
  - "Wildcard origin ['*'] for dev; production should derive origins from Cozy instance URL and OO server URL"
  - "Post to ancestor frames via frame traversal instead of window.top to cross OO's nested iframe boundary"
  - "Removed browser-side JWT token from OO editor config to fix 403 errors in Cozy stack"
  - "Button disable on deselection deferred to future phase (requires floating button redesign)"

patterns-established:
  - "useCozyBridge hook pattern: useRef for bridge instance + respondFn, useState for pendingIntent"
  - "ScribeModal follows FileDeletedModal pattern: ConfirmDialog + Buttons from cozy-ui"
  - "View.jsx integration: hook + handlers + modal rendering alongside existing components"

requirements-completed: [COMM-02, COMM-03]

# Metrics
duration: ~45min
completed: 2026-02-28
---

# Phase 02 Plan 02: Cozy Drive Host-Side Integration Summary

**useCozyBridge React hook and ScribeModal completing full bidirectional round-trip: plugin selection to intent to modal to Replace/Insert/Cancel response to document modification**

## Performance

- **Duration:** ~45 min (including checkpoint verification and 2 fix iterations)
- **Started:** 2026-02-28T21:20:00Z
- **Completed:** 2026-02-28T22:05:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Created useCozyBridge React hook wrapping CozyBridge lifecycle with pendingIntent/respond interface
- Built ScribeModal component using cozy-ui ConfirmDialog with Replace, Insert After, and Cancel buttons
- Integrated hook and modal into View.jsx alongside existing editor components
- Achieved full round-trip communication verified by human: Replace works, Insert After works, Cancel works
- Fixed cross-iframe postMessage routing (ancestor frame traversal instead of window.top)
- Fixed OO editor 403 errors by removing browser-side JWT token from config

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useCozyBridge hook and ScribeModal component** - `61074064f` (feat)
2. **Task 2: Integrate useCozyBridge and ScribeModal into View.jsx** - `adde89cd8` (feat)
3. **Task 3: Verify full round-trip communication** - checkpoint:human-verify (approved)

**Fix commits (deviations):**
- `94b366401` - fix: post to ancestor frames instead of window.top
- `c171267b7` - fix: remove browser JWT token from OO editor config

## Files Created/Modified
- `src/modules/views/OnlyOffice/useCozyBridge.js` - React hook wrapping CozyBridge lifecycle, AI_TEXT_EDIT intent handling, respond callback
- `src/modules/views/OnlyOffice/ScribeModal.jsx` - ConfirmDialog modal showing selected text with Replace, Insert After, Cancel actions
- `src/modules/views/OnlyOffice/View.jsx` - Integrated useCozyBridge hook and ScribeModal rendering
- `src/lib/cozy-bridge/index.js` - Added wildcard origin support for dev mode
- `plugins/onlyoffice-scribe/scripts/code.js` - Fixed postMessage to traverse ancestor frames
- `src/modules/views/OnlyOffice/useConfig.jsx` - Removed browser JWT token from OO editor config

## Decisions Made
- Used wildcard origin `['*']` for development; production should derive from Cozy instance URL and OO server URL
- Plugin posts to ancestor frames via frame traversal (`window.parent` chain) instead of `window.top`, because OO nests the plugin inside multiple iframes and `window.top` doesn't reach the Cozy Drive frame
- Removed browser-side JWT token from OO editor config -- the Cozy stack proxy handles auth, and including a token caused 403 errors
- Button disable on deselection noted as not working during verification; deferred to future phase as it requires a floating button redesign beyond the current plugin panel approach

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed postMessage target: ancestor frame traversal instead of window.top**
- **Found during:** Task 3 (checkpoint verification -- intents not reaching Cozy Drive)
- **Issue:** Plugin was posting to `window.top`, but OO nests the plugin in multiple iframes. The Cozy Drive listener is on an ancestor frame, not necessarily `window.top`
- **Fix:** Changed plugin to traverse `window.parent` chain, posting to each ancestor frame until reaching the top
- **Files modified:** `plugins/onlyoffice-scribe/scripts/code.js`
- **Verification:** Full round-trip verified (Replace, Insert, Cancel all work)
- **Committed in:** `94b366401`

**2. [Rule 1 - Bug] Removed browser JWT token causing 403 errors**
- **Found during:** Task 3 (checkpoint verification -- OO editor failing to load)
- **Issue:** The OO editor config included a JWT token for browser-side authentication, but the Cozy stack proxy handles auth. The extra token caused 403 Forbidden errors
- **Fix:** Removed the `token` field from the editor config object in useConfig.jsx
- **Files modified:** `src/modules/views/OnlyOffice/useConfig.jsx`
- **Verification:** Editor loads correctly, no 403 errors
- **Committed in:** `c171267b7`

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were essential for the round-trip to work. The postMessage routing fix addressed the OO iframe nesting reality. The JWT fix addressed an auth configuration mismatch. No scope creep.

## Issues Encountered
- Button disable on deselection does not work in the current plugin panel approach. This was noted during human verification but deferred -- it requires a redesign of the trigger mechanism (e.g., floating button) which is out of scope for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Full bidirectional communication is working: plugin -> Cozy Drive -> plugin
- Phase 3 can build the Scribe UI knowing the communication layer is solid
- The ScribeModal is a placeholder -- Phase 3 will replace it with the actual Scribe interface (mock AI transformation + preview)
- The useCozyBridge hook API (pendingIntent/respond) is stable and reusable

## Self-Check: PASSED

All 6 source files verified present. All 4 commits (61074064f, adde89cd8, 94b366401, c171267b7) confirmed in git log. SUMMARY.md created.

---
*Phase: 02-contextual-trigger-and-communication-bridge*
*Completed: 2026-02-28*
