# Technology Stack: Document Builder API Injection

**Project:** Scribe v2.4 -- Document Builder Injection
**Researched:** 2026-03-15
**Overall confidence:** HIGH (official OO API docs verified)

**Scope:** NEW stack additions only for the Builder API injection milestone. Existing v2.3 stack (React 18, MUI v4, cozy-ui, twake-i18n, postMessage protocol, OO Plugin API, Turndown, marked, react-markdown) is validated and not re-researched.

---

## Recommended Stack

### No New Dependencies

This milestone adds zero npm packages or external libraries. Everything is built with:
- OO Document Builder API (already available inside `callCommand`)
- ES5 regex patterns (inline code in plugin)
- Existing `Asc.scope` data passing mechanism (already in use)

---

## Core: OO Document Builder API (inside callCommand)

The Builder API is available as global objects inside any `callCommand` callback. The existing codebase already uses `Api.GetDocument()`, `Api.CreateParagraph()`, `doc.InsertContent()`, and `doc.GetRangeBySelect()` (see `insertAfterWithText` at line 190 and `pasteHtml` at line 102 of code.js).

### Global `Api` Factory Methods

| Method | Returns | Purpose |
|--------|---------|---------|
| `Api.GetDocument()` | `ApiDocument` | Access the current document |
| `Api.CreateParagraph()` | `ApiParagraph` | Create a new empty paragraph |
| `Api.CreateRun()` | `ApiRun` | Create a new empty text run |
| `Api.CreateTable(cols, rows)` | `ApiTable` | Create table with specified dimensions |
| `Api.CreateImage(src, widthEMU, heightEMU)` | `ApiImage` | Create image from URL or Base64. Dimensions in EMU |
| `Api.CreateHyperlink(url, display, tooltip)` | `ApiHyperlink` | Create hyperlink text block |
| `Api.CreateNumbering(sType)` | `ApiNumbering` | Create numbering. `sType`: `"bullet"` (default) or `"numbered"` |
| `Api.CreateColorFromRGB(r, g, b)` | `ApiRGBColor` | Create color for text/shading |
| `Api.CreateSolidFill(color)` | `ApiFill` | Create solid fill for shapes |
| `Api.CreateNoFill()` | `ApiFill` | Empty fill |

### ApiDocument -- Document Manipulation

| Method | Returns | Purpose |
|--------|---------|---------|
| `InsertContent(arrContent, isInline, oPr)` | `boolean` | Insert array of elements at current cursor/selection. `arrContent`: `DocumentElement[]`. `isInline`: `boolean` (default false). `oPr`: `{ "KeepTextOnly": true }` optional |
| `GetRangeBySelect()` | `ApiRange \| null` | Get range of current selection |
| `GetRange(start, end)` | `ApiRange` | Get range by character positions |
| `Push(element)` | `boolean` | Append paragraph or table to end of document |
| `GetElement(idx)` | `DocumentElement` | Get element by position |
| `GetBookmarkRange(name)` | `ApiRange \| null` | Get range of a named bookmark |
| `CreateNumbering(sType)` | `ApiNumbering` | Same as Api.CreateNumbering (aliased) |
| `Search(query)` | `ApiRange[]` | Search document for text, returns array of ranges |
| `CreateNewHistoryPoint()` | `boolean` | Create undo checkpoint |
| `AddElement(idx, element)` | `boolean` | Insert element at specific position |
| `RemoveElement(idx)` | `boolean` | Remove element at position |

### ApiParagraph -- Paragraph Creation & Formatting

