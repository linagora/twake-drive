# Phase 24: Table Round-Trip - Research

**Researched:** 2026-03-22
**Domain:** OnlyOffice table cell marker parsing, validation, preview reconstitution, in-place cell reinjection via Builder API
**Confidence:** HIGH

## Summary

Phase 24 completes the table round-trip: tables extracted in Phase 22 as `[CELL:r,c]text[/CELL]` markers must (1) be parsed from the LLM response, (2) validated for cell count coherence against the original extraction, (3) reconstituted as a markdown table for the preview panel, and (4) reinjected in-place into the original OO table with formatting that combines markdown styling with the source cell's font/size.

The extraction side is done (Phase 22, `extractTableCells` in code.js lines 1308-1332). The LLM sees cell markers and processes each cell's text individually (e.g., translating it). Phase 24 handles the four remaining pieces: Scribe-side marker parsing and validation (MARK-03), markdown table reconstitution for preview (MARK-04), in-place cell content replacement in the original OO table (REINJ-02), and formatting that combines md styling with source font/size (REINJ-03).

The key architectural insight is that table round-trip does NOT create a new ApiTable. Instead, it locates the original table in the document via `doc.GetAllTables()`, clears each cell's content, and rebuilds it from the LLM-processed text. This preserves the table's structure (borders, widths, merged cells, backgrounds) while only replacing text content. This is fundamentally different from Phase 21's markdown table injection which creates a new table from scratch.

**Primary recommendation:** In Plan 24-01, add cell marker parsing and validation in `ScribePopover.jsx` (or a utility) to parse `[CELL:r,c]text[/CELL]` markers from the LLM response, validate cell count matches the extraction, and reconstitute a markdown pipe-table for `MarkdownPreview`. In Plan 24-02, add a new `table_roundtrip` block type to `flattenTokens` and handle it in `buildAndInject`'s callCommand by locating the original table, reading each cell's source font/size, clearing cell content, and rebuilding with md-formatted runs.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXTR-03 | Les tableaux dans la selection sont detectes, leur texte est extrait cellule par cellule au format [CELL:r,c]...[/CELL] | Already implemented in Phase 22 (code.js extractTableCells). Phase 24 consumes these markers. |
| MARK-03 | Scribe parse les marqueurs cellule dans la reponse LLM et valide la coherrence (nombre de cellules) | Plan 24-01: Parse [CELL:r,c]text[/CELL] from LLM response with regex, count cells, compare against extraction count, show warning on mismatch. |
| MARK-04 | Scribe reconstitue un tableau markdown pour l'affichage utilisateur a partir des cellules traduites | Plan 24-01: Build a GFM pipe-table string from parsed cells (rows x cols grid), pass to MarkdownPreview which already renders tables via remark-gfm. |
| REINJ-02 | Les cellules traduites sont reinjectees dans le tableau OO d'origine (structure preservee: bordures, fonds, largeurs, fusions) | Plan 24-02: In callCommand, locate original table via GetAllTables, for each cell: Clear() content, rebuild paragraph with formatted runs. Table structure untouched. |
| REINJ-03 | Le formatage des cellules reinjectees applique le md (bold/italic/etc.) + font/size du 1er paragraphe source | Plan 24-02: Before clearing, read GetTextPr() from first paragraph's first run to capture font family and size. Apply these as base style on all rebuilt runs, layering md formatting on top. |
</phase_requirements>

## Architecture Patterns

### Data Flow Overview

```
Phase 22 (done):
  OO table in selection -> extractTableCells(table) -> enrichedMd with:
    [CELL:0,0]Header 1[/CELL]
    [CELL:0,1]Header 2[/CELL]
    [CELL:1,0]Data 1[/CELL]
    [CELL:1,1]Data 2[/CELL]
  -> sent to Scribe React via enrichedMd in AI_TEXT_ASSISTANT intent

LLM processing:
  System prompt preserves [CELL:r,c]...[/CELL] markers
  LLM translates/modifies text INSIDE markers only
  Response example:
    [CELL:0,0]En-tete 1[/CELL]
    [CELL:0,1]En-tete 2[/CELL]
    [CELL:1,0]Donnee 1[/CELL]
    [CELL:1,1]Donnee 2[/CELL]

Phase 24 Plan 24-01 (preview):
  LLM response markdown (with cell markers)
  -> parseCellMarkers(md) extracts cells array
  -> validateCellCount(extracted, response) checks coherence
  -> reconstructTable(cells) builds GFM pipe table
  -> MarkdownPreview renders via existing table components

Phase 24 Plan 24-02 (reinjection):
  LLM response markdown (with cell markers + possibly regular text)
  -> flattenTokens recognizes cell marker block
  -> buildAndInject callCommand:
     1. Locate original table via GetAllTables() + position matching
     2. For each [CELL:r,c]: read source cell font/size, Clear() cell, rebuild with md runs
     3. Non-table text goes through standard pipeline
```

