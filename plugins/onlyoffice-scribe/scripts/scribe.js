import { readContent, writeBlocks } from './document.js'
import { makeBlocks, makeLineSpans, makeLines } from './markdown.js'
import {
  findWrittenParagraphs,
  insertSlide,
  readSlideContent,
  writeSlideLines
} from './presentation.js'

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

function callEditor(method, parameters) {
  return new Promise(resolve => {
    window.Asc.plugin.executeMethod(method, parameters, resolve)
  })
}

function isPresentation() {
  return window.Asc.plugin.info.editorType === 'slide'
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
async function sendContent(origin) {
  const read = await fetchContent()
  if (!read) return
  hostOrigin = origin
  lastContent = read.content
  lastSelectedText = await fetchSelectedText()

  host.postMessage({ type: 'twake-scribe:content', ...read }, origin)
}

// Another text selected: the app gives it to the assistant if it is open.
// A cursor that moves, or the text of an answer just written, is not another
// text.
// The selection is read by a command only when its text changes: a command
// empties the redo of the editor.
async function sendSelection() {
  if (!hostOrigin || isWriting || Date.now() < pausedUntil) return
  const selectedText = await fetchSelectedText()
  if (!selectedText?.trim() || selectedText === lastSelectedText) return

  const { content, target } = (await fetchContent()) ?? {}
  if (target !== 'selection' || content === lastContent) return
  lastContent = content
  lastSelectedText = selectedText

  host.postMessage(
    { type: 'twake-scribe:selection', content, target },
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
  // note, is never replaced, even when the app asks: the answer goes under it
  const isReplace =
    answerAction === 'replace' && (await fetchContent())?.canReplace !== false
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
  // The panel is closed: the selection is no more read
  if (event.data?.type === 'twake-scribe:close') {
    hostOrigin = null
    clearTimeout(selectionTimer)
  }
  if (event.data?.type === 'twake-scribe:applyAnswer') {
    await applyAnswer(event.data)
  }
  if (event.data?.type === 'twake-scribe:insertSlide') {
    await addSlide(event.data)
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
