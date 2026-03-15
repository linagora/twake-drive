# Feature Landscape: v2.4 Document Builder API Injection

**Domain:** Rich content injection via OnlyOffice Document Builder API in plugin callCommand
**Milestone:** v2.4 -- replacing PasteHtml with Builder API for element-level control
**Researched:** 2026-03-15
**Confidence:** MEDIUM -- API surface is well-documented, but post-insertion selection and image handling inside callCommand have known limitations confirmed by community reports.

---

## Existing Foundation (Already Shipped, Must Not Break)

These components form the pipeline that Builder API injection replaces or extends.

| Component | Status | Relevance to v2.4 |
|-----------|--------|-------------------|
| `pasteHtml()` in code.js -- PasteHtml with smart spacing | Shipped v2.1 | **Being replaced.** Builder API injection replaces PasteHtml for the primary path. PasteHtml becomes fallback. |
| `insertAfterWithText()` in code.js -- InsertContent with CreateParagraph/AddText | Shipped v1.0 | **Proof of concept.** Already uses Builder API pattern (CreateParagraph + AddText + InsertContent). No formatting. |
| `scribeConversion.js` -- htmlToMarkdown / markdownToHtml pipeline | Shipped v2.1 | **Upstream dependency.** LLM receives Markdown, returns Markdown. Builder API parser consumes Markdown (not HTML). |
| `normalizeHtml()` -- OO HTML cleanup for Turndown | Shipped v2.1 | **Stays for extraction side.** Still needed to normalize OO's HTML before sending to LLM via Turndown. |
| Smart spacing detection (callCommand reading adjacent chars) | Shipped v2.1 | **Pattern reusable.** Same technique works: read adjacent chars in first callCommand, build content in second. |
| `Asc.scope` data passing into callCommand | Shipped v1.0 | **Critical constraint.** All data (Markdown string, metadata) must pass through Asc.scope as serializable values. No functions, no objects with methods. |

---

## Table Stakes

Features that must work for Builder API injection to be viable. Missing any means the injection quality is worse than the current PasteHtml approach.

