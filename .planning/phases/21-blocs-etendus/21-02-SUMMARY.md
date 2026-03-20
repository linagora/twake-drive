---
phase: 21-blocs-etendus
plan: 02
subsystem: ui
tags: [onlyoffice, builder-api, markdown, table, ApiTable]

requires:
  - phase: 21-blocs-etendus
    plan: 01
    provides: flattenTokens + buildAndInject if/else chain with code_block and blockquote
provides:
  - table token type in flattenTokens (header + body rows with inline runs)
  - ApiTable rendering in callCommand (native OO table with borders, bold header, formatted cells)
affects: [future-rich-content]

tech-stack:
  added: []
  patterns: [ApiTable-creation, fillCell-helper]

key-files:
  created: []
  modified:
    - plugins/onlyoffice-scribe/scripts/code.js

key-decisions:
  - "Native ApiTable with full-width (percent 100) and thin single-line borders on all sides"
  - "Header row cells forced bold via shallow copy of runs"
  - "fillCell helper defined inside callCommand scope for access to Api, srcFontFamily, srcFontSize"
  - "Table blocks contribute no text to totalTextLen — ref-based selection handles them"

patterns-established:
  - "ApiTable creation: Api.CreateTable(nCols, nRows) + SetWidth + SetTableBorder* for all 6 sides"
  - "Cell content: GetCell(row,col).GetContent().GetElement(0) to access default paragraph"

requirements-completed: [BLK-03]

duration: 20min
completed: 2026-03-20
---

# Plan 21-02: Markdown Tables Summary

**Markdown tables render as native OO ApiTable with borders, bold headers, and inline-formatted cell content**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 1

## Accomplishments
- flattenTokens handles marked `table` tokens — extracts header and body row cells with flattened inline runs
- buildAndInject creates native ApiTable with correct dimensions, full-width, thin borders on all 6 sides
- Header row cells rendered bold
- Cell content preserves inline formatting (bold, italic, strikethrough, code, links)

## Task Commits

1. **Task 1: Add table type to flattenTokens and ApiTable rendering** - `2e788ce37` (feat)
2. **Task 2: Human verification** - approved, no issues

## Files Created/Modified
- `plugins/onlyoffice-scribe/scripts/code.js` - table in flattenTokens + ApiTable in callCommand

## Decisions Made
- Full-width table (percent 100) with thin single-line borders — standard document look
- Bold header via shallow copy of runs (avoids mutating original data)

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## Next Phase Readiness
- All Phase 21 block types complete (code_block, blockquote, table)
- Builder API pipeline now handles: paragraph, heading, list_item, code_block, table + blockquote flag

---
*Phase: 21-blocs-etendus*
*Completed: 2026-03-20*