| Method | Returns | Purpose |
|--------|---------|---------|
| `AddText(text)` | `ApiRun` | Add text, returns the created run |
| `AddElement(element)` | `boolean` | Add a run or other inline element |
| `AddHyperlink(url, tooltip, bookmark)` | `ApiHyperlink` | Add hyperlink. Use `SetDisplayedText()` on result to set visible text |
| `AddLineBreak()` | `ApiRun` | Insert line break (soft return) |
| `SetBold(bool)` | `ApiParagraph` | Bold for all text in paragraph |
| `SetItalic(bool)` | `ApiParagraph` | Italic for all text in paragraph |
| `SetUnderline(bool)` | `ApiParagraph` | Underline for all text |
| `SetStrikeout(bool)` | `ApiParagraph` | Strikethrough for all text |
| `SetFontSize(halfPts)` | `ApiParagraph` | Font size in half-points (24 = 12pt) |
| `SetFontFamily(name)` | `ApiParagraph` | Font family for all 4 slots |
| `SetColor(r, g, b)` | `ApiParagraph` | Text color |
| `SetHighlight(color)` | `ApiParagraph` | Background highlight |
| `SetStyle(style)` | `boolean` | Apply named style (e.g. heading) |
| `SetJc(jc)` | `boolean` | Justification: `"left"`, `"center"`, `"right"`, `"both"` |
| `SetNumbering(numLevel)` | `boolean` | Apply numbering level from ApiNumberingLevel |
| `SetIndFirstLine(twips)` | `boolean` | First line indent |
| `SetIndLeft(twips)` | `boolean` | Left indent |
| `SetIndRight(twips)` | `boolean` | Right indent |
| `SetSpacingBefore(twips)` | `boolean` | Space before paragraph |
| `SetSpacingAfter(twips)` | `boolean` | Space after paragraph |
| `GetElement(idx)` | `ParagraphContent` | Get inline element by position |
| `GetElementsCount()` | `number` | Count of inline elements |
| `RemoveAllElements()` | `boolean` | Clear paragraph content |
| `Delete()` | `boolean` | Delete paragraph from document |
| `Copy()` | `ApiParagraph` | Clone paragraph |
| `Search(query)` | `ApiRange[]` | Search within paragraph |
| `AddDrawing(image)` | — | Add image/shape to paragraph |

### ApiRun -- Inline Text with Per-Run Formatting

This is the critical object for mixed formatting (e.g., "Hello **world** and *italic*").

| Method | Returns | Purpose |
|--------|---------|---------|
| `AddText(text)` | `boolean` | Add text to this run |
| `SetBold(bool)` | `ApiTextPr` | Bold this run only |
| `SetItalic(bool)` | `ApiTextPr` | Italic this run only |
| `SetUnderline(bool)` | `ApiTextPr` | Underline this run only |
| `SetStrikeout(bool)` | `ApiTextPr` | Strikethrough |
| `SetDoubleStrikeout(bool)` | `ApiTextPr` | Double strikethrough |
| `SetFontSize(halfPts)` | `ApiTextPr` | Font size (half-points) |
| `SetFontFamily(name)` | `ApiTextPr` | Font family |
| `SetColor(r, g, b)` | `ApiTextPr` | Text color |
| `SetHighlight(color)` | `ApiTextPr` | Background highlight |
| `SetSmallCaps(bool)` | `ApiTextPr` | Small caps |
| `SetCaps(bool)` | `ApiTextPr` | All caps |
| `SetVertAlign(align)` | `ApiTextPr` | `"superscript"`, `"subscript"`, `"baseline"` |
| `AddLineBreak()` | `boolean` | Line break within run |
| `AddTabStop()` | `boolean` | Tab character |
| `GetText()` | `string` | Get run's text content |
| `Copy()` | `ApiRun` | Clone run |
| `Delete()` | `boolean` | Remove run |

**Pattern for mixed formatting in one paragraph:**
```javascript
// ES5 inside callCommand
var p = Api.CreateParagraph();
var r1 = Api.CreateRun();
r1.AddText("Hello ");
p.AddElement(r1);

var r2 = Api.CreateRun();
r2.SetBold(true);
r2.AddText("bold");
p.AddElement(r2);

var r3 = Api.CreateRun();
r3.SetItalic(true);
r3.AddText(" italic");
p.AddElement(r3);
```

### ApiTable / ApiTableRow / ApiTableCell -- Table Construction

| Object | Method | Returns | Purpose |
|--------|--------|---------|---------|
| `ApiTable` | `GetRow(idx)` | `ApiTableRow` | Get row by index |
| `ApiTable` | `GetCell(row, col)` | `ApiTableCell` | Get cell directly |
| `ApiTable` | `SetWidth("twips", value)` | `boolean` | Table width. Also `"auto"`, `"percent"` |
| `ApiTable` | `SetJc(jc)` | `boolean` | Table alignment |
| `ApiTable` | `SetTableBorderTop/Bottom/Left/Right(type, size, space, r, g, b)` | `boolean` | Table borders |
| `ApiTable` | `SetTableBorderInsideH/V(...)` | `boolean` | Internal borders |
| `ApiTable` | `MergeCells(cellsArray)` | `ApiTableCell` | Merge cells |
| `ApiTableRow` | `GetCell(idx)` | `ApiTableCell` | Get cell in row |
| `ApiTableRow` | `GetCellsCount()` | `number` | Cell count |
| `ApiTableRow` | `SetHeight(twips, rule)` | — | Row height |
| `ApiTableRow` | `SetTableHeader(bool)` | — | Mark as repeating header |
| `ApiTableCell` | `GetContent()` | `ApiDocumentContent` | Content container |
| `ApiTableCell` | `SetWidth("twips", value)` | — | Cell width |
| `ApiTableCell` | `SetShd(type, r, g, b)` | — | Cell background |
| `ApiTableCell` | `SetVerticalAlign(align)` | — | `"top"`, `"center"`, `"bottom"` |

