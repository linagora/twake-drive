# Project Research Summary

**Project:** Scribe v2.1 -- Rich Text Formatting Preservation
**Domain:** AI writing assistant plugin for OnlyOffice within Cozy Drive (3-layer iframe architecture)
**Researched:** 2026-03-06
**Confidence:** MEDIUM-HIGH

## Executive Summary

Scribe v2.1 adds rich text formatting preservation to the existing AI writing assistant. The core challenge is shuttling formatted text through a 5-stage pipeline: OO document model extraction, conversion to Markdown (the LLM's native format), LLM processing, Markdown preview in the result panel, and formatted reinsertion back into OO. Research uncovered two viable architectural approaches and several critical risks that must be validated before building begins.

The recommended approach is **HTML-based extraction via `initDataType: "html"` with conversion libraries (turndown, marked) in the React app**, falling back to **Document Builder API extraction via `callCommand`** if the HTML approach fails with background-type plugins. This "thin plugin, smart host" pattern keeps the ES5-constrained plugin minimal while leveraging the React app's full build pipeline for conversion logic. The only new npm dependencies are `react-markdown` (~12KB gzip), `remark-gfm` (~2KB), `turndown` (~14KB), and `marked` (~12KB) -- a total of ~40KB gzip for the complete pipeline. If the Document Builder fallback is needed, turndown and marked are dropped in favor of custom ES5 serializers (~200 lines), and only `react-markdown` + `remark-gfm` are added.

The primary risks are: (1) `initDataType: "html"` is untested with background-type plugins and requires a 10-minute go/no-go validation before any other work begins; (2) OO-generated HTML uses inline styles rather than semantic tags, requiring a normalizer layer for Turndown; (3) `PasteHtml` has a confirmed bug with ordered list numbering (OO defect #79263); and (4) LLMs routinely corrupt Markdown formatting markers, requiring prompt engineering and output post-processing. All four risks have documented mitigation strategies.

## Key Findings

### Recommended Stack

The v2.1 stack builds on the existing v2.0 foundation (React 18, MUI, cozy-ui, OO plugin ES5, postMessage protocol). No framework changes. Two new npm packages are required; two more are conditionally required based on the extraction approach chosen.

**Core technologies (both approaches):**
- `react-markdown` ^10.1.0: Render Markdown in ScribeResultPanel -- safe (no dangerouslySetInnerHTML), ~12KB gzip, supports custom MUI-themed components
- `remark-gfm` ^4.0.1: GFM extension for tables, strikethrough in preview -- required for table rendering in result panel

**Conditional (HTML approach only):**
- `turndown` ^7.2.x: HTML-to-Markdown conversion -- runs in React app, ~14KB gzip, handles OO's HTML output with custom rules
- `marked` ^15.x: Markdown-to-HTML for reinsertion via PasteHtml -- ~12KB gzip, single function call

**No new dependencies (Document Builder approach):**
- Custom ES5 serializer (~80 lines) using `ApiRange.GetAllParagraphs()`, `ApiRun.GetBold/GetItalic/GetText()` for extraction
- Custom ES5 parser (~120 lines) using `Api.CreateParagraph()`, `Api.CreateRun()`, `SetBold()`, `SetItalic()` for reinsertion
- All OO Document Builder APIs confirmed available in OO 9.3.0

**Not recommended:** MDXEditor (100-400KB for unused editing), unified/remark-stringify (over-engineered AST for bounded Markdown subset), Clipboard API (unreliable across iframe boundaries), OOXML manipulation (fragile, undocumented for plugins).

### Expected Features

**Must have (table stakes):**
- Rich text extraction from OO (HTML or Document Builder approach)
- HTML/Markdown bidirectional conversion pipeline
- Markdown preview rendering in result panel (react-markdown)
- Formatted reinsertion via PasteHtml or InsertContent
- Bold, italic, heading, list round-trip preservation
- Paragraph structure preservation through the pipeline
- HTML transport through existing postMessage protocol
- "Insert After" adaptation for formatted content

**Should have (differentiators):**
- Table formatting round-trip (GFM pipe tables)
- Link preservation through the pipeline
- Code block/inline code round-trip
- Graceful fallback to plain text on extraction failure
- Styled Markdown preview matching Scribe MUI theme
- Strip unsupported elements (images, math) before conversion

**Defer:**
- Editable Markdown in result panel -- read-only preview is sufficient
- Custom font/color/size preservation -- Markdown has no concept of these
- Streaming Markdown rendering -- non-streaming in v2.1
- Diff view between original and result -- visual comparison is adequate
- Image extraction/reinsertion -- LLMs cannot process images in text context
- Track changes integration -- creates confusing revision semantics

### Architecture Approach

The architecture follows a "thin plugin, smart host" pattern: the ES5 plugin handles only extraction and reinsertion (OO API calls), while all conversion logic lives in the Cozy Drive React app. Markdown is the canonical format throughout the pipeline -- HTML exists only at the edges (extraction input, reinsertion output). The protocol adds optional `html` fields to existing intent payloads (additive, no version bump, backward compatible).

**Major components:**
1. **Plugin config.json + code.js** -- Extraction (initDataType "html" or callCommand), reinsertion (PasteHtml or InsertContent), HTML class stripping
2. **htmlToMarkdown.js (NEW)** -- Turndown wrapper, pure function, ~30 LOC; or eliminated if using Document Builder extraction
3. **markdownToHtml.js (NEW)** -- Marked wrapper, pure function, ~20 LOC; or eliminated if using Document Builder reinsertion
4. **ScribeResultPanel.jsx** -- Replaces plain text display with react-markdown rendering
5. **scribeAI.js** -- System prompt updated to instruct Markdown preservation
6. **View.jsx** -- Converts Markdown to HTML (or structured JSON) in handleReplace/handleInsert response handlers

**Key patterns:** Dual-field payloads for graceful degradation (always send both `text` and `html`). Conversion modules as pure functions (testable, no React coupling). Store canonical format only (Markdown for results, HTML for input), convert on demand.

### Critical Pitfalls

1. **`initDataType: "html"` untested with background plugins** -- The official HTML plugin example uses panel-type plugins. Background plugins may silently fall back to plain text. This is a go/no-go gate: test in the first 10 minutes of Phase 1. Fallback: Document Builder API extraction via callCommand.

2. **OO HTML is inline-style soup, not semantic HTML** -- OO exports `<span style="font-weight:bold">` instead of `<strong>`. Turndown will not recognize inline styles without custom rules or a normalizer. Must build against real OO output, not assumptions.

3. **PasteHtml ordered list bug (OO #79263)** -- All `<ol><li>` items render as "1." via PasteHtml. Workaround: use Document Builder API (`CreateNumbering("numbered")`) for ordered lists. Test in OO 9.3.0-138 first -- may be patched.

4. **LLM corrupts Markdown formatting** -- Unbalanced markers, stripped bold, heading level drift, escaped syntax. Requires format-preserving system prompt instructions, output validation, and post-processing for common mistakes. This is ongoing, not a one-time fix.

5. **callCommand sandbox blocks libraries** -- No DOMParser, no require, no modern JS inside callCommand. All library-based conversion must happen in Cozy Drive React context or in the plugin iframe (but plugin iframe is ES5-only, so effectively all conversion happens in React).

## Implications for Roadmap

Based on research, the v2.1 milestone should be structured as 4 phases following the data flow. Each phase is independently testable.

### Phase 1: API Validation and Go/No-Go Gates
**Rationale:** Two critical unknowns must be resolved before any pipeline code is written. Building on unvalidated assumptions risks a full rewrite.
**Delivers:** Confirmed extraction and reinsertion approach, documented OO HTML output format, PasteHtml test matrix.
**Addresses:** Feature 1 (extraction), Feature 5 (reinsertion), Feature 7 (protocol)
**Avoids:** Pitfall 1 (initDataType with background plugin), Pitfall 3 (PasteHtml ordered list bug), Pitfall 2 (inline-style HTML)
**Tasks:**
- Test `initDataType: "html"` with background plugin type (10 min)
- If fails: validate Document Builder extraction via callCommand
- Log real OO HTML output for bold, italic, headings, lists, tables
- Test PasteHtml with `<strong>`, `<em>`, `<h1>`-`<h6>`, `<ul>`, `<ol>`, `<table>`, `<a>`
- Decide: HTML approach (turndown/marked) or Document Builder approach (custom ES5)
- Update protocol: add `html` field to intent payloads

### Phase 2: Conversion Pipeline
**Rationale:** With the extraction/reinsertion approach confirmed, build the conversion chain. This is the lowest-risk work (pure functions, established libraries or straightforward ES5 code).
**Delivers:** Working HTML-to-Markdown and Markdown-to-HTML conversion, updated system prompt.
**Uses:** turndown + marked (HTML approach) OR custom ES5 serializer/parser (Document Builder approach)
**Implements:** htmlToMarkdown module, markdownToHtml module (or equivalent callCommand functions), HTML normalizer for OO's inline-style output
**Avoids:** Pitfall 2 (semantic HTML normalization), Pitfall 4 (LLM formatting corruption via prompt), Pitfall 11 (empty paragraph handling)

### Phase 3: Preview and UI
**Rationale:** The result panel must show formatted Markdown before users can evaluate AI output. This is standard React rendering work with known libraries.
**Delivers:** Markdown-rendered result panel with MUI-themed styling, copy-raw-Markdown button.
**Uses:** react-markdown, remark-gfm, scribe-markdown.styl
**Addresses:** Feature 3 (preview), D5 (copy raw MD), D6 (themed preview)
**Avoids:** Pitfall 12 (XSS -- use react-markdown, never dangerouslySetInnerHTML), Pitfall 9 (perf -- React.memo, lazy load)

### Phase 4: Integration, Insert-After, and Edge Cases
**Rationale:** Full pipeline integration, the "Insert After" adaptation, format round-trip validation, and graceful degradation for unsupported content.
**Delivers:** Complete working pipeline, insert-after for formatted content, plain-text fallback, round-trip test coverage.
**Addresses:** Feature 6 (insert-after), Features 8-11 (format round-trips), D1 (tables), D2 (links), D3 (code), D4 (fallback), D7 (strip unsupported)
**Avoids:** Pitfall 5 (lossy tables/merged cells -- define supported subset), Pitfall 8 (payload size -- log sizes, set limits), Pitfall 10 (PasteHtml vs InsertContent -- hybrid approach), Pitfall 14 (RTL text)

### Phase Ordering Rationale

- Phase 1 must come first because the extraction approach is a go/no-go gate that determines whether to use HTML libraries or custom ES5 code. Building phases 2-4 before this decision wastes effort.
- Phase 2 before Phase 3 because the conversion pipeline produces the Markdown that the preview renders. The preview can be developed with hardcoded Markdown but integration-tested only after conversion works.
- Phase 3 before Phase 4 because users need to see the formatted preview to validate the pipeline. Insert-after and edge cases are polish on a working foundation.
- Each phase is independently committable. Phase 2 can be developed with hardcoded HTML test strings (not dependent on Phase 1 for dev, only for integration).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Needs `/gsd:research-phase` -- the `initDataType: "html"` + background plugin combination is undocumented and empirical validation gates the entire architecture. PasteHtml bug status in OO 9.3.0-138 is unknown.
- **Phase 2:** May need research if Document Builder fallback is chosen -- the custom ES5 Markdown parser needs careful design for inline formatting (nested bold+italic, adjacent runs).

Phases with standard patterns (skip research-phase):
- **Phase 3:** Well-documented. react-markdown integration is straightforward React component work with established patterns.
- **Phase 4:** Standard integration testing and edge case handling. No novel technical challenges.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommended libraries are mature (react-markdown, turndown, marked). OO Document Builder APIs confirmed in official docs for v9.3.0. Only uncertainty: which approach (HTML vs Document Builder) will be used. |
| Features | MEDIUM-HIGH | Table stakes and differentiators well-defined. Pipeline stages clear. One tension: STACK.md and FEATURES.md recommend different extraction approaches (Document Builder vs HTML). Phase 1 resolves this. |
| Architecture | HIGH | "Thin plugin, smart host" pattern proven by existing v2.0 code. Component boundaries clear. Protocol changes are additive. Both approaches (HTML and Document Builder) have documented architecture. |
| Pitfalls | HIGH | 14 pitfalls identified with concrete prevention strategies. Critical pitfalls have go/no-go tests. PasteHtml bug confirmed with OO tracking number. LLM formatting corruption is well-documented industry-wide. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **initDataType + background plugin compatibility:** Must be empirically validated in Phase 1. No documentation exists for this combination. 10-minute test gates the architecture.
- **OO 9.3.0-138 PasteHtml bug status:** The ordered list bug (OO #79263) may or may not be fixed in our version. Must test before choosing reinsertion strategy.
- **OO HTML output format specifics:** The exact HTML format (inline styles vs semantic tags, heading representation, list structure) must be captured from real OO output in our version. Research provides general patterns but exact output varies by version.
- **LLM formatting fidelity baseline:** No quantitative data on how well the current LLM (via cozy-stack proxy) preserves Markdown formatting. Need to establish a baseline (target: 8/10 operations preserve formatting) and tune prompts accordingly.
- **Approach divergence between researchers:** STACK.md recommends custom ES5 serializer/parser (Document Builder, no turndown/marked), while FEATURES.md and ARCHITECTURE.md recommend HTML extraction with turndown/marked. Phase 1 validation resolves which approach to use. Both are viable; the HTML approach is simpler if it works.

## Sources

### Primary (HIGH confidence)
- [OO Plugin Configuration (initDataType)](https://api.onlyoffice.com/docs/plugin-and-macros/structure/configuration/)
- [OO GetSelectedContent API](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/GetSelectedContent/)
- [OO PasteHtml API](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/PasteHtml/)
- [OO Get and Paste HTML Plugin Example](https://api.onlyoffice.com/samples/docs/plugin-and-macros/plugin-samples/get-and-paste-html/)
- [OO Document Builder API (ApiParagraph, ApiRun, ApiRange)](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/)
- [OO callCommand documentation](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/)
- [react-markdown](https://github.com/remarkjs/react-markdown)
- [turndown](https://github.com/mixmark-io/turndown)
- [marked](https://github.com/markedjs/marked)

### Secondary (MEDIUM confidence)
- [OO Community: Retaining formatting with AI responses](https://community.onlyoffice.com/t/best-practices-for-retaining-formatting-when-pasting-ai-responses-in-onlyoffice/12811) -- confirms PasteHtml approach, documents ordered list bug #79263
- [OO Community: GetSelectedText HTML format](https://community.onlyoffice.com/t/getselectedtext-html-format-paste-via-context-menu/8733) -- confirms initDataType recommendation
- [OO API Updates December 2025](https://www.onlyoffice.com/blog/2025/12/api-updates-december-2025) -- expanded API methods

### Tertiary (LOW confidence)
- [LLM Markdown output quality analysis](https://medium.com/@CultmanSachs/why-cant-ai-models-output-clean-markdown-a-technical-mess-that-still-isn-t-fixed-1dc70ff366a3) -- general patterns, not model-specific

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
