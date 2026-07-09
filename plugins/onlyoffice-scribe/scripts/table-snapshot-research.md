# Table Snapshot Research — OO Table Formatting APIs in Plugin Sandbox

Research for v3.0-03-04 Task 1. Documents which OO APIs are available for reading (getters) and writing (setters) table/cell/row formatting properties inside `callCommand`.

Source: `onlyoffice-sdkjs/word/apiBuilder.js` (public API) and `word/Editor/Table/TableCell.js` (internal API).

---

## 1. Cell Text Formatting (font, bold, italic, underline, strikethrough, color, size)

All available via `ApiTextPr` — obtained from paragraph runs inside cell content.

| Property | Getter | Setter | Notes |
|----------|--------|--------|-------|
| Bold | `textPr.GetBold()` → `?boolean` | `textPr.SetBold(bool)` | Exported |
| Italic | `textPr.GetItalic()` → `?boolean` | `textPr.SetItalic(bool)` | Exported |
| Underline | `textPr.GetUnderline()` → `?boolean` | `textPr.SetUnderline(bool)` | Exported |
| Strikeout | `textPr.GetStrikeout()` → `?boolean` | `textPr.SetStrikeout(bool)` | Exported |
| Font family | `textPr.GetFontFamily(fontSlot)` → `?string` | `textPr.SetFontFamily(name)` | fontSlot optional, defaults to ASCII |
| Font size | `textPr.GetFontSize()` → `?number` | `textPr.SetFontSize(halfPts)` | Half-points (e.g. 22 = 11pt) |
| Color | `textPr.GetColor()` → `?ApiColor` | `textPr.SetColor(r,g,b,isAuto)` | Returns ApiColor; use `.GetRGB()` → `{r,g,b}` |
| Highlight | `textPr.GetHighlight()` → color name or "none" | `textPr.SetHighlight(name)` | Exported |

**How to get textPr in a cell**:
```js
var content = cell.GetContent();     // ApiDocumentContent
var para = content.GetElement(0);    // ApiParagraph
var run = para.GetElement(0);        // ApiRun (if ParaRun)
var textPr = run.GetTextPr();        // ApiTextPr — has all getters above
```

**Confirmed in code.js**: Yes — `GetTextPr()`, `GetFontFamily()`, `GetFontSize()` are already used (lines 931, 2159, 2201).

---

## 2. Cell Background / Shading

| Property | Getter | Setter | Notes |
|----------|--------|--------|-------|
| Background color | `cell.GetBackgroundColor()` → `?ApiColor` | `cell.SetBackgroundColor(apiColor)` or `cell.SetBackgroundColor(r, g, b, bNone)` | Public API since 9.1.0 |
| Shading (via CellPr) | — (no public getter on ApiTableCellPr) | `cellPr.SetShd(sType, r, g, b, isAuto)` | sType: "clear" or "nil" |

**Reading background**: Use `cell.GetBackgroundColor()` which returns `ApiColor` (or null). Extract RGB via `color.GetRGB()` → `{r, g, b}`.

**Internal fallback**: `cell.Cell.Get_Shd()` returns raw `CDocumentShd` with `{Value, Color: {r,g,b}, Fill: {r,g,b}}`.

**Confirmed in code.js**: `SetShd` used on paragraph (line 1277), not on cell directly. `GetBackgroundColor`/`SetBackgroundColor` not yet used.

---

## 3. Cell Borders (top, bottom, left, right)

### Getters — INTERNAL ONLY (not on public ApiTableCell)

No public API getters for cell borders on `ApiTableCell`. Must use internal `cell.Cell` object:

| Property | Internal getter | Return type |
|----------|----------------|-------------|
| Single border | `cell.Cell.GetBorder(nType)` | `CDocumentBorder` |
| All borders | `cell.Cell.GetBorders()` | `{Top, Right, Bottom, Left}` — each is `CDocumentBorder` |
| nType values | 0=Top, 1=Right, 2=Bottom, 3=Left | |

**CDocumentBorder structure**:
```js
{
  Value: border_None (0) | border_Single (1),
  Size: number,    // mm (internal), converted from pt*8 on set
  Space: number,   // mm (internal), converted from pt on set
  Color: { r, g, b, Auto }
}
```

**Converting back to setter units**:
- Size: `mm → pt*8` via `Size / g_dKoef_pt_to_mm * 8` (approximately `Size * 22.68`)
- Space: `mm → pt` via `Space / g_dKoef_pt_to_mm` (approximately `Space * 2.835`)
- Simpler: store raw mm values and convert on injection, or capture in pt*8 directly.

### Setters — PUBLIC API (on ApiTableCellPr, inherited by ApiTableCell)