### Plan 24-01: Marker Parsing and Preview

**Cell marker parsing** needs to happen BEFORE the markdown is passed to `MarkdownPreview` (react-markdown). The `[CELL:r,c]...[/CELL]` syntax is not standard markdown and would be rendered as plain text. The solution is:

1. Parse cell markers from the LLM response using regex
2. Validate cell count against the original extraction
3. Replace the cell marker block with a reconstructed GFM pipe table
4. Pass the transformed markdown to MarkdownPreview

```javascript
// Cell marker regex -- captures row, col, and content
const CELL_REGEX = /\[CELL:(\d+),(\d+)\]([\s\S]*?)\[\/CELL\]/g

function parseCellMarkers(md) {
  const cells = []
  let match
  while ((match = CELL_REGEX.exec(md)) !== null) {
    cells.push({
      row: parseInt(match[1], 10),
      col: parseInt(match[2], 10),
      text: match[3]
    })
  }
  return cells
}

function reconstructMarkdownTable(cells) {
  if (cells.length === 0) return ''
  // Determine grid dimensions
  let maxRow = 0, maxCol = 0
  for (const c of cells) {
    if (c.row > maxRow) maxRow = c.row
    if (c.col > maxCol) maxCol = c.col
  }
  // Build grid
  const grid = Array.from({ length: maxRow + 1 }, () =>
    Array(maxCol + 1).fill('')
  )
  for (const c of cells) {
    grid[c.row][c.col] = c.text.trim()
  }
  // Build GFM pipe table
  const lines = []
  for (let r = 0; r <= maxRow; r++) {
    lines.push('| ' + grid[r].join(' | ') + ' |')
    if (r === 0) {
      lines.push('| ' + grid[r].map(() => '---').join(' | ') + ' |')
    }
  }
  return lines.join('\n')
}
```

**Where to place this logic:** In `ScribePopover.jsx`, before passing the LLM result to `MarkdownPreview`. The `setResult` flow already stores the raw LLM response. Add a pre-processing step that:
1. Detects if the response contains `[CELL:` markers
2. Parses and validates them
3. Replaces the marker block with a pipe table
4. Stores validation warnings if cell count mismatches

**Cell count source:** The original extraction's enrichedMd is available in the ScribePopover scope. Parse the extraction's cell markers to get the expected count, then compare with the LLM response count.

### Plan 24-02: In-Place Cell Reinjection

**This is fundamentally different from creating a new table.** The strategy:

1. In `flattenTokens`, detect `[CELL:r,c]...[/CELL]` patterns and emit a new block type: `table_roundtrip`
2. In `buildAndInject` callCommand, find the original OO table and modify cells in-place

**Pre-processing cell markers in buildAndInject:**

Before calling `marked.lexer()`, extract cell marker blocks from the md string, parse them separately, and pass them via Asc.scope alongside the regular tokens:

```javascript
// In buildAndInject, BEFORE marked.lexer():
// 1. Extract cell marker blocks from md
// 2. Remove them from md (so marked.lexer processes only regular text)
// 3. Parse cells and pass via Asc.scope

var cellMarkerBlock = '';
var cellRegex = /\[CELL:\d+,\d+\][\s\S]*?\[\/CELL\]/g;
var cellMatches = md.match(cellRegex);
if (cellMatches) {
  // Remove all cell markers from md for standard processing
  var cleanMd = md.replace(/\[CELL:\d+,\d+\][\s\S]*?\[\/CELL\]\n?/g, '');
  // Parse cells
  var cells = [];
  var cellPattern = /\[CELL:(\d+),(\d+)\]([\s\S]*?)\[\/CELL\]/g;
  var m;
  while ((m = cellPattern.exec(md)) !== null) {
    cells.push({ r: parseInt(m[1]), c: parseInt(m[2]), text: m[3] });
  }
  Asc.scope.tableCells = JSON.stringify(cells);
  md = cleanMd;
}
```

