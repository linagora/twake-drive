# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.1 — Formatage Riche

**Shipped:** 2026-03-09
**Phases:** 4 | **Plans:** 6

### What Was Built
- HTML extraction from OO selections with class stripping and graceful fallback
- Bidirectional HTML↔Markdown conversion pipeline (Turndown + marked)
- Markdown rendering in result panel (react-markdown + remark-gfm, theme-aware)
- PasteHtml rich text reinsertion with smart spacing and backward compat
- Full formatting round-trip: bold, italic, headings, lists, tables, code blocks survive OO→LLM→OO

### What Worked
- "Thin plugin, smart host" pattern — keeping conversion logic in React (where libraries are available) and only calling OO APIs from the plugin
- TDD approach for scribeConversion.js — tests caught edge cases early (img rule override, marked ESM import)
- UAT at the end confirmed everything works end-to-end, caught no regressions
- Phase sequencing was clean — each phase built on the previous with clear handoff points

### What Was Inefficient
- Post-paste selection research consumed time but all approaches failed with PasteHtml — should have been deferred earlier
- SUMMARY.md was not generated during initial execution (missing workflow step) — had to backfill

### Patterns Established
- HTML+text dual payload pattern: respond() sends both fields for backward compat
- Smart spacing: check adjacent characters before injecting nbsp
- Regex class stripping for OO HTML (ES5 compatible, no DOMParser in plugin sandbox)
- unwrapSingleParagraph for inline paste without wrapping p tags

### Key Lessons
1. OO plugin sandbox is extremely limited — plan for ES5 + no DOMParser from the start
2. PasteHtml is good enough for basic rich text but has limitations (ordered list bug, no selection control) — Document Builder API needed for complex scenarios
3. Conversion pipeline should always have fallback paths — graceful degradation is critical for production

### Cost Observations
- Sessions: ~4-5
- Notable: v2.1 was efficient — 3 days for a complete rich text pipeline, most time in research/validation rather than implementation

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 6 | 10 | Initial GSD workflow, mock AI |
| v2.0 | 3 | 5 | Faster execution, real API integration |
| v2.1 | 4 | 6 | TDD pattern, UAT verification, research-first approach |

### Top Lessons (Verified Across Milestones)

1. Research phases pay off — understanding OO APIs and limitations before coding prevents rework
2. Fallback patterns are essential — every feature needs a degradation path
3. "Thin plugin, smart host" — minimize code in constrained environments (OO plugin ES5 sandbox)
