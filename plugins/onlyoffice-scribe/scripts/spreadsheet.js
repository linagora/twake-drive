/* global Api, Asc, AscCommon, AscCommonExcel */

// The functions of this file run inside the spreadsheet editor: the plugin
// sends their source to it with `callCommand`. They cannot use anything
// defined outside of them, and their parameters come in `Asc.scope`.
//
// The scribe works on the selected cells, or on the block of data around the
// selected cell. It reads them as the editor shows them, with their formulas,
// and writes the cells of an answer at their addresses (see grid.js).

/**
 * Whether the editor has what the scribe of a spreadsheet uses beside its
 * API: the formula parser it switches to English, the decimal separator of
 * its locale, the merges of the cells and the drawings of a sheet. A build of
 * the editor that renames its internals has none of them.
 *
 * @returns {boolean}
 */
export function checkSheetSupport() {
  try {
    const locale = AscCommonExcel.oFormulaLocaleInfo
    const sheet = Api.GetActiveSheet()
    const cell = sheet.GetRangeByNumber(0, 0)
    return (
      'Parse' in locale &&
      'DigitSep' in locale &&
      typeof AscCommon.g_oDefaultCultureInfo.NumberDecimalSeparator ===
        'string' &&
      typeof cell.GetCurrentRegion === 'function' &&
      typeof cell.range.hasMerged === 'function' &&
      Array.isArray(sheet.worksheet.Drawings)
    )
  } catch {
    return false
  }
}

/**
 * Finds the cells the scribe works on: the first area of the selection, or
 * the block of data around a single cell. A range bigger than
 * `Asc.scope.maxCells` is cut to the used cells of the sheet, then to its
 * first rows.
 *
 * @returns {{ sheet: string, range: object, given: object, around: object|null }|null}
 * the boxes are 0-based; `given` is the part of `range` to read
 */
export function readSheetSelection() {
  const { maxCells } = Asc.scope

  const getBox = range => {
    const r1 = range.GetRow() - 1
    const c1 = range.GetCol() - 1
    return {
      r1,
      c1,
      r2: r1 + range.GetRowsCount() - 1,
      c2: c1 + range.GetColumnsCount() - 1
    }
  }
  const isCell = box => box.r1 === box.r2 && box.c1 === box.c2
  const getSize = box => (box.r2 - box.r1 + 1) * (box.c2 - box.c1 + 1)
  const findRange = selection => {
    const areas = selection.GetAreas()
    const area = areas && areas.GetCount() > 1 ? areas.GetItem(1) : selection
    const box = getBox(area)
    if (!isCell(box)) return { range: box, around: null }
    return {
      range: getBox(area.GetCurrentRegion() ?? area),
      around: { row: box.r1, col: box.c1 }
    }
  }
  // A whole column or row: the cells in use only
  const keepUsedCells = (sheet, range) => {
    if (getSize(range) <= maxCells) return range
    const used = getBox(sheet.GetUsedRange())
    return {
      ...range,
      r2: Math.max(range.r1, Math.min(range.r2, used.r2)),
      c2: Math.max(range.c1, Math.min(range.c2, used.c2))
    }
  }
  const getGiven = range => {
    const columns = Math.min(range.c2 - range.c1 + 1, maxCells)
    const rows = Math.max(1, Math.floor(maxCells / columns))
    return {
      r1: range.r1,
      c1: range.c1,
      r2: Math.min(range.r2, range.r1 + rows - 1),
      c2: range.c1 + columns - 1
    }
  }

  const sheet = Api.GetActiveSheet()
  const selection = Api.GetSelection()
  if (!sheet || !selection) return null
  const { range, around } = findRange(selection)
  const used = keepUsedCells(sheet, range)
  return {
    sheet: sheet.GetName(),
    range: used,
    given: getGiven(used),
    around
  }
}

/**
 * Reads the cells of `Asc.scope.box` in the sheet `Asc.scope.sheetName`:
 * the text each one shows, its formula, and whether it is in a merge that
 * starts at another cell
 *
 * @returns {{ texts: string[][], formulas: (string|null)[][], merged: boolean[][] }|null}
 */
