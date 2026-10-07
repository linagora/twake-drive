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
// The paragraphs of the last answer written in a presentation
let written = null
// The origin of the app, known once it has asked for the text
let hostOrigin = null
// The text last given to the app, and whether an answer is being written
let lastContent = null
let isWriting = false
let selectionTimer = null
let isStarted = false

function runInEditor(command, { scope = {}, isRecalculated = false } = {}) {
  Object.assign(window.Asc.scope, scope)

  return new Promise(resolve => {
    window.Asc.plugin.callCommand(command, false, isRecalculated, resolve)
  })
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

async function sendContent(origin) {
  const { content, target } = await fetchContent()
  hostOrigin = origin
  lastContent = content

  host.postMessage({ type: 'twake-scribe:content', content, target }, origin)
}

// Another text selected: the app gives it to the assistant if it is open.
// A cursor that moves, or the text of an answer just written, is not another
// text.
async function sendSelection() {
  if (!hostOrigin || isWriting) return
  const selectedText = await fetchSelectedText()
  if (!selectedText || selectedText.trim() === '') return

  const { content, target } = await fetchContent()
  if (target !== 'selection' || content === lastContent) return
  lastContent = content

  host.postMessage(
    { type: 'twake-scribe:selection', content, target },
    hostOrigin
  )
}

function handleSelectionChange() {
  clearTimeout(selectionTimer)
  selectionTimer = setTimeout(sendSelection, SELECTION_DELAY)
}

async function writeAnswer({ answerAction, text }) {
  const isReplace = answerAction === 'replace'
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
    if ((await fetchSelectedText())?.trim()) {
      lastContent = (await fetchContent()).content
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
  // The app is not known yet: this first message holds nothing of the document
  host.postMessage({ type: 'twake-scribe:ready' }, '*')
}