**Inside callCommand -- locating the original table:**

```javascript
// ES5 inside callCommand
var tableCellsJson = Asc.scope.tableCells;
if (tableCellsJson) {
  var tableCells = JSON.parse(tableCellsJson);
  // Find the table in the selection
  var selRange = doc.GetRangeBySelect();
  var allTables = doc.GetAllTables();
  var targetTable = null;
  if (selRange) {
    var selStart = selRange.GetStartPos();
    var selEnd = selRange.GetEndPos();
    for (var t = 0; t < allTables.length; t++) {
      var tblRange = allTables[t].GetRange();
      if (tblRange) {
        var tStart = tblRange.GetStartPos();
        var tEnd = tblRange.GetEndPos();
        if (tEnd >= selStart && tStart <= selEnd) {
          targetTable = allTables[t];
          break;
        }
      }
    }
  }

  if (targetTable) {
    // Read source font/size per cell BEFORE any modifications
    var cellFonts = {};  // "r,c" -> { family, size }
    for (var ci = 0; ci < tableCells.length; ci++) {
      var tc = tableCells[ci];
      var key = tc.r + "," + tc.c;
      var srcCell = targetTable.GetCell(tc.r, tc.c);
      if (srcCell) {
        var srcContent = srcCell.GetContent();
        if (srcContent && srcContent.GetElementsCount() > 0) {
          var firstPara = srcContent.GetElement(0);
          if (firstPara && firstPara.GetClassType && firstPara.GetClassType() === "paragraph") {
            // Read font from first run in first paragraph
            var elemCount = firstPara.GetElementsCount();
            for (var ei = 0; ei < elemCount; ei++) {
              var elem = firstPara.GetElement(ei);
              if (elem.GetClassType && elem.GetClassType() === "run") {
                var tp = elem.GetTextPr ? elem.GetTextPr() : null;
                if (tp) {
                  cellFonts[key] = {
                    family: tp.GetFontFamily() || srcFontFamily,
                    size: tp.GetFontSize() || srcFontSize
                  };
                }
                break;
              }
            }
          }
        }
        if (!cellFonts[key]) {
          cellFonts[key] = { family: srcFontFamily, size: srcFontSize };
        }
      }
    }

    // Now clear and rebuild each cell
    for (var ci2 = 0; ci2 < tableCells.length; ci2++) {
      var tc2 = tableCells[ci2];
      var cell = targetTable.GetCell(tc2.r, tc2.c);
      if (!cell) continue;
      cell.Clear();
      var cellContent = cell.GetContent();
      var cellPara = cellContent.GetElement(0);
      if (!cellPara) continue;

      // Parse cell text as markdown to get inline formatting
      var cellTokens = marked.lexer(tc2.text);
      var cellBlocks = flattenTokens(cellTokens);  // Note: flattenTokens defined outside callCommand
      // ... but flattenTokens is in plugin scope, not callCommand scope.
      // Solution: parse inline runs manually or pass pre-flattened tokens
    }
  }
}
```

**Critical constraint: flattenTokens is outside callCommand.** The solution is to pre-flatten cell text BEFORE passing to callCommand:

```javascript
// In buildAndInject (plugin scope), BEFORE callCommand:
if (cellMatches) {
  var cells = [];
  var cellPattern = /\[CELL:(\d+),(\d+)\]([\s\S]*?)\[\/CELL\]/g;
  var m;
  while ((m = cellPattern.exec(md)) !== null) {
    // Parse cell markdown to get inline runs
    var cellMdText = m[3];
    var cellTokens = window.marked.lexer(cellMdText);
    var cellBlocks = flattenTokens(cellTokens);
    // Each cell typically produces a single paragraph block with runs
    var runs = [];
    for (var cb = 0; cb < cellBlocks.length; cb++) {
      if (cellBlocks[cb].runs) {
        runs = runs.concat(cellBlocks[cb].runs);
      }
    }
    cells.push({ r: parseInt(m[1]), c: parseInt(m[2]), runs: runs });
  }
  Asc.scope.tableCells = JSON.stringify(cells);
}
```

This way, `flattenTokens` runs in the plugin iframe where `marked` and the function are available, and the callCommand receives pre-flattened runs.

### Mixed Content: Text + Table

When the selection contains both regular text and a table, the enrichedMd looks like:

