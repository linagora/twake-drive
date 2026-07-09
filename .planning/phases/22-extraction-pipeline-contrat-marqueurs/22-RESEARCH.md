# Phase 22: Extraction Pipeline et Contrat Marqueurs - Research

**Researched:** 2026-03-20
**Domain:** OnlyOffice Document Builder API -- selection scanning, markdown generation, marker contract
**Confidence:** HIGH

## Summary

Phase 22 replaces the current HTML-based extraction pipeline (OO `initDataType: "html"` -> `htmlToMarkdown()` in Scribe React) with a new plugin-side extraction pipeline that runs inside `callCommand` and produces enriched markdown directly from the OO document model. This is the foundational phase for the v2.5 complex objects milestone.

The current flow sends raw HTML from OO to Scribe, which then converts it to markdown via Turndown. The new flow will have the plugin's `callCommand` walk the selected paragraphs using the Document Builder API (`GetRangeBySelect` -> `GetAllParagraphs` -> enumerate runs/drawings/tables), build markdown with normalized markers for images and table cells, and send this enriched markdown to Scribe instead of HTML.

**Primary recommendation:** Build a `selectionToMarkdown()` function inside `callCommand` (ES5) that walks paragraphs from the selection range, emits markdown for text/inline formatting, and inserts marker tokens for images (`![IMG:id]` / `{{IMG:id}}`) and table cells (`[CELL:r,c]...[/CELL]`). Run this pre-scan proactively on every selection change (replacing the current `initDataType: "html"` approach). Scribe React receives enriched markdown directly -- no more `htmlToMarkdown()` conversion needed for the LLM prompt.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXTR-01 | Le plugin OO scanne la selection via callCommand et produit du markdown enrichi avec marqueurs | Plan 22-01 builds `selectionToMarkdown()` inside callCommand using Builder API (GetRangeBySelect, GetAllParagraphs, paragraph element enumeration) |
| EXTR-04 | Le pre-scan s'execute a chaque selection (proactivement) et envoie le markdown enrichi a Scribe | Replace `initDataType: "html"` with callCommand-based pre-scan in `init()`, send enriched markdown via SHOW_SCRIBE_BUTTON intent |
| MARK-01 | Scribe definit une syntaxe pour les images bloc (`![IMG:id](placeholder)`) et inline (`{{IMG:id}}`) | Marker contract defined in this research -- images detected via `GetAllDrawingObjects()` on paragraphs, named with `SetName()` |
| MARK-02 | Scribe definit une syntaxe pour les cellules tableau (`[CELL:r,c]texte[/CELL]`) | Marker contract defined in this research -- tables detected as document elements, cells enumerated via `GetRowsCount()`/`GetCellsCount()`/`GetCell()` |
</phase_requirements>

## Architecture Patterns

### Current vs New Extraction Flow

**Current flow (v2.4):**
```
OO selection change
  -> init(data)  [initDataType: "html", data = raw OO HTML]
  -> GetSelectedText  [plain text for button display]
  -> castIntent(AI_TEXT_ASSISTANT, { text, html })
  -> Scribe React: htmlToMarkdown(html)  [Turndown + normalizeHtml]
  -> LLM prompt uses markdown
```

**New flow (v2.5 Phase 22):**
```
OO selection change
  -> init()  [trigger only, ignore data parameter]
  -> callCommand pre-scan: selectionToMarkdown()
    -> GetRangeBySelect() -> GetAllParagraphs()
    -> Walk paragraphs: text runs -> markdown, drawings -> markers, tables -> cell markers
  -> castIntent(SHOW_SCRIBE_BUTTON, { text, enrichedMd })
  -> castIntent(AI_TEXT_ASSISTANT, { text, enrichedMd })  [on user action]
  -> Scribe React uses enrichedMd directly for LLM prompt  [no htmlToMarkdown needed]
```

### Pre-scan callCommand Architecture (Plan 22-01)

The pre-scan runs inside `callCommand` with `isReadOnly=true` (first param = `true`). This is critical: read-only callCommand does not create an undo point and does not lock the document.

```javascript
// ES5 -- inside callCommand(function() { ... }, true)
// true = read-only, no undo point, no document lock
var doc = Api.GetDocument();
var range = doc.GetRangeBySelect();
if (!range) return JSON.stringify({ text: "", md: "" });

var paragraphs = range.GetAllParagraphs();
var md = "";
var plainText = "";
// ... walk paragraphs, build markdown string
return JSON.stringify({ text: plainText, md: md });
```

