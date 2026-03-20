---
phase: 23-image-round-trip
plan: 01
subsystem: ui
tags: [react-markdown, marked-lexer, image-markers, onlyoffice-plugin]

requires:
  - phase: 22-extraction-pipeline-contrat-marqueurs
    provides: "Image marker contract (IMG:scribe-img-N) and SetName-based extraction"
provides:
  - "MarkdownPreview image marker badge rendering (block + inline)"
  - "flattenTokens image_placeholder block type and imageMarker run property"
  - "buildAndInject inline marker pre-processing"
affects: [23-02-image-reinjection]

tech-stack:
  added: []
  patterns: ["image marker badge rendering via react-markdown custom img component", "inline marker pre-processing regex before lexer"]

key-files:
  created: []
  modified:
    - src/modules/views/OnlyOffice/Scribe/MarkdownPreview.jsx
    - plugins/onlyoffice-scribe/scripts/code.js

key-decisions:
  - "Inline markers {{IMG:...}} normalized to standard image syntax before both preview and lexer paths"
  - "Pure-image paragraphs promoted to image_placeholder blocks; mixed paragraphs keep imageMarker runs"

patterns-established:
  - "Image marker badge: inline-flex span with picture icon + name, theme-aware background"
  - "image_placeholder block type in flattenTokens output for standalone image markers"

requirements-completed: [MARK-05]

duration: 2min
completed: 2026-03-20
---

# Phase 23 Plan 01: Image Marker Recognition Summary

**Image marker badges in MarkdownPreview and image_placeholder/imageMarker token types in flattenTokens for block and inline image markers**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T19:38:49Z
- **Completed:** 2026-03-20T19:40:59Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- MarkdownPreview renders image markers as styled badge chips (picture icon + marker name) instead of broken images
- flattenTokens emits image_placeholder blocks for standalone image paragraphs and imageMarker runs for inline images
- Both block `![IMG:scribe-img-N](placeholder)` and inline `{{IMG:scribe-img-N}}` markers handled via pre-processing normalization

## Task Commits

Each task was committed atomically:

1. **Task 1: Add image marker badge to MarkdownPreview + inline marker pre-processing** - `e178c0b90` (feat)
2. **Task 2: Add image token handling to flattenTokens + inline marker pre-processing in buildAndInject** - `edbaa981b` (feat)

## Files Created/Modified
- `src/modules/views/OnlyOffice/Scribe/MarkdownPreview.jsx` - Custom img component for badge rendering + inline marker pre-processing
- `plugins/onlyoffice-scribe/scripts/code.js` - flattenInline image handler, paragraph image promotion, buildAndInject pre-processing

## Decisions Made
- Inline markers normalized to standard markdown image syntax before both react-markdown and marked.lexer paths, avoiding duplicate parsing logic
- Pure-image paragraphs promoted to dedicated image_placeholder blocks for clean separation from text paragraphs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- image_placeholder blocks and imageMarker runs ready for consumption by Plan 23-02 (image reinjection)
- Badge rendering provides visual feedback to users about image placement in LLM responses

---
*Phase: 23-image-round-trip*
*Completed: 2026-03-20*
