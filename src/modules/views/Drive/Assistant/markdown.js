import { Lexer } from 'marked'

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
 * @property {Block[][]} [items] - of a list: the blocks of each item
 */

const INLINE_MARKS = { strong: { bold: true }, em: { italic: true } }

/** @returns {Inline[]} */
const toInlines = (tokens, marks = {}) =>
  tokens.flatMap(token => {
    if (token.type === 'html') return []
    // A link of the document would need a relationship part: its address is
    // written after its text instead
    if (token.type === 'link' && token.href !== token.text) {
      return [
        ...toInlines(token.tokens, marks),
        { ...marks, text: ` (${token.href})` }
      ]
    }
    if (token.tokens) {
      return toInlines(token.tokens, { ...marks, ...INLINE_MARKS[token.type] })
    }
    // A line break of the Markdown source is a space in the text
    const text = token.type === 'br' ? ' ' : token.text.replace(/\n/g, ' ')
    return text === '' ? [] : [{ ...marks, text }]
  })

/** @returns {Block[]} */
const toBlocks = tokens =>
  tokens.flatMap(token => {
    switch (token.type) {
      case 'heading':
        return [
          {
            type: 'heading',
            level: token.depth,
            inlines: toInlines(token.tokens)
          }
        ]
      case 'paragraph':
      case 'text':
        return [
          { type: 'paragraph', inlines: toInlines(token.tokens ?? [token]) }
        ]
      case 'list':
        return [
          {
            type: 'list',
            ordered: token.ordered,
            items: token.items.map(item => toBlocks(item.tokens))
          }
        ]
      case 'blockquote':
        return toBlocks(token.tokens)
      // A code block keeps its lines, as plain text
      case 'code':
        return token.text
          .split('\n')
          .map(line => ({ type: 'paragraph', inlines: [{ text: line }] }))
      // A table is written as a line of text by row
      case 'table':
        return [token.header, ...token.rows].map(cells => ({
          type: 'paragraph',
          inlines: cells.flatMap((cell, index) => [
            ...(index > 0 ? [{ text: ' | ' }] : []),
            ...toInlines(cell.tokens)
          ])
        }))
      default:
        return []
    }
  })

/** @returns {Block[]} */
export const parseMarkdown = markdown => toBlocks(Lexer.lex(markdown))
