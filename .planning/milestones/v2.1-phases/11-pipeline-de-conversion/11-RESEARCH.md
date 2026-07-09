# Phase 11: Pipeline de Conversion - Research

**Researched:** 2026-03-06
**Domain:** Bidirectional HTML/Markdown conversion with OO inline-style normalization
**Confidence:** HIGH

## Summary

Phase 11 builds two conversion modules in the Cozy Drive React app: `htmlToMarkdown` (OO HTML -> clean Markdown for LLM prompts) and `markdownToHtml` (LLM Markdown response -> valid HTML for OO reinsertion). The critical challenge is that OO exports inline-style HTML (`<span style="font-weight:bold">`) not semantic HTML (`<strong>`), so Turndown needs custom rules to recognize formatting from style attributes.

The conversion pipeline runs entirely in the React app (not the ES5 plugin), leveraging DOMParser which is available in the browser context. Two well-established libraries handle the core conversion: **Turndown 7.2.x** for HTML-to-Markdown and **marked 17.x** for Markdown-to-HTML. The GFM plugin for Turndown adds table support. Unsupported elements (images, SVG, math) are stripped via Turndown's `remove()` API before conversion.

The integration point is `scribeAI.js`'s `buildMessages()` function. When `format === "html"`, the HTML is converted to Markdown before being interpolated into the prompt. On the output side, `callScribeAI()` returns Markdown text which Phase 12 will render and Phase 13 will convert back to HTML for reinsertion. Phase 11 focuses on the two converter modules and their integration into the prompt pipeline only.

**Primary recommendation:** Use Turndown with custom `addRule` calls for OO inline styles (bold, italic) plus the `turndown-plugin-gfm` for tables. Use `marked.parse()` with GFM enabled (default) for Markdown-to-HTML. Build a thin `normalizeOoHtml()` pre-processing step using DOMParser to handle heading detection and list normalization before Turndown processes it.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONV-01 | Le HTML extrait est converti en Markdown via Turndown cote Cozy Drive | Turndown 7.2.x with custom rules for OO inline styles (font-weight:bold -> **, font-style:italic -> *). DOMParser-based normalizer handles headings and structure. Integration in `buildMessages()` when `format === "html"`. |
| CONV-02 | La reponse Markdown du LLM est reconvertie en HTML via marked pour reinjection | `marked.parse(markdown)` with GFM enabled (default). Returns clean HTML with `<strong>`, `<em>`, `<h1>`-`<h6>`, `<ul>/<ol>/<li>`, `<table>`, `<a>`, `<code>`. Output stored alongside Markdown for Phase 13 reinsertion. |
| CONV-03 | Les elements non supportes (images, SVG, math) sont nettoyes silencieusement au lieu de produire du Markdown casse | Turndown's `remove(['img', 'svg', 'math', 'object', 'embed', 'iframe'])` API strips these elements entirely before conversion. No broken Markdown output. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| turndown | ^7.2.2 | HTML-to-Markdown conversion | De facto standard (~4.6kB gzip), addRule API for custom OO style handling |
| turndown-plugin-gfm | ^1.0.2 | GFM extensions (tables, strikethrough, task lists) | Official companion plugin from same maintainer |
| marked | ^17.0.4 | Markdown-to-HTML conversion | Fast, CommonMark + GFM compliant, ~40kB, zero dependencies |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DOMParser (browser API) | N/A | Pre-process OO HTML before Turndown | Always -- normalize inline styles to semantic tags before Turndown processes them |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| turndown | rehype-remark | Part of unified ecosystem, more complex setup, overkill for this use case |
| marked | markdown-it | Similar capabilities, marked is simpler API and already recommended in prior research |
| DOMParser normalizer | Turndown addRule only | addRule can handle bold/italic but cannot restructure DOM (e.g., convert `<p style="font-size:18pt">` to `<h2>`) |

**Installation:**
```bash
yarn add turndown turndown-plugin-gfm marked
```

## Architecture Patterns

### Recommended Module Structure