**Key constraint:** `callCommand` sandbox has no DOM APIs. All string building must use ES5 string concatenation. No regex literals with named groups. No DOMParser.

### Paragraph Walking Strategy

Each paragraph from `GetAllParagraphs()` contains elements accessible via `GetElementsCount()` and `GetElement(i)`. Each element can be:
- An `ApiRun` (text with formatting) -- `GetClassType() === "run"`
- An `ApiHyperlink` -- `GetClassType() === "hyperlink"`
- Other inline content

For each paragraph:
1. Check if the paragraph's parent is a table cell (via checking document element type)
2. Get all drawing objects via `paragraph.GetAllDrawingObjects()`
3. Walk elements to extract text with inline formatting
4. Convert to markdown inline syntax (bold, italic, etc.)

### Markdown Generation from Document Model (Plan 22-01)

```javascript
// ES5 pseudo-code inside callCommand
function paragraphToMarkdown(para) {
  var text = "";
  var count = para.GetElementsCount();
  for (var i = 0; i < count; i++) {
    var el = para.GetElement(i);
    var classType = el.GetClassType();
    if (classType === "run") {
      var runText = el.GetText();
      var tp = el.GetTextPr();
      // Read formatting from text properties
      var isBold = tp ? tp.GetBold() : false;
      var isItalic = tp ? tp.GetItalic() : false;
      var isStrikethrough = tp ? tp.GetStrikeout() : false;
      var isCode = false;
      // Detect monospace font as code span
      var fontFamily = tp ? tp.GetFontFamily() : null;
      if (fontFamily && fontFamily.toLowerCase().indexOf("courier") !== -1) {
        isCode = true;
      }
      // Wrap with markdown inline markers
      if (isCode) runText = "`" + runText + "`";
      if (isBold && isItalic) runText = "***" + runText + "***";
      else if (isBold) runText = "**" + runText + "**";
      else if (isItalic) runText = "*" + runText + "*";
      if (isStrikethrough) runText = "~~" + runText + "~~";
      text += runText;
    } else if (classType === "hyperlink") {
      // ApiHyperlink -- extract URL and display text
      var linkText = el.GetText ? el.GetText() : "";
      var linkUrl = el.GetLink ? el.GetLink() : "";
      text += "[" + linkText + "](" + linkUrl + ")";
    }
  }
  return text;
}
```

### Image Detection and Markers (Plan 22-02)

Images are drawing objects attached to paragraphs. Detection:

```javascript
var drawings = para.GetAllDrawingObjects();
for (var d = 0; d < drawings.length; d++) {
  var drawing = drawings[d];
  var drawingClass = drawing.GetClassType();
  // ApiImage extends ApiDrawing, but GetClassType may return "image" or "drawing"
  // Use GetName/SetName for stable ID across round-trip

  var name = drawing.GetName();
  if (!name || name === "") {
    // Assign a stable name for round-trip tracking
    name = "scribe-img-" + imageCounter;
    drawing.SetName(name);
    // NOTE: SetName is a WRITE operation -- pre-scan must NOT be read-only
    // for images. Alternative: use position-based ID without SetName.
  }
}
```

**CRITICAL INSIGHT:** `SetName()` on a drawing is a write operation. If we use `callCommand` with `isReadOnly=true`, we cannot call `SetName()`. Two options:

1. **Option A (recommended):** Use a separate non-read-only `callCommand` for the pre-scan when images are detected, accepting a minor undo point cost. Mitigated by running this only once per selection change.
2. **Option B:** Use position-based IDs (paragraph index + drawing index) instead of `SetName()`. Less robust but avoids write operations.

**Marker syntax (MARK-01):**
- Block image (own paragraph): `![IMG:scribe-img-0](placeholder)`
- Inline image (within text): `{{IMG:scribe-img-0}}`

Determination: if the paragraph contains ONLY the drawing and no text runs, it is a block image. Otherwise, inline.

### Table Detection and Cell Markers (Plan 22-02)

Tables are top-level document elements, not paragraph children. The walking strategy must handle them separately:

