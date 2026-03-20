---
phase: 21-blocs-etendus
plan: 01
subsystem: ui
tags: [onlyoffice, builder-api, markdown, code-block, blockquote]

requires:
  - phase: 20-markdown-builder-api
    provides: flattenTokens + buildAndInject callCommand pipeline
provides:
  - code_block token type in flattenTokens (splits fenced code lines)
  - blockquote token type in flattenTokens (recursive flatten with flag)
  - code_block rendering in callCommand (Courier New, dark background, light text)
  - blockquote rendering in callCommand (predefined OO quote style or indent fallback)
  - MarkdownPreview code block CSS (pre > code vs inline code)
affects: [21-02-tables, future-rich-content]

tech-stack:
  added: []
  patterns: [quote-style-detection-heuristic, css-module-nested-element-selectors]

key-files:
  created: []
  modified:
    - plugins/onlyoffice-scribe/scripts/code.js
    - src/modules/views/OnlyOffice/Scribe/MarkdownPreview.jsx
    - src/modules/views/OnlyOffice/Scribe/scribe.styl

key-decisions:
  - "Dark code block background (40,44,52) with light text (212,212,212) instead of light gray"
  - "Blockquote style detection: Intense Quote > Citation intense > Quote > Citation, fallback to SetIndLeft(720)"
  - "MarkdownPreview code blocks via CSS selectors (pre > code) in styl, not inline React styles — react-markdown v10 has no reliable block/inline detection prop"

patterns-established:
  - "Quote style heuristic: try known names first, then enumerate GetAllStyles with keyword search"
  - "CSS modules nested element selectors: use & pre syntax in .styl for descendant selectors"

requirements-completed: [BLK-01, BLK-02]

duration: 45min
completed: 2026-03-20
---

# Plan 21-01: Code Blocks & Blockquotes Summary

**Fenced code blocks render as dark monospace paragraphs, blockquotes use OO predefined quote style with indent fallback**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 3

## Accomplishments
- flattenTokens handles marked `code` tokens (split lines → code_block blocks) and `blockquote` tokens (recursive flatten with flag)
- buildAndInject renders code_block as Courier New paragraphs with dark charcoal background and light text
- Blockquote rendering detects predefined OO quote/citation style via 2-step heuristic, falls back to manual indent
- MarkdownPreview code block rendering fixed via CSS selectors in scribe.styl

## Task Commits

1. **Task 1: Add code_block and blockquote to flattenTokens + buildAndInject** - `d9936ba53` (feat)
2. **Task 2: Checkpoint feedback — dark colors, quote style detection, MarkdownPreview fix** - `f5bf28c63` (feat)

## Files Created/Modified
- `plugins/onlyoffice-scribe/scripts/code.js` - code_block + blockquote in flattenTokens & callCommand, quote style detection
- `src/modules/views/OnlyOffice/Scribe/MarkdownPreview.jsx` - Simplified to use CSS for code block rendering
- `src/modules/views/OnlyOffice/Scribe/scribe.styl` - Added scribe-md-preview rules for pre > code

## Decisions Made
- Dark background for code blocks (matches IDE look, user preference)
- Quote style priority: "Intense Quote" first (more visually distinct than plain "Quote")
- MarkdownPreview: CSS-only approach for code blocks — react-markdown v10 doesn't expose block/inline distinction on code component

## Deviations from Plan
- Plan specified light gray (230,230,230) for code blocks — changed to dark (40,44,52) per user feedback
- Plan specified SetIndLeft(720) for blockquotes — enhanced with OO predefined style detection
- MarkdownPreview code block fix was unplanned but necessary for result panel display

## Issues Encountered
- react-markdown v10 removes `inline` prop from code component — CSS selectors (pre > code vs :not(pre) > code) solved it
- CSS modules hash class names — nested `& pre` syntax in stylus required for descendant selectors

## Next Phase Readiness
- code_block and blockquote types established in the if/else chain — plan 21-02 adds table type in the same chain
- No blockers for table implementation

---
*Phase: 21-blocs-etendus*
*Completed: 2026-03-20*