```
src/modules/views/OnlyOffice/Scribe/
  scribeConversion.js     # htmlToMarkdown() + markdownToHtml() + normalizeOoHtml()
  scribeAI.js             # buildMessages() updated to use htmlToMarkdown when format=html
```

Single file `scribeConversion.js` keeps the conversion logic co-located. No separate normalizer file needed -- the module is small (~80-120 LOC total).

### Pattern 1: OO HTML Normalizer (DOMParser)

**What:** Pre-process OO's inline-style HTML into semantic HTML that Turndown understands natively.
**When to use:** Always, before passing HTML to Turndown.
**Why DOMParser:** Turndown's `addRule` filter receives DOM nodes, so it could handle bold/italic via `node.style.fontWeight`. But structural changes (heading detection, list normalization) require DOM manipulation that `addRule` cannot do. DOMParser gives us a proper DOM tree to restructure.

```javascript
/**
 * Normalize OO inline-style HTML to semantic HTML.
 * Runs in browser context (DOMParser available).
 */
function normalizeOoHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // Convert <span style="font-weight:bold"> to <strong>
  doc.querySelectorAll('span').forEach(span => {
    if (span.style.fontWeight === 'bold' || parseInt(span.style.fontWeight) >= 700) {
      const strong = doc.createElement('strong')
      strong.innerHTML = span.innerHTML
      span.replaceWith(strong)
    }
    if (span.style.fontStyle === 'italic') {
      const em = doc.createElement('em')
      em.innerHTML = span.innerHTML
      span.replaceWith(em)
    }
  })

  // Handle nested bold+italic: <span style="font-weight:bold;font-style:italic">
  // After first pass, check for spans with remaining styles
  doc.querySelectorAll('span').forEach(span => {
    const hasBold = span.style.fontWeight === 'bold' || parseInt(span.style.fontWeight) >= 700
    const hasItalic = span.style.fontStyle === 'italic'
    if (hasBold && hasItalic) {
      const strong = doc.createElement('strong')
      const em = doc.createElement('em')
      em.innerHTML = span.innerHTML
      strong.appendChild(em)
      span.replaceWith(strong)
    }
  })

  return doc.body.innerHTML
}
```

### Pattern 2: Turndown with Custom Rules + GFM

**What:** Configure Turndown instance with GFM plugin and any remaining custom rules.
**When to use:** After normalizeOoHtml has converted inline styles to semantic tags.

```javascript
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

function createTurndownService() {
  const td = new TurndownService({
    headingStyle: 'atx',        // # style headings
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  })

  // GFM: tables, strikethrough, task lists
  td.use(gfm)

  // Remove unsupported elements (CONV-03)
  td.remove(['img', 'svg', 'math', 'object', 'embed', 'iframe', 'script', 'style'])

  // Preserve blank paragraphs as empty lines (Pitfall 11)
  td.addRule('blankParagraph', {
    filter: function(node) {
      return node.nodeName === 'P' &&
        node.textContent.trim() === '' &&
        (!node.innerHTML || node.innerHTML.trim() === '' ||
         node.innerHTML.trim() === '<br>' || node.innerHTML.trim() === '&nbsp;')
    },
    replacement: function() {
      return '\n\n'
    }
  })

  return td
}

export function htmlToMarkdown(html) {
  const normalized = normalizeOoHtml(html)
  const td = createTurndownService()
  return td.turndown(normalized)
}
```

### Pattern 3: marked for Markdown-to-HTML

**What:** Convert LLM Markdown output to clean HTML.
**When to use:** After receiving LLM response, before storing for Phase 13 reinsertion.

```javascript
import { marked } from 'marked'

// marked has GFM enabled by default (tables, strikethrough)
export function markdownToHtml(markdown) {
  return marked.parse(markdown)
}
```

### Pattern 4: Integration into buildMessages

**What:** When the intent carries `format: "html"`, convert HTML to Markdown before building the prompt.
**When to use:** In `scribeAI.js` `buildMessages()`.

