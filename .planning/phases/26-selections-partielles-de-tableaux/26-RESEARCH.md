# Phase 26: Selections Partielles de Tableaux - Research

**Researched:** 2026-03-24
**Domain:** OO table partial selection detection, cell-level extraction scoping, ambiguity detection, selective injection
**Confidence:** MEDIUM

## Summary

Phase 26 extends the existing table round-trip pipeline (Phase 24/24.1) to handle cases where the user selects only part of a table. Currently, extraction always processes ALL cells of any table that overlaps the selection, regardless of which rows/columns the user actually selected. This phase must (1) detect which specific cells are within the selection, (2) extract only those cells, (3) inject LLM results back into only those cells, and (4) detect and report ambiguous selection patterns.

The core technical challenge is that OO's `GetRangeBySelect()` returns a range with start/end positions, but there is no direct API to ask "which table cells are selected." The approach must compare the selection range against individual cell ranges to determine inclusion. The `ApiParagraph.GetParentTableCell()` and `ApiTableCell.GetRowIndex()` / `ApiTableCell.GetIndex()` methods provide the necessary cell-position information. For ambiguity detection, we need to check whether the selection cleanly covers complete rows (or complete cell content), vs. cutting through the middle of a cell's text.

The injection side is simpler: since the clone-based architecture (Phase 24.1) already modifies specific cells by `[CELL:r,c]` coordinates, partial selection support mainly means cloning the original table but only modifying the cells that were extracted. The remaining cells retain their original content from the clone.

**Primary recommendation:** Modify extraction to filter cells by selection range overlap, emit only selected cells as `[CELL:r,c]` markers, and add ambiguity detection before extraction. On the injection side, the clone approach already handles this naturally -- unmodified cells in the clone retain their original content.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TBL-01 | Quand la selection ne couvre qu'une partie d'un tableau (lignes/colonnes partielles), Scribe traite correctement les cellules selectionnees sans casser la structure du tableau | Extraction filtering via cell range overlap; clone-based injection naturally preserves unmodified cells; `GetParentTableCell()`, `GetRowIndex()`, `GetIndex()` APIs provide cell position |
| TBL-02 | Scribe detecte et signale a l'utilisateur quand la selection coupe un tableau de maniere ambigue | Ambiguity detection by comparing selection boundaries against cell boundaries; partial cell content overlap = ambiguous; merged cell detection via row.GetCellsCount() mismatch |
</phase_requirements>

## Architecture Patterns

### Current Table Extraction Flow (Phase 24.1)

```
1. GetRangeBySelect() -> selection range (startPos, endPos)
2. GetAllTables() -> find tables whose range overlaps selection
3. For each overlapping table: extractTableCells(table)
   -> iterates ALL rows, ALL cells
   -> emits [TABLE:N]\n[CELL:r,c]...[/CELL]\n...[/TABLE]
4. Paragraphs inside table range are skipped (insideTable flag)
```

**Problem:** Step 3 extracts ALL cells regardless of what the user selected. A user selecting rows 2-4 of a 10-row table gets all 10 rows extracted.

### Proposed Partial Selection Flow

```
1. GetRangeBySelect() -> selection range (startPos, endPos)
2. GetAllTables() -> find tables whose range overlaps selection
3. For each overlapping table:
   a. Determine if table is FULLY inside selection -> extract all cells (current behavior)
   b. If table is PARTIALLY inside selection:
      i.  Run ambiguity check (see below)
      ii. If ambiguous -> return error flag, show user message
      iii. If not ambiguous -> extractPartialTableCells(table, selStart, selEnd)
          -> iterates rows/cells, checks each cell's range against selection
          -> emits only cells whose range is inside the selection
4. On injection: clone table, modify only the cells listed in [CELL:r,c] markers
   (other cells in clone retain original content)
```

### Cell Range Detection Strategy

The key insight is using paragraph-level position data to determine which cells are "in" the selection:

```javascript
// ES5 inside callCommand
function getCellRange(table, r, c) {
  var cell = table.GetCell(r, c);
  if (!cell) return null;
  var content = cell.GetContent();
  if (!content || content.GetElementsCount() === 0) return null;
  // Get range of first and last paragraphs in cell
  var firstPara = content.GetElement(0);
  var lastPara = content.GetElement(content.GetElementsCount() - 1);
  var firstRange = firstPara.GetRange();
  var lastRange = lastPara.GetRange();
  if (!firstRange || !lastRange) return null;
  return {
    start: firstRange.GetStartPos(),
    end: lastRange.GetEndPos()
  };
}
```

