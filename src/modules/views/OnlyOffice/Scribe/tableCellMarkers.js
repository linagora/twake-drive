/**
 * tableCellMarkers.js — Utility functions for parsing, validating, and
 * transforming [CELL:r,c]...[/CELL] markers in LLM responses.
 *
 * The OO plugin extracts table cells as markers embedded in enrichedMd.
 * The LLM returns text with these markers preserved. This module converts
 * them into GFM pipe-tables for preview and validates cell count coherence.
 *
 * Exports: parseCellMarkers, validateCellCount, cellsToMarkdownTable, transformCellMarkersForPreview
 */

/**
 * Parse [CELL:r,c]text[/CELL] markers from a string.
 *
 * @param {string} text - String potentially containing cell markers
 * @returns {Array<{row: number, col: number, text: string}>} Parsed cells (empty array if none found)
 */
export function parseCellMarkers(text) {
  const regex = /\[CELL:(\d+),(\d+)\]([\s\S]*?)\[\/CELL\]/g
  const cells = []
  let match
  while ((match = regex.exec(text)) !== null) {
    cells.push({
      row: parseInt(match[1], 10),
      col: parseInt(match[2], 10),
      text: match[3]
    })
  }
  return cells
}

/**
 * Compare cell counts between the extraction (enrichedMd) and LLM response.
 *
 * @param {string} extractedMd - The original enrichedMd sent to the LLM
 * @param {string} responseMd - The LLM response text
 * @returns {{valid: boolean, expected: number, actual: number}}
 */
export function validateCellCount(extractedMd, responseMd) {
  const expectedCells = parseCellMarkers(extractedMd)
  const actualCells = parseCellMarkers(responseMd)

  if (expectedCells.length === 0) {
    return { valid: true, expected: 0, actual: 0 }
  }

  return {
    valid: actualCells.length >= expectedCells.length,
    expected: expectedCells.length,
    actual: actualCells.length
  }
}

/**
 * Convert parsed cells array to a GFM pipe-table string.
 *
 * Row 0 is treated as the header row. A separator line (| --- | --- |)
 * is inserted after it. Multi-line cell content is collapsed to single line.
 *
 * @param {Array<{row: number, col: number, text: string}>} cells - Parsed cell objects
 * @returns {string} GFM pipe-table string (empty string if no cells)
 */
export function cellsToMarkdownTable(cells) {
  if (cells.length === 0) return ''

  // Determine grid dimensions
  let maxRow = 0
  let maxCol = 0
  for (const c of cells) {
    if (c.row > maxRow) maxRow = c.row
    if (c.col > maxCol) maxCol = c.col
  }

  // Build 2D grid
  const grid = Array.from({ length: maxRow + 1 }, () =>
    Array(maxCol + 1).fill('')
  )
  for (const c of cells) {
    grid[c.row][c.col] = c.text.trim().replace(/\n/g, ' ')
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

/**
 * Pre-process an LLM response for MarkdownPreview display.
 *
 * Replaces contiguous [CELL:r,c]...[/CELL] marker blocks with a GFM
 * pipe-table. Non-cell-marker text surrounding the block is preserved.
 *
 * @param {string} md - The LLM response text
 * @param {string} enrichedMd - The original enrichedMd (for cell count validation)
 * @returns {{displayMd: string, warning: string|null}}
 */
export function transformCellMarkersForPreview(md, enrichedMd) {
  if (!md || !md.includes('[CELL:')) {
    return { displayMd: md, warning: null }
  }

  const cells = parseCellMarkers(md)
  if (cells.length === 0) {
    return { displayMd: md, warning: null }
  }

  // Validate cell count against extraction
  const validation = enrichedMd
    ? validateCellCount(enrichedMd, md)
    : { valid: true, expected: 0, actual: cells.length }

  const warning = validation.valid
    ? null
    : `Table cell count mismatch: expected ${validation.expected}, got ${validation.actual}`

  // Build pipe-table
  const table = cellsToMarkdownTable(cells)

  // Replace the contiguous block of cell markers with the table.
  // Match from first [CELL: to last [/CELL], including surrounding whitespace.
  const blockRegex = /(?:\s*\[CELL:\d+,\d+\][\s\S]*?\[\/CELL\]\s*)+/g
  const displayMd = md.replace(blockRegex, match => {
    // Preserve leading/trailing newlines for separation from surrounding text
    const leadingNewline = match.startsWith('\n') ? '\n' : ''
    const trailingNewline = match.endsWith('\n') ? '\n' : ''
    return leadingNewline + table + trailingNewline
  })

  return { displayMd, warning }
}
