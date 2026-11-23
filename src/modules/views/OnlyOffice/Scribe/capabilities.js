// What the LLM reads (the *_FOR_LLM objects) stays in English whatever the
// language of the user: only the labels and the messages of the chips are
// translated.

export const INSERT_SLIDE = 'insert_slide'
export const INSERT_CHART = 'insert_chart'

// The types of chart the spreadsheet editor makes (ChartType of its API)
export const CHART_TYPES = [
  'bar',
  'barStacked',
  'barStackedPercent',
  'bar3D',
  'barStacked3D',
  'barStackedPercent3D',
  'barStackedPercent3DPerspective',
  'horizontalBar',
  'horizontalBarStacked',
  'horizontalBarStackedPercent',
  'horizontalBar3D',
  'horizontalBarStacked3D',
  'horizontalBarStackedPercent3D',
  'lineNormal',
  'lineStacked',
  'lineStackedPercent',
  'lineNormalMarker',
  'lineStackedMarker',
  'lineStackedPerMarker',
  'line3D',
  'pie',
  'pie3D',
  'doughnut',
  'scatter',
  'scatterLine',
  'scatterLineMarker',
  'scatterSmooth',
  'scatterSmoothMarker',
  'stock',
  'area',
  'areaStacked',
  'areaStackedPercent'
]

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

// A spreadsheet has no capability: a formula, a row or a column comes as a
// cell of an answer, which the plugin writes at its address. These
// instructions take the place of the ones of the assistant, written for a
// text: the LLM weighs the two, and thinks longer than the stack lets it.
// They settle what it hesitates on: the cells to give, a label, a total
// row, a value the user gives.
const SHEET_INSTRUCTIONS_FOR_LLM = `You help the user work on the cells of a spreadsheet, given as a Markdown table: its header row holds the column letters and its first column the row numbers; the formulas of the cells are listed under it. Answer as follows, without weighing other forms. A request to compute something from the cells, as a sum, a ratio or an average, asks for cells with formulas.
To compute or change cells, give one Markdown table of the cells you write, with their column letter in its header row and their row number in its first column, as | | D | then | 3 | =B3/C3 |, and no introduction. Unchanged cells may be given again or left out: they stay as they are. A new column gets its label on the header row of the data, and a formula on each row, the total row too. A new row goes under the data; when a total row ends the data, the new row takes its place and the total row moves one row down, its formulas taking the new row in. A value computed from other cells is a formula in English with commas between its arguments and a dot for decimals, as =SUM(B2:B5) or =IF(B2>0,B2*0.5,0), never a figure you computed. A value the user gives is written plain, with a dot for decimals and no thousands separator, as 1350.5: the cell keeps its format. An empty cell stays as it is. Do not make up values.
To answer a question, write a few sentences in the language of the user. When asked both, the table, then the sentences.`

const INSERT_CHART_FOR_LLM = {
  description:
    'insert a chart of cells of the spreadsheet the user is editing, beside the data. Pick it when the user asks for a chart, a graph, a plot or a diagram. Do not pick it to compute, change or add cells, nor to answer a question about them: that is an answer.',
  examples: [
    {
      message: 'Fais un graphique des ventes par région',
      needs_documents: false
    },
    { message: 'Make a pie chart of the budget', needs_documents: false },
    { message: 'Trace la courbe du chiffre d’affaires', needs_documents: false }
  ],
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description:
          'the type of the chart, as the editor names it: bar, horizontalBar, lineNormal, pie, doughnut, scatter, area, stock, or a variant as barStacked, barStackedPercent, bar3D, lineNormalMarker, lineStacked, pie3D, scatterSmooth, areaStacked'
      },
      range: {
        type: 'string',
        description:
          'the cells to chart, as a range of the sheet given with the message, as A1:C5: the row of the headers and the column of the names with the values, without a total row'
      },
      title: {
        type: 'string',
        description: 'a short title of the chart, in the language of the cells'
      }
    },
    required: ['type', 'range']
  },
  instructions:
    'Take the type the user names; else the one that fits the data: bar compares values, horizontalBar too with long names, lineNormal shows a trend over time, pie or doughnut the parts of a whole, scatter one measure against another, area volumes over time, stock prices; a variant when the user asks for it, as stacked, in percent, in 3D or with markers. Take the range from the column letters and row numbers of the table given with the message, and leave out a total row: it would dwarf the others.'
}