A cell is "selected" if its range overlaps the selection range:
- **Fully contained:** `cellStart >= selStart && cellEnd <= selEnd` -- clearly selected
- **Partial overlap:** `cellStart < selStart || cellEnd > selEnd` -- ambiguous (selection cuts through cell content)

### Ambiguity Detection Rules

A partial table selection is **ambiguous** when:

1. **Selection starts mid-cell:** The selection startPos falls between a cell's startPos and endPos (not at the cell boundary). This means the user selected only part of a cell's text.

2. **Selection ends mid-cell:** The selection endPos falls between a cell's startPos and endPos.

3. **Merged cells with partial row coverage:** The selection covers some but not all cells in a row that has merged cells (different `GetCellsCount()` per row indicates merges).

A partial table selection is **valid** (not ambiguous) when:

1. **Complete rows selected:** All cells in each selected row have their full range within the selection.

2. **Full table selected:** The entire table range is within the selection (current behavior).

3. **Selection starts/ends at cell boundaries:** Even if only some rows are selected, the selection cleanly starts at the beginning of a cell and ends at the end of a cell.

### Ambiguity Detection Implementation

```javascript
// ES5 inside callCommand
function checkTableSelectionAmbiguity(table, selStart, selEnd) {
  var rowCount = table.GetRowsCount();
  var issues = [];
  var selectedRows = [];
  var partialCells = [];

  for (var r = 0; r < rowCount; r++) {
    var row = table.GetRow(r);
    var cellCount = row.GetCellsCount();
    var rowFullyInside = true;
    var rowPartiallyInside = false;

    for (var c = 0; c < cellCount; c++) {
      var cellRange = getCellRange(table, r, c);
      if (!cellRange) continue;

      var fullyInside = cellRange.start >= selStart && cellRange.end <= selEnd;
      var overlaps = cellRange.end >= selStart && cellRange.start <= selEnd;
      var partialOverlap = overlaps && !fullyInside;

      if (partialOverlap) {
        partialCells.push({ r: r, c: c });
        rowPartiallyInside = true;
      }
      if (!fullyInside) rowFullyInside = false;
      if (overlaps) rowPartiallyInside = true;
    }

    if (rowFullyInside) selectedRows.push(r);
  }

  if (partialCells.length > 0) {
    return {
      ambiguous: true,
      reason: "selection_cuts_cell",
      partialCells: partialCells
    };
  }

  return { ambiguous: false, selectedRows: selectedRows };
}
```

### Injection Side: No Major Changes Needed

The clone-based injection (Phase 24.1) already works cell-by-cell:
1. Clone the original table via `Copy()`
2. For each `[CELL:r,c]` in the LLM response, modify that cell in the clone
3. Push clone to `content[]` for `InsertContent`

For partial selection, the clone contains ALL cells (unchanged), and only the cells that were extracted/processed get modified. **The unmodified cells automatically retain their original content.** This is the key architectural advantage of the clone approach.

However, there is a subtlety: in **Replace mode**, `InsertContent` replaces the selection. If the selection only covers part of the table, the clone (which is a full table) replaces just that part, potentially creating a layout issue. This needs careful handling:

**Strategy for Replace mode with partial table:**
- Clone the table
- Modify only the selected cells in the clone
- The selection covers part of the table, so `InsertContent` with the full clone would insert a complete table where only part was selected
- **Better approach:** Do NOT use InsertContent for the table. Instead, modify cells in-place in the ORIGINAL table (revert to the in-place approach from Phase 24, but only for the selected cells)
- For partial table selections, in-place modification is actually the correct approach since we want to preserve the table structure and only change specific cells

**This is a key architectural decision:** For partial table selection, use in-place cell modification (not clone+InsertContent). For full table selection, continue using clone+InsertContent (current behavior).

### Recommended Project Structure (Changes)

```
plugins/onlyoffice-scribe/scripts/code.js
  extractTableCells(table)            -- existing, extracts ALL cells
  extractPartialTableCells(table, selStart, selEnd)  -- NEW: extracts only selected cells
  checkTableSelectionAmbiguity(table, selStart, selEnd)  -- NEW: ambiguity detection

src/modules/views/OnlyOffice/Scribe/tableCellMarkers.js
  (no changes needed -- parsing [CELL:r,c] markers works regardless of which cells are present)

src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx
  (add ambiguity error display -- e.g. Snackbar or inline warning)
```

### Data Flow for Partial Selection