| Method | Parameters | Notes |
|--------|-----------|-------|
| `cell.SetCellBorderTop(sType, nSize, nSpace, r, g, b)` | sType: "single"/"none", nSize: pt*8, nSpace: pt, r,g,b: 0-255 | Exported |
| `cell.SetCellBorderBottom(sType, nSize, nSpace, r, g, b)` | same | Exported |
| `cell.SetCellBorderLeft(sType, nSize, nSpace, r, g, b)` | same | Exported |
| `cell.SetCellBorderRight(sType, nSize, nSpace, r, g, b)` | same | Exported |

**Confirmed in code.js**: Not yet used.

---

## 4. Cell Width

### Getter — INTERNAL ONLY

| Method | Returns | Notes |
|--------|---------|-------|
| `cell.Cell.GetW()` | `CTableMeasurement` or from compiled Pr | `{Type, W}` — Type is tblwidth constant, W is mm |
| `cell.Cell.GetCalculatedW()` | number (mm) | Computed from grid — actual rendered width |

No public API getter for cell width on `ApiTableCell`.

### Setter — PUBLIC API

| Method | Parameters | Notes |
|--------|-----------|-------|
| `cell.SetWidth(sType, nValue)` | sType: "auto"/"nil"/"percent"/"twips", nValue: positive int | Inherited from ApiTableCellPr. Exported. |

**CTableMeasurement**: `{Type: tblwidth_Auto|tblwidth_Nil|tblwidth_Pct|tblwidth_Mm, W: number}`

**Confirmed in code.js**: Not yet used on cells.

---

## 5. Cell Vertical Merge

### Getter — INTERNAL ONLY

| Method | Returns | Notes |
|--------|---------|-------|
| `cell.Cell.GetVMerge()` | `vmerge_Restart` (0x01) or `vmerge_Continue` (0x02) | From compiled cell properties |
| `cell.Cell.SetVMerge(nType)` | void | Internal setter |

No public API getter or setter for VMerge on `ApiTableCell`.

### Setter — via MergeCells (PUBLIC)

| Method | Parameters | Notes |
|--------|-----------|-------|
| `table.MergeCells(aCells)` | Array of ApiTableCell objects | Merges the given cells. Returns merged ApiTableCell or null. |

**Gotcha**: `MergeCells` works on the table object, not individual cells. For snapshot reconstruction, you would create the table first, then call `MergeCells` on groups of cells that should be merged.

**Alternative (internal)**: `cell.Cell.SetVMerge(vmerge_Restart)` / `cell.Cell.SetVMerge(vmerge_Continue)` — works but not public API. Similarly `cell.Cell.SetHMerge(type)`.

**Constants**: `vmerge_Restart = 0x01`, `vmerge_Continue = 0x02` (defined in Styles.js).

**Confirmed in code.js**: Not yet used.

---

## 6. Cell Horizontal Merge / Grid Span

### Getter — INTERNAL ONLY

| Method | Returns | Notes |
|--------|---------|-------|
| `cell.Cell.GetGridSpan()` | number | Number of grid columns this cell spans (1 = no merge) |
| `cell.Cell.GetHMerge()` | value from compiled Pr | Horizontal merge status |

No public API getter on `ApiTableCell`.

### Setter — INTERNAL ONLY

| Method | Parameters | Notes |
|--------|-----------|-------|
| `cell.Cell.SetGridSpan(n)` | number | Internal setter |
| `cell.Cell.SetHMerge(nType)` | type constant | Internal setter |

**Alternative**: Use `table.MergeCells(aCells)` (public API) instead of setting grid span directly.

**Confirmed in code.js**: Not yet used, but `GetGridSpan()` is used internally by apiBuilder.js in MergeCells logic.

---

## 7. Table Width

### Getter — NO PUBLIC API

Must read from internal: `table.Table.Pr.TableW` → `CTableMeasurement {Type, W}` or `table.TablePr.TableW`.

Since `ApiTable` extends `ApiTablePr`, `table.TablePr` is available and contains `TableW`.

### Setter — PUBLIC API

| Method | Parameters | Notes |
|--------|-----------|-------|
| `table.SetWidth(sType, nValue)` | sType: "auto"/"nil"/"percent"/"twips", nValue | Inherited from ApiTablePr. Exported. |

**Confirmed in code.js**: Yes — `table.SetWidth("percent", 100)` at line 1307.

---

## 8. Table Alignment (Justification)

### Getter — NO PUBLIC API

Must read from `table.TablePr.Jc` or `table.Table.Pr.Jc`.
Values: `align_Left`, `align_Right`, `align_Center` (numeric constants).

### Setter — PUBLIC API

| Method | Parameters | Notes |
|--------|-----------|-------|
| `table.SetJc(sJcType)` | "left" / "right" / "center" | Inherited from ApiTablePr. Exported. |

**Confirmed in code.js**: Not yet used.