```javascript
// Walk document elements in selection range
var doc = Api.GetDocument();
var range = doc.GetRangeBySelect();
var startPos = range.GetStartPos();
var endPos = range.GetEndPos();

// Strategy: walk paragraphs for text, but also check if any
// document-level elements in the range are tables
var allTables = doc.GetAllTables();
for (var t = 0; t < allTables.length; t++) {
  var table = allTables[t];
  var tableRange = table.GetRange();
  if (!tableRange) continue;
  var tStart = tableRange.GetStartPos();
  var tEnd = tableRange.GetEndPos();
  // Check if table overlaps with selection
  if (tEnd >= startPos && tStart <= endPos) {
    // This table is in the selection -- extract cells
    var rowCount = table.GetRowsCount();
    for (var r = 0; r < rowCount; r++) {
      var row = table.GetRow(r);
      var cellCount = row.GetCellsCount();
      for (var c = 0; c < cellCount; c++) {
        var cell = table.GetCell(r, c);
        var cellContent = cell.GetContent();
        var cellText = cellContent.GetText();
        md += "[CELL:" + r + "," + c + "]" + cellText + "[/CELL]";
      }
    }
  }
}
```

**Marker syntax (MARK-02):**
```
[CELL:0,0]Header 1[/CELL][CELL:0,1]Header 2[/CELL]
[CELL:1,0]Row 1 Cell 1[/CELL][CELL:1,1]Row 1 Cell 2[/CELL]
```

Each cell marker contains row,col coordinates and the cell's text content. This allows the LLM to process cell text individually while maintaining structural information.

### Protocol Changes

The intent data payload needs a new field `enrichedMd` to carry the plugin-generated markdown:

```javascript
// Updated intent data for AI_TEXT_ASSISTANT
{
  text: "plain text (for display/fallback)",
  enrichedMd: "markdown with markers (for LLM prompt)",
  // html field deprecated but kept for backward compat
  html: ""  // empty or omitted
}
```

On the Scribe React side, `scribeAI.js` `buildMessages()` must prefer `enrichedMd` over `htmlToMarkdown(html)`:

```javascript
// In buildMessages():
const textForPrompt = extra?.enrichedMd || (extra?.html ? htmlToMarkdown(extra.html) : selectedText)
```

### initDataType Change

Currently `config.json` has `"initDataType": "html"` which makes OO pass HTML to `init(data)`. Two approaches:

1. **Keep `initDataType: "html"`** but ignore the HTML data, using it only as a trigger signal. Run callCommand pre-scan to generate enrichedMd. Backward compatible.
2. **Change to `initDataType: "text"`** since we no longer need HTML. Simpler but loses HTML fallback.

**Recommendation:** Keep `"initDataType": "html"` for now. Use the init call as a trigger to run the callCommand pre-scan. The HTML data serves as a fallback if callCommand fails. This maintains backward compatibility and allows gradual migration.

### Proactive Pre-scan Timing

The pre-scan must run on every selection change without perceptible delay:

```
init(data) called by OO
  -> If pasteInProgress, skip (existing guard)
  -> Run callCommand (read-only) to scan selection
  -> On callback: store enrichedMd, update lastSelectedText
  -> Debounce SHOW_SCRIBE_BUTTON by 300ms (existing pattern)
```

**Performance consideration:** The callCommand pre-scan adds a round-trip to the OO document model. For simple text selections, this should be <50ms. For documents with many tables/images, it could be slower. The existing 300ms debounce on SHOW_SCRIBE_BUTTON provides a natural buffer.

### Recommended Project Structure

No new files needed. Changes are confined to:

```
plugins/onlyoffice-scribe/
  scripts/
    code.js           # Add selectionToMarkdown() function + update init()

src/modules/views/OnlyOffice/
  Scribe/
    scribeAI.js       # Update buildMessages() to prefer enrichedMd
    scribeConversion.js  # htmlToMarkdown still available as fallback
  View.jsx            # Pass enrichedMd through intent data
  useCozyBridge.js    # No changes needed (intent data is opaque)
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown escaping | Custom escape function | Careful character-by-character escaping of `*`, `_`, `[`, `]`, `(`, `)`, `` ` `` | Markdown special chars in document text must be escaped to prevent misparse |
| Table structure detection | DOM parsing of HTML tables | `doc.GetAllTables()` + `GetRowsCount()`/`GetCellsCount()` | Builder API provides direct table structure access |
| Image identification | HTML img tag parsing | `para.GetAllDrawingObjects()` + `GetClassType()` | Builder API provides direct drawing object access |
| HTML to markdown | Keep Turndown for fallback | `htmlToMarkdown()` already exists | Don't remove it -- keep as fallback if callCommand pre-scan fails |

## Common Pitfalls

### Pitfall 1: callCommand Read-Only vs Write Operations
**What goes wrong:** Using `callCommand(fn, true)` (read-only) but calling `SetName()` on a drawing, which is a write operation. OO silently ignores the write, and the name is not set.
**Why it happens:** The pre-scan should be read-only to avoid creating undo points, but image naming requires a write.
**How to avoid:** For Plan 22-01 (text only), use read-only callCommand. For Plan 22-02 (images), use a separate non-read-only callCommand only when images are detected, or use position-based IDs to avoid writes entirely.
**Warning signs:** `SetName()` returning `false` or images having empty names after the pre-scan.