```
Extraction:
  User selects rows 2-4 of a 6-row table
  -> checkTableSelectionAmbiguity: no partial cells -> valid
  -> extractPartialTableCells: emits only cells for rows 2-4
  -> enrichedMd: [TABLE:0]\n[CELL:2,0]...[CELL:4,2]...\n[/TABLE]
  -> Scribe sends to LLM with existing system prompt

LLM Response:
  [TABLE:0]\n[CELL:2,0]modified...[CELL:4,2]modified...\n[/TABLE]

Preview:
  transformCellMarkersForPreview renders a 3-row table (rows 2-4 only)
  (existing code already handles arbitrary cell indices)

Injection (Replace mode):
  -> Detect partial table (cells don't cover all rows)
  -> Use in-place modification on original table (not clone+InsertContent)
  -> For each [CELL:r,c]: find original table, modify that cell
  -> Non-mentioned cells stay untouched

Injection (Insert mode):
  -> Partial table insert doesn't make semantic sense (insert a sub-table?)
  -> Recommendation: disable Insert mode for partial table selections
  -> Show user message: "Insert is not available for partial table selections"
```

### Ambiguity UX Pattern

When ambiguity is detected, communicate via the existing intent protocol:

```javascript
// In extraction callCommand, if ambiguous:
return JSON.stringify({
  text: plainParts.join("\n"),
  md: mdLines.join(""),
  tableDocIndices: tableDocIndices,
  tableAmbiguity: {
    type: "selection_cuts_cell",
    message: "La selection coupe un tableau de maniere ambigue. Selectionnez des lignes completes du tableau."
  }
});
```

Scribe React side displays this as a toast/snackbar message and does NOT send to LLM.

### Anti-Patterns to Avoid

- **Sending partial cell text to LLM:** If the selection cuts through a cell's text (e.g., user selected "abc" from a cell containing "abcdef"), do NOT extract partial text. This is the ambiguity case -- reject it.
- **Creating a sub-table from selected rows:** InsertContent with a smaller table would not correctly replace in-place. Use in-place modification instead.
- **Modifying cells not in the original extraction:** If the LLM invents cells that were not extracted, ignore them (existing validation handles this).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cell position detection | Custom position tracking | `GetRowIndex()` + `GetIndex()` on ApiTableCell | OO API provides direct access |
| Cell range calculation | Estimate from table position | `GetContent().GetElement(0/n).GetRange().GetStartPos/EndPos()` | Accurate paragraph-level positions |
| Partial table preview | New preview component | Existing `cellsToMarkdownTable()` in tableCellMarkers.js | Already handles arbitrary cell indices |
| Cell modification | New injection path | Existing `addRunsToParagraph()` + `RemoveAllElements()` | Same pattern as clone cell modification |
| Ambiguity messaging | Custom error dialog | Existing Snackbar/toast pattern in Scribe UI | Consistent UX |

## Common Pitfalls

### Pitfall 1: Selection Range vs Cell Range Off-by-One
**What goes wrong:** Cell boundary detection misses the first or last cell because position comparison uses `>=` vs `>`.
**Why it happens:** OO positions can be inclusive or exclusive depending on the element.
**How to avoid:** Test empirically with boundary cases. Use a small tolerance (e.g., `cellStart + 1 >= selStart` instead of `cellStart >= selStart`) if needed.
**Warning signs:** First or last selected row being excluded from extraction.

### Pitfall 2: Empty Cells Have No Range
**What goes wrong:** `GetContent().GetElement(0).GetRange()` returns null for truly empty cells.
**Why it happens:** Empty cells may not have any paragraphs or have a paragraph with no range.
**How to avoid:** Treat cells with no range as included if their row is fully selected. Fall back to row-level inclusion detection.
**Warning signs:** Cells disappearing from extraction.

### Pitfall 3: Merged Cells Span Multiple Row/Column Indices
**What goes wrong:** A merged cell at (0,0) spanning 2 columns means row 0 has fewer cells than row 1. `GetCell(0, 1)` may return unexpected results.
**Why it happens:** OO internally represents merged cells differently from the row/col grid.
**How to avoid:** Compare `row.GetCellsCount()` across rows. If counts differ, treat the table as having merged cells and check ambiguity more carefully.
**Warning signs:** Cell count mismatch between rows, wrong content in cells.

