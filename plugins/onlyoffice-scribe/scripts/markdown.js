import { Lexer, getDefaults } from 'marked'

// The editor has nine levels of list
const MAX_LIST_DEPTH = 8
const LINK_PROTOCOL = /^(https?:|mailto:)/i
// The <u> tags of a text are read with it, as its underline
const HTML_TAG = /(<(?!\/?u>)[^>]*>)/i
const SPAN_ATTRIBUTE = /\b(colspan|rowspan)\s*=\s*"?(\d+)/gi
const LINE_BREAK_TAG = /^<br\s*\/?>$/i
// A whole answer fenced as text or quoted: the LLM wraps the text it was
// told to give alone, HTML tables most of all. Code in another language
// stays code.
const WRAPPED =
  /^\s*(```|~~~|""")[ \t]*(?:markdown|md|html|text)?[ \t]*\n([\s\S]*?)\s*\1\s*$/i
const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0'
}

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? entity

    const isHexadecimal = code[1].toLowerCase() === 'x'
    const point = parseInt(
      code.slice(isHexadecimal ? 2 : 1),
      isHexadecimal ? 16 : 10
    )
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity
  })
}

function makeText(text, marks) {
  // A line break of the Markdown source is a space in the text
  return { ...marks, text: decodeEntities(text).replace(/\n/g, ' ') }
}

// A link is a single text: the notes of its text come after it
function makeLinkSpans(token, marks) {
  const all = makeSpans(token.tokens, marks)
  const notes = all.filter(span => span.note !== undefined)
  const spans = all.filter(span => span.note === undefined)
  const text = spans.map(span => span.text ?? ' ').join('')
  // Other links, as `javascript:` ones, are written as their text
  if (!LINK_PROTOCOL.test(token.href)) return [{ ...marks, text }, ...notes]

  // A link is written in one look: underlined when all its text is
  const isUnderline = spans.every(span => span.isUnderline)
  return [
    { text, href: token.href, ...(isUnderline && { isUnderline }) },
    ...notes
  ]
}

// The marks an inline token sets on the text it holds
const MARKS = {
  strong: 'isBold',
  em: 'isItalic',
  del: 'isStrike',
  underline: 'isUnderline'
}

// The text between <u> tags, and the markers of the footnotes of the text, in
// the form `marked.use` gives the extensions to the lexer. A tag left open is
// left out, as the other tags.
const UNDERLINE = /^<u>([\s\S]*?)<\/u>/i
const NOTE = /^\[\^scribe-fn-(\d+)\]/
const EXTENSIONS = {
  inline: [
    function tokenizeUnderline(src) {
      const match = src.match(UNDERLINE)
      if (!match) return null
      return {
        type: 'underline',
        raw: match[0],
        tokens: this.lexer.inlineTokens(match[1])
      }
    },
    function tokenizeNote(src) {
      const match = src.match(NOTE)
      if (!match) return null
      return { type: 'note', raw: match[0], note: Number(match[1]) }
    }
  ],
  startInline: [
    src => src.match(/<u>/i)?.index,
    src => src.match(/\[\^scribe-fn-\d+\]/)?.index
  ]
}

// The spans of the inline tokens that are not a mark nor a text
const INLINE_TOKENS = {
  codespan: (token, marks) => [{ ...marks, text: token.text, isCode: true }],
  note: token => [{ note: token.note }],
  link: makeLinkSpans,
  br: () => [{ isBreak: true }],
  // The tags are left out: the text they hold comes in its own tokens
  html: token => (LINE_BREAK_TAG.test(token.text) ? [{ isBreak: true }] : []),
  escape: (token, marks) => [{ ...marks, text: token.text }]
}

function makeTokenSpans(token, marks) {
  const mark = MARKS[token.type]
  if (mark) return makeSpans(token.tokens, { ...marks, [mark]: true })
  const makeInlineSpans = INLINE_TOKENS[token.type]
  if (makeInlineSpans) return makeInlineSpans(token, marks)
  return token.tokens
    ? makeSpans(token.tokens, marks)
    : [makeText(token.text ?? '', marks)]
}

/**
 * Turns the inline tokens of marked into spans: texts with their marks,
 * links and line breaks
 */
function makeSpans(tokens, marks = {}) {
  return tokens
    .flatMap(token => makeTokenSpans(token, marks))
    .filter(span => span.isBreak || span.text !== '')
}

function makeCodeLines(code) {
  if (code === '') return []
  return code.split('\n').map(line => (line === '' ? ' ' : line))
}

// The lines of a block of code as the text of a single paragraph
function makeCodeSpans(lines) {
  return lines.flatMap((line, index) => [
    ...(index === 0 ? [] : [{ isBreak: true }]),
    { text: line, isCode: true }
  ])
}

// The rows of a Markdown table, its header in bold
function makeTableRows(token) {
  return [
    token.header.map(cell => ({
      spans: makeSpans(cell.tokens, { isBold: true })
    })),
    ...token.rows.map(row =>
      row.map(cell => ({ spans: makeSpans(cell.tokens) }))
    )
  ]
}

const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)]) +(.*)$/
// A fence in an item is indented as its text
const FENCE = /^ *(```|~~~)/

