import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { marked } from 'marked'

/**
 * Normalize rich-text HTML to clean semantic markup that Turndown understands.
 *
 * All transformations are idempotent — already-clean HTML passes through unchanged.
 * Originally motivated by OnlyOffice which produces Office-style HTML (inline styles
 * instead of semantic tags, flat lists with margin-based indentation, tables without
 * thead/th), but applicable to any HTML source with similar patterns.
 *
 * Transformations applied:
 * - Styled spans → semantic tags (<strong>, <em>)
 * - Tables: first row promoted to <thead>/<th>, <p> unwrapped in cells, &nbsp; after <br> cleaned
 * - Adjacent identical inline elements merged
 * - Flat lists with margin-left indentation → properly nested lists
 */
export function normalizeHtml(html) {
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

  // Tables: promote first row to <thead>/<th> for GFM compatibility.
  // Office-style editors export tables without thead/th structure.
  const tables = Array.from(doc.body.querySelectorAll('table'))
  for (const table of tables) {
    if (table.querySelector('thead')) continue
    const firstRow = table.querySelector('tr')
    if (!firstRow) continue
    // Flatten cell content for GFM table compatibility:
    // - Clean &nbsp; artifacts after <br>
    // - Unwrap <p> wrappers (Office-style editors wrap cell content in <p>)
    const cells = Array.from(table.querySelectorAll('td, th'))
    for (const cell of cells) {
      // Remove trailing &nbsp; span/text after <br> (Office-style artifact)
      const brs = Array.from(cell.querySelectorAll('br'))
      for (const br of brs) {
        const next = br.nextSibling
        if (next && next.nodeType === 3 && next.textContent.trim() === '\u00a0') {
          next.remove()
        } else if (next && next.nodeType === 1 && next.tagName === 'SPAN' && next.textContent.trim() === '\u00a0') {
          next.remove()
        }
      }
      const ps = Array.from(cell.querySelectorAll('p'))
      for (const p of ps) {
        while (p.firstChild) {
          p.parentNode.insertBefore(p.firstChild, p)
        }
        p.remove()
      }
    }

    const rowParent = firstRow.parentNode
    const thead = doc.createElement('thead')
    const tds = Array.from(firstRow.querySelectorAll('td'))
    for (const td of tds) {
      const th = doc.createElement('th')
      th.innerHTML = td.innerHTML
      td.parentNode.replaceChild(th, td)
    }
    rowParent.insertBefore(thead, firstRow)
    thead.appendChild(firstRow)
  }

  // Merge adjacent siblings with identical tag+style. Office-style editors
  // often fragment runs of same formatting (e.g. <b>foo</b><b>bar</b>).
  const mergeableTags = new Set([
    'STRONG',
    'EM',
    'B',
    'I',
    'U',
    'S',
    'SPAN'
  ])
  let merged = true
  while (merged) {
    merged = false
    for (const tag of mergeableTags) {
      const els = Array.from(doc.body.querySelectorAll(tag.toLowerCase()))
      for (const el of els) {
        const next = el.nextSibling
        if (
          next &&
          next.nodeType === 1 &&
          next.tagName === el.tagName &&
          next.style.cssText === el.style.cssText
        ) {
          while (next.firstChild) {
            el.appendChild(next.firstChild)
          }
          next.remove()
          merged = true
        }
      }
    }
  }

  // Restructure flat lists into properly nested lists. Office-style editors
  // export all <li> at the same level but use margin-left on inner <p>
  // to indicate depth. Margin values are mapped to nesting levels per-list.
  const lists = Array.from(doc.body.querySelectorAll('ul, ol'))
  for (const list of lists) {
    const items = Array.from(list.children).filter(
      c => c.tagName === 'LI'
    )
    if (items.length === 0) continue

    // Extract margin-left from the <p> inside each <li>
    const margins = items.map(li => {
      const p = li.querySelector('p[style]')
      if (!p) return 0
      const match = (p.style.marginLeft || '').match(/([\d.]+)pt/)
      return match ? parseFloat(match[1]) : 0
    })

    // Build depth map from sorted unique margin values
    const uniqueMargins = [...new Set(margins.filter(m => m > 0))]
      .sort((a, b) => a - b)
    if (uniqueMargins.length <= 1) continue

    const getDepth = margin => {
      if (margin <= 0) return 0
      return uniqueMargins.indexOf(margin)
    }

    const depths = margins.map(getDepth)
    const hasNesting = depths.some(d => d > 0)
    if (!hasNesting) continue

    // Rebuild with proper nesting
    const tagName = list.tagName.toLowerCase()
    const newList = doc.createElement(tagName)

    let currentDepth = 0
    let currentParent = newList

    for (let i = 0; i < items.length; i++) {
      const targetDepth = depths[i]

      while (currentDepth < targetDepth) {
        const subList = doc.createElement(tagName)
        const lastLi =
          currentParent.lastElementChild ||
          currentParent.appendChild(doc.createElement('li'))
        lastLi.appendChild(subList)
        currentParent = subList
        currentDepth++
      }

      while (currentDepth > targetDepth) {
        // Go up: parent <li> → parent <ul/ol>
        currentParent =
          currentParent.parentElement?.parentElement || newList
        currentDepth--
      }

      currentParent.appendChild(items[i])
    }

    list.parentNode.replaceChild(newList, list)
  }

  return doc.body.innerHTML
}

/**
 * Create a configured TurndownService instance with GFM support
 * and rules for common rich-text editor HTML patterns.
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

  // Preserve <u> tags through Turndown conversion (Turndown strips unknown HTML by default)
  td.addRule('underline', {
    filter: 'u',
    replacement(content) {
      return '<u>' + content + '</u>'
    }
  })

  // Blank paragraph rule: Office-style editors use <p>&nbsp;</p> for empty lines
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
 * Convert HTML (with inline styles) to Markdown suitable for LLM processing.
 * @param {string} html - HTML string from any rich-text editor
 * @returns {string} Markdown string
 */
export function htmlToMarkdown(html) {
  if (!html || !html.trim()) return ''

  const normalized = normalizeHtml(html)
  return createTurndownService().turndown(normalized)
}

/**
 * Convert Markdown (from LLM response) to HTML for reinsertion into the editor.
 * @param {string} markdown - Markdown string
 * @returns {string} HTML string
 */
export function markdownToHtml(markdown) {
  if (!markdown || !markdown.trim()) return ''

  return marked.parse(markdown)
}