```
Some regular text paragraph.

[CELL:0,0]Header[/CELL]
[CELL:0,1]Header 2[/CELL]
[CELL:1,0]Data[/CELL]
[CELL:1,1]Data 2[/CELL]

Another paragraph after the table.
```

The LLM returns the same structure with modified text. The strategy:
1. Extract cell marker blocks from the LLM response (save them separately)
2. Remove cell markers from the md string
3. Process the remaining text through the standard `marked.lexer() -> flattenTokens -> buildAndInject` pipeline
4. Handle cell reinjection as a separate step within the same callCommand

**Important:** The standard text pipeline replaces the selection (which includes the table). But we do NOT want to replace the table -- we want to modify it in-place. This means:

**Strategy A (recommended): Process table cells BEFORE InsertContent replaces the selection.**
1. Inside callCommand, first handle table cell reinjection (Clear + rebuild each cell)
2. Then adjust the selection to exclude the table
3. Then InsertContent the regular text blocks

**Strategy B: Two-pass approach.**
1. First callCommand: rewrite table cells in-place
2. Second callCommand: replace non-table text via standard pipeline
This would break the single-undo requirement.

**Strategy A is correct.** The sequence inside callCommand:
1. Read source font/size for all cells
2. Clear and rebuild each cell with LLM-processed content
3. Adjust selection to exclude the table range
4. InsertContent for the regular text blocks (tables are now already updated)

### Anti-Patterns to Avoid
- **Creating a new ApiTable for round-trip:** The entire point of table round-trip is to preserve the ORIGINAL table's structure. Never create `Api.CreateTable` for this path.
- **Sending raw table markdown to marked.lexer:** The `[CELL:r,c]...[/CELL]` syntax is not markdown. It must be extracted and parsed separately BEFORE calling `marked.lexer`.
- **Modifying table structure (add/remove rows/cols):** If the LLM response has different cell count, warn the user but do NOT modify the table structure. Only update cells that exist in both extraction and response.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table structure creation | ApiTable for round-trip | In-place cell.Clear() + rebuild | Preserves borders, widths, merged cells, backgrounds |
| Cell markdown parsing | Custom inline parser | `marked.lexer()` + existing `flattenTokens` | Already handles bold, italic, strikethrough, code, links |
| Markdown table preview | Custom HTML table builder | GFM pipe-table string + existing MarkdownPreview with remark-gfm | react-markdown already renders tables with theme-aware styling |
| Font/size reading | Manual property enumeration | `GetTextPr().GetFontFamily()` / `.GetFontSize()` | Same pattern already used for srcFontFamily/srcFontSize |

## Common Pitfalls

### Pitfall 1: Cell Markers Not Recognized by marked.lexer
**What goes wrong:** `[CELL:0,0]text[/CELL]` is treated as plain text by marked, producing garbled output.
**Why it happens:** This is custom syntax, not standard markdown.
**How to avoid:** Extract and remove cell marker blocks from the md string BEFORE passing to `marked.lexer()`. Process cells separately.
**Warning signs:** Cell marker text appearing verbatim in the document.

### Pitfall 2: flattenTokens Not Available Inside callCommand
**What goes wrong:** Trying to call `flattenTokens` or `marked.lexer` inside the callCommand sandbox.
**Why it happens:** callCommand runs in OO's isolated sandbox with no access to plugin-scope functions or window.marked.
**How to avoid:** Pre-flatten cell content runs in the plugin iframe scope, pass pre-parsed runs via `Asc.scope.tableCells`.
**Warning signs:** ReferenceError for `marked` or `flattenTokens` inside callCommand.

### Pitfall 3: Table Selection and InsertContent Conflict
**What goes wrong:** InsertContent in replace mode destroys the table (which is part of the selection) before cell reinjection.
**Why it happens:** The selection includes the table. Replace mode removes the selection first.
**How to avoid:** Modify table cells in-place FIRST, then adjust the selection to exclude the table, then InsertContent for non-table content. If the selection is table-only, skip InsertContent entirely.
**Warning signs:** Table disappearing after injection, or duplicate tables appearing.

### Pitfall 4: ES5 Constraint in callCommand
**What goes wrong:** Using `const`, `let`, arrow functions, `Object.keys()`, template literals, `for...of` inside callCommand.
**Why it happens:** Natural tendency to write modern JS when adding complex logic.
**How to avoid:** All code inside callCommand must use `var`, `function`, string concatenation, `for` loops, and `hasOwnProperty`.
**Warning signs:** Silent failures or SyntaxError in OO console.