| # | Feature | Why Expected | Complexity | Dependencies | Notes |
|---|---------|--------------|------------|--------------|-------|
| 1 | **Markdown-to-Builder parser (ES5)** | Core of the milestone. Converts Markdown AST into Document Builder API calls (CreateParagraph, CreateRun, AddText, SetBold, etc.) inside callCommand. Must be ES5 (no arrow functions, no const/let, no template literals) because it runs in the OO plugin sandbox. | HIGH | Markdown tokenizer that runs in ES5 context. Cannot use `marked` (ES6 module). Need a simple recursive-descent parser or pre-tokenize in React side and pass token array via Asc.scope. | **Key design decision:** parse Markdown in the plugin (ES5 tokenizer) OR pre-tokenize in React (use marked's lexer) and pass structured tokens via Asc.scope. Pre-tokenizing is strongly recommended -- avoids duplicating a Markdown parser in ES5. |
| 2 | **Inline formatting: bold, italic, bold+italic** | The LLM routinely returns `**bold**`, `*italic*`, and `***bold+italic***`. These must survive injection as actual OO formatting. Currently works via PasteHtml -- Builder API must match. | MEDIUM | Parser (feature 1). ApiRun.SetBold(true), ApiRun.SetItalic(true), paragraph.AddElement(run). | ApiRun.SetBold/SetItalic return ApiTextPr (not ApiRun), so **method chaining breaks**. Pattern: `var run = Api.CreateRun(); run.SetBold(true); run.AddText("text"); para.AddElement(run, pos);` |
| 3 | **Inline formatting: strikethrough, code spans** | LLM returns `~~strikethrough~~` and `` `code` ``. Must render correctly. | LOW | ApiRun.SetStrikeout(true) for strikethrough. Code spans: SetFontFamily("Courier New") + SetShd() for background highlight. | Code span background may not render perfectly -- SetShd on a run is the closest approximation. Acceptable degradation. |
| 4 | **Paragraph separation** | Multiple paragraphs must insert as separate OO paragraphs, not as a single block with line breaks. | LOW | Each Markdown paragraph token becomes a separate Api.CreateParagraph() in the content array passed to InsertContent. | Straightforward -- the existing insertAfterWithText already does this with split("\n"). |
| 5 | **Headings** | LLM can return `# Heading` through `###### Heading`. Must inject with correct heading style. | LOW | ApiParagraph.SetStyle() with OO's built-in heading styles ("Heading 1" through "Heading 6"). | Style names are locale-independent in the API ("Heading 1" not "Titre 1"). |
| 6 | **Bullet lists (unordered)** | LLM returns `- item` lists frequently. Must inject as proper OO bullet lists, not as plain text with dashes. | MEDIUM | Api.CreateNumbering("bullet") on the document, then paragraph.SetNumbering(level) for each list item. Nesting requires setting the correct level index. | CreateNumbering returns a numbering object. GetLevel(n) retrieves each level. paragraph.SetNumbering(numberingLevel) applies it. Nested lists use higher level indices. |
| 7 | **Numbered lists (ordered)** | LLM returns `1. item` lists. Must inject as proper OO numbered lists. | MEDIUM | Api.CreateNumbering("numbered") -- same pattern as bullet lists but with numbered type. | Same complexity as bullet lists. Share the numbering creation logic with a type parameter. |
| 8 | **Links (hyperlinks)** | LLM returns `[text](url)` links. Must inject as clickable OO hyperlinks. | LOW | ApiParagraph.AddHyperlink(url, text) returns ApiHyperlink. | Simple API call. One of the easier features. |
| 9 | **Single undo point** | All injected content must be undoable with a single Ctrl+Z. The current PasteHtml achieves this. Builder API must match. | LOW | A single callCommand call with all InsertContent operations inside it. callCommand executes atomically -- one undo point per call. | **Confirmed by existing behavior:** the current insertAfterWithText uses one callCommand with InsertContent and produces one undo point. |
| 10 | **Smart spacing (before/after injected content)** | Injected content must not create double spaces or missing spaces at boundaries with existing document text. | MEDIUM | Same two-step pattern as current pasteHtml: first callCommand reads adjacent chars, callback builds content with leading/trailing spaces if needed, second callCommand inserts. | The first/last paragraph's first/last run gets a prepended/appended space character instead of the HTML &nbsp; approach. More precise than PasteHtml. |
| 11 | **Fallback to PasteHtml** | If Builder API injection fails (e.g., unsupported Markdown construct, API error), gracefully fall back to the existing PasteHtml path. | LOW | Try/catch around Builder API callCommand. On error, invoke existing pasteHtml(). | Ensures no regression during progressive rollout. |

---

## Differentiators

Features that go beyond what PasteHtml can do. These are the reasons for migrating to Builder API.

| # | Feature | Value Proposition | Complexity | Dependencies | Notes |
|---|---------|-------------------|------------|--------------|-------|
| D1 | **Post-injection selection** | Select the exact range of injected content after insertion. PasteHtml cannot do this (OO returns inconsistent cursor positions -- confirmed in phase13 research). Builder API can track the position because we know exactly how many paragraphs/runs we created. | HIGH | After InsertContent, use doc.GetRange(startPos, endPos).Select() OR use the Search method to find injected content and select it. The Search workaround is recommended by OO community. | **This is the primary differentiator.** Two approaches: (A) Track character count during building, compute range positions, select. (B) Insert a unique marker string, Search for it, select the range, remove the marker. Approach B is more reliable given OO's position tracking quirks. |
| D2 | **Tables with column structure** | Inject Markdown tables as proper OO tables with columns, rows, and cell content. PasteHtml handles tables but loses column widths and formatting. Builder API gives full control. | HIGH | Api.CreateTable(cols, rows), table.GetRow(n).GetCell(n), cell content via GetContent().GetElement(0).AddText(). Table borders via SetTableBorder* methods. | Tables are the second-hardest content type after images. Column width can be set with SetWidth("twip", value) or left as auto-width. Header row can be styled with SetBold. |
| D3 | **Nested list indentation** | Properly nested lists (indentation levels > 1). PasteHtml sometimes flattens nested lists. Builder API controls nesting via numbering levels. | MEDIUM | CreateNumbering with GetLevel(depth) for each nesting depth. Markdown parser must track nesting. | Nesting depth maps directly to numbering level index. Level 0 = top, Level 1 = first indent, etc. |
| D4 | **Code blocks with monospace formatting** | Multi-line code blocks rendered with monospace font and optional background shading. PasteHtml renders these poorly. | MEDIUM | Each line as a paragraph with SetFontFamily("Courier New"). Optional: SetShd() for background color. No syntax highlighting (OO limitation). | Language identifier from fenced code blocks (```js) is ignored -- OO has no syntax highlighting API. |
| D5 | **Blockquotes with visual indicator** | `> quoted text` rendered with left indent and/or left border. PasteHtml strips blockquote formatting. | LOW-MEDIUM | SetIndLeft(720) for indentation (720 twips = 0.5 inch). Optional: SetLeftBorder("single", 4, 0, blueR, blueG, blueB) for a visual indicator. | Purely cosmetic but meaningful for LLM outputs that include quotes. |
| D6 | **Horizontal rules** | `---` rendered as a visual separator. | LOW | Insert a paragraph with a bottom border: SetBottomBorder("single", 4, 0, 0, 0, 0). Or insert an empty paragraph with a line. | Minor feature but easy to implement. |

---

## Anti-Features

Features that seem useful but should be explicitly avoided for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Image injection via CreateImage** | CreateImage requires a URL or Base64 string. Images in the original document are referenced by OO-internal blob URLs that are not accessible from the plugin sandbox. The community reports "inconsistent image insertion" (cross marks, timing issues) when using CreateImage with fetched URLs inside callCommand. The LLM does not return images -- it returns text. | Strip images during Markdown extraction (already done by Turndown's stripImages rule). If future milestone needs image preservation, it requires a separate extraction-and-reinsertion pipeline outside the LLM round-trip. |
| **Preserving original document styles (font size, font family, color)** | The LLM output is new text with semantic formatting (bold/italic). Trying to map original document styles onto LLM output creates a fragile heuristic (which parts of the new text correspond to which parts of the old text?). | Use KeepTextOnly option in InsertContent to inherit the surrounding paragraph's default text properties. New content gets the document's default font/size automatically. Only semantic formatting (bold/italic/etc.) is applied explicitly. |
| **Syntax highlighting in code blocks** | OO has no syntax highlighting API. Building a custom highlighter (colorizing tokens via SetColor on individual runs) would be extremely complex, fragile, and slow for large code blocks. | Monospace font only. Users who need syntax highlighting use dedicated tools. |
| **HTML-to-Builder conversion (bypassing Markdown)** | Building a full HTML DOM parser in ES5 for the plugin sandbox is unreasonably complex. The LLM returns Markdown, not HTML. | Parse Markdown tokens (either pre-tokenized in React via marked.lexer or a minimal ES5 tokenizer in the plugin). HTML is only used on the extraction side (OO -> Turndown -> Markdown -> LLM). |
| **Streaming injection (progressive rendering)** | Injecting content progressively as the LLM streams would require multiple InsertContent calls, breaking the single-undo-point guarantee and creating flicker. | Wait for complete LLM response (already the v2.0 approach), then inject once. Streaming deferred to v3.x. |
| **Complex table features (merged cells, colored cells, borders per cell)** | GFM Markdown tables cannot represent merged cells or per-cell styling. The LLM will never output these. Building support for them is wasted effort. | Simple tables only: uniform columns, text content in cells, optional bold header row. |

---

## Feature Dependencies

```
Markdown tokenizer (in React via marked.lexer OR in ES5 in plugin)
    |
    v
Asc.scope token array (serialized)
    |
    v
callCommand Builder function (ES5, in plugin)
    |-- reads tokens from Asc.scope
    |-- creates paragraphs, runs, tables, lists
    |-- calls InsertContent([...elements])
    |
    +-- Inline formatting (bold/italic/strikethrough/code)
    |       requires: CreateRun, SetBold, SetItalic, SetStrikeout, SetFontFamily
    |
    +-- Paragraphs / Headings
    |       requires: CreateParagraph, SetStyle, AddText
    |
    +-- Lists (bullet + numbered)
    |       requires: CreateNumbering, GetLevel, SetNumbering
    |       depends on: paragraph creation
    |
    +-- Tables
    |       requires: CreateTable, GetRow, GetCell, GetContent, AddText
    |       depends on: inline formatting (for cell content)
    |
    +-- Links
    |       requires: AddHyperlink
    |       depends on: paragraph creation
    |
    +-- Post-injection selection (D1)
    |       requires: doc.Search() or doc.GetRange().Select()
    |       depends on: all content being inserted first
    |
    +-- Smart spacing
            requires: adjacent char detection (existing pattern)
            depends on: token array (to prepend/append space to first/last text)

Fallback: pasteHtml() (existing, unchanged)
    triggered on: Builder API error, unsupported token type
```

### Dependency Notes

- **Tokenizer strategy is the critical design decision.** Pre-tokenizing in React (using marked.lexer) avoids writing an ES5 Markdown parser. The token array is JSON-serializable and passes through Asc.scope cleanly. This is the recommended approach.
- **Inline formatting is the foundation.** Every other feature (lists, tables, headings) builds on the ability to create formatted runs inside paragraphs.
- **Lists and tables are independent of each other.** Can be implemented in any order. Tables are higher complexity but higher value (PasteHtml handles them poorly).
- **Post-injection selection depends on everything else.** It must run after all content is inserted. Should be the last feature implemented.
- **Smart spacing is orthogonal.** Same two-callCommand pattern as current implementation. Can be added at any point.

---

## MVP Definition

### Must Have for v2.4 (Table Stakes 1-11)

- [ ] **Markdown-to-Builder token pipeline** -- pre-tokenize in React, pass via Asc.scope, interpret in ES5 callCommand
- [ ] **Inline formatting** -- bold, italic, bold+italic, strikethrough, code spans
- [ ] **Paragraphs** -- separate OO paragraphs per Markdown paragraph
- [ ] **Headings** -- H1-H6 via SetStyle
- [ ] **Bullet lists** -- unordered lists with proper numbering object
- [ ] **Numbered lists** -- ordered lists with proper numbering object
- [ ] **Links** -- clickable hyperlinks via AddHyperlink
- [ ] **Single undo point** -- one callCommand, one Ctrl+Z
- [ ] **Smart spacing** -- no double/missing spaces at injection boundaries
- [ ] **PasteHtml fallback** -- graceful degradation on error

### Add After Validation (v2.4.x)

- [ ] **Post-injection selection (D1)** -- search-based selection of injected content
- [ ] **Tables (D2)** -- proper OO tables from GFM Markdown tables
- [ ] **Nested list indentation (D3)** -- multi-level bullet/numbered lists

### Future Consideration

- [ ] **Code blocks (D4)** -- monospace formatting for fenced code blocks
- [ ] **Blockquotes (D5)** -- indented paragraphs with left border
- [ ] **Horizontal rules (D6)** -- visual separators

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Token pipeline (parser) | CRITICAL | HIGH | P0 |
| Bold / italic / bold+italic | HIGH | MEDIUM | P1 |
| Paragraphs | HIGH | LOW | P1 |
| Headings | MEDIUM | LOW | P1 |
| Bullet lists | HIGH | MEDIUM | P1 |
| Numbered lists | HIGH | MEDIUM | P1 |
| Links | MEDIUM | LOW | P1 |
| Single undo point | HIGH | LOW (inherent) | P1 |
| Smart spacing | HIGH | MEDIUM | P1 |
| PasteHtml fallback | HIGH (safety net) | LOW | P1 |
| Post-injection selection | HIGH (differentiator) | HIGH | P2 |
| Tables | HIGH (differentiator) | HIGH | P2 |
| Nested list indentation | MEDIUM | MEDIUM | P2 |
| Code blocks | LOW-MEDIUM | MEDIUM | P3 |
| Blockquotes | LOW | LOW-MEDIUM | P3 |
| Horizontal rules | LOW | LOW | P3 |

---

## Progressive Implementation Order

Based on dependencies and risk:

**Phase A: Token Pipeline + Inline Basics**
1. Pre-tokenize Markdown using marked.lexer in React side
2. Pass token array via Asc.scope to callCommand
3. ES5 token interpreter: paragraphs + plain text + bold + italic
4. Wire up InsertContent with fallback to PasteHtml on error

**Phase B: Block Elements**
5. Headings (SetStyle)
6. Bullet lists (CreateNumbering "bullet")
7. Numbered lists (CreateNumbering "numbered")
8. Links (AddHyperlink)
9. Smart spacing (two-callCommand pattern)

**Phase C: Complex Content**
10. Tables (CreateTable, cell population, auto-width)
11. Nested lists (multi-level numbering)
12. Code blocks, blockquotes, horizontal rules

**Phase D: Selection + Polish**
13. Post-injection selection (Search-based approach)
14. Edge case handling, fallback refinement

---

## Key API Patterns (Reference)

### Creating a formatted paragraph with mixed runs

```
// ES5 inside callCommand
var para = Api.CreateParagraph();

// Bold run
var boldRun = Api.CreateRun();
boldRun.SetBold(true);
boldRun.AddText("bold text");
para.AddElement(boldRun);

// Normal run
var normalRun = Api.CreateRun();
normalRun.AddText(" normal text");
para.AddElement(normalRun);

// Italic run
var italicRun = Api.CreateRun();
italicRun.SetItalic(true);
italicRun.AddText(" italic");
para.AddElement(italicRun);
```

### Creating a bullet list

```
// ES5 inside callCommand
var doc = Api.GetDocument();
var numbering = doc.CreateNumbering("bullet");
var level0 = numbering.GetLevel(0);

var item1 = Api.CreateParagraph();
item1.AddText("First item");
item1.SetNumbering(level0);

var item2 = Api.CreateParagraph();
item2.AddText("Second item");
item2.SetNumbering(level0);
```

### Creating a table

```
// ES5 inside callCommand
var table = Api.CreateTable(3, 2); // 3 cols, 2 rows
table.SetWidth("percent", 100);

var headerRow = table.GetRow(0);
var cell = headerRow.GetCell(0);
var cellPara = cell.GetContent().GetElement(0);
cellPara.AddText("Header 1");
cellPara.SetBold(true);
```

### InsertContent (replaces selection)

```
// ES5 inside callCommand
var doc = Api.GetDocument();
doc.InsertContent([para1, para2, table, para3]);
```

---

## Sources

- [OnlyOffice: How to call commands](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/) -- callCommand signature, Asc.scope, callback -- HIGH confidence
- [OnlyOffice: InsertContent](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/InsertContent/) -- parameters, isInline, KeepTextOnly -- HIGH confidence
- [OnlyOffice: Inserting text sample](https://api.onlyoffice.com/docs/office-api/samples/text-document-editor/inserting-text-into-a-document/) -- CreateParagraph, AddText, SetBold, SetItalic chaining -- HIGH confidence
- [OnlyOffice: Creating formatted table sample](https://api.onlyoffice.com/docs/office-api/samples/text-document-editor/creating-formatted-table/) -- CreateTable, GetRow, GetCell, SetWidth -- HIGH confidence
- [OnlyOffice: Creating auto-width table](https://api.onlyoffice.com/docs/office-api/samples/text-document-editor/creating-auto-width-table/) -- table borders, cell population -- HIGH confidence
- [OnlyOffice: ApiParagraph methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/) -- full method list -- HIGH confidence
- [OnlyOffice: ApiRun methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRun/) -- SetBold returns ApiTextPr, not ApiRun -- HIGH confidence
- [OnlyOffice: CreateImage](https://api.onlyoffice.com/officeapi/textdocumentapi/api/createimage) -- URL/Base64 only, EMU units -- HIGH confidence
- [OnlyOffice: CreateNumbering](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/CreateNumbering/) -- bullet/numbered types -- HIGH confidence
- [OnlyOffice Community: Text styling inline](https://community.onlyoffice.com/t/text-styling-e-g-bold-inline-in-paragraph-with-text-document-api/11500) -- CreateRun is the official answer for mixed formatting -- MEDIUM confidence
- [OnlyOffice Community: Retrieving paragraph after InsertContent](https://community.onlyoffice.com/t/issue-in-retrieving-newly-created-paragraph-element/10415) -- Search workaround for post-insertion selection -- MEDIUM confidence
- [OnlyOffice Community: Inconsistent image insertion](https://community.onlyoffice.com/t/inconsistent-image-insertion-issue-in-onlyoffice-plugin-for-word-documents/5833) -- CreateImage timing issues in callCommand -- MEDIUM confidence
- [OnlyOffice Blog: Plugin tips and pitfalls (Jan 2026)](https://www.onlyoffice.com/blog/2026/01/creating-onlyoffice-plugins-tips-tricks-and-hidden-pitfalls) -- keep commands short, no fetch inside callCommand, precompute data -- HIGH confidence
- [OnlyOffice: ApiRange Select](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRange/Methods/Select/) -- range selection API -- HIGH confidence

---
*Feature research for: v2.4 Document Builder API Injection*
*Researched: 2026-03-15*