```javascript
import { htmlToMarkdown } from './scribeConversion'

export function buildMessages(actionId, selectedText, label, extra) {
  // If HTML is available, convert to Markdown for better LLM input
  const textForPrompt = extra?.html
    ? htmlToMarkdown(extra.html)
    : selectedText

  // ... rest of buildMessages uses textForPrompt instead of selectedText
}
```

### Anti-Patterns to Avoid

- **Running conversion in the plugin:** The ES5 plugin has no access to DOMParser, Turndown, or marked. All conversion runs in the React app.
- **Heading detection by absolute font-size threshold:** OO documents have varying base font sizes. Do NOT use "font-size > 14pt = heading". Instead, only detect headings for paragraphs that are standalone (single text run) with significantly larger font-size than the default. If uncertain, leave as paragraph -- false negatives are better than false positives (Pitfall 13).
- **Using `dangerouslySetInnerHTML` with `marked` output:** Phase 11 converts Markdown to HTML for reinsertion (Phase 13), NOT for preview (Phase 12 uses react-markdown). The HTML string from `marked.parse()` should never be rendered directly in React.
- **Attempting to preserve font-family, color, or size:** These are out of scope. The Markdown pipeline preserves structural formatting only (bold, italic, headings, lists, links, tables, code).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML-to-Markdown | Custom regex-based converter | Turndown + addRule | Turndown handles edge cases (nested tags, whitespace, escaping) that a regex approach will miss |
| Markdown-to-HTML | Custom parser | marked.parse() | CommonMark + GFM compliance, battle-tested, single function call |
| Table conversion | Custom table parser | turndown-plugin-gfm | GFM pipe tables are non-trivial (alignment, escaping pipes in cells) |
| Element stripping | Custom DOM walker to remove images | Turndown `remove()` API | Built-in, declarative, handles all descendant nodes |

**Key insight:** The conversion libraries are tiny (~5kB + ~40kB gzipped) and handle thousands of edge cases. Custom parsers inevitably break on nested formatting, escaped characters, or unusual HTML structures.

## Common Pitfalls

### Pitfall 1: OO Inline Styles Not Recognized by Turndown

**What goes wrong:** Turndown outputs plain text because OO uses `<span style="font-weight:bold">` not `<strong>`.
**Why it happens:** Turndown matches by tag name, not by CSS style. Without normalization, all `<span>` elements are treated as inline containers with no formatting significance.
**How to avoid:** Run `normalizeOoHtml()` BEFORE Turndown. Convert inline styles to semantic tags using DOMParser.
**Warning signs:** Markdown output has no `**bold**` or `*italic*` markers despite selecting formatted text in OO.

### Pitfall 2: Bold+Italic Nesting Order

**What goes wrong:** Text that is both bold AND italic produces `***text***` in Markdown but the normalizer creates `<strong><em>text</em></strong>` or vice versa, and Turndown may not handle the nesting correctly.
**Why it happens:** A single `<span>` with `font-weight:bold;font-style:italic` must be split into two nested semantic tags. Order matters.
**How to avoid:** In the normalizer, always nest `<em>` inside `<strong>` (convention). Process both styles in a single pass when they co-exist on the same span.

### Pitfall 3: Turndown Drops Empty Paragraphs

**What goes wrong:** OO uses `<p>&nbsp;</p>` or `<p><br/></p>` for spacing. Turndown strips these, collapsing visual structure.
**Why it happens:** Turndown treats empty paragraphs as insignificant whitespace.
**How to avoid:** Add a custom `blankParagraph` rule that converts empty `<p>` elements to `\n\n`.

### Pitfall 4: Heading Detection False Positives

**What goes wrong:** Large-font body text is mistakenly converted to headings.
**Why it happens:** Heuristic font-size thresholds do not account for documents with non-standard base font sizes.
**How to avoid:** For Phase 11, do NOT implement heading detection by font-size. Only convert if OO actually uses `<h1>`-`<h6>` tags (which it may for some styles). Heading heuristics can be added later with real OO output data. Conservative approach: if it is not an `<h>` tag, leave it as `<p>`.

