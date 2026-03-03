---
phase: 03-scribe-interface-with-mock-ai
plan: 02
subsystem: ui
tags: [react, cozy-ui, popover, action-menu, submenu, scribe, onlyoffice]

# Dependency graph
requires:
  - phase: 03-scribe-interface-with-mock-ai
    plan: 01
    provides: "SCRIBE_ACTIONS, mockTransform, ScribeResultPanel, ScribePopover with placeholder menu"
provides:
  - "ScribeActionMenu with 4 top-level actions, hover submenus, and chevron indicators"
  - "ScribePromptInput with 'Help me write' placeholder and send button"
  - "ScribePopover wired with real action menu (placeholder replaced)"
  - "View.jsx uses ScribePopover instead of ScribeModal"
  - "Complete two-step flow: action menu -> mock transform -> result panel -> Replace/Insert"
affects: [phase-04, phase-05, phase-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [hover-submenu-with-wrapper, free-prompt-input, popover-overflow-visible]

key-files:
  created:
    - src/modules/views/OnlyOffice/Scribe/ScribeActionMenu.jsx
    - src/modules/views/OnlyOffice/Scribe/ScribePromptInput.jsx
  modified:
    - src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx
    - src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx
    - src/modules/views/OnlyOffice/Scribe/scribeActions.js
    - src/modules/views/OnlyOffice/Scribe/scribe.styl
    - src/modules/views/OnlyOffice/useConfig.jsx
    - src/modules/views/OnlyOffice/View.jsx
    - scripts/oo-dev-setup.sh

key-decisions:
  - "Removed JWT token from frontend DocEditor config — OO 9.x compat, cozy-stack proxy handles auth"
  - "CSS modules import for ScribeResultPanel (import styles from) — project webpack config uses CSS modules for .styl"
  - "overflow: visible on Popover PaperProps — needed for submenus to render outside popover bounds"
  - "Removed state resets from handleReplace/handleInsert/handleClose — useEffect on open handles reset, avoids menu flicker"
  - "Wrapper div handles onMouseEnter/onMouseLeave for submenu flicker prevention"

patterns-established:
  - "Hover submenu pattern: wrapper div contains both parent ListItem and submenu Paper, mouse events on wrapper"
  - "Free prompt input: InputBase with send IconButton, submit on Enter with stopPropagation"

requirements-completed: [UI-02, UI-03]

# Metrics
duration: ~2h (including verification and fixes)
completed: 2026-03-01
---

# Phase 03 Plan 02: Action Menu, View Integration, and Verification

**ScribeActionMenu with hover submenus, ScribePromptInput, View.jsx integration replacing ScribeModal, and end-to-end verification with UI fixes**

## Performance

- **Duration:** ~2h (tasks + verification + fix cycle)
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files created:** 2
- **Files modified:** 7

## Accomplishments
- Created ScribeActionMenu with 4 top-level actions (Correct grammar, Translate, Change tone, Improve), hover-activated submenus with chevron indicators, and icon support
- Created ScribePromptInput with "Help me write" placeholder, send button, and Enter key submission
- Replaced placeholder menu in ScribePopover with real ScribeActionMenu
- Swapped ScribeModal for ScribePopover in View.jsx (drop-in replacement, same prop interface)
- Fixed multiple UI issues discovered during verification: CSS modules, overflow clipping, menu flicker, missing icons, result panel sizing
- Fixed OO dev setup: JWT secret alignment, --add-host for DNS resolution, token removal from frontend config

## Task Commits

1. **Task 1: Create ScribeActionMenu and ScribePromptInput** - `68f83cec9` (feat)
2. **Task 2: Wire ScribePopover into View.jsx** - `1fd1a3de6` (feat)
3. **Task 3: Checkpoint verification + fixes** - `8ef07d7a7` (fix)

## Files Created/Modified
- `src/modules/views/OnlyOffice/Scribe/ScribeActionMenu.jsx` — Action menu with hover submenus
- `src/modules/views/OnlyOffice/Scribe/ScribePromptInput.jsx` — Free prompt input with send button
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` — Wired with ScribeActionMenu, overflow fix, state reset fix
- `src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx` — CSS modules import fix
- `src/modules/views/OnlyOffice/Scribe/scribeActions.js` — Added icons for Change tone submenu
- `src/modules/views/OnlyOffice/Scribe/scribe.styl` — Result panel width 380px
- `src/modules/views/OnlyOffice/View.jsx` — ScribePopover replaces ScribeModal
- `src/modules/views/OnlyOffice/useConfig.jsx` — Removed JWT token from DocEditor config
- `scripts/oo-dev-setup.sh` — JWT config fixes, --add-host

## Issues Encountered
- OO "security token not correctly formatted" — multi-layered (DNS, secret mismatch, field name). Solved by disabling browser/inbox JWT and removing token from frontend.
- CSS styles not applied — ScribeResultPanel used raw class names instead of CSS modules import
- Menu flicker on close — state resets in handlers conflicted with useEffect cleanup
- Submenus clipped — Popover PaperProps needed overflow: visible

## Next Phase Readiness
- Phase 3 complete: full Scribe UI with mock AI working end-to-end
- Phase 4 (End-to-End Actions): Replace/Insert/Cancel already functional via Phase 2 bridge — phase may require minimal new work
- Phase 5 (Floating button): requires plugin-side selection coordinate emission and host-side floating button rendering
- Phase 6 (UI/UX polish): visual alignment with mockups, dark theme, transitions

---
*Phase: 03-scribe-interface-with-mock-ai*
*Completed: 2026-03-01*