**Pattern for populating table cells:**
```javascript
// ES5 inside callCommand
var table = Api.CreateTable(3, 2); // 3 cols, 2 rows
var cell = table.GetCell(0, 0);    // row 0, col 0
var content = cell.GetContent();
var p = content.GetElement(0);     // cells come with one empty paragraph
p.AddText("Header 1");
p.SetBold(true);
```

### ApiNumbering -- List Creation

```javascript
// ES5 inside callCommand
var doc = Api.GetDocument();
var bulletNum = doc.CreateNumbering("bullet");
var numLvl0 = bulletNum.GetLevel(0);  // top-level bullets
var numLvl1 = bulletNum.GetLevel(1);  // nested bullets (levels 0-7)

var p = Api.CreateParagraph();
p.AddText("First bullet");
p.SetNumbering(numLvl0);

var p2 = Api.CreateParagraph();
p2.AddText("Nested bullet");
p2.SetNumbering(numLvl1);
```

### ApiRange -- Selection & Post-Insertion Positioning

| Method | Returns | Purpose |
|--------|---------|---------|
| `Select()` | `boolean` | Set document selection to this range |
| `GetText()` | `string` | Get text content |
| `GetStartPos()` | `number` | Start character position |
| `GetEndPos()` | `number` | End character position |
| `SetStartPos(pos)` | `boolean` | Adjust start |
| `SetEndPos(pos)` | `boolean` | Adjust end |
| `AddBookmark(name)` | — | Create named bookmark on range |
| `Delete()` | `boolean` | Delete range content |
| `GetParagraph()` | `ApiParagraph` | Get paragraph in range |
| `AddText(text)` | `boolean` | Add text at range position |
| `MoveCursorToPos(pos)` | `boolean` | Move cursor within range |

### ApiHyperlink -- Hyperlink Configuration

| Method | Returns | Purpose |
|--------|---------|---------|
| `SetDisplayedText(text)` | — | Set visible link text |
| `SetLink(url)` | — | Set URL |
| `SetScreenTipText(tip)` | — | Set tooltip |
| `GetRange()` | `ApiRange` | Get range of hyperlink |
| `SetDefaultStyle()` | — | Apply default hyperlink style |

---

## Markdown Parser: Custom ES5 Regex (inside callCommand)

**Decision: Write a custom regex-based Markdown-to-Builder parser. No external libraries.**

### Why Custom

1. The `callCommand` sandbox requires ES5 -- no `const`, `let`, arrow functions, module imports
2. External libraries cannot be loaded inside `callCommand` (no `require`, no `import`, no script tags)
3. The parser output is Builder API calls, not HTML. No existing library produces this format
4. The Markdown subset from LLM output is constrained: no need for full CommonMark compliance
5. Parsing + building in a single `callCommand` = single undo point

### Architecture: Two-Phase Inside One callCommand

**Phase A -- Parse Markdown string to block/inline token array:**

```javascript
// ES5 regex-based tokenizer
// Input: Asc.scope.markdown (string)
// Output: array of block tokens with inline runs

// Block-level regex patterns (applied line-by-line):
// ^#{1,6}\s+(.+)           -> heading (level = # count)
// ^(\s*)[-*+]\s+(.+)       -> bullet item (indent -> level)
// ^(\s*)\d+\.\s+(.+)       -> numbered item
// ^>\s+(.+)                 -> blockquote
// ^```(\w*)                 -> code block start
// ^```                      -> code block end
// ^---+$  or  ^***+$        -> horizontal rule
// ^\|.+\|$                  -> table row
// ^!\[(.+?)\]\((.+?)\)     -> image (block-level)
// (anything else)           -> paragraph

