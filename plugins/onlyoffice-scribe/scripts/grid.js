import { Lexer } from 'marked'

import { makeInlineText, unwrapAnswer } from './markdown.js'

// The cells of a sheet the assistant gets at most: the first rows of a
// bigger range
export const MAX_CELLS = 1000
// The cells an answer may cover at most, from the range to its farthest cell
export const MAX_ANSWER_CELLS = 20000

const COLUMN_NAME = /^[A-Z]{1,3}$/
const ROW_NUMBER = /^[1-9]\d{0,6}$/
// The first header cell of a table with row numbers: nothing, or a mark
const ROW_HEADER = /^(|#|n°|no\.?|row|ligne)$/i
// Non-breaking spaces included: a number format groups digits with them
const SPACES = /\s+/g
// A formula given by its address, as the content lists them: `D5: =B5+C5`
const FORMULA_LINE =
  /^\s*(?:[-*]\s+)?`?(\$?[A-Z]{1,3}\$?[1-9]\d{0,6})`?\s*:\s*`?(=[^`]*?)`?\s*$/

/**
 * A position in a sheet, 0-based
 * @typedef {{ row: number, col: number }} Cell
 */

/**
 * A rectangle of cells, 0-based and inclusive
 * @typedef {{ r1: number, c1: number, r2: number, c2: number }} Box
 */

/**
 * @param {number} index - 0-based
 * @returns {string} the letters of the column: A, Z, AA
 */
export function getColumnName(index) {
  let name = ''
  for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    name = String.fromCharCode(65 + ((rest - 1) % 26)) + name
  }
  return name
}

/**
 * @param {string} name - the letters of a column
 * @returns {number|null} its 0-based index, null for another text
 */
export function findColumnIndex(name) {
  if (!COLUMN_NAME.test(name)) return null
  return (
    [...name].reduce(
      (index, letter) => index * 26 + letter.charCodeAt(0) - 64,
      0
    ) - 1
  )
}

// The address of a cell, absolute or not: B3, $B$3
const ADDRESS = /^\$?([A-Z]{1,3})\$?([1-9]\d{0,6})$/
const ADDRESS_HEADER =
  /^(address|cell|ref(erence)?|adresse|cellule|référence)$/i

function parseAddress(address) {
  const [, letters, number] = address.match(ADDRESS)
  return { row: Number(number) - 1, col: findColumnIndex(letters) }
}

export function makeAddress({ row, col }) {
  return `${getColumnName(col)}${row + 1}`
}

export function makeBoxAddress({ r1, c1, r2, c2 }) {
  const start = makeAddress({ row: r1, col: c1 })
  return r1 === r2 && c1 === c2
    ? start
    : `${start}:${makeAddress({ row: r2, col: c2 })}`
}

const escapeCell = text =>
  text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')

function makeSheetPlace({ sheet, range, given, around, isCell }) {
  const parts = [
    `Sheet ${JSON.stringify(sheet)}, ${
      isCell ? 'cell' : 'cells'
    } ${makeBoxAddress(range)}`
  ]
  if (around && !isCell) parts.push(`around ${makeAddress(around)}`)
  if (given.r2 < range.r2 || given.c2 < range.c2) {
    parts.push(`only ${makeBoxAddress(given)} given`)
  }
  return parts.join(', ')
}

function makeCellsTable(texts, given) {
  const columns = texts[0].map((_, index) => getColumnName(given.c1 + index))
  return [
    `|   | ${columns.join(' | ')} |`,
    `|---|${columns.map(() => '---|').join('')}`,
    ...texts.map(
      (row, index) =>
        `| ${given.r1 + index + 1} | ${row.map(escapeCell).join(' | ')} |`
    )
  ].join('\n')
}

function makeFormulaLines(formulas, given) {
  return formulas.flatMap((row, rowIndex) =>
    row.flatMap((formula, colIndex) =>
      formula
        ? [
            `${makeAddress({
              row: given.r1 + rowIndex,
              col: given.c1 + colIndex
            })}: ${formula}`
          ]
        : []
    )
  )
}

/**
 * The cells as the assistant gets them: a Markdown table with the letters
 * of the columns and the numbers of the rows, then the formulas
 *
 * @param {object} sheet - what `readSheetSelection` read
 * @param {string} sheet.sheet - the name of the sheet
 * @param {Box} sheet.range - the cells the request is about
 * @param {Box} sheet.given - the part of them given, the first rows
 * @param {Cell|null} [sheet.around] - the cell selected, for a range around it
 * @param {string[][]} sheet.texts - the text of each given cell, as shown
 * @param {(string|null)[][]} sheet.formulas - the formula of each given cell
 * @returns {string}
 */
export function makeSheetContent({
  sheet,
  range,
  given,
  around = null,
  texts,
  formulas
}) {
  const isCell = range.r1 === range.r2 && range.c1 === range.c2
  const isEmpty = texts.every(row => row.every(text => text === ''))
  const place = makeSheetPlace({ sheet, range, given, around, isCell })
  if (isCell && isEmpty) {
    return `${place}, empty: the cells of an answer start there`
  }

  const formulaLines = makeFormulaLines(formulas, given)
  return [
    place,
    makeCellsTable(texts, given),
    ...(formulaLines.length > 0
      ? [`Formulas:\n${formulaLines.join('\n')}`]
      : [])
  ].join('\n\n')
}

// A formula is written as the LLM gave it: its `*` are no emphasis. A cell
// in backquotes is code, its text as it is.
function readCellText(raw) {
  const text = raw.trim()
  const code = text.match(/^`([^`]*)`$/)?.[1]
  if (code !== undefined) return code.trim()
  if (text.startsWith('=')) return text
  return makeInlineText(text).trim()
}