// The LLM indents a sublist by 2 spaces, but Markdown nests it only under the
// text of its parent item, 3 spaces in after "1. ": each item is indented
// again under the text of the item it belongs to. A block of code stays
// as it is.
function nestLists(markdown) {
  let fence = null
  // Each level of the list being read: the indent the LLM gave its items,
  // and the one they get
  let levels = []

  return markdown
    .split('\n')
    .map(line => {
      const fenceMark = line.match(FENCE)?.[1]
      if (fence !== null || fenceMark) {
        if (fence === null) fence = fenceMark
        else if (fenceMark === fence) fence = null
        return line
      }
      const item = line.match(LIST_ITEM)
      if (!item || (levels.length === 0 && item[1].length > 3)) {
        if (/^\S/.test(line)) levels = []
        return line
      }

      const [, { length: indent }, marker, text] = item
      while (levels.length > 0 && indent < levels[levels.length - 1].indent) {
        levels.pop()
      }
      const parent = levels[levels.length - 1]
      if (!parent || indent > parent.indent) {
        const nested = parent ? parent.nested + parent.width : 0
        levels.push({ indent, nested, width: 0 })
      }
      const level = levels[levels.length - 1]
      level.width = marker.length + 1
      return `${' '.repeat(level.nested)}${marker} ${text}`
    })
    .join('\n')
}

function getTagName(tag) {
  return tag.match(/^<(\/?[a-z]+)/i)?.[1].toLowerCase() ?? null
}

/**
 * Turns the Markdown of an answer into the blocks the document is written
 * with: paragraphs, headings, quotes, list items and tables, each with its
 * spans, and blocks of code with their lines, an empty one a space. A cell
 * of a table has its spans, its blocks when it holds several (`blocks`, each
 * with its spans), and the columns and rows it takes (`colSpan`, `rowSpan`)
 * when it takes more than one.
 *
 * @param {string} markdown
 * @param {object} [options]
 * @param {boolean} [options.hasLineBreaks=false] - a line break of the
 * source breaks the line, instead of being a space: for an editor whose
 * paragraphs are lines, as the slides of a presentation
 * @returns {object[]}
 */
export function makeBlocks(markdown, { hasLineBreaks = false } = {}) {
  const blocks = []
  let listCount = 0
  // The table being read in HTML tags, the way the editor gives its tables.
  // Its cells take the blocks that come before its end.
  let htmlTable = null
  // A lexer keeps its tokenizer in its options: each one gets its own
  const makeOptions = () => ({
    ...getDefaults(),
    breaks: hasLineBreaks,
    extensions: EXTENSIONS
  })

  const addBlock = block => {
    if (block.spans?.length === 0 || block.lines?.length === 0) return
    if (!htmlTable) {
      blocks.push(block)
      return
    }

    const row = htmlTable[htmlTable.length - 1]
    const cell = row?.[row.length - 1]
    if (!cell) return
    // In a cell, a block of code is the text of one paragraph, and a table is
    // left out
    if (block.type === 'code') {
      cell.blocks.push({ ...block, spans: makeCodeSpans(block.lines) })
    } else if (block.spans) {
      cell.blocks.push(block)
    }
  }

  const makeCell = tag => {
    const cell = { blocks: [] }
    for (const [, attribute, value] of tag.matchAll(SPAN_ATTRIBUTE)) {
      const span = Number(value)
      if (span > 1) cell[attribute === 'colspan' ? 'colSpan' : 'rowSpan'] = span
    }
    return cell
  }

  const addHtmlCell = tag => {
    if (htmlTable.length === 0) htmlTable.push([])
    htmlTable[htmlTable.length - 1].push(makeCell(tag))
  }

  // A cell gives the spans of its blocks, a line each, and its blocks when
  // it holds several
  const makeHtmlCell = ({ blocks: cellBlocks, ...cell }) => ({
    ...cell,
    spans: cellBlocks.flatMap((block, index) =>
      index === 0 ? block.spans : [{ isBreak: true }, ...block.spans]
    ),
    ...(cellBlocks.length > 1 && { blocks: cellBlocks })
  })

  const closeHtmlTable = () => {
    const rows = htmlTable
      .filter(row => row.length > 0)
      .map(row => row.map(makeHtmlCell))
    htmlTable = null
    if (rows.length > 0) addBlock({ type: 'table', rows })
  }

  const readHtmlTag = tag => {
    const name = getTagName(tag)
    if (name === 'table') htmlTable = []
    if (!htmlTable) return
    if (name === 'tr') htmlTable.push([])
    if (name === 'td' || name === 'th') addHtmlCell(tag)
    if (name === '/table') closeHtmlTable()
  }

  const addHtml = html => {
    html.split(HTML_TAG).forEach(part => {
      if (HTML_TAG.test(part)) {
        readHtmlTag(part)
        return
      }
      if (part.trim() === '') return
      addBlock({
        type: 'paragraph',
        spans: makeSpans(Lexer.lexInline(part, makeOptions()))
      })
    })
  }

  const addList = (list, depth) => {
    listCount += 1
    const listId = listCount
    list.items.forEach(item => {
      const [first, ...rest] = item.tokens
      // The text of an item comes first, before the lists it holds
      const hasText = ['text', 'paragraph'].includes(first?.type)
      const checkbox = item.checked ? '☑ ' : '☐ '
      addBlock({
        type: 'listItem',
        listId,
        isOrdered: list.ordered,
        depth: Math.min(depth, MAX_LIST_DEPTH),
        spans: [
          ...(item.task ? [{ text: checkbox }] : []),
          ...(hasText ? makeSpans(first.tokens ?? [first]) : [])
        ]
      })
      addTokens(hasText ? rest : item.tokens, { depth: depth + 1 })
    })
  }

  const skip = () => {}
  // How each block token is added; the others are paragraphs, or quotes
  // inside a quote
  const blockTokens = {
    space: skip,
    hr: skip,
    def: skip,
    heading: token =>
      addBlock({
        type: 'heading',
        level: token.depth,
        spans: makeSpans(token.tokens)
      }),
    list: (token, depth) => addList(token, depth),
    blockquote: (token, depth) =>
      addTokens(token.tokens, { depth, isQuote: true }),
    code: token => addBlock({ type: 'code', lines: makeCodeLines(token.text) }),
    table: token => addBlock({ type: 'table', rows: makeTableRows(token) }),
    html: token => addHtml(token.text)
  }

  const addTokens = (tokens, { depth = 0, isQuote = false } = {}) => {
    tokens.forEach(token => {
      const addToken = blockTokens[token.type]
      if (addToken) {
        addToken(token, depth)
        return
      }
      addBlock({
        type: isQuote ? 'quote' : 'paragraph',
        spans: makeSpans(token.tokens ?? [token])
      })
    })
  }

  const lexer = new Lexer(makeOptions())
  addTokens(lexer.lex(nestLists(markdown.match(WRAPPED)?.[2] ?? markdown)))
  // A table left open still gives what it holds
  if (htmlTable) readHtmlTag('</table>')

  return blocks
}

