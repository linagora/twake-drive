---
phase: 09-internationalization
plan: 02
subsystem: i18n
tags: [i18n, useI18n, twake-i18n, t(), react, jsx, translations]

# Dependency graph
requires:
  - phase: 09-internationalization
    provides: Scribe i18n keys in locale files, labelKey pattern in scribeActions.js, i18n descriptors from scribeAI.js
provides:
  - All 6 Scribe JSX components wired to t() from useI18n
  - Zero hardcoded English/French UI strings in Scribe components
  - Translated loading messages, error messages, action labels, button labels, tooltips, placeholders
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [t(action.labelKey) for menu items, t(loadingInfo.key loadingInfo.params) for loading messages, t(classified.messageKey) for error messages, child.labelKey ? t(child.labelKey) : child.label for translate children]

key-files:
  created: []
  modified:
    - src/modules/views/OnlyOffice/Scribe/ScribeFloatingButton.jsx
    - src/modules/views/OnlyOffice/Scribe/ScribeActionMenu.jsx
    - src/modules/views/OnlyOffice/Scribe/ScribePromptInput.jsx
    - src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx
    - src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx
    - src/modules/views/OnlyOffice/ScribeModal.jsx

key-decisions:
  - "Translate children use child.label directly (native language names not translated)"
  - "Breadcrumbs assembled from translated labels at selection time"

patterns-established:
  - "t(action.labelKey) pattern: components resolve i18n keys from action definitions at render time"
  - "t(result.key, result.params) pattern: loading/error descriptors resolved via t() in ScribePopover"

requirements-completed: [I18N-01, I18N-03]

# Metrics
duration: 3min
completed: 2026-03-06
---

# Phase 9 Plan 02: Scribe Component i18n Wiring Summary

**All 6 Scribe JSX components wired to t() from useI18n -- zero hardcoded English/French UI strings remain (except "Scribe" brand and "(Ctrl+I)" shortcut)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T00:16:58Z
- **Completed:** 2026-03-06T00:19:36Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Replaced all hardcoded UI strings in ScribeFloatingButton, ScribePromptInput, ScribeResultPanel, and ScribeModal with t() calls
- Wired ScribeActionMenu to display t(action.labelKey) for menus, t(child.labelKey) or child.label for children, and t(child.placeholderKey) for custom input
- Wired ScribePopover to resolve loading messages via t(loadingInfo.key, loadingInfo.params) and error messages via t(classified.messageKey)
- Fixed hardcoded French "Inserer" bug (now uses t('Scribe.button.insert'))

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire ScribeFloatingButton, ScribePromptInput, ScribeResultPanel, ScribeModal to t()** - `6e5bd38b2` (feat)
2. **Task 2: Wire ScribeActionMenu and ScribePopover to t() with labelKey, loading keys, error keys** - `37680f30b` (feat)

## Files Created/Modified
- `src/modules/views/OnlyOffice/Scribe/ScribeFloatingButton.jsx` - Translated tooltip "Text AI" via t()
- `src/modules/views/OnlyOffice/Scribe/ScribePromptInput.jsx` - Translated placeholder via t()
- `src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx` - Translated Retry/Replace/Insert buttons via t()
- `src/modules/views/OnlyOffice/ScribeModal.jsx` - Translated Cancel/Insert After/Replace/Selected text via t()
- `src/modules/views/OnlyOffice/Scribe/ScribeActionMenu.jsx` - t(action.labelKey) for menus, translated breadcrumbs, t(child.placeholderKey) for custom input
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` - t() for loading and error message resolution

## Decisions Made
- Translate children use child.label directly (native language names should not be translated)
- Breadcrumbs are assembled from translated labels at selection time in ScribeActionMenu, passed already-translated to ScribePopover

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All Scribe UI text is now fully internationalized
- Changing Cozy locale will change all Scribe UI text
- Phase 9 (Internationalization) is complete

## Self-Check: PASSED

All 6 modified files exist. Both task commits (6e5bd38b2, 37680f30b) verified in git log.

---
*Phase: 09-internationalization*
*Completed: 2026-03-06*
