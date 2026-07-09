---
phase: 23-image-round-trip
plan: 02
subsystem: ui
tags: [onlyoffice-plugin, image-reinjection, tojson-fromjson, adddrawing, callcommand]

requires:
  - phase: 23-image-round-trip
    provides: "image_placeholder block type and imageMarker run property from flattenTokens (plan 01)"
  - phase: 22-extraction-pipeline-contrat-marqueurs
    provides: "Image marker contract (IMG:scribe-img-N) and SetName-based extraction"
provides:
  - "Image reinjection via ToJSON/FromJSON serialization in buildAndInject callCommand"
  - "Image cache pre-pass that survives InsertContent selection destruction"
  - "Block and inline image restoration with Copy() fallback"
affects: []

tech-stack:
  added: []
  patterns: ["ToJSON/FromJSON pre-cache for images before InsertContent destroys selection", "restoreImage helper with primary/fallback serialization strategy"]

key-files:
  created: []
  modified:
    - plugins/onlyoffice-scribe/scripts/code.js

key-decisions:
  - "ToJSON/FromJSON as primary serialization strategy over Copy() -- self-contained JSON survives document mutations"
  - "Copy() as fallback when ToJSON fails -- defense in depth"

patterns-established:
  - "Image pre-cache pattern: serialize before destructive operation, restore during content building"
  - "restoreImage helper with re-lookup on Copy() fallback to handle consumed references"

requirements-completed: [REINJ-01]

duration: 2min
completed: 2026-03-20
---

# Phase 23 Plan 02: Image Reinjection Summary

**Image reinjection via ToJSON/FromJSON pre-cache in buildAndInject callCommand -- images survive LLM round-trip in both replace and insert modes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T19:42:31Z
- **Completed:** 2026-03-20T19:44:26Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Pre-cache all referenced images via ToJSON before InsertContent destroys the selection (critical for replace mode)
- restoreImage helper with FromJSON primary strategy and Copy() fallback for robustness
- image_placeholder blocks produce OO paragraphs with restored original images via AddDrawing
- Inline imageMarker runs inject restored images in heading, list_item, code_block, and paragraph handlers

## Task Commits

Each task was committed atomically:

1. **Task 1: Image cache pre-pass and image_placeholder/imageMarker handling in buildAndInject callCommand** - `5e7ce126c` (feat)
2. **Task 2: Update totalTextLen calculation to account for image blocks** - `8ef056d49` (docs)

## Files Created/Modified
- `plugins/onlyoffice-scribe/scripts/code.js` - Image cache pre-pass (ToJSON serialization), restoreImage helper (FromJSON + Copy fallback), image_placeholder block handler, inline imageMarker handling in all run loops, totalTextLen documentation

## Decisions Made
- ToJSON/FromJSON chosen as primary serialization strategy because it produces self-contained JSON that survives document mutations, unlike Copy() which may hold internal references invalidated by InsertContent
- Copy() retained as fallback for cases where ToJSON fails at runtime

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full image round-trip pipeline complete: extraction (phase 22) -> marker recognition (23-01) -> reinjection (23-02)
- Images survive both replace mode (ToJSON pre-cache before InsertContent) and insert mode
- No additional phases needed for basic image round-trip

---
*Phase: 23-image-round-trip*
*Completed: 2026-03-20*
