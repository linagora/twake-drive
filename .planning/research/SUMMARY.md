# Project Research Summary

**Project:** Scribe v2.4 -- Document Builder API Injection
**Domain:** Rich content injection via OnlyOffice Document Builder API in plugin callCommand
**Researched:** 2026-03-15
**Confidence:** MEDIUM-HIGH

## Executive Summary

Scribe v2.4 replaces the current PasteHtml injection path with OnlyOffice's Document Builder API, executed inside `callCommand`. This gives element-level control over every paragraph, run, table, and list -- enabling format preservation, post-injection selection, and proper table rendering that PasteHtml cannot achieve. The approach requires zero new npm dependencies: everything is built with the OO Builder API globals (`Api.CreateParagraph`, `Api.CreateRun`, `Api.CreateTable`, etc.) already available inside `callCommand`, plus a custom ES5 Markdown parser (~150-250 lines) that runs in the same sandbox.

The recommended architecture is "parse outside, build inside": tokenize the LLM's Markdown output in the plugin iframe (where modern JS is available), serialize the token array through `Asc.scope`, then interpret tokens as Builder API calls inside a single `callCommand`. This preserves the single-undo-point guarantee that users expect. A format snapshot captured before the LLM round-trip provides document styling defaults (font, size, color, alignment) that Markdown cannot represent, applied via a "fusion" strategy where snapshot values are defaults and Markdown formatting is additive overrides.

The primary risks are: (1) the callCommand sandbox is ES5-only with no DOM APIs, making parser bugs silent and hard to debug; (2) post-injection selection remains unreliable due to a known OO limitation where `InsertContent` does not return references to inserted elements; and (3) table formatting may be stripped by `InsertContent`. All three are mitigable -- the first by parsing outside the sandbox, the second by deferring selection to a late phase using a sentinel-marker strategy, and the third by explicitly setting all table properties. The existing PasteHtml path must be preserved as a fallback throughout the migration.

## Key Findings

### Recommended Stack

No new dependencies are needed. The entire milestone is built with OO's built-in Document Builder API (available as globals inside `callCommand`) and ES5 regex patterns for Markdown parsing. The existing stack (React 18, MUI v4, cozy-ui, Turndown, marked, react-markdown) remains unchanged.

**Core technologies:**
- **OO Document Builder API** (inside callCommand): Element-level content construction -- `Api.CreateParagraph()`, `Api.CreateRun()`, `Api.CreateTable()`, `Api.CreateNumbering()`, `doc.InsertContent()` -- all verified against official OO docs
- **Custom ES5 Markdown tokenizer**: Converts LLM Markdown output to a JSON instruction set; must be ES5 because callCommand runs in an isolated sandbox with no module system
- **Asc.scope data bridge**: Passes serialized token arrays and format snapshots from plugin iframe to callCommand sandbox -- already proven in existing code
- **Sentinel marker strategy** (for post-injection selection): Zero-width characters inserted as boundary markers, found via `doc.Search()`, then deleted -- MEDIUM confidence, needs empirical validation

### Expected Features

**Must have (table stakes):**
- Markdown-to-Builder token pipeline (ES5 parser + callCommand interpreter)
- Inline formatting: bold, italic, bold+italic, strikethrough, code spans
- Paragraph separation as distinct OO paragraphs
- Headings H1-H6 via SetStyle or SetFontSize+SetBold
- Bullet and numbered lists via CreateNumbering
- Hyperlinks via AddHyperlink
- Single undo point (all operations in one callCommand)
- Smart spacing at injection boundaries
- PasteHtml fallback on any Builder API failure

**Should have (differentiators -- why we are migrating):**
- Post-injection selection (select the exact range of injected content)
- GFM tables as proper OO tables with column structure
- Nested list indentation (multi-level numbering)

**Defer (v2.5+):**
- Code blocks with monospace formatting
- Blockquotes with left border/indent
- Horizontal rules
- Image injection (CreateImage has known reliability issues inside callCommand; LLM does not return images)
- Syntax highlighting (OO has no API for this)
- Streaming injection (breaks single undo point)
- Preserving per-run original formatting (too fragile when LLM restructures text)

### Architecture Approach

The architecture adds four new ES5 components to `code.js`, all running inside `callCommand`: a format snapshot extractor (captures original document styling before LLM round-trip), a Markdown parser (tokenizes LLM output into a JSON AST), a Builder content generator (walks the AST and emits Builder API calls with fusion of snapshot defaults + MD overrides), and a post-injection selector (sentinel markers + Search). The format snapshot stays in `code.js` (never round-tripped through React), and `View.jsx` sends raw Markdown instead of HTML to the plugin.

