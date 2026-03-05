---
phase: quick
plan: 2
completed: 2026-03-05
---

# Quick Task 2: Feature flag for Scribe

**Gate all Scribe UI behind `drive.scribe.enabled` cozy-flags feature flag**

## Accomplishments
- Added `flag('drive.scribe.enabled')` check in View.jsx
- ScribeFloatingButton and ScribePopover only render when flag is true
- useCozyBridge stays called (React hooks rules) but output is unused when flag is off
- OO plugin (code.js) unchanged — Ctrl+I messages silently ignored when no bridge listens

## Files Modified
- `src/modules/views/OnlyOffice/View.jsx` — import cozy-flags, gate Scribe components

## Usage
- Flag off (default): no Scribe UI, no floating button, Ctrl+I does nothing
- Flag on: `cozy-stack features flags '{"drive.scribe.enabled": true}' --domain alice.localhost:8080`