---

## 9. Table Default Borders

### Getter — NO PUBLIC API

Must read from `table.TablePr.TableBorders` → `{Top, Bottom, Left, Right, InsideH, InsideV}`, each is `CDocumentBorder`.

### Setter — PUBLIC API

| Method | Parameters | Notes |
|--------|-----------|-------|
| `table.SetTableBorderTop(sType, nSize, nSpace, r, g, b)` | sType: "single"/"none", nSize: pt*8, nSpace: pt, r,g,b | Exported |
| `table.SetTableBorderBottom(...)` | same | Exported |
| `table.SetTableBorderLeft(...)` | same | Exported |
| `table.SetTableBorderRight(...)` | same | Exported |
| `table.SetTableBorderInsideH(...)` | same | Exported |
| `table.SetTableBorderInsideV(...)` | same | Exported |
| `table.SetTableBorderAll(...)` | same — sets all 6 at once | Exported |

**Confirmed in code.js**: Yes — all 6 individual setters used at lines 1310-1315.

---

## 10. Row Height

### Getter — NO PUBLIC API

Must read from internal: `row.Row.Pr.Height` → `CTableRowHeight {Value: number (mm), HRule: linerule constant}`.
Or `row.RowPr.Height` (from ApiTableRow's copy).

### Setter — PUBLIC API

| Method | Parameters | Notes |
|--------|-----------|-------|
| `row.SetHeight(sHRule, nValue)` | sHRule: "auto"/"atLeast", nValue: twips (1/1440 inch) | Inherited from ApiTableRowPr. Exported. |

**CTableRowHeight HRule values**: `Asc.linerule_Auto`, `Asc.linerule_AtLeast`.

**Confirmed in code.js**: Not yet used.

---

## Summary: Getter / Setter Availability

| Category | Public Getter | Public Setter | Internal Getter Available |
|----------|:---:|:---:|:---:|
| 1. Cell text formatting | YES (ApiTextPr) | YES (ApiTextPr) | — |
| 2. Cell background | YES (`GetBackgroundColor`) | YES (`SetBackgroundColor`) | Also `Cell.Get_Shd()` |
| 3. Cell borders | NO | YES (`SetCellBorder*`) | YES (`Cell.GetBorder(n)`, `Cell.GetBorders()`) |
| 4. Cell width | NO | YES (`SetWidth`) | YES (`Cell.GetW()`, `Cell.GetCalculatedW()`) |
| 5. Cell vertical merge | NO | via `MergeCells()` | YES (`Cell.GetVMerge()`) |
| 6. Cell grid span | NO | via `MergeCells()` | YES (`Cell.GetGridSpan()`) |
| 7. Table width | NO | YES (`SetWidth`) | YES (`table.TablePr.TableW`) |
| 8. Table alignment | NO | YES (`SetJc`) | YES (`table.TablePr.Jc`) |
| 9. Table default borders | NO | YES (`SetTableBorder*`) | YES (`table.TablePr.TableBorders`) |
| 10. Row height | NO | YES (`SetHeight`) | YES (`row.RowPr.Height` or `row.Row.Pr.Height`) |

---

## Recommended Snapshot Schema

Based on the above, the snapshot should capture using a mix of public and internal getters during extraction, then reconstruct using only public setters during injection.

```js
// Extraction: capture via internal getters where public ones don't exist
{
  rows: Number,
  cols: Number,

  // Table-level (read from table.TablePr or table.Table.Pr)
  tableWidth: { type: "auto"|"percent"|"twips"|"nil", value: Number },
  tableJc: "left"|"center"|"right"|null,
  tableBorders: {
    top:     { type: "single"|"none", size: Number/*pt*8*/, space: Number/*pt*/, r, g, b } | null,
    bottom:  ...,
    left:    ...,
    right:   ...,
    insideH: ...,
    insideV: ...
  },

  // Row-level
  rowHeights: [
    { hRule: "auto"|"atLeast", value: Number/*twips*/ } | null,
    ...
  ],

  // Cell-level (flat array)
  cells: [
    {
      r: Number, c: Number,

      // Text runs (from paragraph content)
      content: [
        {
          text: String,
          bold: Boolean|null,
          italic: Boolean|null,
          underline: Boolean|null,
          strikethrough: Boolean|null,
          fontFamily: String|null,
          fontSize: Number|null,      // half-points
          color: { r, g, b }|null
        }
      ],

      // Cell formatting
      bgColor: { r, g, b }|null,
      borders: {
        top:    { type, size, space, r, g, b }|null,
        right:  ...,
        bottom: ...,
        left:   ...
      }|null,
      width: { type: "auto"|"percent"|"twips"|"nil", value: Number }|null,
      vMerge: "restart"|"continue"|null,   // from Cell.GetVMerge()
      gridSpan: Number|null                // from Cell.GetGridSpan(), >1 means h-merge
    }
  ]
}
```

---

## Gotchas and Caveats

1. **Unit conversion for borders**: Internal `CDocumentBorder.Size` is in mm. Setter expects pt*8. Convert: `pt8 = Math.round(mm / 25.4 * 72 * 8)` or use the constant `g_dKoef_pt_to_mm` (≈0.3528). Reverse: `pt8 = Math.round(Size / g_dKoef_pt_to_mm * 8)`.

2. **Unit conversion for row height**: Internal `CTableRowHeight.Value` is in mm. Setter expects twips (1/1440 inch). Convert: `twips = Math.round(mm / 25.4 * 1440)`.

3. **Unit conversion for cell/table width**: Internal `CTableMeasurement.W` is in mm when Type=tblwidth_Mm (which maps to "twips" sType). When Type=tblwidth_Pct, W is a percentage (0-100). Convert mm→twips: `twips = Math.round(mm / 25.4 * 1440)`.

4. **MergeCells vs SetVMerge/SetGridSpan**: The public API `table.MergeCells(cells)` modifies the table structure (removes cells, adjusts grid). For reconstruction from snapshot, it may be simpler to create the table with the right grid and use internal `Cell.SetVMerge()` + `Cell.SetGridSpan()` to set merge flags directly, avoiding the structural changes that MergeCells performs. However, these are internal APIs — test carefully.

5. **Border getter returns compiled (effective) borders**: `Cell.GetBorder(n)` returns the effective border considering table-level defaults. For the snapshot, we may want to capture both table-level defaults AND cell-level overrides separately, then apply table defaults on reconstruction and only set cell borders where they differ.

6. **ApiColor from GetBackgroundColor**: Returns `ApiColor` object. Use `color.GetRGB()` → `{r, g, b}`. Check `color.IsAutoColor()` and `color.IsThemeColor()` for special cases. Theme colors may not round-trip perfectly as RGB.

7. **vmerge/hmerge constants**: `vmerge_Restart = 0x01`, `vmerge_Continue = 0x02`. These are global constants available in the callCommand scope.

8. **Table alignment constants**: `align_Left`, `align_Right`, `align_Center` are numeric. Map to strings for the snapshot; convert back when setting via `SetJc("left"|"right"|"center")`.

9. **Font size units**: `ApiTextPr.GetFontSize()` returns half-points (e.g., 22 = 11pt). `SetFontSize()` also takes half-points.

10. **Null/undefined from getters**: Text property getters can return `null` or `undefined` when the property is not explicitly set (inherits from style). For the snapshot, store null and let the reconstruction skip those properties.

---
---

# HTML Extraction & PasteHtml Table Research (v3.0-03-04 Task 1)

Research on extracting tables as portable snapshots (HTML or JSON) and reconstructing them via PasteHtml or FromJSON. This determines the feasibility of the HTML-snapshot architecture proposed in v3.0-03-04.

Source files investigated:
- `onlyoffice-sdkjs/common/wordcopypaste.js` (CopyProcessor — clipboard copy pipeline)
- `onlyoffice-sdkjs/common/apiBase_plugins.js` (PasteHtml, GetSelectedContent plugin methods)
- `onlyoffice-sdkjs/common/apiBase.js` (getSelectedContent base implementation)
- `onlyoffice-sdkjs/word/apiBuilder.js` (ApiTable.ToJSON, Api.FromJSON, CMarkdownConverter, ApiTable.Select, ApiTable.Copy, InsertContent)
- `onlyoffice-sdkjs/word/api.js` (asc_CheckCopy — HTML copy path)
- `onlyoffice-sdkjs/word/api_plugins.js` (stream paste)
- `onlyoffice-sdkjs/word/Editor/Document.js` (CDocument.GetSelectedContent)
- `onlyoffice-sdkjs/word/Editor/Table.js` (CTable.GetSelectedContent, CTable.Copy)

---

## 1. HTML Extraction Methods

### 1a. CopyProcessor — The Clipboard Copy Pipeline (BEST for HTML)

OO's Ctrl+C pipeline uses `AscCommon.CopyProcessor` to convert selected content to HTML. This is the proven, battle-tested code path.

**How it works:**
1. `CopyProcessor.Start()` calls `oDocument.GetSelectedContent()` to get a `CSelectedContent` object
2. `CopyProcessor.CopyDocument2()` walks the content elements
3. For tables, it calls `CopyProcessor.CopyTable()` which creates `CopyElement` DOM nodes
4. `CopyElement.getOuterHtml()` serializes to an HTML string

**What CopyTable captures:**
- Table alignment (Jc), background (Shd), cell margins, table borders (including InsideH/InsideV)
- Cell spacing
- Per-row: height, grid-before/grid-after
- Per-cell: width, rowspan (via `Internal_GetVertMergeCount`), colspan (via GridSpan), background-color, borders, cell margins
- Cell content: paragraphs with full text formatting (font, bold, italic, color, etc.)
- Merged cells: handled via `vmerge_Continue` skip + rowspan attribute

**Availability inside callCommand:**
- `AscCommon.CopyProcessor` is exported: `window["AscCommon"].CopyProcessor = CopyProcessor` (wordcopypaste.js:14524)
- `CopyElement` is local to wordcopypaste.js but used internally by CopyProcessor
- `editor` global (`window.editor`) is available — this is the `Api` instance with `WordControl`
- The `CopyProcessor` constructor requires `api` (the editor instance): `new AscCommon.CopyProcessor(editor)`

**Prototype for HTML extraction inside callCommand:**
```js
// Inside callCommand — ES5 syntax
function captureTableHtml(apiTable) {
  var doc = Api.GetDocument();
  var logicDocument = doc.Document;

  // Save current selection state
  var oldSelectionInfo = logicDocument.SaveDocumentState();

  // Select the entire table
  apiTable.Select();

  // Create CopyProcessor and use it to generate HTML
  var copyProcessor = new AscCommon.CopyProcessor(editor);
  var selectedContent = logicDocument.GetSelectedContent(false);

  if (!selectedContent || !selectedContent.Elements || selectedContent.Elements.length === 0) {
    logicDocument.LoadDocumentState(oldSelectionInfo);
    logicDocument.UpdateSelection();
    return null;
  }

  // Use CopyDocument2 to convert to HTML DOM tree
  copyProcessor.CopyDocument2(copyProcessor.oRoot, null, selectedContent.Elements);

  // Restore original selection
  logicDocument.LoadDocumentState(oldSelectionInfo);
  logicDocument.UpdateSelection();

  // Extract HTML string
  return copyProcessor.oRoot.getInnerHtml();
}
```

**Concern:** `CopyProcessor` internally accesses `this.oBinaryFileWriter` and other objects. The constructor creates a `BinaryFileWriter` which may have side effects. Need to test whether `CopyDocument2` alone (without calling `Start()`) works cleanly inside callCommand. The `CopyDocument2` path is used in isolation elsewhere (e.g., `cell/model/clipboard.js:1069`), so it should be safe.

**Alternative simpler approach — use `CopyTable` directly:**
```js
function captureTableHtml(apiTable) {
  var table = apiTable.Table; // internal CTable
  var copyProcessor = new AscCommon.CopyProcessor(editor);
  var domRoot = copyProcessor.oRoot; // CopyElement("span")

  // Ensure table has computed grid
  table.Recalculate_Grid();

  // Directly call CopyTable on the internal CTable
  copyProcessor.CopyTable(domRoot, table, null);

  return domRoot.getInnerHtml();
}
```

This is simpler and avoids selection manipulation entirely. `CopyTable` directly walks the internal `CTable` object and builds the HTML DOM. No need to select the table first.

**Risk:** `CopyTable` accesses `table.Get_CompiledPr()` which requires the table to have been recalculated. Inside callCommand, tables in the document should already be recalculated. The `table.Recalculate_Grid()` call ensures the grid is up to date.

### 1b. CMarkdownConverter.HandleTable (INSUFFICIENT)

The built-in `CMarkdownConverter.HandleTable` produces bare `<table><tr><td>` HTML with NO styling:
```html
<table>
  <tr>
   <td>cell content</td>
  </tr>
</table>
```

No borders, no backgrounds, no widths, no merges. **Not suitable for our use case.**

### 1c. executeMethod('GetSelectedContent', {type: 'html'}) (ASYNC — cannot use in callCommand)

The plugin API `GetSelectedContent` with `{type: 'html'}` calls `this.getSelectedContent(AscCommon.c_oAscClipboardDataFormat.Html)` which internally uses `asc_CheckCopy` which creates a `CopyProcessor` and calls `Start()`.

**Problem:** This is an `executeMethod` — it runs asynchronously from the plugin iframe. It **cannot** be called from within `callCommand` (which runs synchronously in the editor's JS context). It would need to be a separate step before or after callCommand.

**However:** The same code path (`CopyProcessor`) is what we'd use directly inside callCommand (approach 1a), so this is effectively the same thing but with extra async overhead.

### 1d. ApiRange.ToJSON / ApiTable.ToJSON (ALTERNATIVE — JSON instead of HTML)

`ApiTable.prototype.ToJSON(bWriteNumberings, bWriteStyles)` serializes a table to a comprehensive JSON string using `AscJsonConverter.WriterToJSON`. This captures ALL table properties including internal formatting.

`Api.FromJSON(jsonString)` deserializes back to an `ApiTable` object when the JSON has `"type": "table"`.

**Prototype:**
```js
// Extraction (inside callCommand)
var jsonStr = apiTable.ToJSON(true, true);
// Store jsonStr — it's a string, JSON-serializable

// Injection (inside callCommand)
var restoredTable = Api.FromJSON(jsonStr);
// restoredTable is ApiTable — can be used with InsertContent
```

**Advantages over HTML:**
- Lossless round-trip — captures EVERY property OO knows about
- No HTML parsing on the way back
- Works entirely inside callCommand (synchronous)
- Returns a proper ApiTable directly — no need to find the table after paste

**Disadvantages vs HTML:**
- JSON string may be very large for complex tables (images as base64?)
- Less battle-tested than the HTML copy/paste path (FromJSON is newer API)
- Need to verify image handling

---

## 2. PasteHtml Implementation & Table Reconstruction

### How PasteHtml Works

`Api.prototype["pluginMethod_PasteHtml"]` (apiBase_plugins.js:309):

1. Sets async mode (`setPluginMethodReturnAsync`)
2. Creates a `<div>` element, sets `innerHTML` to the HTML string
3. Appends to `document.body`
4. Calls `this.asc_PasteData(c_oAscClipboardDataFormat.HtmlElement, elem, ...)`
5. The paste processor in `wordcopypaste.js` parses the DOM nodes and creates internal OO objects (CTable, Paragraph, etc.)
6. After paste completes, removes the temp div and calls callback

**What PasteHtml supports for tables** (from wordcopypaste.js paste parser):
- `<table>` with style attributes (margin-left, background, mso-padding-alt, borders)
- `<tr>` with height style
- `<td>` with width, rowspan, colspan, background-color, borders, padding
- Cell content: paragraphs, bold, italic, font-size, font-family, color, etc.
- Cell merges via rowspan/colspan attributes
- MSO-specific styles (mso-border-insidev, mso-border-insideh, mso-cellspacing, etc.)

**Key fact:** PasteHtml is ASYNCHRONOUS. It goes through the paste pipeline which involves DOM manipulation and async callbacks. **It cannot be called from within callCommand.**

### PasteHtml Timing Implications

If we use PasteHtml for injection:
1. **Step 1 (executeMethod):** PasteHtml the table HTML — async, returns via callback
2. **Step 2 (callCommand):** Find the pasted table, modify cells with LLM content, build InsertContent array

This 2-step process adds complexity. The table is pasted into the document temporarily during step 1, then we need to find it and work with it in step 2.

---

## 3. Getting an ApiTable Reference After PasteHtml

### 3a. Count Tables Before/After

```js
// Before PasteHtml
var tableCountBefore = doc.GetAllTables().length;

// After PasteHtml (in callback)
// Then in callCommand:
var tables = doc.GetAllTables();
var pastedTable = tables[tableCountBefore]; // first new table
```

**Risk:** If PasteHtml inserts at a position that's not at the end, the index might be wrong. Also, if other edits happen between the count and the retrieval, it breaks.

### 3b. Cursor Position After Paste

After PasteHtml completes, the cursor is positioned after the pasted content. We could use `doc.GetRangeBySelect()` or track the insertion point.

**This is fragile and hard to rely on.**

### 3c. Avoid PasteHtml Entirely — Use ToJSON/FromJSON + InsertContent

This is the cleanest approach:
```js
// Inside callCommand (synchronous):
var restoredTable = Api.FromJSON(tableJsonSnapshot);
// restoredTable is already an ApiTable — use it directly
// Modify cells as needed
// Push to content array for InsertContent
```

No async, no finding tables, no cursor position hacks.

---

## 4. Recommended Approach: Dual-Path (ToJSON Primary, CopyProcessor HTML Fallback)

### Primary: ToJSON/FromJSON (synchronous, lossless)

**Extraction (inside callCommand):**
```js
function captureTableSnapshot(apiTable) {
  try {
    return apiTable.ToJSON(true, true);
  } catch (e) {
    return null;
  }
}
```

**Injection (inside callCommand):**
```js
function restoreTableFromSnapshot(jsonStr) {
  try {
    var restored = Api.FromJSON(jsonStr);
    // restored is ApiTable
    return restored;
  } catch (e) {
    return null;
  }
}
```

**Advantages:**
- 100% synchronous — works entirely inside callCommand
- Lossless — captures every property OO knows about
- Returns ApiTable directly — no need to search for it
- No DOM manipulation, no async paste pipeline
- The JSON string is a plain string — JSON-serializable, travels via postMessage

### Fallback: CopyProcessor HTML (for diagnostics/debugging)

If ToJSON/FromJSON fails or produces unexpected results, we can fall back to `CopyProcessor.CopyTable` for HTML extraction + PasteHtml for injection. This path is more complex (async injection) but is the battle-tested clipboard path.

---

## 5. Key Findings Summary

| Question | Answer |
|----------|--------|
| Can we extract HTML from a table inside callCommand? | **YES** — via `AscCommon.CopyProcessor.CopyTable()` directly on the internal CTable. No selection manipulation needed. |
| Can we extract a lossless snapshot inside callCommand? | **YES** — `apiTable.ToJSON(true, true)` captures everything as a JSON string. |
| Does PasteHtml recreate tables with formatting? | **YES** — borders, backgrounds, merges, widths, heights, cell content formatting all supported. But it's **ASYNC** — cannot run inside callCommand. |
| Can we reconstruct a table from JSON inside callCommand? | **YES** — `Api.FromJSON(jsonStr)` returns an ApiTable. **Synchronous.** |
| How to get ApiTable ref after PasteHtml? | Count tables before/after, or cursor position. **Fragile.** Not needed if using ToJSON/FromJSON path. |
| Can executeMethod be called from callCommand? | **NO** — executeMethod is async, callCommand is synchronous. They are separate execution contexts. |
| Is CopyProcessor available in callCommand scope? | **YES** — `AscCommon.CopyProcessor` is exported. `editor` global is available. |

---

## 6. Prototype Code Snippets

### 6a. Extraction via ToJSON (RECOMMENDED)

```js
// Inside callCommand, ES5 syntax
function captureTableSnapshot(apiTable) {
  try {
    // ToJSON captures: borders, backgrounds, merges, widths, heights,
    // fonts, images, numberings, styles — everything
    var json = apiTable.ToJSON(true, true);
    return json; // string
  } catch (e) {
    log("[Scribe] captureTableSnapshot failed: " + e.message);
    return null;
  }
}

// Usage during selection scan:
var tables = doc.GetAllTables();
var tableSnapshots = [];
for (var i = 0; i < tables.length; i++) {
  // ... (existing range overlap check) ...
  tableSnapshots.push(captureTableSnapshot(tables[i]));
}
// Store in Asc.scope.tableSnapshots = JSON.stringify(tableSnapshots);
```

### 6b. Extraction via CopyProcessor HTML (ALTERNATIVE)

```js
// Inside callCommand, ES5 syntax
function captureTableHtml(apiTable) {
  try {
    var table = apiTable.Table; // internal CTable
    var copyProcessor = new AscCommon.CopyProcessor(editor);
    var domRoot = copyProcessor.oRoot;

    // Ensure grid is calculated
    table.Recalculate_Grid();

    // CopyTable builds HTML DOM nodes on domRoot
    copyProcessor.CopyTable(domRoot, table, null);

    // Serialize to HTML string
    return domRoot.getInnerHtml();
  } catch (e) {
    log("[Scribe] captureTableHtml failed: " + e.message);
    return null;
  }
}
```

### 6c. Injection via FromJSON (RECOMMENDED)

```js
// Inside callCommand, ES5 syntax
function restoreTableFromSnapshot(snapshotJson) {
  try {
    var restoredTable = Api.FromJSON(snapshotJson);
    if (!restoredTable || restoredTable.GetClassType() !== "table") {
      return null;
    }
    return restoredTable; // ApiTable ready for InsertContent
  } catch (e) {
    log("[Scribe] restoreTableFromSnapshot failed: " + e.message);
    return null;
  }
}

// Usage during injection:
var snapshot = tableSnapshots[tableIndex];
var newTable = restoreTableFromSnapshot(snapshot);
if (newTable) {
  // Modify cells with LLM content
  for (var k = 0; k < modifiedCells.length; k++) {
    var mc = modifiedCells[k];
    var cell = newTable.GetRow(mc.r).GetCell(mc.c);
    replaceCellContent(cell.GetContent(), mc.content, fontFamily, fontSize);
  }
  // Push to content array
  content.push(newTable);
}
```

### 6d. Injection via PasteHtml (ALTERNATIVE — async, 2-step)

```js
// Step 1: outside callCommand
window.Asc.plugin.executeMethod("PasteHtml", [tableHtml], function() {
  // Table is now in the document
  // Step 2: callCommand to find and modify it
  window.Asc.plugin.callCommand(function() {
    var doc = Api.GetDocument();
    var tables = doc.GetAllTables();
    var pastedTable = tables[tables.length - 1]; // last table = just pasted
    // ... modify cells, build InsertContent array ...
  });
});
```

**Not recommended** due to async complexity and fragile table-finding logic.

---

## 7. Timing & Async Considerations

| Operation | Sync/Async | Works in callCommand? |
|-----------|-----------|----------------------|
| `apiTable.ToJSON()` | Sync | YES |
| `Api.FromJSON()` | Sync | YES |
| `AscCommon.CopyProcessor.CopyTable()` | Sync | YES |
| `executeMethod('PasteHtml')` | Async | NO |
| `executeMethod('GetSelectedContent')` | Async | NO |
| `doc.GetAllTables()` | Sync | YES |
| `doc.InsertContent()` | Sync | YES |
| `apiTable.Select()` | Sync | YES |
| `apiTable.Copy()` | Sync | YES |

---

## 8. Known Limitations & Gotchas

1. **ToJSON string size:** For tables with embedded images, the JSON string could be very large (images encoded as base64 or internal refs). This travels via postMessage (panel flow) — need to verify no size limits hit. If too large, consider compressing or chunking.

2. **FromJSON availability:** `Api.FromJSON` is a static method on the `Api` constructor. Inside callCommand, `Api` is a global — should work. Verify that `AscJsonConverter` is loaded in the callCommand scope.

3. **Table styles:** `ToJSON(true, true)` includes numberings and styles. The table style (e.g., "Grid Table 1 Light") may reference styles by name/ID. `FromJSON` re-resolves these — if the document has different styles, the result may differ. For our use case (same document, same session), this should not be an issue.

4. **Undo behavior:** `FromJSON` creates a new table object not tied to document history. When used with `InsertContent`, it becomes part of the undo stack via InsertContent's history point. This is the same as the current `Copy()` approach.

5. **CopyProcessor.CopyTable assumes document context:** It accesses `this.oDocument.Get_Theme()` and `this.oDocument.Get_ColorMap()` for color resolution. Inside callCommand, `editor.WordControl.m_oLogicDocument` should be the active document — this should work.

6. **Recalculate_Grid() requirement:** `CopyTable` calls `table.Recalculate_Grid()` internally (line 1224 of wordcopypaste.js). For safety, call it explicitly before CopyTable if the table was just modified.

7. **PasteHtml creates real DOM elements:** The `_pluginMethod_PasteHtml` implementation creates a `<div>` with `innerHTML`, appends it to `document.body`, then uses `asc_PasteData`. This requires a DOM environment — it will NOT work inside callCommand (no `document.body` in that scope). Confirms PasteHtml is strictly an executeMethod.

8. **ToJSON/FromJSON round-trip for images:** Images in tables may be referenced by internal URLs (rId references or media URLs). `ToJSON` serializes them; `FromJSON` needs the media to be available. In the same document session, internal refs should resolve. Needs testing with actual image-containing tables.

9. **Partial table selection:** For partial table snapshots, we still capture the FULL table via `apiTable.ToJSON()` (the ApiTable object represents the whole table). At injection, we restore the full table and only modify the cells that the LLM changed. Unmodified cells keep their original content from the snapshot.

10. **JSON vs HTML size comparison:** JSON snapshots from ToJSON include all internal properties (some redundant). HTML from CopyProcessor is typically more compact. For postMessage transport, either should be fine for typical tables (under 100KB). For tables with many images, monitor size.

---

## 9. Recommendation

**Use ToJSON/FromJSON as the primary snapshot mechanism.** It is:
- Fully synchronous (works inside callCommand for both extraction and injection)
- Lossless (captures everything OO knows about the table)
- Returns ApiTable directly (no table-finding after paste)
- Simpler code (no CopyProcessor instantiation, no selection manipulation)
- JSON-serializable string (travels via postMessage)

**Keep CopyProcessor HTML as a diagnostic tool** for debugging (can generate human-readable HTML of any table) but do not use it for the production pipeline.

**Do NOT use PasteHtml for table injection** — it is async (cannot run in callCommand) and requires fragile post-paste table detection. The current `Copy()` + `InsertContent` approach is already better, and `FromJSON` + `InsertContent` is the best option.

### Updated Architecture (revised from plan)

```
EXTRACTION (callCommand)              TRANSPORT                    INJECTION (callCommand)
------------------------              ---------                    ----------------------
For each TABLE:N in selection:        enrichedMd +                 For each [TABLE:N] in LLM response:
                                      tableSnapshots[]
|                                     travels via:                 |
+- [TABLE:N][CELL:r,c] markers      - SELECTION_CHANGED           1. restoredTable = Api.FromJSON(tableSnapshots[N])
|  (text content -> LLM)             - AI_TEXT_ASSISTANT              -> ApiTable with ALL formatting
|                                    - ScribeContext state
+- tableSnapshots[N] =              - PANEL_ACTION payload         2. Modify cells with LLM content:
     apiTable.ToJSON(true, true)                                      restoredTable.GetRow(r).GetCell(c)
     (JSON string)                                                    -> replaceCellContent()

     Captures EVERYTHING:                                          3. content.push(restoredTable)
     - borders, colors, fonts                                         for InsertContent
     - images (internal refs)
     - merges, widths, styles
     - numberings
```
