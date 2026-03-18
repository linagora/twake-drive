---
phase: 19-extended-markdown-support
plan: 02
subsystem: ui
tags: [onlyoffice, builder-api, markdown, strikethrough, hyperlink, code-span, inline-formatting]

requires:
  - phase: 19-01
    provides: "flattenInline with bold/italic, callCommand interpreter with heading/list/paragraph blocks"
provides:
  - "Strikethrough formatting via SetStrikeout in Builder API"
  - "Inline code spans with Courier New monospace font"
  - "Native OO hyperlinks via CreateHyperlink for markdown links"
  - "Full inline nesting support (bold+italic+strikethrough+code+link combinations)"
affects: [20-post-injection-selection]

tech-stack:
  added: []
  patterns: ["CreateHyperlink for link runs instead of styled text", "Courier New for code spans without overriding srcFontFamily"]

key-files:
  created: []
  modified: ["plugins/onlyoffice-scribe/scripts/code.js"]

key-decisions:
  - "Hyperlinks use CreateHyperlink API (not blue-styled text runs) for native OO Ctrl+click behavior"
  - "Code spans use Courier New but preserve srcFontSize for consistent sizing"
  - "Heading code spans get srcFontSize only (no srcFontFamily override, no heading font override)"

patterns-established:
  - "Link runs branch separately from text runs in the run loop (CreateHyperlink vs CreateRun)"
  - "Code spans override font family but inherit font size from source paragraph"

requirements-completed: [INL-02, INL-03, INL-04]

duration: 2min
completed: 2026-03-18
---

# Phase 19 Plan 02: Extended Inline Formatting Summary

**Strikethrough, code span, and hyperlink support in Builder API via flattenInline extension and CreateHyperlink/SetStrikeout/SetFontFamily run handling**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T22:32:11Z
- **Completed:** 2026-03-18T22:34:05Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Extended flattenInline to 6 parameters handling del/codespan/link token types with full nesting
- All three callCommand run loops (heading, list_item, paragraph) handle strikethrough, code, and hyperlink runs
- Font application rules enforced: no srcFont on headings, Courier New for code spans, srcFontSize preserved

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend flattenInline for strikethrough, code spans, and links** - `8e0349786` (feat)
2. **Task 2: Extend callCommand run loops for strikethrough, code, and hyperlinks** - `2f0255bf6` (feat)

## Files Created/Modified
- `plugins/onlyoffice-scribe/scripts/code.js` - Extended flattenInline with 3 new token types and updated all callCommand run loops

## Decisions Made
- Hyperlinks use CreateHyperlink API for native OO link behavior (Ctrl+click opens URL)
- Code spans get Courier New font but preserve srcFontSize for size consistency
- Heading code spans receive srcFontSize only (no srcFontFamily to avoid overriding monospace)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All inline formatting types complete (bold, italic, strikethrough, code, links)
- Ready for Phase 20 (post-injection selection) or further extended markdown work
- PasteHtml fallback remains intact for non-Builder paths

---
*Phase: 19-extended-markdown-support*
*Completed: 2026-03-18*