### Pitfall 5: LLM Strips or Modifies Cell Markers
**What goes wrong:** LLM removes `[CELL:r,c]` / `[/CELL]` tags, or changes row/col numbers, or merges cells.
**Why it happens:** LLMs may interpret bracket syntax as something to modify.
**How to avoid:** The system prompt already says "Preserve any Markdown formatting." May need to add explicit instruction: "Preserve all [CELL:r,c]...[/CELL] markers exactly. Only modify the text between markers." Validation (MARK-03) catches mismatches.
**Warning signs:** Cell count mismatch in validation, missing cells in response.

### Pitfall 6: Cell Content with Newlines
**What goes wrong:** A cell's text may contain newlines (multi-paragraph cells). The regex `[\s\S]*?` handles this, but the GFM pipe table format does not support multi-line cell content.
**Why it happens:** OO table cells can contain multiple paragraphs.
**How to avoid:** In preview reconstitution, join multi-paragraph cell content with `<br>` or space. For reinjection, the pre-flattened runs handle multi-block cell content naturally (multiple paragraph blocks per cell).
**Warning signs:** Preview table breaking visually on multi-paragraph cells.

### Pitfall 7: Multiple Tables in Selection
**What goes wrong:** If the selection contains more than one table, the position-based matching may fail or match the wrong table.
**Why it happens:** `GetAllTables()` returns all document tables; multiple may overlap the selection.
**How to avoid:** Support multiple tables by matching cell markers to tables. The extraction emits cells for each table sequentially -- the row indices reset per table. However, current extraction does NOT distinguish between tables. This is a limitation: for v2.5, support single-table selections only. Document this as out of scope.
**Warning signs:** Cell content injected into wrong table.

## Code Examples

### Cell Marker Regex Parsing (JavaScript)
```javascript
// Parses [CELL:r,c]text[/CELL] markers from LLM response
const CELL_REGEX = /\[CELL:(\d+),(\d+)\]([\s\S]*?)\[\/CELL\]/g

function parseCellMarkers(text) {
  const cells = []
  let m
  // Reset regex lastIndex for reuse
  CELL_REGEX.lastIndex = 0
  while ((m = CELL_REGEX.exec(text)) !== null) {
    cells.push({
      row: parseInt(m[1], 10),
      col: parseInt(m[2], 10),
      text: m[3]
    })
  }
  return cells
}
```

### GFM Pipe Table Reconstitution (JavaScript)
```javascript
function cellsToMarkdownTable(cells) {
  if (cells.length === 0) return ''
  let maxRow = 0, maxCol = 0
  for (const c of cells) {
    if (c.row > maxRow) maxRow = c.row
    if (c.col > maxCol) maxCol = c.col
  }
  const grid = Array.from({ length: maxRow + 1 }, () =>
    Array(maxCol + 1).fill('')
  )
  for (const c of cells) {
    // Replace newlines with space for GFM compatibility
    grid[c.row][c.col] = c.text.trim().replace(/\n/g, ' ')
  }
  const lines = []
  for (let r = 0; r <= maxRow; r++) {
    lines.push('| ' + grid[r].join(' | ') + ' |')
    if (r === 0) {
      lines.push('| ' + grid[r].map(() => '---').join(' | ') + ' |')
    }
  }
  return lines.join('\n')
}
```

### Pre-flattening Cell Runs in Plugin Scope (ES5)
```javascript
// In buildAndInject, BEFORE Asc.plugin.callCommand
var cellPattern = /\[CELL:(\d+),(\d+)\]([\s\S]*?)\[\/CELL\]/g;
var cellMatch;
var parsedCells = [];
while ((cellMatch = cellPattern.exec(md)) !== null) {
  var cellText = cellMatch[3];
  var cellTokens = window.marked.lexer(cellText);
  var cellBlocks = flattenTokens(cellTokens);
  var cellRuns = [];
  for (var cb = 0; cb < cellBlocks.length; cb++) {
    if (cellBlocks[cb].runs) {
      for (var cr = 0; cr < cellBlocks[cb].runs.length; cr++) {
        cellRuns.push(cellBlocks[cb].runs[cr]);
      }
    }
  }
  parsedCells.push({
    r: parseInt(cellMatch[1]),
    c: parseInt(cellMatch[2]),
    runs: cellRuns
  });
}
// Remove cell markers from md for standard pipeline
var cleanMd = md.replace(/\[CELL:\d+,\d+\][\s\S]*?\[\/CELL\]\n?/g, "");
```