export function readSheetCells() {
  const { sheetName, box } = Asc.scope

  const getIndexes = (first, last) =>
    Array.from({ length: last - first + 1 }, (_, index) => first + index)
  const readText = cell => String(cell.GetText() ?? '')
  // A cell without a formula gives its value
  const readFormula = cell => {
    const formula = cell.GetFormula()
    return typeof formula === 'string' && formula.startsWith('=')
      ? formula
      : null
  }
  const isMerged = (cell, row, col) => {
    const merge = cell.range.hasMerged()
    return Boolean(merge) && (merge.r1 !== row || merge.c1 !== col)
  }
  const rows = getIndexes(box.r1, box.r2)
  const cols = getIndexes(box.c1, box.c2)

  const sheet = Api.GetSheet(sheetName)
  if (!sheet) return null
  const cells = rows.map(row =>
    cols.map(col => sheet.GetRangeByNumber(row, col))
  )
  return {
    texts: cells.map(row => row.map(readText)),
    formulas: cells.map(row => row.map(readFormula)),
    merged: cells.map((line, i) =>
      line.map((cell, j) => isMerged(cell, rows[i], cols[j]))
    )
  }
}

/**
 * Writes the plan of an answer (`planSheetWrite`) in the sheet
 * `Asc.scope.sheetName`: inserts its columns and rows, writes its cells, then
 * selects them with the range, in one step of the undo.
 *
 * @returns {number} the cells the editor did not write, as the ones of a
 * protected sheet or a formula it cannot read; all of them when it failed
 */
export function writeSheetPlan() {
  const { sheetName, plan } = Asc.scope
  const { insertColumns, insertRows, writes, box } = plan

  const getRange = (sheet, r1, c1, r2, c2) =>
    sheet.GetRange(
      sheet.GetRangeByNumber(r1, c1),
      sheet.GetRangeByNumber(r2, c2)
    )
  const insertCells = sheet => {
    if (insertColumns) {
      const { at, count } = insertColumns
      getRange(sheet, 0, at, 0, at + count - 1)
        .GetEntireColumn()
        .Insert('right')
    }
    if (insertRows) {
      const { at, count } = insertRows
      getRange(sheet, at, 0, at + count - 1, 0)
        .GetEntireRow()
        .Insert('down')
    }
  }
  // A number of the answer is in English, as 1350.5: the editor reads a
  // value with the decimal separator of its locale
  const separator = AscCommon.g_oDefaultCultureInfo.NumberDecimalSeparator
  const localize = text =>
    /^[-+]?\d+\.\d+$/.test(text) ? text.replace('.', separator) : text
  const compact = formula => String(formula).replace(/\s/g, '').toUpperCase()
  // The editor keeps the cell as it was when it cannot read a formula, and
  // SetValue still says it wrote it
  const writeCell = (sheet, { row, col, text }) => {
    const cell = sheet.GetRangeByNumber(row, col)
    const before = cell.GetFormula()
    if (cell.SetValue(localize(text)) === false) return false
    if (!text.startsWith('=')) return true
    const after = cell.GetFormula()
    return (
      typeof after === 'string' &&
      after.startsWith('=') &&
      (after !== before || compact(after) === compact(text))
    )
  }
  const writeCells = sheet => {
    insertCells(sheet)
    const refused = writes.filter(write => !writeCell(sheet, write)).length
    getRange(sheet, box.r1, box.c1, box.r2, box.c2).Select()
    return refused
  }

  const sheet = Api.GetSheet(sheetName)
  if (!sheet) return writes.length
  // The formulas of an answer are in English, whatever the language the
  // editor reads the formulas typed in its cells in
  const locale = AscCommonExcel.oFormulaLocaleInfo
  const saved = { Parse: locale.Parse, DigitSep: locale.DigitSep }
  Object.assign(locale, { Parse: false, DigitSep: false })
  // An exception would give nothing, as a busy editor: the plan would be
  // written again over what it has already done, as its inserted rows
  try {
    return writeCells(sheet)
  } catch {
    return writes.length
  } finally {
    Object.assign(locale, saved)
  }
}

/**
 * Reads what decides where a chart goes in the sheet `Asc.scope.sheetName`:
 * the last column used on each row from `Asc.scope.r1`, for
 * `Asc.scope.rowCount` rows, and the boxes of its charts and shapes
 *
 * @returns {{ lastColumns: number[], drawings: object[] }|null}
 */