**Major components:**
1. **Format Snapshot Extractor** (`code.js`, ES5) -- Captures paragraph properties (alignment, spacing, indent) and dominant run style (font, size, color) from selected text before LLM round-trip
2. **Markdown Parser** (`code.js` or plugin context, ES5) -- Tokenizes LLM Markdown into a flat JSON instruction array; handles paragraphs, inline formatting, headings, lists, links, tables
3. **Builder Content Generator** (`code.js`, inside callCommand) -- Interprets token array, creates ApiParagraph/ApiRun/ApiTable objects, applies format fusion, calls `doc.InsertContent()`
4. **Post-Injection Selector** (`code.js`, inside or after callCommand) -- Inserts sentinel zero-width chars at content boundaries, uses `doc.Search()` to find them, selects range, removes markers

### Critical Pitfalls

1. **callCommand sandbox has no DOM APIs** -- Parser must not use DOMParser, document, window, require, or any browser/Node API. Parse Markdown OUTSIDE callCommand, pass instruction set via Asc.scope. Getting this wrong means a full rewrite.
2. **Multiple callCommand calls = multiple undo points** -- ALL content creation and InsertContent must happen in a single callCommand. The existing two-step pattern (read-only prep + single modification) is correct. Never split insertion across multiple modifying callCommands.
3. **ES5-only inside callCommand** -- No const/let, no arrow functions, no template literals, no destructuring, no for...of, no Array.includes. The Markdown interpreter will be the most complex callCommand code in the plugin; ES6 slips are easy and failures are silent.
4. **Post-insertion selection is unreliable** -- InsertContent does not return references to inserted elements. GetRange/Select fails immediately after InsertContent. Use sentinel markers + Search as workaround, and defer this to a late phase.
5. **Redo is broken after callCommand** -- Confirmed OO bug (March 2025, still unfixed). No workaround exists. Accept and document this limitation.

## Implications for Roadmap

Based on research, the milestone naturally splits into 6 phases with clear dependency ordering.

### Phase 1: Token Pipeline + Minimal Builder Injection
**Rationale:** This is the foundational architecture decision. If the parse-outside-build-inside pattern works, everything else builds on it. If it fails, we need to know immediately.
**Delivers:** End-to-end proof that Markdown text goes through tokenizer, Asc.scope, callCommand, Builder API, InsertContent, and appears in the document with bold/italic formatting.
**Addresses:** Table stakes 1-4 (parser, inline formatting, paragraphs), table stake 9 (single undo), table stake 11 (PasteHtml fallback)
**Avoids:** Pitfall 1 (sandbox constraints), Pitfall 2 (Asc.scope limits), Pitfall 3 (multiple undo points), Pitfall 5 (ES5 constraint), Pitfall 15 (CreateRun vs AddText), Pitfall 17 (pasteInProgress guard)

### Phase 2: Format Snapshot + Fusion
**Rationale:** Format preservation is the second-most-important capability after basic injection. Without it, inserted text loses the document's font/size/color -- a visible regression from PasteHtml which inherits surrounding styles. Must come before extended MD support so all subsequent content types benefit.
**Delivers:** Original document formatting (font family, font size, color, alignment, spacing) preserved through the LLM round-trip via dominant-style fusion.
**Addresses:** Table stake 10 (smart spacing), Pitfall 12 (paragraph properties lost)
**Avoids:** Pitfall 6 (selection state management during prep callCommand)

### Phase 3: Extended Markdown Support
**Rationale:** With the pipeline proven and format fusion working, extend the parser to cover all common LLM output structures. These are independent of each other and can be implemented incrementally.
**Delivers:** Headings, bullet lists, numbered lists, links, inline code -- all rendered as proper OO elements, not plain text.
**Addresses:** Table stakes 5-8 (headings, lists, links), differentiator D3 (nested lists)
**Avoids:** Pitfall 9 (LLM output quirks), Pitfall 13 (OO ordered list bug)

### Phase 4: Tables
**Rationale:** Tables are the highest-complexity content type and the highest-value differentiator over PasteHtml. They depend on inline formatting (for cell content) being solid, so they come after Phase 3.
**Delivers:** GFM Markdown tables rendered as proper OO tables with correct column structure, header row styling, and explicit borders.
**Addresses:** Differentiator D2 (tables with column structure)
**Avoids:** Pitfall 10 (table width/formatting loss after InsertContent)

### Phase 5: Post-Injection Selection
**Rationale:** This is the primary differentiator but has the highest uncertainty. It depends on all content types being insertable (so sentinels bracket the full content). Deferring it ensures core injection is not blocked by selection research.
**Delivers:** After Replace/Insert, the injected content range is selected (highlighted) in the document.
**Addresses:** Differentiator D1 (post-injection selection)
**Avoids:** Pitfall 7 (GetRange/Select fails after InsertContent) -- uses sentinel workaround instead

### Phase 6: Polish + Edge Cases
**Rationale:** Code blocks, blockquotes, horizontal rules are low-value features that round out the implementation. Smart spacing refinements and fallback hardening belong here.
**Delivers:** Code blocks with monospace font, blockquotes with indent/border, horizontal rules, refined spacing logic, robust error handling.
**Addresses:** Differentiators D4-D6, remaining edge cases
**Avoids:** Pitfall 11 (premature PasteHtml removal) -- only remove fallback after all content types verified

### Phase Ordering Rationale

