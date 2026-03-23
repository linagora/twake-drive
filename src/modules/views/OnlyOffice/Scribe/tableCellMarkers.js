/**
 * tableCellMarkers.js — Utility functions for parsing, validating, and
 * transforming [CELL:r,c]...[/CELL] markers in LLM responses.
 *
 * The OO plugin extracts table cells as markers embedded in enrichedMd,
 * wrapped in [TABLE:N]...[/TABLE] blocks (0-based index per table).
 * The LLM returns text with these markers preserved. This module converts
 * them into GFM pipe-tables for preview and validates cell count coherence.
 *
 * Exports: parseCellMarkers, parseTableBlocks, validateCellCount,
 *   validateTableCounts, cellsToMarkdownTable, transformCellMarkersForPreview
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
 * Parse [TABLE:N]...[/TABLE] blocks from a string.
 * Each block contains [CELL:r,c]...[/CELL] markers parsed via parseCellMarkers.
 *
 * @param {string} text - String potentially containing TABLE blocks
 * @returns {Array<{index: number, cells: Array<{row: number, col: number, text: string}>}>}
 */
export function parseTableBlocks(text) {
  const regex = /\[TABLE:(\d+)\]([\s\S]*?)\[\/TABLE\]/g
  const tables = []
  let match
  while ((match = regex.exec(text)) !== null) {
    const index = parseInt(match[1], 10)
    const cells = parseCellMarkers(match[2])
    tables.push({ index, cells })
  }
  return tables
}

/**
 * Compare cell counts between the extraction (enrichedMd) and LLM response.
 * Global count across all tables (backward compat).
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
 * Compare cell counts per table between extraction and LLM response.
 *
 * @param {string} extractedMd - The original enrichedMd sent to the LLM
 * @param {string} responseMd - The LLM response text
 * @returns {{valid: boolean, details: Array<{tableIndex: number, expected: number, actual: number}>, warning: string|null}}
 */
export function validateTableCounts(extractedMd, responseMd) {
  const expectedTables = parseTableBlocks(extractedMd)
  const actualTables = parseTableBlocks(responseMd)

  if (expectedTables.length === 0) {
    return { valid: true, details: [], warning: null }
  }

  // Build map of actual tables by index
  const actualMap = {}
  for (const t of actualTables) {
    actualMap[t.index] = t.cells.length
  }

  const details = []
  let valid = true
  const warnings = []

  for (const t of expectedTables) {
    const actual = actualMap[t.index] !== undefined ? actualMap[t.index] : 0
    const expected = t.cells.length
    details.push({ tableIndex: t.index, expected, actual })
    if (actual < expected) {
      valid = false
      warnings.push(`Table ${t.index}: expected ${expected} cells, got ${actual}`)
    }
  }

  return {
    valid,
    details,
    warning: warnings.length > 0 ? warnings.join('; ') : null
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
 * If the text contains [TABLE:N] wrappers, each table block is replaced
 * with its own GFM pipe-table. If it contains bare [CELL:] markers
 * (backward compat), falls back to single-table behavior.
 *
 * @param {string} md - The LLM response text
 * @param {string} enrichedMd - The original enrichedMd (for cell count validation)
 * @returns {{displayMd: string, warning: string|null}}
 */
export function transformCellMarkersForPreview(md, enrichedMd) {
  if (!md) {
    return { displayMd: md, warning: null }
  }

  // Multi-table path: [TABLE:N] wrappers present
  if (md.includes('[TABLE:')) {
    const tables = parseTableBlocks(md)
    if (tables.length === 0) {
      return { displayMd: md, warning: null }
    }

    // Validate per-table cell counts
    const validation = enrichedMd
      ? validateTableCounts(enrichedMd, md)
      : { valid: true, details: [], warning: null }

    // Replace each [TABLE:N]...[/TABLE] block with its pipe-table
    const displayMd = md.replace(
      /\[TABLE:\d+\]([\s\S]*?)\[\/TABLE\]/g,
      (fullMatch, inner) => {
        const cells = parseCellMarkers(inner)
        if (cells.length === 0) return ''
        return cellsToMarkdownTable(cells)
      }
    )

    return { displayMd, warning: validation.warning }
  }

  // Backward compat: bare [CELL:] markers without [TABLE:] wrappers
  if (!md.includes('[CELL:')) {
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
  const blockRegex = /(?:\s*\[CELL:\d+,\d+\][\s\S]*?\[\/CELL\]\s*)+/g
  const displayMd = md.replace(blockRegex, match => {
    const leadingNewline = match.startsWith('\n') ? '\n' : ''
    const trailingNewline = match.endsWith('\n') ? '\n' : ''
    return leadingNewline + table + trailingNewline
  })

  return { displayMd, warning }
}