export function readChartPlace() {
  const { sheetName, r1, rowCount } = Asc.scope

  const hasText = (sheet, row, col) =>
    String(sheet.GetRangeByNumber(row, col).GetText() ?? '') !== ''
  const findLastColumn = (sheet, lastUsed, row) => {
    for (let col = lastUsed; col >= 0; col -= 1) {
      if (hasText(sheet, row, col)) return col
    }
    return -1
  }
  const getLastColumns = (sheet, count) => {
    const used = sheet.GetUsedRange()
    const lastUsed = used.GetCol() - 2 + used.GetColumnsCount()
    return Array.from({ length: count }, (_, index) =>
      findLastColumn(sheet, lastUsed, r1 + index)
    )
  }
  // The builder gives no position of a drawing: its anchor does, and the
  // cells it covers once drawn. A drawing not drawn yet takes the room of a
  // chart.
  const getDrawingEnd = (from, to) =>
    to && to.row > from.row
      ? { row: to.row, col: to.col }
      : { row: from.row + rowCount - 1, col: from.col + 7 }
  const getDrawingBoxes = base => {
    const { from, boundsFromTo } = base ?? {}
    if (!from) return []
    const end = getDrawingEnd(from, (boundsFromTo ?? {}).to)
    return [{ r1: from.row, c1: from.col, r2: end.row, c2: end.col }]
  }

  const sheet = Api.GetSheet(sheetName)
  if (!sheet) return null
  const drawings = sheet.worksheet.Drawings.flatMap(getDrawingBoxes)
  // The rows a chart pushed under the drawings may take.
  // ponytail: 1000 rows at most, a chart pushed further may cover cells
  const lastRow = Math.max(
    r1 + rowCount - 1,
    ...drawings.map(drawing => drawing.r2 + rowCount + 1)
  )
  return {
    lastColumns: getLastColumns(sheet, Math.min(lastRow - r1 + 1, 1000)),
    drawings
  }
}

/**
 * Inserts a chart in the sheet `Asc.scope.sheetName`, of the data
 * `Asc.scope.range` (as 'Ventes'!$A$1:$C$5), with its type, its title and its
 * top-left cell, in one step of the undo. With `Asc.scope.areas`, the range
 * is the box of these areas: the series of the cells left out between them
 * are removed.
 *
 * @returns {boolean} false when the editor could not make it, as a stock
 * chart of data that is no prices
 */
export function insertChart() {
  const {
    sheetName,
    range,
    areas,
    isInRows,
    type,
    title,
    place,
    width,
    height
  } = Asc.scope

  const column = letters =>
    [...letters].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0) -
    1
  const parseBox = ref => {
    const match = String(ref ?? '').match(
      /\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/
    )
    if (!match) return null
    const [, letters1, number1, letters2 = letters1, number2 = number1] = match
    return {
      r1: Number(number1) - 1,
      c1: column(letters1),
      r2: Number(number2) - 1,
      c2: column(letters2)
    }
  }
  const isInArea = (box, area) =>
    box.r1 >= area.r1 &&
    box.r2 <= area.r2 &&
    box.c1 >= area.c1 &&
    box.c2 <= area.c2
  const isKept = ref => {
    const box = parseBox(ref)
    return !box || areas.some(area => isInArea(box, area))
  }
  // The editor takes the first column of one block for the names, not the
  // one of separate areas: the chart is made of their box, then the series
  // of the cells between them are removed
  const removeLeftOutSeries = chart => {
    const series = chart.Chart?.getAllSeries?.() ?? []
    // The values of a scatter chart are its y values
    const kept = series.map(serie =>
      isKept((serie.val ?? serie.yVal)?.numRef?.f)
    )
    if (!kept.some(Boolean)) return
    for (let index = series.length - 1; index >= 0; index -= 1) {
      if (!kept[index]) chart.RemoveSeria(index)
    }
  }
  const addChart = sheet => {
    const chart = sheet.AddChart(
      range,
      isInRows,
      type,
      2,
      width,
      height,
      place.col,
      0,
      place.row,
      0
    )
    if (!chart) return false
    if (title) chart.SetTitle(title, 13, true)
    if (areas && areas.length > 1) removeLeftOutSeries(chart)
    return true
  }

  const sheet = Api.GetSheet(sheetName)
  if (!sheet) return false
  // An exception would give nothing, as a busy editor: the chart would be
  // asked again for nothing
  try {
    return addChart(sheet)
  } catch {
    return false
  }
}