- **Dependency chain:** Parser (Phase 1) -> Format fusion (Phase 2) -> Extended tokens (Phase 3) -> Tables (Phase 4). Each phase builds on the previous; no phase can be skipped or reordered.
- **Risk-first:** Phase 1 validates the riskiest architectural decision (parse outside, build inside, single callCommand). Phase 2 validates format capture via Builder API getter methods. Both are validated before investing in feature breadth.
- **Differentiators last:** Post-injection selection (Phase 5) has the lowest confidence and highest research debt. Deferring it means the core milestone ships even if selection proves infeasible.
- **Pitfall avoidance:** The phase structure ensures PasteHtml fallback is maintained throughout (Pitfall 11), ES5 compliance is established in Phase 1 (Pitfall 5), and single-undo-point is architecturally guaranteed from the start (Pitfall 3).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Validate that `Asc.scope` reliably passes medium-sized token arrays (~50 tokens). Validate that a single callCommand can execute 50+ Builder API calls without timeout.
- **Phase 2:** Empirically test `ApiRun.GetColor()`, `ApiRun.GetFontSize()`, `ApiRun.GetFontFamily()` return types inside callCommand -- docs are ambiguous on whether they return primitives or API objects.
- **Phase 4:** Test `InsertContent` behavior with mixed content arrays (paragraphs + tables). Verify table formatting survives InsertContent. Test ordered list bug (#79263) with Builder API.
- **Phase 5:** Test sentinel zero-width character search via `doc.Search()`. Test `ApiRange.Delete()` on zero-width characters. This phase may need a spike before planning.

Phases with standard patterns (skip deep research):
- **Phase 3:** Headings, lists, links are well-documented Builder API patterns with official examples. Standard implementation.
- **Phase 6:** Code blocks, blockquotes, horizontal rules are cosmetic paragraph formatting -- straightforward SetFontFamily/SetIndLeft/SetBottomBorder calls.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all Builder API methods verified against official OO docs |
| Features | MEDIUM | API surface is clear, but post-injection selection and table formatting through InsertContent have known limitations |
| Architecture | MEDIUM-HIGH | Parse-outside-build-inside pattern is sound; format snapshot fusion is well-designed but getter method return types need empirical validation |
| Pitfalls | HIGH | Grounded in existing code analysis, official docs, confirmed OO bugs, and community reports |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **GetColor/GetFontSize return types:** Do ApiRun getter methods return primitives or API objects inside callCommand? Needs a quick spike in Phase 2. If they return objects, the snapshot extractor needs adaptation.
- **Asc.scope payload size limit:** No documented limit. Test with realistic payloads (a full page of formatted Markdown, ~100 tokens) early in Phase 1.
- **InsertContent with mixed content arrays:** Does OO handle paragraphs interleaved with tables correctly? Needs empirical validation in Phase 4.
- **Sentinel character searchability:** Can `doc.Search()` find zero-width Unicode characters? If not, Phase 5 needs a different marker strategy. Consider a spike before Phase 5 planning.
- **OO ordered list bug (#79263):** Does this affect Builder API lists the same way it affects PasteHtml lists? Test in Phase 3 before building full list support.
- **Redo bug after callCommand:** Upstream OO bug, no fix available. Document as known limitation.

## Sources

### Primary (HIGH confidence)
- [OnlyOffice Text Document API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/) -- Full Builder API reference
- [OnlyOffice callCommand documentation](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/) -- Sandbox constraints, Asc.scope, callback protocol
- [OnlyOffice InsertContent API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/InsertContent/) -- Parameters, isInline, KeepTextOnly
- [OnlyOffice Plugin Tips & Pitfalls (Jan 2026)](https://www.onlyoffice.com/blog/2026/01/creating-onlyoffice-plugins-tips-tricks-and-hidden-pitfalls) -- Payload size warnings, precompute guidance
- [OnlyOffice API method references](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRun/) -- ApiRun, ApiParagraph, ApiTable, ApiRange, ApiHyperlink

### Secondary (MEDIUM confidence)
- [OO Community: post-insertion element retrieval](https://community.onlyoffice.com/t/issue-in-retrieving-newly-created-paragraph-element/10415) -- Search workaround for post-insertion selection
- [OO Community: redo bug after callCommand](https://community.onlyoffice.com/t/can-not-redo-after-execute-connectors-callcommand-method/12614) -- Confirmed bug, registered by OO team
- [OO Community: cursor positioning after insert](https://community.onlyoffice.com/t/how-to-position-the-cursor-caret-after-inserted-inline-contentcontrol/1423) -- Position tracking limitations
- [OO Community: inconsistent image insertion](https://community.onlyoffice.com/t/inconsistent-image-insertion-issue-in-onlyoffice-plugin-for-word-documents/5833) -- CreateImage timing issues

### Tertiary (LOW confidence)
- Sentinel marker strategy for post-injection selection -- Theoretically sound but untested with zero-width characters in OO Search API
- Position counting fallback for selection -- Community reports suggest InsertContent does not preserve linear character positions

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*
