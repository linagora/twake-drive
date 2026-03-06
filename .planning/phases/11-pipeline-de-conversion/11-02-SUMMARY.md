---
phase: 11-pipeline-de-conversion
plan: 02
subsystem: ui
tags: [turndown, markdown, html-conversion, llm-pipeline, scribe]

requires:
  - phase: 11-pipeline-de-conversion
    provides: htmlToMarkdown() and markdownToHtml() conversion functions
  - phase: 10-extraction-rich-text
    provides: HTML extraction from OO editor via intent protocol (selectedHtml prop)
provides:
  - buildMessages() converts HTML to Markdown before LLM prompt when HTML available
  - ScribePopover wires selectedHtml prop through to buildMessages extra parameter
  - Backward-compatible plain text fallback when no HTML available
affects: [12-preview-resultat, 13-reinsertion-html]

tech-stack:
  added: []
  patterns: [extra-object-pattern-for-pipeline-data, textForPrompt-conversion-guard]

key-files:
  created: []
  modified:
    - src/modules/views/OnlyOffice/Scribe/scribeAI.js
    - src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx
    - src/modules/views/OnlyOffice/View.jsx

key-decisions:
  - "Use textForPrompt variable pattern to keep selectedText param unchanged for backward compat"
  - "Build extra object incrementally (not ternary) for cleaner multi-field construction"

patterns-established:
  - "Pipeline data flow: extra.html carries HTML through ScribePopover to buildMessages, converted to Markdown via htmlToMarkdown before prompt assembly"
  - "Conversion guard: extra?.html ? htmlToMarkdown(extra.html) : selectedText provides clean fallback"

requirements-completed: [CONV-01, CONV-02]

duration: 6min
completed: 2026-03-06
---

# Phase 11 Plan 02: Pipeline Integration Summary

**HTML-to-Markdown conversion wired into Scribe AI pipeline via extra.html prop flow from OO editor through ScribePopover to buildMessages**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-06T20:14:56Z
- **Completed:** 2026-03-06T20:21:10Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Integrated htmlToMarkdown import into scribeAI.js with textForPrompt conversion guard
- Wired selectedHtml prop through ScribePopover to buildMessages via extra.html parameter
- Removed Phase 10 temporary console.log from View.jsx (cleanup)
- All 18 existing scribeConversion tests still pass (no regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate htmlToMarkdown into buildMessages** - `4e5ebb7a5` (feat)
2. **Task 2: Wire selectedHtml through ScribePopover to buildMessages** - `326abbc9c` (feat)

## Files Created/Modified
- `src/modules/views/OnlyOffice/Scribe/scribeAI.js` - Added htmlToMarkdown import, textForPrompt conversion guard, replaced selectedText with textForPrompt in all prompt templates
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` - Added selectedHtml prop, built extra object with html field, updated useCallback deps and PropTypes
- `src/modules/views/OnlyOffice/View.jsx` - Removed temporary Phase 10 console.log for HTML verification

## Decisions Made
- Used textForPrompt variable pattern instead of modifying selectedText parameter -- keeps function signature backward-compatible
- Built extra object incrementally with if-guards instead of ternary -- cleaner when multiple optional fields (language + html)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full pipeline operational: OO HTML -> normalizeOoHtml -> Turndown -> Markdown in prompt -> LLM -> Markdown response
- LLM Markdown response available as raw string from callScribeAI for Phase 12 (preview rendering)
- markdownToHtml() from scribeConversion.js ready for Phase 13 (HTML reconversion for PasteHtml)

---
*Phase: 11-pipeline-de-conversion*
*Completed: 2026-03-06*