// A table of cells by address, one per row, under a header as
// `| Address | Value |`. The header tells it: a label as T1 or Q2 looks like
// an address.
function readAddressList(header, lines) {
  const isAddress = line => ADDRESS.test(line[0]?.trim() ?? '')
  const isList =
    ADDRESS_HEADER.test(header[0]?.trim() ?? '') &&
    lines.length > 0 &&
    lines.every(isAddress)
  if (!isList) return null

  return lines.map(line => ({
    ...parseAddress(line[0].trim()),
    text: readCellText(line[1] ?? '')
  }))
}

const isColumnName = text => findColumnIndex(text) !== null
const hasRowNumber = line => ROW_NUMBER.test(line[0]?.trim() ?? '')

function readTableHeader(headerTexts, lines) {
  const hasRowHeader = ROW_HEADER.test(headerTexts[0] ?? '')
  const start = hasRowHeader ? 1 : 0
  const letters = headerTexts.slice(start)
  const hasLetters = letters.length > 0 && letters.every(isColumnName)
  const hasNumbers = hasRowHeader && lines.every(hasRowNumber)
  return {
    letters,
    hasLetters,
    hasNumbers,
    firstColumn: hasLetters || hasNumbers ? start : 0
  }
}

function readTableLine(line, lineIndex, layout, origin) {
  const { letters, hasLetters, hasNumbers, firstColumn } = layout
  const row = hasNumbers ? Number(line[0].trim()) - 1 : origin.row + lineIndex
  const getColumn = hasLetters
    ? index => findColumnIndex(letters[index] ?? '') ?? -1
    : index => origin.col + index
  return line.slice(firstColumn).map((raw, index) => ({
    row,
    col: getColumn(index),
    text: readCellText(raw ?? '')
  }))
}

function readTable({ header, rows }, origin) {
  const headerTexts = header.map(cell => cell.text)
  const lines = rows.map(row => row.map(cell => cell.text))
  const list = readAddressList(headerTexts, lines)
  if (list) return list
  const layout = readTableHeader(
    headerTexts.map(text => text.trim()),
    lines
  )

  // Without the letters, the header row is the first row of cells
  const grid = layout.hasLetters ? lines : [headerTexts, ...lines]
  return grid
    .flatMap((line, lineIndex) =>
      readTableLine(line, lineIndex, layout, origin)
    )
    .filter(cell => cell.col >= 0)
}

// The lines of an answer without a table, when they are formulas: one cell
// each. Any other text is an explanation, even a single line: nothing is
// written for it.
function readLines(tokens, origin) {
  const lines = tokens
    .flatMap(token => {
      if (token.type === 'list') return token.items.map(item => item.text)
      if (['paragraph', 'heading', 'text', 'code'].includes(token.type)) {
        return token.text.split('\n')
      }
      return []
    })
    .filter(line => !FORMULA_LINE.test(line))
    .map(readCellText)
    .filter(text => text !== '')
  if (!lines.every(text => text.startsWith('='))) return []

  return lines.map((text, index) => ({
    row: origin.row + index,
    col: origin.col,
    text
  }))
}

function readFormulaLines(markdown) {
  return markdown.split('\n').flatMap(line => {
    const match = line.match(FORMULA_LINE)
    return match ? [{ ...parseAddress(match[1]), text: match[2].trim() }] : []
  })
}

/**
 * Where the cells of an answer without addresses go: a table from the
 * top-left cell of the range, lines under it, or both at an empty cell
 *
 * @param {object} target
 * @param {Box} target.range
 * @param {boolean} target.isEmpty - whether the range is an empty cell
 * @returns {{ tableOrigin: Cell, linesOrigin: Cell }}
 */
export function getAnswerOrigins({ range, isEmpty }) {
  const topLeft = { row: range.r1, col: range.c1 }
  return {
    tableOrigin: topLeft,
    linesOrigin: isEmpty ? topLeft : { row: range.r2 + 1, col: range.c1 }
  }
}