// The spaces around a line are left out, whatever spans hold them
function trimLine(spans) {
  const trimmed = spans.filter(span => span.text !== '')
  while (trimmed.length > 0 && trimmed[0].text.trim() === '') trimmed.shift()
  while (trimmed.length > 0 && trimmed[trimmed.length - 1].text.trim() === '')
    trimmed.pop()
  if (trimmed.length === 0) return []
  trimmed[0] = { ...trimmed[0], text: trimmed[0].text.trimStart() }
  const last = trimmed.length - 1
  trimmed[last] = { ...trimmed[last], text: trimmed[last].text.trimEnd() }
  return trimmed
}

function addToLines(lines, span) {
  if (span.isBreak) return [...lines, []]
  return [...lines.slice(0, -1), [...lines[lines.length - 1], span]]
}

// A presentation has no footnotes: their markers stay text
function makeNoteText(span) {
  return span.note === undefined ? span : { text: `[^scribe-fn-${span.note}]` }
}

// The lines of spans, a line break starting a line
function splitLines(spans) {
  return spans
    .map(makeNoteText)
    .reduce(addToLines, [[]])
    .map(trimLine)
    .filter(line => line.length > 0)
}

function joinSpans(parts, separator) {
  return parts.flatMap((part, index) =>
    index === 0 ? part : [{ text: separator }, ...part]
  )
}

function makeRowLine(row) {
  const cells = row.map(cell => joinSpans(splitLines(cell.spans), ' '))
  return joinSpans(cells, ' | ').filter(span => span.text !== '')
}

/**
 * Turns blocks into lines, for an editor that keeps the look of its
 * paragraphs itself: a line break starts a line, the cells of a row are
 * joined. Each line is a list of spans, with the emphasis of the answer.
 *
 * @param {object[]} blocks - the blocks of `makeBlocks`
 * @returns {object[][]}
 */
export function makeLineSpans(blocks) {
  return blocks.flatMap(block => {
    if (block.type === 'table') return block.rows.map(makeRowLine)
    if (block.type === 'code') return splitLines(makeCodeSpans(block.lines))
    return splitLines(block.spans)
  })
}

/**
 * Turns blocks into lines of plain text: the lines of `makeLineSpans`,
 * without their emphasis
 *
 * @param {object[]} blocks - the blocks of `makeBlocks`
 * @returns {string[]}
 */
export function makeLines(blocks) {
  return makeLineSpans(blocks).map(spans =>
    spans.map(span => span.text).join('')
  )
}