### In-Place Cell Reinjection in callCommand (ES5)
```javascript
// Inside callCommand — ES5 only
var tableCellsJson = Asc.scope.tableCells;
if (tableCellsJson) {
  var tableCells = JSON.parse(tableCellsJson);
  var selRange = doc.GetRangeBySelect();
  var allTables = doc.GetAllTables();
  var targetTable = null;

  if (selRange) {
    var selStart = selRange.GetStartPos();
    var selEnd = selRange.GetEndPos();
    for (var t = 0; t < allTables.length; t++) {
      var tblRange = allTables[t].GetRange();
      if (tblRange) {
        var ts = tblRange.GetStartPos();
        var te = tblRange.GetEndPos();
        if (te >= selStart && ts <= selEnd) {
          targetTable = allTables[t];
          break;
        }
      }
    }
  }

  if (targetTable) {
    // Step 1: Read source font/size per cell
    var cellFonts = {};
    for (var ci = 0; ci < tableCells.length; ci++) {
      var tc = tableCells[ci];
      var fKey = tc.r + "," + tc.c;
      var srcCell = targetTable.GetCell(tc.r, tc.c);
      if (srcCell) {
        var srcContent = srcCell.GetContent();
        if (srcContent && srcContent.GetElementsCount() > 0) {
          var fp = srcContent.GetElement(0);
          if (fp && fp.GetElementsCount) {
            for (var fe = 0; fe < fp.GetElementsCount(); fe++) {
              var fElem = fp.GetElement(fe);
              if (fElem.GetClassType && fElem.GetClassType() === "run") {
                var fTp = fElem.GetTextPr ? fElem.GetTextPr() : null;
                if (fTp) {
                  cellFonts[fKey] = {
                    family: fTp.GetFontFamily() || null,
                    size: fTp.GetFontSize() || null
                  };
                }
                break;
              }
            }
          }
        }
      }
      if (!cellFonts[fKey]) {
        cellFonts[fKey] = { family: srcFontFamily, size: srcFontSize };
      }
    }

    // Step 2: Clear and rebuild each cell
    for (var ci2 = 0; ci2 < tableCells.length; ci2++) {
      var tc2 = tableCells[ci2];
      var cell = targetTable.GetCell(tc2.r, tc2.c);
      if (!cell) continue;
      cell.Clear();
      var cc = cell.GetContent();
      if (!cc || cc.GetElementsCount() === 0) continue;
      var cp = cc.GetElement(0);
      if (!cp) continue;

      var cf = cellFonts[tc2.r + "," + tc2.c] || {};
      var runs = tc2.runs || [];
      for (var rr = 0; rr < runs.length; rr++) {
        var run = runs[rr];
        if (run.link) {
          var link = Api.CreateHyperlink(run.link, run.text, "");
          cp.AddElement(link);
        } else {
          var r = Api.CreateRun();
          r.AddText(run.text);
          if (run.bold) r.SetBold(true);
          if (run.italic) r.SetItalic(true);
          if (run.strikethrough) r.SetStrikeout(true);
          if (run.code) {
            r.SetFontFamily("Courier New");
            if (cf.size) r.SetFontSize(cf.size);
          } else {
            if (cf.family) r.SetFontFamily(cf.family);
            if (cf.size) r.SetFontSize(cf.size);
          }
          cp.AddElement(r);
        }
      }
    }
  }
}
```

### Reading Cell Font Properties (Verified: OO API)
```javascript
// Source: https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiTableCell/
// GetContent() -> ApiDocumentContent, GetElement(0) -> first paragraph
// Then GetElement(0) on paragraph -> first run, GetTextPr() -> ApiTextPr
var cell = table.GetCell(row, col);
var content = cell.GetContent();
var firstPara = content.GetElement(0);
var firstRun = firstPara.GetElement(0);  // first run element
var textPr = firstRun.GetTextPr();
var family = textPr.GetFontFamily();
var size = textPr.GetFontSize();
```

