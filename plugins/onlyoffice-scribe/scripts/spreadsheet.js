/* global Api, Asc, AscCommonExcel */

// The functions of this file run inside the spreadsheet editor: the plugin
// sends their source to it with `callCommand`. They cannot use anything
// defined outside of them, and their parameters come in `Asc.scope`.
//
// The scribe works on the selected cells, or on the block of data around the
// selected cell. It reads them as the editor shows them, with their formulas,
// and writes the cells of an answer at their addresses (see grid.js).

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
  const sheet = Api.GetActiveSheet()
  const selection = Api.GetSelection()
  if (!sheet || !selection) return null

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
  const areas = selection.GetAreas()
  const area = areas && areas.GetCount() > 1 ? areas.GetItem(1) : selection
  let range = getBox(area)
  let around = null
  if (range.r1 === range.r2 && range.c1 === range.c2) {
    around = { row: range.r1, col: range.c1 }
    range = getBox(area.GetCurrentRegion() ?? area)
  }

  // A whole column or row: the cells in use only
  if ((range.r2 - range.r1 + 1) * (range.c2 - range.c1 + 1) > maxCells) {
    const used = getBox(sheet.GetUsedRange())
    range = {
      ...range,
      r2: Math.max(range.r1, Math.min(range.r2, used.r2)),
      c2: Math.max(range.c1, Math.min(range.c2, used.c2))
    }
  }
  const columns = Math.min(range.c2 - range.c1 + 1, maxCells)
  const rows = Math.max(1, Math.floor(maxCells / columns))
  const given = {
    r1: range.r1,
    c1: range.c1,
    r2: Math.min(range.r2, range.r1 + rows - 1),
    c2: range.c1 + columns - 1
  }

  return { sheet: sheet.GetName(), range, given, around }
}

/**
 * Reads the cells of `Asc.scope.box` in the sheet `Asc.scope.sheetName`:
 * the text each one shows, and its formula
 *
 * @returns {{ texts: string[][], formulas: (string|null)[][] }|null}
 */
export function readSheetCells() {
  const { sheetName, box } = Asc.scope
  const sheet = Api.GetSheet(sheetName)
  if (!sheet) return null

  const texts = []
  const formulas = []
  for (let row = box.r1; row <= box.r2; row += 1) {
    const textRow = []
    const formulaRow = []
    for (let col = box.c1; col <= box.c2; col += 1) {
      const cell = sheet.GetRangeByNumber(row, col)
      // A cell without a formula gives its value
      const formula = cell.GetFormula()
      textRow.push(String(cell.GetText() ?? ''))
      formulaRow.push(
        typeof formula === 'string' && formula.startsWith('=') ? formula : null
      )
    }
    texts.push(textRow)
    formulas.push(formulaRow)
  }
  return { texts, formulas }
}

/**
 * Writes the plan of an answer (`planSheetWrite`) in the sheet
 * `Asc.scope.sheetName`: inserts its columns and rows, writes its cells, then
 * selects them with the range, in one step of the undo.
 *
 * @returns {number} the cells the editor refused to write, as the ones of a
 * protected sheet
 */
export function writeSheetPlan() {
  const { sheetName, plan } = Asc.scope
  const sheet = Api.GetSheet(sheetName)
  if (!sheet) return plan.writes.length

  const cell = (row, col) => sheet.GetRangeByNumber(row, col)
  const { insertColumns, insertRows, writes, box } = plan
  // The formulas of an answer are in English, whatever the language the
  // editor reads the formulas typed in its cells in
  const locale =
    typeof AscCommonExcel === 'undefined'
      ? null
      : AscCommonExcel.oFormulaLocaleInfo
  const saved = locale && { Parse: locale.Parse, DigitSep: locale.DigitSep }
  if (locale) {
    locale.Parse = false
    locale.DigitSep = false
  }
  try {
    if (insertColumns) {
      const { at, count } = insertColumns
      sheet
        .GetRange(cell(0, at), cell(0, at + count - 1))
        .GetEntireColumn()
        .Insert('right')
    }
    if (insertRows) {
      const { at, count } = insertRows
      sheet
        .GetRange(cell(at, 0), cell(at + count - 1, 0))
        .GetEntireRow()
        .Insert('down')
    }
    const refused = writes.filter(
      ({ row, col, text }) => cell(row, col).SetValue(text) === false
    ).length
    sheet.GetRange(cell(box.r1, box.c1), cell(box.r2, box.c2)).Select()
    return refused
  } finally {
    if (locale) Object.assign(locale, saved)
  }
}
