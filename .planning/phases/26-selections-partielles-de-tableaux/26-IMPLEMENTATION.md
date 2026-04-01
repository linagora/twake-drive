# Phase 26: Implementation Notes

**Updated:** 2026-04-01
**Status:** Complete (with known limitations)

This document describes the ACTUAL implementation, which diverged significantly from the initial plans (26-01-PLAN, 26-02-PLAN) during iterative testing.

## Key Differences from Plans

### 1. Cell detection: paragraph-based, not position-based
**Plan:** Use position ranges (GetStartPos/GetEndPos) to classify cells as fullyInside/partialOverlap.
**Implemented:** Use `GetParentTableCell()` on selection paragraphs to determine which cells are actually selected. Position-based detection fails for column selections (positions are sequential in the document, so cells from all columns in intermediate rows fall within the range).

### 2. Replace routing: always in-place for cells
**Plan:** Clone+InsertContent for full table Replace, in-place for partial.
**Implemented:** Replace ALWAYS uses `modifyOriginalTableCells` (in-place), except when the selection structurally encompasses the table (positions englobantes → clone+InsertContent). This is because:
- Selecting all cell content from inside doesn't encompass the table structure
- InsertContent with a clone fails when the selection is content-only

### 3. Mixed content Replace: per-paragraph InsertContent
**Plan:** Use InsertContent with narrowed selection.
**Implemented:** Selection narrowing fails when text is on both sides of the table (a single range can't exclude the middle). Instead:
1. `modifyOriginalTableCells` for cells (in-place)
2. Per-paragraph InsertContent for text (processed in reverse order)
3. Content building skipped entirely (`skipContentAndInsert`) to avoid `Api.CreateParagraph()` causing OO undo rollback

### 4. Ambiguity detection: not needed
**Plan:** Detect and display warning when selection cuts through cell content.
**Implemented:** Not needed — OO does not allow ambiguous selections. Either the selection is within a single cell, or it covers complete cells.

### 5. Insert button: always enabled
**Plan:** Disable Insert for pure partial table selections.
**Implemented:** Insert is always available. For partial tables, a reduced clone (RemoveRow/RemoveColumn post-InsertContent) is inserted after the table.

### 6. Extraction clipping: text-matching approach
**Plan:** Use position arithmetic to clip first/last paragraphs.
**Implemented:** Use `range.GetText()` vs `para.GetText()` text matching (indexOf for single paragraph, suffix/prefix matching for multi). Position arithmetic doesn't work because OO positions don't map 1:1 to text characters (paragraph marks \r\n add positions not in GetText).

### 7. Multi-paragraph cells: split-before-parse
**Plan:** Not addressed.
**Implemented:** Cell content is split on `\n\n` BEFORE passing to `marked.lexer`, to preserve empty paragraphs (marked treats blank lines as separators, dropping them). Injection uses `replaceCellContent` with `AddElement(pos, para)` for additional paragraphs.

### 8. Cell images: drawing index includes table cells
**Plan:** Not addressed.
**Implemented:** `drawingIndex` (for image pre-caching) scans both `doc.GetAllParagraphs()` AND all table cell paragraphs, because `GetAllParagraphs()` doesn't include table cell content. `extractCellContent` uses `getDrawingMarker` for image naming.

### 9. Post-InsertContent row/column removal
**Plan:** RemoveRow/RemoveColumn on clone before InsertContent.
**Implemented:** Deferred to post-InsertContent because these APIs require the table to be in the document. Uses cell references (`RemoveRow(oCell)` not `RemoveRow(index)`).

## Architecture (Final)

### Extraction Flow
```
Selection → analyzeTableSelection(table, selStart, selEnd, paragraphs)
  ├─ hitCount=0 → ambiguous (shouldn't happen)
  ├─ hitCount=1 → intraCell: true → paragraphs fall through to normal extraction
  ├─ hitCount=all AND structural → full: true → extractTableCells (all cells)
  └─ else → partial → extractPartialTableCells (selected cells only)

extractCellContent(cell):
  for each paragraph: getDrawingMarker + paragraphToMarkdown
  joined by \n\n (preserves paragraph breaks including empty ones)
```

### Injection Flow (Replace)
```
For each table in parsedTables:
  ├─ isStructuralFull → clone + replaceCellContent + InsertContent
  └─ else → modifyOriginalTableCells (in-place) + tablesModifiedInPlace=true

If tablesModifiedInPlace AND hasMixedContent:
  Per-paragraph InsertContent (reverse order) → skipContentAndInsert=true
Else if tablesModifiedInPlace:
  content=[] naturally (no text blocks) → InsertContent skipped
Else:
  Normal InsertContent flow
```

### Injection Flow (Insert)
```
Cursor moved after table (GetEndPos + 1)
For each table:
  ├─ partial → buildReducedTableClone + pendingTableReductions
  └─ full → clone + replaceCellContent
InsertContent with content (includes clone)
Post-InsertContent: RemoveRow/RemoveColumn on inserted clone
```

## Known Limitations
See `memory/project_phase26_known_issues.md` for the full list:
1. InsertContent loses suffix inline styles (pre-existing OO bug)
2. No post-selection for mixed Replace (OO API limitation)
3. InsertContent block mode in cells creates content outside cell (pre-existing)
4. OO API cannot select partial table cells programmatically
