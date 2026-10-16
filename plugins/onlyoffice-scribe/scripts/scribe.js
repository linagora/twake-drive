import { readContent, writeBlocks } from './document.js'
import {
  CHART_ROWS,
  MAX_ANSWER_CELLS,
  MAX_CELLS,
  getAnswerOrigins,
  getBoxSize,
  isChartInRows,
  makeChartRange,
  makeSheetContent,
  makeUnionBox,
  parseRanges,
  placeChart,
  planSheetWrite,
  readAnswerCells
} from './grid.js'
import { makeBlocks, makeLineSpans, makeLines } from './markdown.js'
import {
  findWrittenParagraphs,
  insertSlide,
  readSlideContent,
  writeSlideLines
} from './presentation.js'
import {
  insertChart,
  readChartPlace,
  readSheetCells,
  readSheetSelection,
  writeSheetPlan
} from './spreadsheet.js'

// The plugin is in the frame of the editor, itself in the app that shows it
const host = window.parent.parent
// Time for a selection to settle before it is read: a selection made with
// the mouse or the keyboard changes many times
const SELECTION_DELAY = 400
// A selection is read with callCommand, which empties the redo of the editor.
// An undo or a redo changes the selection: none is read for this time after
// one, long enough for the throttled timers of a background frame.
const UNDO_REDO_PAUSE = 3000
// The paragraphs of the last answer written in a presentation
let written = null
// The cells last given to the app in a spreadsheet: where an answer goes
let sheetTarget = null
// The origin of the app while its panel is open: it has asked for the text
let hostOrigin = null
// The text last given to the app, its plain text, and whether an answer is
// being written
let lastContent = null
let lastSelectedText = null
let isWriting = false
let selectionTimer = null
let pausedUntil = 0
let isStarted = false
// Each request for the text, and each close of the panel, ends the requests
// still being read: the panel does not open again for an older one
let contentRequest = 0
// The editor keeps a single callback of the plugin for its commands: a
// command sent while another one runs would take its result, and the other
// one would never end. They run one after the other.
let lastCommand = Promise.resolve()

function runInEditor(command, { scope = {}, isRecalculated = false } = {}) {
  const run = lastCommand.then(
    () =>
      new Promise(resolve => {
        // The scope goes with the command when it is sent
        Object.assign(window.Asc.scope, scope)
        window.Asc.plugin.callCommand(command, false, isRecalculated, resolve)
      })
  )
  lastCommand = run
  return run
}

// The editor runs no command while it saves, or while a cell is being
// edited: the command gives nothing. A command that must not be lost, as
// the writing of an answer, is sent again for a while.
const BUSY_DELAY = 500
const BUSY_RETRIES = 10

async function runInFreeEditor(command, options) {
  for (let attempt = 0; attempt < BUSY_RETRIES; attempt += 1) {
    const result = await runInEditor(command, options)
    if (result !== undefined) return result
    await new Promise(resolve => setTimeout(resolve, BUSY_DELAY))
  }
  return undefined
}

function callEditor(method, parameters) {
  return new Promise(resolve => {
    window.Asc.plugin.executeMethod(method, parameters, resolve)
  })
}

function isPresentation() {
  return window.Asc.plugin.info.editorType === 'slide'
}

function isSpreadsheet() {
  return window.Asc.plugin.info.editorType === 'cell'
}

// The cells the app gets, and where an answer goes. `key` leaves out the
// selected cell: another cell of the same block gives the same cells.
async function readSheet({ isCellIgnored = false } = {}) {
  const selection = await runInEditor(readSheetSelection, {
    scope: { maxCells: MAX_CELLS }
  })
  if (!selection || (isCellIgnored && selection.around)) return null
  const cells = await runInEditor(readSheetCells, {
    scope: { sheetName: selection.sheet, box: selection.given }
  })
  if (!cells) return null

  const sheet = { ...selection, ...cells }
  const { range } = selection
  const isEmpty =
    getBoxSize(range) === 1 && cells.texts[0][0] === '' && !cells.formulas[0][0]
  return {
    content: makeSheetContent(sheet),
    key: makeSheetContent({ ...sheet, around: null }),
    target: selection.around ? 'region' : 'selection',
    sheetTarget: { sheetName: selection.sheet, range, isEmpty }
  }
}

function keepSheet(read) {
  lastContent = read.key
  sheetTarget = read.sheetTarget
}

