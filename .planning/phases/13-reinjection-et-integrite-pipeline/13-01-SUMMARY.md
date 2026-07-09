---
phase: 13-reinjection-et-integrite-pipeline
plan: 01
subsystem: ui
tags: [onlyoffice, pastehtml, markdown, html, rich-text, marked]

requires:
  - phase: 11-extraction-et-conversion-html-markdown
    provides: "markdownToHtml conversion function in scribeConversion.js"
  - phase: 12-preview-markdown
    provides: "Markdown preview rendering in result panel"
provides:
  - "Rich text reinsertion via PasteHtml for Replace and Insert After actions"
  - "HTML field in cozy-bridge response payload (backward-compatible with text fallback)"
  - "Smart spacing with nbsp before/after pasted content"
  - "insertAfterWithHtml function for HTML-based insert-after"
affects: [rich-content-pipeline, future-document-builder]

tech-stack:
  added: []
  patterns:
    - "PasteHtml for formatted reinsertion with PasteText fallback"
    - "Smart spacing: nbsp injection when adjacent to non-whitespace"
    - "unwrapSingleParagraph for inline paste without wrapping p tags"

key-files:
  created: []
  modified:
    - src/modules/views/OnlyOffice/View.jsx
    - plugins/onlyoffice-scribe/scripts/code.js
    - plugins/onlyoffice-scribe/README.md

key-decisions:
  - "PasteHtml with smart nbsp spacing for formatted reinsertion"
  - "unwrapSingleParagraph to avoid wrapping inline content in paragraph tags"
  - "pasteInProgress flag to guard against init()/polling interference during paste"
  - "Removed broken post-paste selection code (bookmarks, markers) -- deferred to rich content milestone"

patterns-established:
  - "HTML+text dual payload: respond() sends both html and text fields for backward compat"
  - "Smart spacing: check adjacent characters and inject nbsp only when needed"

requirements-completed: [REINJ-01, REINJ-02, PIPE-01, PIPE-02, PIPE-03, PIPE-04]

duration: ~15min
completed: 2026-03-07
---

# Phase 13 Plan 01: Rich Text Reinsertion Pipeline Summary

**PasteHtml-based rich text reinsertion with smart spacing, completing the OO-to-LLM-to-OO formatting round-trip**

## Performance

- **Duration:** ~15 min (implementation + cleanup + UAT)
- **Started:** 2026-03-07T16:23:00Z
- **Completed:** 2026-03-07T22:23:28Z
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 3

## Accomplishments
- Replace and Insert After actions now send formatted HTML alongside plain text to the OO plugin
- Plugin uses PasteHtml for rich text reinsertion, preserving bold, italic, headings, lists, tables, and code blocks
- Smart spacing injects nbsp before/after pasted content when adjacent to non-whitespace characters
- Plain text fallback maintained for backward compatibility when html field is absent
- Cleaned up dead code (broken post-paste selection attempts) and renamed functions for clarity
- UAT verified 5/5: inline formatting, structural elements, insert after, plain text fallback, tables/code

## Task Commits

Each task was committed atomically:

1. **Task 1: Add HTML conversion to View.jsx response handlers** - `f7097fa42` (feat)
2. **Task 2: Update plugin to use PasteHtml with fallback and add insertAfterWithHtml** - `ee9aedb9f` (feat)
3. **Task 3: Verify rich text round-trip in browser** - UAT passed 5/5 (documented in `27facfd81`)

**Cleanup commit:** `38dd3bb8d` - smart spacing, dead code removal, README documentation

## Files Created/Modified
- `src/modules/views/OnlyOffice/View.jsx` - Added markdownToHtml import, handleReplace/handleInsert send {text, html} payload
- `plugins/onlyoffice-scribe/scripts/code.js` - PasteHtml reinsertion with smart spacing, insertAfterWithHtml, plain text fallback
- `plugins/onlyoffice-scribe/README.md` - Rich Text Reinsertion Pipeline documentation with ASCII diagram

## Decisions Made
- Used PasteHtml with smart nbsp spacing rather than Document Builder API (simpler, sufficient for v2.1)
- unwrapSingleParagraph strips wrapping `<p>` tags for inline paste scenarios
- pasteInProgress flag prevents init()/polling from interfering during paste operations
- Removed broken post-paste selection code -- deferred to future rich content milestone using Document Builder API
- Renamed pasteHtmlAndSelect to pasteHtml, isCtrlK to isCtrlI for accuracy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Smart spacing with nbsp injection**
- **Found during:** Task 2 refinement (commit 38dd3bb8d)
- **Issue:** Pasted content could merge with adjacent text without spacing
- **Fix:** Added smart spacing that checks adjacent characters and injects nbsp when next to non-whitespace
- **Files modified:** plugins/onlyoffice-scribe/scripts/code.js
- **Committed in:** 38dd3bb8d

**2. [Rule 1 - Bug] Removed broken post-paste selection code**
- **Found during:** Task 2 refinement (commit 38dd3bb8d)
- **Issue:** Bookmark/marker/MoveCursorRight approaches all failed with PasteHtml
- **Fix:** Removed dead code, documented findings in phase13-paste-select.md
- **Files modified:** plugins/onlyoffice-scribe/scripts/code.js
- **Committed in:** 38dd3bb8d

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Smart spacing essential for usability. Dead code removal improves maintainability. No scope creep.

## Issues Encountered
- OO ordered lists render all items as "1." due to known OO bug #79263 -- accepted for v2.1, not a blocker

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Rich text pipeline complete for v2.1 milestone
- Future rich content milestone will use Document Builder API for complex objects, perfect spacing, and post-paste selection
- See MEMORY.md "Future Milestone" section for approach details

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 13-reinjection-et-integrite-pipeline*
*Completed: 2026-03-07*
