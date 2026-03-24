# Phase 26: Selections Partielles de Tableaux - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning
**Source:** Discussion with user

<domain>
## Phase Boundary

This phase adds support for partial table selections in Scribe. Currently, when any part of a table overlaps the selection, ALL cells are extracted. This phase makes Scribe handle partial selections correctly: extract only selected cells, inject only into those cells, and handle the general case of mixed selections spanning paragraphs and tables.

</domain>

<decisions>
## Implementation Decisions

### OO Selection Constraint
- OO does not allow partial content selection across multiple cells. Either the selection is within a single cell (partial text of that one cell), or it covers complete cells only. There is no ambiguous "selection cuts through cell content" case to handle.

### General Selection Model
- A selection is a contiguous range across document elements. Each element (paragraph or table) is either fully selected, partially selected, or not selected.
- The general pattern is: `[partial element]? [full elements]* [partial element]?`
- A partial element can be a paragraph (text partially selected) or a table (some cells selected, but each selected cell is fully selected).
- Full elements are paragraphs or tables entirely within the selection.

### Case 1: Intra-cell selection
- The selection is entirely within a single cell (partial or complete text of that cell).
- **No special table treatment.** The content is handled via exactly the same code path as a normal paragraph — same insertion, replacement, spacing, and post-operation selection logic.
- **Investigation needed:** verify whether the current code already handles this correctly or mistakenly triggers the table extraction path.

### Case 2: Selection covering complete cells

#### Extraction
- The markdown reflects the entire selection in document order:
  - Partial/complete paragraphs: normal markdown text
  - Complete tables: all cells as `[TABLE:N][CELL:r,c]...[/TABLE]`
  - Partial tables: only selected cells as `[CELL:r,c]`

#### Case 2a: Replacement
- For each element in the selection, in document order:
  1. **Partial paragraph (start/end):** replace selected text via the standard paragraph code path (same code as normal paragraph replacement)
  2. **Complete paragraph:** replace entirely
  3. **Complete table:** replace via clone + InsertContent (existing behavior)
  4. **Partial table:** modify cells in-place: clear selected cells, inject LLM content, then select the modified cells (rectangle from top-left to bottom-right cell)
- Unselected cells and elements outside the selection remain intact.

#### Case 2b: Insertion — selection ending inside a table
- The selection ends inside a table (without reaching its last cell). The start may be before the table or inside the table.
- **Insert after the table**, in this order:
  1. Any paragraphs/complete tables from the start of the selection (normal text, complete tables duplicated with LLM content)
  2. A reduced copy of the ending table: duplicate the table, inject cell content from the md, delete rows and columns not concerned
- The original table remains intact.

#### Case 2c: Insertion — selection ending after a table
- The selection starts inside a table and ends after it (text or other elements follow).
- **Insert after the end of the selection**, in this order:
  1. A reduced copy of the starting table: duplicate the table, inject cell content from the md, delete rows and columns not concerned
  2. Any paragraphs/tables that follow in the selection (normal text, complete tables duplicated with LLM content)
- The original table remains intact.

#### Case 2d: Insertion — partial tables at both ends (most general case)
- The selection starts in a table (partial), traverses complete elements (paragraphs and/or tables), and ends in another table (partial).
- **Insert after the end of the selection**, in this order:
  1. Reduced copy of the starting table (same logic as 2c)
  2. Complete elements from the middle (paragraphs, complete tables duplicated with LLM content)
  3. Reduced copy of the ending table (same logic as 2b)
- All original tables remain intact.

### Claude's Discretion
- Technical approach for detecting intra-cell vs multi-cell selection
- OO API calls for cell range detection
- How to duplicate and reduce a table (RemoveRow/RemoveColumn vs rebuild)
- Post-replacement cell selection API
- Error handling for edge cases (empty cells, merged cells)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing table pipeline
- `plugins/onlyoffice-scribe/scripts/code.js` — extractTableCells, table range detection, clone+inject injection
- `src/modules/views/OnlyOffice/Scribe/tableCellMarkers.js` — CELL marker parsing, cellsToMarkdownTable preview

### Phase 26 research
- `.planning/phases/26-selections-partielles-de-tableaux/26-RESEARCH.md` — OO API investigation, cell range detection strategy, code examples

### Prior table work
- Phase 24/24.1 summaries — clone+InsertContent architecture, cell.Clear pitfall, table clone pattern

</canonical_refs>

<specifics>
## Specific Ideas

- For reduced table copies (insertion cases 2b/2c/2d): duplicate the full table via Copy(), inject LLM content into the relevant cells, then remove rows and columns that have no selected cells.
- For intra-cell case: must use the exact same code path as paragraph replacement/insertion — no special-casing.
- Post-replacement selection for partial tables: the modified cells form a rectangle, so select from min(r,c) to max(r,c).

</specifics>

<deferred>
## Deferred Ideas

- Merged cell handling: not in scope for this phase, may need special treatment later
- Nested tables: already unsupported, remains unsupported

</deferred>

---

*Phase: 26-selections-partielles-de-tableaux*
*Context gathered: 2026-03-24 via user discussion*