// Inline-level regex patterns (applied to text content):
// \*\*\*(.+?)\*\*\*        -> bold+italic
// \*\*(.+?)\*\*            -> bold
// \*(.+?)\*                -> italic
// ~~(.+?)~~                -> strikethrough
// `(.+?)`                  -> inline code
// \[(.+?)\]\((.+?)\)       -> link
// !\[(.+?)\]\((.+?)\)      -> inline image
```

**Phase B -- Walk tokens, emit Builder API calls:**

```javascript
// Reads token array, creates ApiParagraph/ApiRun/ApiTable objects
// Collects into content[] array
// Calls doc.InsertContent(content)
```

### Supported Markdown Elements (Priority Order)

| Priority | Element | Builder API Approach |
|----------|---------|---------------------|
| P0 | **Bold** `**text**` | `run.SetBold(true)` |
| P0 | **Italic** `*text*` | `run.SetItalic(true)` |
| P0 | **Bold+Italic** `***text***` | `run.SetBold(true); run.SetItalic(true)` |
| P0 | **Paragraph** (plain text) | `Api.CreateParagraph()` + `AddText()` |
| P1 | **Heading 1-6** `# text` | `paragraph.SetBold(true)` + `paragraph.SetFontSize(size)` where H1=32, H2=28, H3=26, H4=24, H5=22, H6=20 (half-points) |
| P1 | **Bullet list** `- item` | `doc.CreateNumbering("bullet")` + `paragraph.SetNumbering(level)` |
| P1 | **Numbered list** `1. item` | `doc.CreateNumbering("numbered")` + `paragraph.SetNumbering(level)` |
| P1 | **Inline code** `` `code` `` | `run.SetFontFamily("Courier New"); run.SetFontSize(20)` |
| P2 | **Link** `[text](url)` | `paragraph.AddHyperlink(url, "")` then `hyperlink.SetDisplayedText(text)` |
| P2 | **Code block** ` ```lang ``` ` | Monospace font per-run + optional gray paragraph background |
| P2 | **Blockquote** `> text` | `paragraph.SetIndLeft(720)` (0.5 inch) + gray text color |
| P2 | **Strikethrough** `~~text~~` | `run.SetStrikeout(true)` |
| P3 | **Table (GFM)** | `Api.CreateTable(cols, rows)`, populate cells via `GetCell().GetContent().GetElement(0).AddText()` |
| P3 | **Horizontal rule** `---` | Empty paragraph with reduced spacing or bottom border |
| P3 | **Image** `![alt](url)` | `Api.CreateImage(src, w, h)` + `paragraph.AddDrawing(img)`. Width/height require defaults (e.g., 200x150px -> EMU) |

### Why NOT Parse Outside callCommand

Considered parsing in plugin iframe (modern JS) and passing AST via `Asc.scope`:
- **Rejected because:** Two-step approach (parse outside, build inside) risks partial state if the callCommand fails between steps. A single callCommand = single undo point. Also, `Asc.scope` serialization of deep instruction trees is fragile (OO uses structured clone, which may not handle complex nested objects reliably).
- **Parser size estimate:** ~150-250 lines of ES5. Small enough to live inside the callCommand function body.

---

## Post-Insertion Selection: Sentinel Marker Strategy

**Decision: Use zero-width sentinel characters to bracket injected content, then Search + Select.**

### Why Not Bookmarks

Bookmarks via `AddBookmark`/`GetBookmarkRange` require first having a range of the inserted content -- but `InsertContent` does not return the range of what it inserted. This is a chicken-and-egg problem. Community reports confirm this limitation.

### Sentinel Strategy (PRIMARY)

```javascript
// ES5 inside callCommand
var SENTINEL_START = "\u200B\u200C"; // zero-width space + zero-width non-joiner
var SENTINEL_END = "\u200C\u200B";   // reversed pair (unique in document)

// 1. Prepend sentinel to first run of first paragraph
// 2. Append sentinel to last run of last paragraph
// 3. Call InsertContent(content)
// 4. Search for sentinels:
var startRanges = doc.Search(SENTINEL_START);
var endRanges = doc.Search(SENTINEL_END);
// 5. Compute selection range from startRange[0].GetStartPos() to endRange[0].GetEndPos()
var selRange = doc.GetRange(
  startRanges[0].GetStartPos(),
  endRanges[0].GetEndPos()
);
selRange.Select();
// 6. Clean up sentinels (delete the zero-width chars)
startRanges[0].Delete();
// Re-search end sentinel (positions shifted after delete)
var endRanges2 = doc.Search(SENTINEL_END);
if (endRanges2.length > 0) endRanges2[0].Delete();
```

**Confidence: MEDIUM.** The sentinel approach is theoretically sound but depends on:
- `doc.Search()` finding zero-width characters (needs testing)
- `ApiRange.Delete()` removing just the sentinel without affecting surrounding content
- Position recalculation after delete being correct

### Fallback: Position Counting

If sentinels fail, use character position arithmetic:
1. Before InsertContent, record `selEnd = range.GetEndPos()`
2. After InsertContent, new content occupies positions starting at `selStart` (for replace mode) or `selEnd` (for insert mode)
3. Calculate total character length of injected content from the markdown
4. Select range `[insertStart, insertStart + totalLength]`

