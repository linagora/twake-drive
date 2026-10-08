// What the LLM reads (the *_FOR_LLM objects) stays in English whatever the
// language of the user: only the labels and the messages of the chips are
// translated.

export const INSERT_SLIDE = 'insert_slide'
export const INSERT_TABLE = 'insert_table'

// DEFAULT_MENU_SUGGESTION of the assistant (twake-assistant src/lib/intent.js):
// its default menu of prompts, at this place among the chips
const CATALOGUE = { name: 'catalogue' }

const INSERT_SLIDE_FOR_LLM = {
  description:
    'add a new slide after the current one in the presentation the user is editing, with a title and bullet points. Pick it when the user asks for a new slide, a slide about a subject, a conclusion or a summary slide. Do not pick it to change, fix, shorten, translate or rewrite the text given with the message: that is an answer.',
  examples: [
    { message: 'Ajoute une diapositive sur le budget', needs_documents: false },
    { message: 'Add a closing slide', needs_documents: false }
  ],
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'the title of the slide, short'
      },
      bullets: {
        type: 'array',
        items: { type: 'string' },
        description:
          'the bullet points of the slide, 3 to 6 short lines, without bullet marks'
      }
    },
    required: ['title', 'bullets']
  },
  instructions:
    'Write the title and the bullets in the language of the text of the presentation given with the message. Build on that text when it is about the same subject; do not invent figures, names or dates it does not give.'
}

const INSERT_TABLE_FOR_LLM = {
  description:
    'insert a new table in the text document the user is editing, at the cursor, with a header row and data rows. Pick it when the user asks to make a table, a grid or a comparison in columns, from the text given with the message or from what they say. When the text given with the message already is a table, never pick it: to add a column or a row to that table, to sort it or to change its cells is an answer with the whole table changed. Do not pick it either to fix, rewrite, shorten or translate the text: that is an answer.',
  examples: [
    {
      message: 'Fais un tableau des lots et de leur budget',
      needs_documents: false
    },
    { message: 'Present these figures as a table', needs_documents: false }
  ],
  parameters: {
    type: 'object',
    properties: {
      caption: {
        type: 'string',
        description:
          'a short title written above the table, empty when none is needed'
      },
      columns: {
        type: 'array',
        items: { type: 'string' },
        description:
          'the header of each column, 2 to 6 columns: one column per piece of information of a row, like a number, a name, a person or an amount'
      },
      rows: {
        type: 'array',
        items: { type: 'string' },
        description:
          'the data rows, one string per row, the cells separated by " | " in the order of the columns'
      }
    },
    required: ['columns', 'rows']
  },
  instructions:
    'Write in the language of the text given with the message. Keep the figures and names of that text as they are; do not invent values it does not give. Each row has exactly as many cells as there are columns, in their order: never put two pieces of information in one cell nor one piece in two cells.'
}

// Keyed by the `documentType` of the OnlyOffice config. `confirm: false`:
// the editor undoes a slide or a table in one step, so they are written
// without a card to confirm.
const EDITORS = {
  slide: {
    capabilities: t => [
      {
        name: INSERT_SLIDE,
        label: t('OnlyOffice.scribe.insertSlide'),
        ...INSERT_SLIDE_FOR_LLM,
        confirm: false
      }
    ],
    suggestions: t => [
      CATALOGUE,
      {
        name: 'new_slide',
        capability: INSERT_SLIDE,
        label: t('OnlyOffice.scribe.suggestions.newSlide'),
        message: t('OnlyOffice.scribe.suggestions.newSlideMessage')
      }
    ]
  },
  word: {
    capabilities: () => [
      { name: INSERT_TABLE, ...INSERT_TABLE_FOR_LLM, confirm: false }
    ],
    suggestions: t => [
      CATALOGUE,
      {
        name: 'table',
        capability: INSERT_TABLE,
        label: t('OnlyOffice.scribe.suggestions.table'),
        message: t('OnlyOffice.scribe.suggestions.tableMessage')
      }
    ]
  }
}

export const makeCapabilities = ({ documentType, t }) =>
  EDITORS[documentType]?.capabilities(t) ?? []

export const makeSuggestions = ({ documentType, t }) =>
  EDITORS[documentType]?.suggestions(t) ?? []

/**
 * @param {unknown} params - parameters of an `insert_slide` call, as the LLM
 * wrote them
 * @returns {{ title: string, bullets: string[] } | null} null when the
 * parameters are wrong or the slide would be empty
 */
export const normalizeSlide = params => {
  const { title, bullets } = params ?? {}
  const isValid =
    typeof title === 'string' &&
    Array.isArray(bullets) &&
    bullets.every(bullet => typeof bullet === 'string')
  if (!isValid) return null

  // The slide gives its own bullets: a mark the LLM still wrote would double them
  const lines = bullets
    .map(bullet => bullet.replace(/^\s*[-*•]\s+/, '').trim())
    .filter(line => line !== '')
  if (title.trim() === '' && lines.length === 0) return null

  return { title: title.trim(), bullets: lines }
}

const isStringArray = value =>
  Array.isArray(value) && value.every(item => typeof item === 'string')

// The LLM sometimes writes the rows as the lines of a Markdown table, with
// their outer pipes and the separator line under the header
const OUTER_PIPES = /^\s*\|?|\|?\s*$/g
const SEPARATOR_CELL = /^:?-+:?$/

/**
 * @param {unknown} params - parameters of an `insert_table` call, as the LLM
 * wrote them, each row a string of cells split on `|`
 * @returns {{ caption: string, columns: string[], rows: string[][] } | null}
 * every row padded to the width of the widest one, header included; null
 * when the parameters are wrong or the table would be empty
 */
export const normalizeTable = params => {
  const { caption = '', columns, rows } = params ?? {}
  const isValid =
    typeof caption === 'string' && isStringArray(columns) && isStringArray(rows)
  if (!isValid) return null

  const lines = rows
    .map(row =>
      row
        .replace(OUTER_PIPES, '')
        .split('|')
        .map(cell => cell.trim())
    )
    .filter(
      row =>
        row.some(cell => cell !== '') &&
        !row.every(cell => SEPARATOR_CELL.test(cell))
    )
  // A row longer than the header widens the table: the LLM sometimes splits
  // a cell it named as one column, and its figures are worth more than an
  // empty header
  const width = Math.max(columns.length, ...lines.map(row => row.length))
  const header = Array.from(
    { length: width },
    (_, index) => columns[index]?.trim() ?? ''
  )
  const cells = lines.map(row =>
    Array.from({ length: width }, (_, index) => row[index] ?? '')
  )
  if (columns.length === 0 || cells.length === 0) return null

  return { caption: caption.trim(), columns: header, rows: cells }
}

export const makeTableMarkdown = ({ caption, columns, rows }) => {
  // A backslash is escaped first: it would escape the character after it
  const escapeCell = cell =>
    cell
      .replace(/\\/g, '\\\\')
      .replace(/\|/g, '\\|')
      .replace(/\s*\n\s*/g, ' ')
  const makeLine = cells => `| ${cells.map(escapeCell).join(' | ')} |`

  const lines = [
    makeLine(columns),
    `|${' --- |'.repeat(columns.length)}`,
    ...rows.map(makeLine)
  ]
  return (caption === '' ? '' : `${caption}\n\n`) + lines.join('\n')
}