### Pitfall 4: Replace Mode with Partial Table Destroys Table Structure
**What goes wrong:** Using `InsertContent` with a full table clone to replace a partial selection deletes the non-selected part of the table.
**Why it happens:** Replace mode removes the selection first, then inserts content. If the selection covers 3 rows of a 10-row table, those 3 rows are removed and replaced with a full 10-row clone.
**How to avoid:** For partial table selections, use in-place cell modification on the original table (not clone+InsertContent).
**Warning signs:** Table gaining extra rows, or losing rows.

### Pitfall 5: Insert Mode with Partial Table
**What goes wrong:** "Insert below" with partial table would insert a sub-table, creating a confusing document layout.
**Why it happens:** The clone contains all rows but only some were processed.
**How to avoid:** Disable Insert mode for partial table selections. Show a clear message to the user.
**Warning signs:** Random tables appearing in the document.

### Pitfall 6: ES5 Constraint
**What goes wrong:** Using `const`, `let`, arrow functions, `Array.from()`, `for...of`, `.includes()` inside callCommand.
**Why it happens:** Natural tendency when writing complex logic.
**How to avoid:** All code inside callCommand must use `var`, `function`, `for` loops, and `indexOf !== -1`.
**Warning signs:** Silent failures in OO console.

## Code Examples

### Detecting Partial Table Selection (ES5 callCommand)

```javascript
// Returns: { full: boolean, selectedCells: [{r, c}], ambiguous: boolean, reason: string }
function analyzeTableSelection(table, selStart, selEnd) {
  var tblRange = table.GetRange();
  if (!tblRange) return { full: false, selectedCells: [], ambiguous: true, reason: "no_range" };

  var tblStart = tblRange.GetStartPos();
  var tblEnd = tblRange.GetEndPos();

  // Full table selected?
  if (tblStart >= selStart && tblEnd <= selEnd) {
    return { full: true, selectedCells: [], ambiguous: false, reason: null };
  }

  var rowCount = table.GetRowsCount();
  var selectedCells = [];
  var ambiguousCells = [];

  for (var r = 0; r < rowCount; r++) {
    var row = table.GetRow(r);
    var cellCount = row.GetCellsCount();
    for (var c = 0; c < cellCount; c++) {
      var cell = table.GetCell(r, c);
      if (!cell) continue;
      var content = cell.GetContent();
      if (!content || content.GetElementsCount() === 0) continue;

      var firstPara = content.GetElement(0);
      var lastPara = content.GetElement(content.GetElementsCount() - 1);
      var firstRange = firstPara ? firstPara.GetRange() : null;
      var lastRange = lastPara ? lastPara.GetRange() : null;
      if (!firstRange || !lastRange) continue;

      var cStart = firstRange.GetStartPos();
      var cEnd = lastRange.GetEndPos();

      var fullyInside = (cStart >= selStart && cEnd <= selEnd);
      var overlaps = (cEnd >= selStart && cStart <= selEnd);
      var partialOverlap = overlaps && !fullyInside;

      if (fullyInside) {
        selectedCells.push({ r: r, c: c });
      } else if (partialOverlap) {
        ambiguousCells.push({ r: r, c: c });
      }
    }
  }

  if (ambiguousCells.length > 0) {
    return {
      full: false,
      selectedCells: [],
      ambiguous: true,
      reason: "selection_cuts_cell"
    };
  }

  return {
    full: false,
    selectedCells: selectedCells,
    ambiguous: false,
    reason: null
  };
}
```

### Extracting Only Selected Cells (ES5 callCommand)

```javascript
function extractPartialTableCells(table, selectedCells) {
  var cellMd = [];
  for (var i = 0; i < selectedCells.length; i++) {
    var sc = selectedCells[i];
    var cell = table.GetCell(sc.r, sc.c);
    if (!cell) continue;
    var content = cell.GetContent();
    var cellText = "";
    var elemCount = content.GetElementsCount();
    for (var e = 0; e < elemCount; e++) {
      var elem = content.GetElement(e);
      if (elem.GetClassType && elem.GetClassType() === "paragraph") {
        if (cellText.length > 0) cellText = cellText + " ";
        cellText = cellText + paragraphToMarkdown(elem);
      }
    }
    cellMd.push("[CELL:" + sc.r + "," + sc.c + "]" + cellText + "[/CELL]");
  }
  return cellMd.join("\n");
}
```

### In-Place Modification for Partial Table (ES5 callCommand)

