import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { marked } from 'marked'

/**
 * Normalize OO inline-style HTML to semantic tags that Turndown understands.
 * OO uses <span style="font-weight:bold"> instead of <strong>, etc.
 */
function normalizeOoHtml(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const spans = Array.from(doc.body.querySelectorAll('span[style]'))

  for (const span of spans) {
    const style = span.style
    const isBold =
      style.fontWeight === 'bold' ||
      (parseInt(style.fontWeight, 10) >= 700 && !isNaN(style.fontWeight))
    const isItalic = style.fontStyle === 'italic'

    if (isBold && isItalic) {
      const strong = doc.createElement('strong')
      const em = doc.createElement('em')
      em.innerHTML = span.innerHTML
      strong.appendChild(em)
      span.parentNode.replaceChild(strong, span)
    } else if (isBold) {
      const strong = doc.createElement('strong')
      strong.innerHTML = span.innerHTML
      span.parentNode.replaceChild(strong, span)
    } else if (isItalic) {
      const em = doc.createElement('em')
      em.innerHTML = span.innerHTML
      span.parentNode.replaceChild(em, span)
    }
  }

  return doc.body.innerHTML
}

/**
 * Create a configured TurndownService instance with GFM support
 * and rules for OO-specific HTML patterns.
 */
function createTurndownService() {
  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  })

  td.use(gfm)

  // Remove unsupported elements silently
  td.remove(['svg', 'math', 'object', 'embed', 'iframe', 'script', 'style'])

  // Override Turndown's built-in img rule to strip images silently
  td.addRule('stripImages', {
    filter: 'img',
    replacement() {
      return ''
    }
  })

  // Blank paragraph rule: OO uses <p>&nbsp;</p> for empty lines
  td.addRule('blankParagraph', {
    filter(node) {
      if (node.nodeName !== 'P') return false
      const text = node.textContent || ''
      return text.trim() === '' || text.trim() === '\u00a0'
    },
    replacement() {
      return '\n\n'
    }
  })

  return td
}

/**
 * Convert OO HTML (with inline styles) to Markdown suitable for LLM processing.
 * @param {string} html - HTML string from OO editor
 * @returns {string} Markdown string
 */
export function htmlToMarkdown(html) {
  if (!html || !html.trim()) return ''

  const normalized = normalizeOoHtml(html)
  return createTurndownService().turndown(normalized)
}

/**
 * Convert Markdown (from LLM response) to HTML for reinsertion into OO.
 * @param {string} markdown - Markdown string
 * @returns {string} HTML string
 */
export function markdownToHtml(markdown) {
  if (!markdown || !markdown.trim()) return ''

  return marked.parse(markdown)
}