### Clearing Cell Content (Verified: OO API)
```javascript
// Source: https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiTableCell/
// Clear() removes all content from the cell
// After Clear(), GetContent().GetElement(0) returns an empty paragraph
cell.Clear();
var emptyPara = cell.GetContent().GetElement(0);
// Add new runs to emptyPara
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tables stripped during extraction | Tables preserved as cell markers (Phase 22) | Phase 22 | Table text no longer lost during LLM round-trip |
| No table preview after LLM | Reconstituted markdown table in preview | Phase 24 (this phase) | User sees translated/modified table before injection |
| No cell validation | Cell count coherence check | Phase 24 (this phase) | User warned if LLM corrupted table structure |
| New table created for markdown tables | In-place cell reinjection for round-trip | Phase 24 (this phase) | Original table structure (borders, widths, etc.) preserved |

## Open Questions

1. **Multiple tables in a single selection**
   - What we know: The current extraction emits cells for each table sequentially, but row indices reset per table. There is no table ID or separator in the marker format.
   - What's unclear: How to distinguish cells from table A vs table B in the LLM response.
   - Recommendation: For v2.5, document as limitation: support single-table selections only. If multiple tables detected, fall back to text-only processing for the table content.

2. **Cell.Clear() behavior after clearing**
   - What we know: `Clear()` is documented to clear cell content and return boolean.
   - What's unclear: Whether `GetContent().GetElement(0)` returns a usable empty paragraph after `Clear()`, or if a new paragraph needs to be created.
   - Recommendation: Test empirically. If no paragraph exists after Clear(), use `cell.GetContent().AddElement(Api.CreateParagraph(), 0)` to add one.

3. **Selection adjustment for mixed text+table content**
   - What we know: In replace mode, the selection includes the table. Table cells are modified in-place, but the non-table text needs to be replaced via InsertContent.
   - What's unclear: How to select only the non-table portions of the selection for InsertContent.
   - Recommendation: If the selection contains both text and a table, the simplest approach is to handle it in two steps within the same callCommand: (a) modify table cells in-place, (b) for non-table text, determine if there is text before/after the table, select that range, and InsertContent. If this proves too complex, an acceptable v2.5 simplification is to handle table-only selections first, and text+table as a follow-up.

4. **System prompt for cell marker preservation**
   - What we know: Current system prompt says "Preserve any Markdown formatting." Cell markers are not markdown.
   - What's unclear: Whether LLMs reliably preserve `[CELL:r,c]...[/CELL]` tags.
   - Recommendation: Add explicit instruction to system prompt when cell markers are present: "Preserve all [CELL:r,c]...[/CELL] markers exactly as-is. Only modify the text content between opening and closing tags."

## Sources

### Primary (HIGH confidence)
- [ApiTableCell](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiTableCell/) - GetContent(), Clear(), SetTextPr()
- [ApiTable](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiTable/) - GetCell(row, col), GetRowsCount(), GetRow(), Clear()
- [ApiTableRow](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiTableRow/) - GetCellsCount(), GetCell()
- Existing codebase: `plugins/onlyoffice-scribe/scripts/code.js` -- extractTableCells (lines 1308-1332), existing table injection via ApiTable (lines 586-659), buildAndInject (lines 249-850+), flattenTokens (lines 93-242)
- Existing codebase: `src/modules/views/OnlyOffice/Scribe/MarkdownPreview.jsx` -- react-markdown with remark-gfm, table components
- Existing codebase: `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` -- enrichedMd flow, result handling
- Phase 22-02-SUMMARY.md: Confirmed cell marker contract [CELL:r,c]text[/CELL]
- Phase 21-02-SUMMARY.md: Confirmed ApiTable creation pattern and fillCell helper

### Secondary (MEDIUM confidence)
- OO API GetAllTables() -- used in extraction (line 1351), verified working
- Cell.Clear() behavior -- documented in API, but post-clear paragraph state needs empirical validation

### Tertiary (LOW confidence)
- Selection adjustment for mixed text+table content -- complex interaction, needs empirical validation
- LLM cell marker preservation -- depends on model behavior with custom syntax

## Metadata

**Confidence breakdown:**
- Cell marker parsing (Plan 24-01): HIGH - straightforward regex parsing and GFM table generation
- Preview reconstitution (Plan 24-01): HIGH - remark-gfm already renders pipe tables
- Validation (Plan 24-01): HIGH - simple count comparison
- In-place cell reinjection (Plan 24-02): MEDIUM - API methods are documented, but Clear() post-state and selection adjustment need validation
- Mixed content handling (Plan 24-02): MEDIUM - conceptually clear but complex implementation
- Overall architecture: HIGH - builds directly on Phase 22 extraction and Phase 21 table patterns

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable -- OO API and marker contract are fixed)