const SHEET_CHIPS = [
  { name: 'explain', key: 'explain' },
  { name: 'clean_up', key: 'cleanUp' },
  { name: 'totals', key: 'totals' }
]

// Keyed by the `documentType` of the OnlyOffice config. `confirm: true`: the
// scribe writes nothing in the document without a click (docs/decisions.md).
// A text document has no capability: a table comes in an answer, shown as a
// table before it is inserted.
const EDITORS = {
  slide: {
    capabilities: t => [
      {
        name: INSERT_SLIDE,
        label: t('OnlyOffice.scribe.insertSlide'),
        ...INSERT_SLIDE_FOR_LLM,
        confirm: true
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
    capabilities: () => [],
    suggestions: t => [
      CATALOGUE,
      {
        name: 'table',
        label: t('OnlyOffice.scribe.suggestions.table'),
        message: t('OnlyOffice.scribe.suggestions.tableMessage')
      }
    ]
  },
  // The prompts of the assistant are written for a text: a spreadsheet has
  // its chips only
  cell: {
    capabilities: t => [
      {
        name: INSERT_CHART,
        label: t('OnlyOffice.scribe.insertChart'),
        ...INSERT_CHART_FOR_LLM,
        confirm: true
      }
    ],
    suggestions: t => [
      ...SHEET_CHIPS.map(({ name, key }) => ({
        name,
        label: t(`OnlyOffice.scribe.suggestions.${key}`),
        message: t(`OnlyOffice.scribe.suggestions.${key}Message`)
      })),
      {
        name: 'chart',
        capability: INSERT_CHART,
        label: t('OnlyOffice.scribe.suggestions.chart'),
        message: t('OnlyOffice.scribe.suggestions.chartMessage')
      }
    ],
    instructions: SHEET_INSTRUCTIONS_FOR_LLM,
    answerActions: () => ['apply']
  }
}

export const makeCapabilities = ({ documentType, t }) =>
  EDITORS[documentType]?.capabilities(t) ?? []

export const makeSuggestions = ({ documentType, t }) =>
  EDITORS[documentType]?.suggestions(t) ?? []

/**
 * @returns {string|null} how the LLM answers a request in this editor, in
 * place of the instructions of the assistant; null for the ones of the
 * assistant
 */
export const makeInstructions = ({ documentType }) =>
  EDITORS[documentType]?.instructions ?? null

/**
 * A selection that holds what an answer cannot give back, as an image or a
 * note, is not offered to be replaced. An older plugin does not tell. The
 * cells of an answer go where their addresses say: one action.
 *
 * @returns {string[]} the names of the actions under each answer
 */
export const makeAnswerActions = ({ documentType, target, canReplace }) =>
  EDITORS[documentType]?.answerActions?.() ??
  (target === 'selection' && canReplace !== false
    ? ['insert', 'replace']
    : ['insert'])

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

// The names the LLM may give a type of chart, beside the ones of the editor.
// A Map: a name as `constructor` is no type.
const CHART_TYPE_NAMES = new Map([
  ...CHART_TYPES.map(type => [type.toLowerCase(), type]),
  ['column', 'bar'],
  ['columns', 'bar'],
  ['line', 'lineNormal'],
  ['horizontal', 'horizontalBar']
])
const AREA = /^(?:.+!)?\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?$/i

/**
 * @param {unknown} params - parameters of an `insert_chart` call, as the LLM
 * wrote them
 * @returns {{ chartType: string, range: string|null, title: string } | null}
 * the type as the editor names it, the range in A1 notation, its areas
 * joined by commas, as A1:A5,C1:C5 for the names and one column of values;
 * null for the cells given. null when the type is none of the editor.
 */
export const normalizeChart = params => {
  const { type, range, title } = params ?? {}
  // `Pie chart`, `bar graph`: the type is the name before
  const chartType =
    typeof type === 'string'
      ? CHART_TYPE_NAMES.get(
          type
            .trim()
            .replace(/\s*(chart|graph)$/i, '')
            .replace(/\s+/g, '')
            .toLowerCase()
        )
      : undefined
  if (chartType === undefined) return null

  const areas = (typeof range === 'string' ? range.toUpperCase() : '')
    .split(/[,;]/)
    .map(area => area.trim())
    .filter(area => area !== '')
  return {
    chartType,
    range:
      areas.length > 0 && areas.every(area => AREA.test(area))
        ? areas.join(',')
        : null,
    title: typeof title === 'string' ? title.trim() : ''
  }
}