// The cells of an answer, written at their addresses in the cells last
// given to the app: see planSheetWrite
// @returns {Promise<boolean>} whether a cell was written
async function writeSheetAnswer(text) {
  if (!sheetTarget) return false
  const { sheetName, range, isEmpty } = sheetTarget
  const cells = readAnswerCells(text, getAnswerOrigins({ range, isEmpty }))
  const box = makeUnionBox(range, cells)
  if (cells.length === 0 || getBoxSize(box) > MAX_ANSWER_CELLS) return false

  const read = await runInFreeEditor(readSheetCells, {
    scope: { sheetName, box }
  })
  if (!read) return false
  const plan = planSheetWrite({ cells, range, box, ...read })
  if (plan.writes.length === 0) return false
  await runInFreeEditor(writeSheetPlan, {
    scope: { sheetName, plan },
    isRecalculated: true
  })
  // The cells written are left selected: they are not other cells to work on
  const after = await readSheet()
  if (after) keepSheet(after)
  return true
}

// The editor gives the selected text of a presentation to the plugin only,
// not to the code it runs
function fetchSelectedText() {
  return callEditor('GetSelectedText', [{ ParaSeparator: '\n' }])
}

async function readPresentation() {
  const selectedText = await fetchSelectedText()
  return runInEditor(readSlideContent, { scope: { selectedText } })
}

async function writePresentation(text, isReplace) {
  // A line of the answer is a paragraph of the slide
  const blocks = makeBlocks(text, { hasLineBreaks: true })
  const lineSpans = makeLineSpans(blocks)
  if (lineSpans.length === 0) return

  const selectedText = await fetchSelectedText()
  const result = await runInEditor(writeSlideLines, {
    scope: { lineSpans, isReplace, selectedText, written },
    isRecalculated: true
  })
  if (result?.isInline) {
    // The editor writes plain text, in the look of the text around it
    const lines = makeLines(blocks)
    await callEditor('ReplaceTextSmart', [lines])
    written = await runInEditor(findWrittenParagraphs, {
      scope: { count: lines.length }
    })
    return
  }
  written = result
}

function fetchContent() {
  return isPresentation() ? readPresentation() : runInEditor(readContent)
}

// The editor runs no command while it loads or saves: the text is then not
// read, and the app asks again
// The size of a chart, in English measure units: 12 cm by 7 cm
const CHART_WIDTH = 4320000
const CHART_HEIGHT = 2520000

// A chart the assistant has made, of a range of the cells last given to the
// app, or of all of them, beside the data. The app has checked it already.
async function addChart({ chartType, title, range }) {
  if (!isSpreadsheet() || !sheetTarget || typeof chartType !== 'string') return
  const { sheetName } = sheetTarget
  // The areas of the data, as the names and one column of values of a pie
  const areas = (typeof range === 'string' && parseRanges(range)) || [
    sheetTarget.range
  ]
  const data = makeUnionBox(
    areas[0],
    areas.flatMap(({ r1, c1, r2, c2 }) => [
      { row: r1, col: c1 },
      { row: r2, col: c2 }
    ])
  )

  isWriting = true
  try {
    const read = await runInFreeEditor(readChartPlace, {
      scope: { sheetName, r1: data.r1, rowCount: CHART_ROWS }
    })
    if (!read) return
    await runInFreeEditor(insertChart, {
      scope: {
        sheetName,
        range: makeChartRange(sheetName, [data]),
        areas,
        isInRows: isChartInRows(data),
        type: chartType,
        title: typeof title === 'string' ? title : '',
        place: placeChart({ range: data, ...read }),
        width: CHART_WIDTH,
        height: CHART_HEIGHT
      },
      isRecalculated: true
    })
  } finally {
    isWriting = false
  }
}

async function sendContent(origin) {
  contentRequest += 1
  const request = contentRequest
  if (isSpreadsheet()) {
    const read = await readSheet()
    if (!read || request !== contentRequest) return
    hostOrigin = origin
    keepSheet(read)
    const { content, target } = read
    host.postMessage({ type: 'twake-scribe:content', content, target }, origin)
    return
  }
  const read = await fetchContent()
  const selectedText = await fetchSelectedText()
  if (!read || request !== contentRequest) return
  hostOrigin = origin
  lastContent = read.content
  lastSelectedText = selectedText

  host.postMessage({ type: 'twake-scribe:content', ...read }, origin)
}

// Another text selected: the app gives it to the assistant if it is open.
// A cursor that moves, or the text of an answer just written, is not another
// text.
// The selection is read by a command only when its text changes: a command
// empties the redo of the editor.
// Other cells selected. A click on a single cell is a cursor that moves.
async function sendSheetSelection() {
  const read = await readSheet({ isCellIgnored: true })
  if (!hostOrigin || !read || read.key === lastContent) return
  keepSheet(read)
  const { content, target } = read
  host.postMessage(
    { type: 'twake-scribe:selection', content, target },
    hostOrigin
  )
}