```javascript
// For partial table selection: modify cells in-place in original table
// (not clone+InsertContent, which would break the table structure)
function modifyOriginalTableCells(origTable, parsedCells, cFonts) {
  for (var i = 0; i < parsedCells.length; i++) {
    var pc = parsedCells[i];
    var cell = origTable.GetCell(pc.r, pc.c);
    if (!cell) continue;
    var cc = cell.GetContent();
    if (!cc || cc.GetElementsCount() === 0) continue;
    var cp = cc.GetElement(0);
    if (!cp) continue;
    if (cp.RemoveAllElements) {
      cp.RemoveAllElements();
    }
    var cf = cFonts[pc.r + "," + pc.c] || {};
    addRunsToParagraph(cp, pc.runs || [], cf.family, cf.size);
  }
}
```

## State of the Art

| Old Approach | Current Approach | Phase 26 Change | Impact |
|--------------|------------------|-----------------|--------|
| Extract ALL cells of any overlapping table | Same (Phase 24.1) | Extract ONLY cells within selection range | Users can work with table subsets |
| No ambiguity detection | No ambiguity detection | Detect when selection cuts through cells | Clear user feedback on invalid selections |
| Clone + InsertContent for all tables | Same (Phase 24.1) | In-place modification for partial tables | Preserves non-selected cells and table structure |
| Insert mode available for all tables | Same | Disable Insert for partial table selections | Prevents confusing sub-table insertions |

## Open Questions

1. **Exact position behavior at cell boundaries**
   - What we know: `GetRange().GetStartPos()` / `GetEndPos()` returns numeric positions for paragraphs.
   - What's unclear: Whether cell boundary positions align exactly with paragraph positions, or if there's structural padding between cells.
   - Recommendation: Empirical testing. Write a diagnostic callCommand that logs positions of all cells in a test table, then compare with `GetRangeBySelect()` positions for various selection patterns. LOW confidence until validated.

2. **Mixed partial-table + text selections**
   - What we know: User could select text before a table + first 2 rows of the table.
   - What's unclear: Whether the non-table text should be processed normally while the table is processed partially.
   - Recommendation: Yes -- process the text through the standard pipeline, and handle the partial table separately. The `insideTable` flag already skips table paragraphs.

3. **OO selection behavior when selecting table rows**
   - What we know: OO has a UI gesture for selecting entire rows (click the row border). This creates a selection that exactly covers those rows.
   - What's unclear: Whether the selection range from row-selection exactly matches cell boundaries, or if there's a slight offset.
   - Recommendation: Empirical testing. This is the most common use case and must work reliably.

4. **Handling the `isPartialTable` flag in injection**
   - What we know: Injection currently uses clone+InsertContent.
   - What's unclear: Best way to signal from extraction to injection that this is a partial table (needing in-place modification).
   - Recommendation: Add a `partialTable` boolean per table entry in the extraction result. The injection code checks this flag and branches accordingly.

## Sources

### Primary (HIGH confidence)
- [ApiParagraph](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/) - GetParentTableCell(), GetParentTable(), GetRange()
- [ApiTableCell](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiTableCell/) - GetIndex(), GetRowIndex(), GetContent(), GetParentRow(), GetParentTable()
- [ApiTableRow](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiTableRow/) - GetIndex(), GetCellsCount(), GetCell()
- Existing codebase: `plugins/onlyoffice-scribe/scripts/code.js` -- extractTableCells (lines 1616-1639), table range detection (lines 1658-1676), clone+inject (lines 592-670)
- Existing codebase: `src/modules/views/OnlyOffice/Scribe/tableCellMarkers.js` -- parsing and preview utilities
- Phase 24.1 CONTEXT.md -- clone+InsertContent architecture decisions

### Secondary (MEDIUM confidence)
- [GetRangeBySelect](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/GetRangeBySelect/) - returns ApiRange for current selection
- [MergeCells](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiTable/Methods/MergeCells/) - merged cell creation (implies merged cell structure)

### Tertiary (LOW confidence)
- Cell boundary position alignment -- needs empirical validation
- Merged cell detection via GetCellsCount() mismatch -- logical inference, not documented
- Selection behavior for row-selection gesture -- needs testing

## Metadata

**Confidence breakdown:**
- Extraction filtering (cell range overlap): MEDIUM - API methods confirmed, but position alignment needs validation
- Ambiguity detection: MEDIUM - logical approach, but edge cases around merged cells and boundary positions need testing
- Injection (in-place for partial): HIGH - same pattern as Phase 24 (pre-rearchitecture), proven to work
- Injection (full table via clone): HIGH - existing Phase 24.1 architecture, unchanged
- UX messaging: HIGH - straightforward intent protocol extension

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- OO API and existing architecture are fixed)