### Pitfall 2: ES5 Syntax in callCommand
**What goes wrong:** Using `const`, `let`, arrow functions, template literals, or destructuring inside callCommand. OO's sandbox rejects ES6+ syntax.
**Why it happens:** The selectionToMarkdown function will be large and complex -- easy to forget ES5 constraint.
**How to avoid:** All code inside `callCommand` must use `var`, `function`, string concatenation (`+`), and `for` loops. No `forEach`, `map`, `filter`, arrow functions, or template literals.
**Warning signs:** Silent failures or "SyntaxError" in OO console.

### Pitfall 3: Selection Range vs Document Elements Mismatch
**What goes wrong:** `GetAllParagraphs()` on the selection range returns paragraphs that are inside table cells, making it unclear which paragraphs are top-level and which are cell content.
**Why it happens:** OO's range model includes table cell paragraphs as part of the range's paragraph collection.
**How to avoid:** When walking paragraphs, check if a paragraph's parent is a table cell before processing it as a top-level paragraph. Use `GetAllTables()` to identify table boundaries separately.
**Warning signs:** Table cell text appearing both in the cell markers AND as standalone paragraphs.

### Pitfall 4: Markdown Special Character Escaping
**What goes wrong:** Document text containing `*`, `_`, `[`, `]`, `` ` `` etc. being interpreted as markdown formatting instead of literal text.
**Why it happens:** The document may contain these characters as literal text, but the markdown output treats them as formatting.
**How to avoid:** Escape markdown special characters in text runs: `\*`, `\_`, `\[`, `\]`, `` \` ``, `\(`, `\)`. Only apply formatting markers intentionally based on detected OO formatting.
**Warning signs:** Garbled markdown output when document contains special characters.

### Pitfall 5: GetTextPr() Returns Null or Incomplete Properties
**What goes wrong:** `GetTextPr()` on a run returns null or properties that don't reflect the actual display formatting (e.g., bold from a style is not reported).
**Why it happens:** OO distinguishes between direct formatting and style-based formatting. `GetTextPr()` may only return direct formatting, not inherited/computed formatting.
**How to avoid:** Test with both directly formatted text and style-based formatting. May need to check paragraph style in addition to run text properties.
**Warning signs:** Bold text from a heading style not being detected as bold.

### Pitfall 6: Performance on Large Selections
**What goes wrong:** Pre-scan takes >200ms for large selections (many paragraphs, complex tables), causing noticeable lag.
**Why it happens:** Walking every element in every paragraph inside callCommand is synchronous.
**How to avoid:** Add a character/paragraph count limit. If the selection exceeds a threshold (e.g., 5000 chars or 100 paragraphs), fall back to the simpler `GetSelectedText` + `initDataType: "html"` path.
**Warning signs:** UI jank when selecting large text blocks.

### Pitfall 7: Table Partially Selected
**What goes wrong:** User selects text that starts before a table and ends inside it, or selects only some rows of a table.
**Why it happens:** Partial table selection is a legitimate user action.
**How to avoid:** When a table's range overlaps the selection, extract ALL cells (complete table), not just the selected portion. The LLM should see the full table structure to make coherent edits.
**Warning signs:** Incomplete cell markers or missing rows/columns.

## Code Examples

### Read-Only Pre-scan Pattern (Verified from existing code.js)
```javascript
// Source: code.js lines 247-762 -- existing callCommand pattern
window.Asc.plugin.callCommand(function() {
  var doc = Api.GetDocument();
  var range = doc.GetRangeBySelect();
  if (!range) return "";
  // ... read-only operations ...
  return JSON.stringify(result);
}, true, false, function(resultJson) {
  // true = read-only (no undo point)
  // false = no paste
  // callback receives the return value as string
  var result = JSON.parse(resultJson);
  // ... use result ...
});
```

### Getting Drawing Objects from Paragraph (OO API docs)
```javascript
// Source: https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/Methods/GetAllDrawingObjects/
var drawings = paragraph.GetAllDrawingObjects();
for (var d = 0; d < drawings.length; d++) {
  var name = drawings[d].GetName();
  var classType = drawings[d].GetClassType(); // "drawing" or "image"
}
```

### Table Cell Enumeration (OO API docs)
```javascript
// Source: https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiTable/
var rowCount = table.GetRowsCount();
for (var r = 0; r < rowCount; r++) {
  var row = table.GetRow(r);
  var cellCount = row.GetCellsCount();
  for (var c = 0; c < cellCount; c++) {
    var cell = table.GetCell(r, c);
    var content = cell.GetContent(); // ApiDocumentContent
    var text = content.GetText();
  }
}
```

### Paragraph Element Walking (OO API docs)
```javascript
// Source: https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/
var count = paragraph.GetElementsCount();
for (var i = 0; i < count; i++) {
  var el = paragraph.GetElement(i);
  var type = el.GetClassType(); // "run", "hyperlink", etc.
  if (type === "run") {
    var text = el.GetText();
    var textPr = el.GetTextPr(); // ApiTextPr
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `initDataType: "html"` + Turndown in React | callCommand pre-scan + selectionToMarkdown() in plugin | Phase 22 (this phase) | Plugin produces markdown directly from document model -- no HTML intermediary |
| `htmlToMarkdown()` for LLM prompts | `enrichedMd` field in intent data | Phase 22 (this phase) | Richer extraction: images and tables represented as markers |
| HTML stripped of OO classes (`stripOoClasses`) | Direct API extraction (no HTML involved) | Phase 22 (this phase) | Eliminates HTML parsing entirely for the primary path |

## Open Questions

1. **GetTextPr() reliability for style-based formatting**
   - What we know: Direct formatting (user applied bold) should be reported by GetTextPr()
   - What's unclear: Whether style-based formatting (e.g., heading style making text bold) is reported
   - Recommendation: Test during implementation. If style-based formatting is not reported, check paragraph style separately.

2. **ApiImage GetClassType return value**
   - What we know: ApiDrawing.GetClassType() returns "drawing". ApiImage documentation lists only 3 methods (GetClassType, GetNextImage, GetPrevImage).
   - What's unclear: Whether ApiImage.GetClassType() returns "image" or "drawing" (documentation unclear on inheritance)
   - Recommendation: Test empirically. If GetClassType is "drawing" for all, use other heuristics (e.g., check if the drawing has image-specific properties).

3. **Table paragraph deduplication in GetAllParagraphs**
   - What we know: GetAllParagraphs() on a range returns all paragraphs, potentially including those inside table cells
   - What's unclear: Exact behavior -- do table cell paragraphs appear in the range's paragraph list?
   - Recommendation: Test empirically. If they do, filter them out by checking parent context.

## Sources

### Primary (HIGH confidence)
- [ApiDocument methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/) - GetRangeBySelect, GetAllTables, GetAllDrawingObjects, GetAllImages, GetElement, GetElementsCount
- [ApiParagraph methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/) - GetAllDrawingObjects, GetElement, GetElementsCount, GetText, GetRange
- [ApiRange methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRange/) - GetAllParagraphs, GetText, GetStartPos, GetEndPos
- [ApiTable methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiTable/) - GetCell, GetRow, GetRowsCount, GetRange
- [ApiTableRow methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiTableRow/) - GetCell, GetCellsCount, GetIndex
- [ApiTableCell methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiTableCell/) - GetContent, GetIndex, GetRowIndex
- [ApiDrawing methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDrawing/) - GetName, SetName, GetClassType, ToJSON
- [ApiImage methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiImage/) - GetClassType, GetNextImage, GetPrevImage
- [ApiRun methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRun/) - GetClassType, GetText, GetTextPr
- [ApiDocumentContent methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocumentContent/) - GetElement, GetElementsCount, GetAllImages, GetAllDrawingObjects, GetAllTables, GetText
- Existing codebase: `plugins/onlyoffice-scribe/scripts/code.js` -- callCommand patterns, ES5 constraints, existing selection flow

### Secondary (MEDIUM confidence)
- [callCommand documentation](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/) - read-only mode, Asc.scope passing
- [GetSelectedText executeMethod](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/GetSelectedText/) - parameters and behavior

### Tertiary (LOW confidence)
- ApiImage inheritance from ApiDrawing -- inferred from API structure, not explicitly documented
- GetTextPr() returning style-inherited properties -- needs empirical validation

## Metadata

**Confidence breakdown:**
- Architecture: HIGH - based on existing codebase patterns and verified OO API methods
- Marker contract: HIGH - syntax designed to be unambiguous for LLM processing and parser-friendly
- API capabilities: HIGH - methods verified via official OO API documentation
- Pitfalls: MEDIUM - some pitfalls (GetTextPr reliability, table paragraph dedup) need empirical validation

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- OO API changes infrequently)