**Confidence: LOW.** InsertContent may not preserve linear character positions, especially with tables/images.

---

## Units Reference

| Unit | Used For | Conversion |
|------|----------|-----------|
| **half-points** | `SetFontSize()` | 24 = 12pt, 28 = 14pt, 32 = 16pt |
| **twips** | Spacing, indentation, table widths | 1 inch = 1440 twips, 1 pt = 20 twips |
| **EMU** | Image dimensions (`CreateImage`) | 1 inch = 914400 EMU, 1 cm = 360000 EMU, 1 px ~= 9525 EMU |
| **width type** | `SetWidth()` first param | `"twips"`, `"auto"`, `"percent"` |

---

## Integration Pattern

### Data Flow

```
React panel (markdown result string)
  -> postMessage response to plugin iframe
    -> plugin sets Asc.scope.markdown = markdownString
    -> plugin sets Asc.scope._mode = "replace" | "insert"
    -> pasteInProgress = true; stopHidePolling();
      -> callCommand (single call, single undo point):
           1. If mode === "insert": collapse cursor to end of selection
           2. Parse markdown to block tokens (ES5 regex)
           3. Walk tokens, build ApiParagraph/ApiRun/ApiTable objects
           4. Inject sentinel markers at boundaries
           5. doc.InsertContent(content)
           6. Search sentinels, compute range, Select
           7. Clean up sentinels
      -> callback: pasteInProgress = false
```

### Asc.scope Contract

```javascript
// Set before callCommand:
Asc.scope.markdown = "**bold** and *italic*\n\n- bullet 1\n- bullet 2";
Asc.scope._mode = "replace";  // "replace" | "insert"

// Inside callCommand, access via:
var md = Asc.scope.markdown;
var mode = Asc.scope._mode;
```

### Backward Compatibility

The existing `pasteHtml()` function remains as a fallback. If Builder API injection fails (e.g., unsupported content), the system falls back to PasteHtml. The new builder function (`buildAndInsert()`) is called instead of `pasteHtml()` in the response handler, with PasteHtml as the error fallback.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| MD parser location | Inside callCommand (ES5) | Plugin iframe (modern JS) + Asc.scope AST | Breaks single-undo-point guarantee; Asc.scope deep serialization fragile |
| MD parser impl | Custom ES5 regex | snarkdown / slimdown | Produce HTML not Builder API instructions; would need HTML-to-Builder converter |
| MD parser impl | Custom ES5 regex | commonmark.js | ~30KB, ES6 syntax, cannot load in callCommand |
| MD parser impl | Custom ES5 regex | marked.js | Already used in React side for preview, but outputs HTML not Builder calls |
| Selection | Sentinel markers | Bookmarks | Chicken-and-egg: need range to create bookmark, but InsertContent doesn't return range |
| Selection | Sentinel markers | Position arithmetic | InsertContent position behavior is unreliable per community reports |
| Injection | Builder API | PasteHtml (current) | No per-element control, no post-paste selection, no image/table fidelity |

---

## Sources

- [OnlyOffice Text Document API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/) -- HIGH confidence
- [ApiParagraph methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/) -- HIGH confidence
- [ApiRun methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRun/) -- HIGH confidence
- [ApiDocument methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/) -- HIGH confidence
- [ApiTable methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiTable/) -- HIGH confidence
- [ApiRange methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRange/) -- HIGH confidence
- [ApiTableCell methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiTableCell/) -- HIGH confidence
- [ApiHyperlink methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiHyperlink/) -- HIGH confidence
- [InsertContent signature](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/InsertContent/) -- HIGH confidence
- [CreateNumbering](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/CreateNumbering/) -- HIGH confidence
- [CreateTable](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/Api/Methods/CreateTable/) -- HIGH confidence
- [CreateImage](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/Api/Methods/CreateImage/) -- HIGH confidence
- [How to call commands](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/) -- HIGH confidence
- [AddBookmark](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRange/Methods/AddBookmark/) -- HIGH confidence
- [GetBookmarkRange](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/GetBookmarkRange/) -- HIGH confidence
- [Community: retrieving inserted content](https://community.onlyoffice.com/t/issue-in-retrieving-newly-created-paragraph-element/10415) -- MEDIUM confidence
- [Community: cursor positioning after insert](https://community.onlyoffice.com/t/how-to-position-the-cursor-caret-after-inserted-inline-contentcontrol/1423) -- MEDIUM confidence

---
*Stack research for: v2.4 Document Builder Injection*
*Researched: 2026-03-15*