/**
 * The cells of an answer: those of its first table, at the addresses its
 * letters and numbers give, or laid from `tableOrigin` without them; else
 * lines of formulas, one cell each, laid from `linesOrigin`, in a column. A formula given on a
 * line with its address, as the content lists them, takes its cell. An empty
 * cell is not given: the LLM leaves a cell empty to keep it as it is.
 *
 * @param {string} markdown - the answer
 * @param {object} origins
 * @param {Cell} origins.tableOrigin
 * @param {Cell} origins.linesOrigin
 * @returns {{ row: number, col: number, text: string }[]} the last one given
 * for a cell wins
 */
export function readAnswerCells(markdown, { tableOrigin, linesOrigin }) {
  const text = unwrapAnswer(markdown)
  const tokens = new Lexer().lex(text)
  const table = tokens.find(token => token.type === 'table')
  const cells = [
    ...(table ? readTable(table, tableOrigin) : readLines(tokens, linesOrigin)),
    ...readFormulaLines(text)
  ]

  const byAddress = new Map(
    cells
      .filter(cell => cell.text !== '')
      .map(cell => [`${cell.row},${cell.col}`, cell])
  )
  return [...byAddress.values()]
}

/**
 * @param {Box} range
 * @param {Cell[]} cells
 * @returns {Box} the smallest box that holds the range and the cells
 */
export function makeUnionBox(range, cells) {
  return cells.reduce(
    (box, { row, col }) => ({
      r1: Math.min(box.r1, row),
      c1: Math.min(box.c1, col),
      r2: Math.max(box.r2, row),
      c2: Math.max(box.c2, col)
    }),
    range
  )
}

export function getBoxSize({ r1, c1, r2, c2 }) {
  return (r2 - r1 + 1) * (c2 - c1 + 1)
}

// A single separator before three digits groups the thousands
function isDecimalSeparator(separators, decimals) {
  if (separators.length === 0) return false
  return (
    new Set(separators).size > 1 ||
    (separators.length === 1 && decimals.length !== 3)
  )
}

/**
 * A number however the LLM or the sheet writes it: `1 200,50 €`, `1,200.5`,
 * `-3`
 *
 * @param {string} text
 * @returns {number|null} null for a text that is not one
 */
export function readLooseNumber(text) {
  const compact = text.replace(SPACES, '').replace(/[€$£¥]/g, '')
  if (!/^[-+]?\d[\d.,]*$/.test(compact)) return null

  const separators = compact.match(/[.,]/g) ?? []
  const last = compact.search(/[.,][^.,]*$/)
  const decimals = compact.slice(last + 1)
  const isDecimal = isDecimalSeparator(separators, decimals)
  const integer = (isDecimal ? compact.slice(0, last) : compact).replace(
    /[.,]/g,
    ''
  )
  const value = Number(isDecimal ? `${integer}.${decimals}` : integer)
  return Number.isFinite(value) ? value : null
}

const normalize = text => text.replace(SPACES, ' ').trim()

/**
 * Whether the text the answer gives a cell is the one it holds: its text as
 * shown, its formula, or the same number written another way
 */
export function isSameCell(text, { shown, formula }) {
  if (normalize(text) === normalize(shown)) return true
  if (
    formula &&
    normalize(text).replace(/ /g, '') === formula.replace(SPACES, '')
  ) {
    return true
  }
  const number = readLooseNumber(text)
  return number !== null && number === readLooseNumber(shown)
}

const isInside = ({ row, col }, { r1, c1, r2, c2 }) =>
  row >= r1 && row <= r2 && col >= c1 && col <= c2

function makeCellReader({ box, texts, formulas }) {
  return ({ row, col }) => ({
    shown: texts[row - box.r1]?.[col - box.c1] ?? '',
    formula: formulas[row - box.r1]?.[col - box.c1] ?? null
  })
}

function getPlace(cell, range) {
  if (isInside(cell, range)) return 'inside'
  if (cell.row > range.r2) return 'below'
  if (cell.col > range.c2) return 'beside'
  return 'before'
}

function groupByPlace(cells, range) {
  const groups = { inside: [], below: [], beside: [], before: [] }
  cells.forEach(cell => groups[getPlace(cell, range)].push(cell))
  return groups
}

// The rows or columns to insert from `at` for the cells past the range,
// when one of them would overwrite a cell
function makeInsert(cells, collides, at, getIndex) {
  if (!cells.some(collides)) return null
  return { at, count: Math.max(...cells.map(getIndex)) - at + 1 }
}

