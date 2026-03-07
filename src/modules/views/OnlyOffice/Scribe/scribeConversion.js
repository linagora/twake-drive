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

  // Restructure OO flat lists into properly nested lists.
  // OO exports all <li> at the same level but uses margin-left on inner <p>
  // to indicate depth (~35pt = level 1, ~71pt = level 2, ~107pt = level 3).
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
