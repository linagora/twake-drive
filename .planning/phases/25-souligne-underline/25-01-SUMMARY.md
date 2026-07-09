---
phase: 25-souligne-underline
plan: 01
subsystem: ui
tags: [onlyoffice, markdown, underline, marked, builder-api]

requires:
  - phase: none
    provides: existing bold/italic/strikethrough extraction pipeline
provides:
  - Underline extraction from OO (GetUnderline API)
  - Underline injection into OO (SetUnderline via Builder API)
  - Marked <u> token extension with recursive child parsing
  - Self-contained segment strategy for markdown emission
  - mergeAdjacentRuns for post-parse run consolidation
  - Enriched markdown format contract (documented in README)
affects: [future formatting phases, LLM integration, editor plugins]

tech-stack:
  added: [rehype-raw]
  patterns: [self-contained-segments, merge-adjacent-runs]

key-files:
  created: []
  modified:
    - plugins/onlyoffice-scribe/scripts/code.js
    - src/modules/views/OnlyOffice/Scribe/scribeAI.js
    - src/modules/views/OnlyOffice/Scribe/MarkdownPreview.jsx
    - src/modules/views/OnlyOffice/Scribe/scribeConversion.js
    - src/modules/views/OnlyOffice/Scribe/scribeConversion.spec.js
    - plugins/onlyoffice-scribe/README.md

key-decisions:
  - "Self-contained segment strategy: each run emits all markers independently, no cross-boundary tracking"
  - "Adjacent </u><u> and same-URL links accepted as trade-off for unambiguous markdown"
  - "mergeAdjacentRuns consolidates split segments after marked parsing, before Builder API injection"
  - "LLM system prompt updated with explicit rules to preserve segment structure"

patterns-established:
  - "Self-contained segments: formatting markers open and close within each segment, never cross boundaries"
  - "mergeAdjacentRuns: post-parse consolidation of runs with identical formatting flags"
  - "Enriched markdown format contract documented in README.md"

requirements-completed: [FMT-01]

duration: 45min
completed: 2026-03-24
---

# Phase 25-01: Underline Round-Trip Summary

**Full underline round-trip via self-contained segment markdown strategy — extraction, LLM preservation, preview, and OO reinjection with overlapping format support**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 (+ 4 bugfix iterations)
- **Files modified:** 6

## Accomplishments
- Underline extraction from OO via GetUnderline() API, emitted as `<u>` HTML tags in markdown
- Custom marked v17 extension for `<u>` token parsing with recursive child tokenization
- Self-contained segment strategy replacing stateful cross-boundary marker emission — eliminates `***` ambiguity
- mergeAdjacentRuns() consolidates split segments after parsing (same-URL links, contiguous code)
- rehype-raw added for `<u>` rendering in MarkdownPreview
- LLM system prompt updated with segment preservation rules
- Enriched markdown format contract documented in README.md

## Task Commits

1. **Task 1: Underline extraction, emission, injection, marked extension** - `db3bcf9` (feat)
2. **Task 2: System prompt, preview, fallback path** - `0df8deb` (feat)
3. **Task 3: Verification** — 4 fix iterations during user testing:
   - `9a6b041` (fix) — underline token child parsing in marked v17
   - `d124b45` (fix) — overlapping bold/underline at tag boundaries
   - `de26a17` (fix) — literal asterisks after underline boundary
   - `e0ef76f` (fix) — empty bold markers after underline boundary
4. **Refactor: Self-contained segments** - `008183f` (refactor) — replaced stateful transition logic
5. **Merge + docs** - `842e4f7` (feat) — mergeAdjacentRuns + README contract

## Files Modified
- `plugins/onlyoffice-scribe/scripts/code.js` — extraction (GetUnderline), marked extension, buildMarkdownFromParts (self-contained segments), mergeAdjacentRuns, flattenInline (underline propagation), Builder API (SetUnderline)
- `src/modules/views/OnlyOffice/Scribe/scribeAI.js` — SYSTEM_PROMPT with segment preservation rules
- `src/modules/views/OnlyOffice/Scribe/MarkdownPreview.jsx` — rehype-raw for `<u>` rendering
- `src/modules/views/OnlyOffice/Scribe/scribeConversion.js` — underline in fallback HTML conversion
- `src/modules/views/OnlyOffice/Scribe/scribeConversion.spec.js` — underline conversion tests
- `plugins/onlyoffice-scribe/README.md` — enriched markdown format contract

## Decisions Made
- **Self-contained segments over stateful tracking:** Overlapping OO spans produce ambiguous `***` when markers cross boundaries. Self-contained segments (each run opens/closes its own markers) eliminate this entirely at the cost of slightly more verbose markdown.
- **Adjacent `</u><u>` and split links accepted:** OO renders contiguous underline identically; mergeAdjacentRuns reconsolidates links.
- **rehype-raw for preview:** Needed for `<u>` HTML tag rendering in react-markdown.

## Deviations from Plan

### Auto-fixed Issues

**1. Marked v17 childTokens not auto-populated**
- **Found during:** Task 3 verification
- **Issue:** `childTokens: ["tokens"]` does not auto-populate in marked v17; `tokens` array was empty
- **Fix:** Manual `this.lexer.inlineTokens()` call in tokenizer
- **Committed in:** `9a6b041`

**2. Overlapping format spans produce ambiguous markdown**
- **Found during:** Task 3 verification (multiple iterations)
- **Issue:** Stateful marker emission produced `***`, literal `**`, and empty `****` when bold/italic cross underline boundaries
- **Fix:** Complete rewrite to self-contained segment strategy
- **Committed in:** `d124b45`, `de26a17`, `e0ef76f`, `008183f`

---

**Total deviations:** 2 classes of issues, 5 fix commits
**Impact on plan:** Led to a better architecture (self-contained segments) than originally planned (stateful transitions)

## Issues Encountered
- CommonMark flanking rules: `** text**` doesn't open bold (space after `**`). Fixed by extracting leading whitespace outside markers.
- `***` ambiguity: three adjacent asterisks parsed inconsistently. Root cause of the self-contained segment rewrite.

## Next Phase Readiness
- Underline pipeline complete and verified with overlapping formats
- Self-contained segment strategy establishes the pattern for future formatting additions
- Format contract documented — future editors know the expected markdown structure

---
*Phase: 25-souligne-underline*
*Completed: 2026-03-24*