async function sendSelection() {
  if (!hostOrigin || isWriting || Date.now() < pausedUntil) return
  if (isSpreadsheet()) {
    await sendSheetSelection()
    return
  }
  const selectedText = await fetchSelectedText()
  // The panel may have been closed while the selection was read
  if (!hostOrigin || !selectedText?.trim()) return
  if (selectedText === lastSelectedText) return

  const { content, target, canReplace } = (await fetchContent()) ?? {}
  if (!hostOrigin || target !== 'selection' || content === lastContent) return
  lastContent = content
  lastSelectedText = selectedText
  // The answer last written in a presentation is no more the selection
  written = null

  host.postMessage(
    { type: 'twake-scribe:selection', content, target, canReplace },
    hostOrigin
  )
}

function handleSelectionChange() {
  clearTimeout(selectionTimer)
  selectionTimer = setTimeout(sendSelection, SELECTION_DELAY)
}

// A read already planned would come after the undo or the redo: it is dropped
function pauseSelection() {
  pausedUntil = Date.now() + UNDO_REDO_PAUSE
  clearTimeout(selectionTimer)
}

// Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z redo (Cmd on a Mac)
function handleUndoRedoKey(event) {
  if (!event.ctrlKey && !event.metaKey) return
  if (['z', 'y'].includes(event.key?.toLowerCase())) pauseSelection()
}

function handleUndoRedoClick(event) {
  if (event.target?.closest?.('[id*="btn-undo"], [id*="btn-redo"]')) {
    pauseSelection()
  }
}

// The frame of the plugin has the origin of the editor: it hears the keys of
// the editor and the clicks on its toolbar
function watchUndoRedo() {
  try {
    window.parent.document.addEventListener('keydown', handleUndoRedoKey, true)
    window.parent.document.addEventListener('click', handleUndoRedoClick, true)
  } catch {
    document.addEventListener('keydown', handleUndoRedoKey, true)
  }
}

async function writeAnswer({ answerAction, text }) {
  // A text that holds what an answer cannot give back, as an image or a
  // note, is never replaced, even when the app asks: the answer goes under
  // it, as when the editor was too busy to read the selection
  const read = answerAction === 'replace' ? await fetchContent() : null
  const isReplace = Boolean(read) && read.canReplace !== false
  if (isPresentation()) {
    await writePresentation(text, isReplace)
    return
  }
  const blocks = makeBlocks(text)
  if (blocks.length === 0) return

  await runInEditor(writeBlocks, {
    scope: { blocks, isReplace },
    isRecalculated: true
  })
}

async function applyAnswer(answer) {
  isWriting = true
  try {
    if (isSpreadsheet()) {
      // An explanation has no cells: the app tells the user nothing changed
      const isWritten = await writeSheetAnswer(answer.text)
      if (!isWritten && hostOrigin) {
        host.postMessage({ type: 'twake-scribe:notApplied' }, hostOrigin)
      }
      return
    }
    await writeAnswer(answer)
    // The answer is left selected: it is not another text to work on
    const selectedText = await fetchSelectedText()
    if (selectedText?.trim()) {
      lastContent = (await fetchContent())?.content ?? lastContent
      lastSelectedText = selectedText
    }
  } finally {
    isWriting = false
  }
}

// A slide the assistant has made, added after the current one. The app has
// checked it already: this only keeps a wrong message out of the editor.
async function addSlide({ title, bullets }) {
  const isSlide =
    typeof title === 'string' &&
    Array.isArray(bullets) &&
    bullets.every(bullet => typeof bullet === 'string')
  if (!isPresentation() || !isSlide) return

  isWriting = true
  try {
    await runInEditor(insertSlide, {
      scope: { title, bullets },
      isRecalculated: true
    })
    // The paragraphs of the last answer are on another slide now
    written = null
  } finally {
    isWriting = false
  }
}

async function handleMessage(event) {
  // Only the app that shows the editor may read and write the document
  if (event.source !== host) return

  if (event.data?.type === 'twake-scribe:getContent') {
    await sendContent(event.origin)
  }
  // The panel is closed: the selection is no more read, and the next panel
  // starts on the text then selected, not on the answer last written in a
  // presentation
  if (event.data?.type === 'twake-scribe:close') {
    contentRequest += 1
    hostOrigin = null
    written = null
    sheetTarget = null
    clearTimeout(selectionTimer)
  }
  if (event.data?.type === 'twake-scribe:applyAnswer') {
    await applyAnswer(event.data)
  }
  if (event.data?.type === 'twake-scribe:insertSlide') {
    await addSlide(event.data)
  }
  if (event.data?.type === 'twake-scribe:insertChart') {
    await addChart(event.data)
  }
}

// The editor starts the plugin again each time the selection changes
window.Asc.plugin.init = () => {
  if (isStarted) {
    handleSelectionChange()
    return
  }
  isStarted = true
  window.addEventListener('message', handleMessage)
  watchUndoRedo()
  // The app is not known yet: this first message holds nothing of the document
  host.postMessage({ type: 'twake-scribe:ready' }, '*')
}
