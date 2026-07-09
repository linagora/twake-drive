---
phase: 11-pipeline-de-conversion
plan: 01
subsystem: ui
tags: [turndown, marked, markdown, html-conversion, gfm, tdd]

requires:
  - phase: 10-extraction-rich-text
    provides: HTML extraction from OO editor via intent protocol
provides:
  - htmlToMarkdown() function converting OO inline-style HTML to Markdown
  - markdownToHtml() function converting LLM Markdown responses to HTML
  - Inline style normalization (font-weight/font-style to semantic tags)
  - GFM table support in both directions
affects: [11-02-integration-pipeline, scribe-ai-pipeline]

tech-stack:
  added: [turndown@7.2.2, turndown-plugin-gfm@1.0.2, marked@17.0.4]
  patterns: [OO-HTML-normalization, DOMParser-based-style-conversion]

key-files:
  created:
    - src/modules/views/OnlyOffice/Scribe/scribeConversion.js
    - src/modules/views/OnlyOffice/Scribe/scribeConversion.spec.js
  modified:
    - package.json
    - yarn.lock
    - jest.config.js

key-decisions:
  - "Override Turndown built-in img rule with addRule instead of remove (built-in rules take priority over remove list)"
  - "Add marked to jest transformIgnorePatterns for ESM module compatibility"

patterns-established:
  - "OO HTML normalization: DOMParser + querySelectorAll span[style] to convert inline styles to semantic tags before Turndown processing"
  - "Conversion guard pattern: null/empty/whitespace input returns empty string"

requirements-completed: [CONV-01, CONV-02, CONV-03]

duration: 3min
completed: 2026-03-06
---

# Phase 11 Plan 01: Conversion Pipeline Summary

**Bidirectional HTML/Markdown conversion with Turndown+marked, normalizing OO inline styles to semantic tags via DOMParser**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T20:09:33Z
- **Completed:** 2026-03-06T20:12:34Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Installed turndown, turndown-plugin-gfm, and marked conversion libraries
- Built htmlToMarkdown() that normalizes OO inline-style HTML (font-weight:bold, font-style:italic) to semantic tags before Turndown conversion
- Built markdownToHtml() using marked with GFM support for LLM response reinsertion
- Full TDD cycle: 18 tests covering bold, italic, bold+italic, headings, lists, tables, empty input, unsupported element stripping

## Task Commits

Each task was committed atomically:

1. **Task 1: Install turndown, turndown-plugin-gfm, and marked** - `edb235416` (chore)
2. **Task 2 RED: Failing tests for scribeConversion** - `db5d53fc6` (test)
3. **Task 2 GREEN: Implement scribeConversion module** - `266be674a` (feat)

## Files Created/Modified
- `src/modules/views/OnlyOffice/Scribe/scribeConversion.js` - Bidirectional HTML/Markdown conversion with OO inline style normalization
- `src/modules/views/OnlyOffice/Scribe/scribeConversion.spec.js` - 18 TDD tests for all conversion behaviors
- `package.json` - Added turndown, turndown-plugin-gfm, marked dependencies
- `yarn.lock` - Lock file updated with new dependencies
- `jest.config.js` - Added marked to transformIgnorePatterns for ESM support

## Decisions Made
- Override Turndown's built-in img rule with addRule() instead of using remove() -- Turndown's built-in rules take priority over the remove list, so an explicit rule override is needed
- Added marked to jest transformIgnorePatterns since marked v17 is an ESM-only package

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Turndown remove() does not override built-in img rule**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** `td.remove(['img'])` had no effect because Turndown's built-in img rule takes priority
- **Fix:** Used `td.addRule('stripImages', { filter: 'img', replacement: () => '' })` to explicitly override
- **Files modified:** src/modules/views/OnlyOffice/Scribe/scribeConversion.js
- **Verification:** img stripping test passes
- **Committed in:** 266be674a (Task 2 GREEN commit)

**2. [Rule 3 - Blocking] marked ESM module not transpiled by jest**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** marked v17 is ESM-only, jest could not import it without transpilation
- **Fix:** Added `marked` to transformIgnorePatterns in jest.config.js
- **Files modified:** jest.config.js
- **Verification:** All 18 tests pass
- **Committed in:** 266be674a (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correct operation. No scope creep.

## Issues Encountered
- Turndown list formatting includes extra whitespace in output -- adjusted test to use flexible matching instead of exact string comparison

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- scribeConversion.js exports ready for integration in plan 11-02
- htmlToMarkdown() can process OO HTML extracted via phase 10 intent protocol
- markdownToHtml() can convert LLM responses back to HTML for PasteHtml reinsertion

---
*Phase: 11-pipeline-de-conversion*
*Completed: 2026-03-06*