/**
 * What to do to write the cells of an answer: the cells left as they are,
 * the ones written, and the rows or columns to insert first, so that nothing
 * outside of the range is overwritten
 *
 * @param {object} options
 * @param {{ row: number, col: number, text: string }[]} options.cells - the
 * cells of the answer
 * @param {Box} options.range - the cells the request was about
 * @param {Box} options.box - the cells read, the range and the answer
 * @param {string[][]} options.texts - the text of each cell of the box
 * @param {(string|null)[][]} options.formulas - its formula
 * @returns {{
 *   insertRows: { at: number, count: number } | null,
 *   insertColumns: { at: number, count: number } | null,
 *   writes: { row: number, col: number, text: string }[],
 *   skipped: Cell[],
 *   box: Box
 * }} `box` holds the range and the cells written, once the rows and columns
 * are inserted
 */
export function planSheetWrite({ cells, range, box, texts, formulas }) {
  const read = makeCellReader({ box, texts, formulas })
  const collides = cell => {
    const { shown, formula } = read(cell)
    return shown !== '' || Boolean(formula)
  }

  const changed = cells.filter(cell => !isSameCell(cell.text, read(cell)))
  const { inside, below, beside, before } = groupByPlace(changed, range)
  // Above or left of the range, a cell that holds something is kept
  const skipped = before.filter(collides)
  const others = before.filter(cell => !collides(cell))

  const writes = [...inside, ...below, ...beside, ...others].map(
    ({ row, col, text }) => ({ row, col, text })
  )
  return {
    insertRows: makeInsert(below, collides, range.r2 + 1, cell => cell.row),
    insertColumns: makeInsert(beside, collides, range.c2 + 1, cell => cell.col),
    writes,
    skipped: skipped.map(({ row, col }) => ({ row, col })),
    box: makeUnionBox(range, writes)
  }
}

const RANGE =
  /^\$?([A-Z]{1,3})\$?([1-9]\d{0,6})(?::\$?([A-Z]{1,3})\$?([1-9]\d{0,6}))?$/

/**
 * @param {string} address - a range in A1 notation, as A1:C5 or $B$2, after
 * the name of its sheet or not
 * @returns {Box|null} null for another text
 */
export function parseRange(address) {
  const match = address.trim().replace(/^.*!/, '').match(RANGE)
  if (!match) return null
  const [, letters1, number1, letters2 = letters1, number2 = number1] = match
  const r1 = Number(number1) - 1
  const r2 = Number(number2) - 1
  const c1 = findColumnIndex(letters1)
  const c2 = findColumnIndex(letters2)
  return {
    r1: Math.min(r1, r2),
    c1: Math.min(c1, c2),
    r2: Math.max(r1, r2),
    c2: Math.max(c1, c2)
  }
}

/**
 * @param {string} address - a range of one area or more, joined by commas,
 * as A1:A5,C1:C5
 * @returns {Box[]|null} null when one of them is no range
 */
export function parseRanges(address) {
  const areas = address.split(/[,;]/).map(parseRange)
  return areas.every(Boolean) ? areas : null
}

/**
 * @param {string} sheet - the name of the sheet
 * @param {Box[]} areas
 * @returns {string} the range as the editor takes the data of a chart:
 * 'Ventes'!$A$1:$A$5,'Ventes'!$C$1:$C$5
 */
export function makeChartRange(sheet, areas) {
  const name = `'${sheet.replace(/'/g, "''")}'`
  const cell = (row, col) => `$${getColumnName(col)}$${row + 1}`
  return areas
    .map(({ r1, c1, r2, c2 }) => `${name}!${cell(r1, c1)}:${cell(r2, c2)}`)
    .join(',')
}

/**
 * The series of a chart run along the longer side of its data, as in the
 * editor: the columns of a range taller than wide
 */
export function isChartInRows({ r1, c1, r2, c2 }) {
  return c2 - c1 > r2 - r1
}

// The rows a chart takes, about: 7 cm under the default height of a row
export const CHART_ROWS = 15

/**
 * Where a chart goes beside its data: one empty column after the last cell
 * used on its rows, and under the charts already there
 *
 * @param {object} options
 * @param {Box} options.range - the data of the chart
 * @param {number[]} options.lastColumns - the last column used on each row
 * from the first row of the data, -1 for an empty row
 * @param {Box[]} options.drawings - the charts and shapes of the sheet
 * @returns {Cell} the top-left cell of the chart
 */
export function placeChart({ range, lastColumns, drawings }) {
  const col = Math.max(range.c2, ...lastColumns) + 2
  let row = range.r1
  // A drawing in the way pushes the chart under it, until none is
  for (let moved = true; moved; ) {
    moved = false
    for (const drawing of drawings) {
      const isInWay =
        drawing.c2 >= col &&
        drawing.r2 >= row &&
        drawing.r1 <= row + CHART_ROWS - 1
      if (isInWay) {
        row = drawing.r2 + 2
        moved = true
      }
    }
  }
  return { row, col }
}