### Pitfall 5: `marked.parse()` Produces Unescaped HTML

**What goes wrong:** The HTML output from marked is valid but may contain characters that conflict with OO's PasteHtml parsing.
**Why it happens:** Different HTML consumers have different expectations about entity encoding.
**How to avoid:** Test `marked.parse()` output directly with PasteHtml in Phase 13. For Phase 11, just verify the HTML is well-formed.

## Code Examples

### Complete scribeConversion.js Module

```javascript
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { marked } from 'marked'

/**
 * Normalize OO inline-style HTML to semantic HTML that Turndown can process.
 * OO exports <span style="font-weight:bold"> instead of <strong>.
 *
 * @param {string} html - Raw OO HTML (class-stripped by plugin)
 * @returns {string} Semantic HTML with <strong>, <em>, etc.
 */
function normalizeOoHtml(html) {
  if (!html) return ''

  const doc = new DOMParser().parseFromString(html, 'text/html')

  // Process all spans: convert inline styles to semantic tags
  doc.querySelectorAll('span').forEach(span => {
    const isBold = span.style.fontWeight === 'bold' ||
      parseInt(span.style.fontWeight, 10) >= 700
    const isItalic = span.style.fontStyle === 'italic'

    if (isBold && isItalic) {
      const strong = doc.createElement('strong')
      const em = doc.createElement('em')
      while (span.firstChild) em.appendChild(span.firstChild)
      strong.appendChild(em)
      span.replaceWith(strong)
    } else if (isBold) {
      const strong = doc.createElement('strong')
      while (span.firstChild) strong.appendChild(span.firstChild)
      span.replaceWith(strong)
    } else if (isItalic) {
      const em = doc.createElement('em')
      while (span.firstChild) em.appendChild(span.firstChild)
      span.replaceWith(em)
    }
    // Other spans (font-family, color, size) are left as-is.
    // Turndown treats unknown spans as inline containers (content preserved).
  })

  return doc.body.innerHTML
}

/**
 * Create a configured Turndown instance.
 */
function createTurndownService() {
  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  })

  td.use(gfm)

  // CONV-03: Remove unsupported elements silently
  td.remove(['img', 'svg', 'math', 'object', 'embed', 'iframe', 'script', 'style'])

  // Preserve empty paragraphs as blank lines
  td.addRule('blankParagraph', {
    filter: function (node) {
      if (node.nodeName !== 'P') return false
      const text = node.textContent.trim()
      return text === '' || text === '\u00a0' // &nbsp;
    },
    replacement: function () {
      return '\n\n'
    }
  })

  return td
}

/**
 * Convert OO HTML to clean Markdown for LLM prompts.
 * CONV-01: HTML extrait -> Markdown via Turndown
 *
 * @param {string} html - OO HTML (class-stripped)
 * @returns {string} Clean Markdown
 */
export function htmlToMarkdown(html) {
  if (!html || !html.trim()) return ''
  const normalized = normalizeOoHtml(html)
  const td = createTurndownService()
  return td.turndown(normalized)
}

/**
 * Convert Markdown to HTML for OO reinsertion.
 * CONV-02: Markdown LLM response -> HTML via marked
 *
 * @param {string} markdown - Markdown string from LLM
 * @returns {string} HTML string ready for PasteHtml
 */
export function markdownToHtml(markdown) {
  if (!markdown || !markdown.trim()) return ''
  return marked.parse(markdown)
}
```

### Integration in scribeAI.js buildMessages()

```javascript
import { htmlToMarkdown } from './scribeConversion'

export function buildMessages(actionId, selectedText, label, extra) {
  const systemPrefix = SYSTEM_PROMPT + '\n\n'

  // Use Markdown from HTML when available (v2.1 rich text pipeline)
  const text = extra?.html ? htmlToMarkdown(extra.html) : selectedText

  if (actionId === 'free-prompt') {
    return [{
      role: 'user',
      content: `${systemPrefix}Apply the following instruction to the text below. Return only the modified text.\n\nInstruction: ${label}\n\nText: ${text}`
    }]
  }

  // ... rest unchanged, using `text` variable instead of `selectedText`
}
```

