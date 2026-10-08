// The document of an OnlyOffice editor as the scribe harness compares it:
// its blocks with their text and look, and the text the selection covers.
// Taken from the test harness of the scribe of Benibur/cozy-drive.

export interface ScribeRun {
  t: string
  b?: 1
  i?: 1
  u?: 1
  s?: 1
  code?: 1
  link?: string
}

export interface ScribeParagraph {
  type: 'p'
  runs: ScribeRun[]
  style?: string
  lvl?: number
  // The level of the item and the label the editor numbers it with
  list?: [number, string]
  images?: number
  // The references to footnotes
  notes?: number
  pageBreaks?: number
  // The paragraph ends a section of the document
  section?: 1
}

export interface ScribeCell {
  blocks: ScribeBlock[]
  vmerge?: 'master' | 'cont'
  hspan?: number
}

export interface ScribeTable {
  type: 'table'
  grid: ScribeCell[][]
}

export type ScribeBlock = ScribeParagraph | ScribeTable

// Where a selected paragraph is: a block of the body, or a paragraph of a cell
export interface ScribePosition {
  block: number
  cell?: { r: number; c: number }
  cellBlock?: number
}

export interface ScribeModel {
  blocks: ScribeBlock[]
  // The text the selection covers, '\n' where it crosses a paragraph
  selText: string | null
  // Each paragraph the selection touches, its selected text between « »
  selMarkup: { at: ScribePosition; text: string }[]
  collapsed?: true
  selMarkupTruncated?: true
}

const RUN_FLAGS = ['b', 'i', 'u', 's', 'code'] as const

// The marks of paragraphs and cells, and the non-breaking spaces of the
// editor, are not text
const normalizeText = (text: string | undefined): string =>
  (text ?? '').replace(/\u00a0/g, ' ').replace(/[\t\r\n]/g, '')

const normalizeRun = (run: ScribeRun): ScribeRun => {
  const normalized: ScribeRun = { t: normalizeText(run.t) }
  for (const flag of RUN_FLAGS) if (run[flag]) normalized[flag] = 1
  if (run.link) normalized.link = run.link
  return normalized
}

// In the order the expected results are written
const PARAGRAPH_FIELDS = [
  'style',
  'lvl',
  'list',
  'images',
  'notes',
  'pageBreaks',
  'section'
] as const

// The level 0 of the outline is a level, a count of 0 is nothing
const hasField = (
  paragraph: ScribeParagraph,
  field: (typeof PARAGRAPH_FIELDS)[number]
): boolean =>
  field === 'lvl'
    ? typeof paragraph.lvl === 'number'
    : Boolean(paragraph[field])

const normalizeParagraph = (paragraph: ScribeParagraph): ScribeParagraph => ({
  type: 'p',
  runs: paragraph.runs
    .map(normalizeRun)
    .filter(run => run.t !== '' || run.link),
  ...Object.fromEntries(
    PARAGRAPH_FIELDS.filter(field => hasField(paragraph, field)).map(field => [
      field,
      paragraph[field]
    ])
  )
})

const normalizeCell = (cell: ScribeCell): ScribeCell => ({
  blocks: cell.blocks.map(normalizeBlock),
  ...(cell.vmerge && { vmerge: cell.vmerge }),
  ...(cell.hspan && cell.hspan > 1 && { hspan: cell.hspan })
})

function normalizeBlock(block: ScribeBlock): ScribeBlock {
  if (block.type === 'p') return normalizeParagraph(block)
  return {
    type: 'table',
    grid: block.grid.map(row => row.map(normalizeCell))
  }
}

/**
 * Keeps what the harness asserts, in a stable form: the positions of the
 * editor, which count empty runs, are left out
 */
export const normalizeModel = (captured: ScribeModel): ScribeModel => {
  const selText =
    captured.selText === null
      ? null
      : captured.selText
          .replace(/\u00a0/g, ' ')
          .replace(/\t/g, '')
          .replace(/\r\n?/g, '\n')
  return {
    blocks: captured.blocks.map(normalizeBlock),
    selText,
    selMarkup: captured.selMarkup.map(({ at, text }) => ({
      at,
      text: normalizeText(text)
    })),
    ...(selText === '' && { collapsed: true as const }),
    ...(captured.selMarkupTruncated && { selMarkupTruncated: true as const })
  }
}
