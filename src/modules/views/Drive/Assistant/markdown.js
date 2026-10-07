// Reads only what cozy-stack lets the LLM write in a document (writingPrompt,
// model/rag/router.go): "#" headings, paragraphs, "- " and "1. " lists,
// **bold** and *italic*. Anything else is plain paragraph text.

/**
 * @typedef {object} Inline
 * @property {string} text
 * @property {boolean} [bold]
 * @property {boolean} [italic]
 */

/**
 * @typedef {object} Block
 * @property {'heading' | 'paragraph' | 'list'} type
 * @property {number} [level] - of a heading
 * @property {Inline[]} [inlines] - of a heading or a paragraph
 * @property {boolean} [ordered] - of a list
 * @property {Inline[][]} [items] - of a list
 */

const HEADING_RE = /^(#{1,6})\s+(.+)$/
const BULLET_RE = /^[-*+]\s+(.+)$/
const ORDERED_RE = /^\d+[.)]\s+(.+)$/
const EMPHASIS_RE =
  /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*([^*\s](?:[^*]*[^*\s])?)\*|_([^_\s](?:[^_]*[^_\s])?)_/g

/** @returns {Inline[]} */
export const parseInlines = text => {
  const inlines = []
  let last = 0
  for (const match of text.matchAll(EMPHASIS_RE)) {
    const index = match.index ?? 0
    if (index > last) inlines.push({ text: text.slice(last, index) })
    const [, both, bold, italic, underscored] = match
    if (both) inlines.push({ text: both, bold: true, italic: true })
    else if (bold) inlines.push({ text: bold, bold: true })
    else inlines.push({ text: italic ?? underscored, italic: true })
    last = index + match[0].length
  }
  if (last < text.length) inlines.push({ text: text.slice(last) })
  return inlines.filter(inline => inline.text !== '')
}

/**
 * @returns {{ type: 'blank' | 'heading' | 'item' | 'text', text: string, level?: number, ordered?: boolean }}
 */
const readLine = line => {
  const heading = HEADING_RE.exec(line)
  if (heading) {
    return { type: 'heading', level: heading[1].length, text: heading[2] }
  }
  const bullet = BULLET_RE.exec(line)
  if (bullet) return { type: 'item', ordered: false, text: bullet[1] }
  const ordered = ORDERED_RE.exec(line)
  if (ordered) return { type: 'item', ordered: true, text: ordered[1] }
  return { type: line === '' ? 'blank' : 'text', text: line }
}

const flushParagraph = state => {
  if (state.paragraph.length === 0) return
  state.blocks.push({
    type: 'paragraph',
    inlines: parseInlines(state.paragraph.join(' '))
  })
  state.paragraph = []
}

const flushList = state => {
  if (state.list === null) return
  state.blocks.push({ type: 'list', ...state.list })
  state.list = null
}

const flush = state => {
  flushParagraph(state)
  flushList(state)
}

const LINE_HANDLERS = {
  blank: flush,
  heading: (state, { level, text }) => {
    flush(state)
    state.blocks.push({ type: 'heading', level, inlines: parseInlines(text) })
  },
  item: (state, { ordered, text }) => {
    flushParagraph(state)
    if (state.list?.ordered !== ordered) {
      flushList(state)
      state.list = { ordered, items: [] }
    }
    state.list.items.push(parseInlines(text))
  },
  text: (state, { text }) => {
    flushList(state)
    state.paragraph.push(text)
  }
}

/** @returns {Block[]} */
export const parseMarkdown = markdown => {
  const state = { blocks: [], paragraph: [], list: null }
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = readLine(rawLine.trim())
    LINE_HANDLERS[line.type](state, line)
  }
  flush(state)
  return state.blocks
}