### Integration in ScribePopover.jsx handleActionSelect()

```javascript
// Pass html to buildMessages via extra parameter
const extra = actionId === 'translate-custom'
  ? { language: label, html: selectedHtml }
  : { html: selectedHtml }
const messages = buildMessages(actionId, selectedText, label, extra)
```

## State of the Art

| Old Approach (v2.0) | Current Approach (v2.1 Phase 11) | Impact |
|----------------------|-----------------------------------|--------|
| Plain text sent to LLM | Markdown from HTML sent to LLM | LLM receives and returns structured text |
| No conversion modules | `scribeConversion.js` with htmlToMarkdown + markdownToHtml | Bidirectional pipeline established |
| `selectedText` in prompts | HTML-derived Markdown in prompts when available | Better LLM output quality |

**Deprecated/outdated:**
- Turndown pre-v7 used to be called `to-markdown` -- do not reference old name
- marked v12+ changed to ESM-only exports -- use `import { marked } from 'marked'`

## Open Questions

1. **Exact OO HTML format for headings**
   - What we know: OO may use `<h1>`-`<h6>` for heading-styled paragraphs, OR may use `<p style="font-size:18pt;font-weight:bold">`. Depends on whether the document uses OO's built-in heading styles.
   - What's unclear: Which pattern OO 9.3.0-138 actually produces.
   - Recommendation: Phase 11 handles `<h>` tags natively (Turndown does this by default). Font-size-based heading detection is deferred -- add only if real OO output proves `<h>` tags are not used.

2. **Turndown + turndown-plugin-gfm ESM/CJS compatibility**
   - What we know: The project uses rsbuild with SWC. Turndown 7.2.x ships as UMD/CJS. turndown-plugin-gfm is CJS.
   - What's unclear: Whether rsbuild handles the CJS imports seamlessly.
   - Recommendation: Test import after `yarn add`. If CJS import issues arise, use `require()` or check rsbuild config.

3. **LLM Markdown output quality**
   - What we know: LLMs generally produce good Markdown when given Markdown input. The system prompt says "Return only the transformed text."
   - What's unclear: Whether the LLM will preserve Markdown structure (headings, lists, tables) or flatten it.
   - Recommendation: This is an LLM behavior concern, not a conversion concern. Consider adding "Preserve the formatting structure (headings, lists, tables)" to the system prompt.

## Sources

### Primary (HIGH confidence)
- [Turndown GitHub](https://github.com/mixmark-io/turndown) - v7.2.2 (Oct 2025), addRule API, remove() API, plugin system
- [turndown-plugin-gfm GitHub](https://github.com/mixmark-io/turndown-plugin-gfm) - tables, strikethrough, taskListItems plugins
- [marked documentation](https://marked.js.org/) - GFM tables enabled by default, `marked.parse()` API
- Project research files: `.planning/research/PITFALLS.md` (Pitfalls 2, 11, 13), `.planning/research/FEATURES.md` (Feature table stakes 1-11)

### Secondary (MEDIUM confidence)
- [marked npm](https://www.npmjs.com/package/marked) - v17.0.4 latest
- `.planning/research/SUMMARY.md` - Architecture decisions (thin plugin, smart host)

### Tertiary (LOW confidence)
- OO heading output format (no sample HTML available yet from OO 9.3.0-138)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Turndown and marked are the established choices, versions verified
- Architecture: HIGH - Follows "thin plugin, smart host" pattern already validated in Phase 10
- Pitfalls: HIGH - OO inline-style issue documented extensively in prior research with proven mitigation (normalizer + custom rules)
- OO HTML format specifics: MEDIUM - General patterns known, exact output for our OO version needs empirical validation

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable libraries, no expected breaking changes)
