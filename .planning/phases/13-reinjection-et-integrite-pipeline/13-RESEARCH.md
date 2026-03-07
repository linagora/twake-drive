# Phase 13: Reinjection et Integrite Pipeline - Research

**Researched:** 2026-03-07
**Domain:** OnlyOffice PasteHtml API, postMessage protocol, Markdown-to-HTML conversion pipeline
**Confidence:** HIGH

## Summary

Phase 13 completes the rich text pipeline by wiring the "Replace" and "Insert After" buttons to send HTML (not plain text) back to the plugin, which then calls `PasteHtml` instead of `PasteText`. The conversion infrastructure (`markdownToHtml` via `marked.parse()`) already exists in `scribeConversion.js` from Phase 11. The main work is: (1) converting the LLM's Markdown response to HTML in the React app before sending to the plugin, (2) updating the plugin's `handleIntentResponse` to use `PasteHtml` when HTML is present, (3) creating an HTML-aware `insertAfterWithHtml` function in the plugin, and (4) validating the full round-trip for each formatting type.

The architecture is well-defined from prior research (ARCHITECTURE.md). The "thin plugin, smart host" pattern means all conversion happens on the Cozy Drive (React) side. The plugin receives ready-to-paste HTML and calls a single OO API method. The known risk is the PasteHtml ordered list bug (OO #79263) which may or may not be fixed in OO 9.3.0-138.

**Primary recommendation:** Start with PasteHtml for all formatting types. Test ordered lists first -- if the bug persists, accept degraded `<ol>` numbering for v2.1 and document it as a known limitation rather than building a complex InsertContent hybrid approach.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REINJ-01 | L'action "Replace" utilise PasteHtml pour reinjecter le texte formate | View.jsx handleReplace must call markdownToHtml() and pass `html` field in response; plugin handleIntentResponse must switch to PasteHtml when html field present |
| REINJ-02 | L'action "Insert After" insere du contenu HTML formate apres la selection | Plugin needs insertAfterWithHtml() that concatenates original HTML + new HTML and calls PasteHtml once |
| PIPE-01 | Le formatage inline (gras, italique) survit au cycle complet | Validated by full round-trip: OO HTML -> normalizeHtml -> Turndown -> LLM (preserves MD) -> marked.parse -> PasteHtml |
| PIPE-02 | Les blocs (titres, listes) survivent au cycle complet | Same pipeline; headings map cleanly; lists depend on PasteHtml bug status |
| PIPE-03 | Les tableaux GFM survivent au cycle complet | Turndown GFM plugin handles table extraction; marked renders GFM tables; PasteHtml handles `<table>` |
| PIPE-04 | Les liens et blocs de code survivent au cycle complet | Links: `<a href>` round-trips cleanly through MD. Code blocks: fenced code -> `<pre><code>` via marked |
</phase_requirements>

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| marked | ^15.x | Markdown-to-HTML conversion | Already imported in scribeConversion.js |
| turndown | ^7.x | HTML-to-Markdown conversion | Already used in scribeConversion.js |
| turndown-plugin-gfm | ^1.x | GFM tables/strikethrough support | Already used in scribeConversion.js |

### OO APIs Used

| API | Purpose | Confidence |
|-----|---------|------------|
| `PasteHtml(htmlString)` | Replace selection with formatted HTML | HIGH -- documented, used by official OO plugins |
| `PasteText(textString)` | Fallback for plain text (existing v2.0 behavior) | HIGH -- already working |
| `InsertContent(paragraphArray)` | Currently used for insertAfterWithText | HIGH -- already working |

**No new dependencies needed.** All libraries are already installed from Phases 11-12.

## Architecture Patterns

### Current Data Flow (v2.0 -- plain text)

```
User clicks Replace/Insert
  -> ScribePopover passes result.text (Markdown string)
  -> View.jsx handleReplace/handleInsert sends { text } via respond()
  -> CozyBridge posts response to plugin iframe
  -> Plugin handleIntentResponse calls PasteText(text) or insertAfterWithText(text)
```

### Target Data Flow (v2.1 -- formatted HTML)

```
User clicks Replace/Insert
  -> ScribePopover passes result.text (Markdown string)
  -> View.jsx handleReplace/handleInsert calls markdownToHtml(text)
  -> View.jsx sends { text, html } via respond()
  -> CozyBridge posts response to plugin iframe
  -> Plugin handleIntentResponse calls PasteHtml(html) or insertAfterWithHtml(originalHtml, newHtml)
  -> Falls back to PasteText(text) if html field absent
```

### Files to Modify

| File | Change | LOC estimate |
|------|--------|-------------|
| `src/modules/views/OnlyOffice/View.jsx` | Import markdownToHtml, convert MD->HTML in handleReplace/handleInsert, pass both text and html in response | ~10 |
| `plugins/onlyoffice-scribe/scripts/code.js` | Update handleIntentResponse to use PasteHtml when html present; add insertAfterWithHtml function | ~25 |

### Pattern: Response Payload Enhancement

View.jsx currently sends:
```javascript
respond({ status: 'ok', action: 'replace', data: { text } })
```

Must become:
```javascript
import { markdownToHtml } from '@/modules/views/OnlyOffice/Scribe/scribeConversion'

const handleReplace = useCallback(
  text => {
    var html = markdownToHtml(text)
    respond({ status: 'ok', action: 'replace', data: { text, html } })
    setTimeout(focusEditor, 100)
  },
  [respond, focusEditor]
)
```

Same pattern for handleInsert. The `text` field is kept for backward compatibility and plain-text fallback.

### Pattern: Plugin PasteHtml with Fallback

Plugin handleIntentResponse currently uses PasteText. Must switch to PasteHtml with fallback:

```javascript
// ES5 -- plugin code.js
function handleIntentResponse(msg) {
  if (msg.action === "replace") {
    if (msg.data && msg.data.html) {
      log("Applying replace with HTML");
      window.Asc.plugin.executeMethod("PasteHtml", [msg.data.html]);
    } else {
      log("Applying replace with plain text (fallback)");
      window.Asc.plugin.executeMethod("PasteText", [msg.data.text]);
    }
  } else if (msg.action === "insert") {
    if (msg.data && msg.data.html) {
      log("Applying insert after with HTML");
      insertAfterWithHtml(msg.data.html);
    } else {
      log("Applying insert after with plain text");
      insertAfterWithText(msg.data.text);
    }
  } else if (msg.action === "cancel") {
    log("Intent cancelled");
  }
}
```

### Pattern: Insert After with HTML

The current `insertAfterWithText` uses `callCommand` + `InsertContent` to rebuild original paragraphs and append new text. For HTML, a simpler approach using PasteHtml:

```javascript
// ES5 -- plugin code.js
function insertAfterWithHtml(newHtml) {
  // PasteHtml replaces the current selection.
  // For "insert after": concatenate original HTML + separator + new HTML
  var combined = lastSelectedHtml + "<p></p>" + newHtml;
  window.Asc.plugin.executeMethod("PasteHtml", [combined]);
}
```

This replaces the selection with original + new content, effectively inserting after. The separator is an empty paragraph (`<p></p>`) to create visual separation.

**Important:** `lastSelectedHtml` is already stored from `init()` -- it contains the class-stripped HTML of the original selection. For insert-after, we need the original HTML to be included in the response or use the stored value.

### Anti-Patterns to Avoid

- **Don't call PasteHtml with Markdown strings.** Always convert via `markdownToHtml()` first.
- **Don't wrap plain text in `<p>` tags for PasteHtml.** Use PasteText for plain text fallback.
- **Don't build InsertContent Document Builder objects for formatted reinsertion.** PasteHtml is simpler and sufficient for v2.1 supported formatting.
- **Don't modify the Markdown preview or LLM pipeline.** Phase 13 only touches the reinsertion path (after the result is displayed).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown-to-HTML | Custom parser | `marked.parse()` (already in scribeConversion.js) | Battle-tested, GFM support, already working |
| HTML sanitization for PasteHtml | Custom sanitizer | None needed -- marked output is clean HTML from known Markdown | The input is LLM-generated Markdown, not user-submitted HTML |
| Document Builder paragraph construction for HTML | InsertContent with ApiParagraph/ApiRun | PasteHtml | PasteHtml handles all supported formatting types directly |

## Common Pitfalls

### Pitfall 1: PasteHtml Ordered List Bug (OO #79263)
**What goes wrong:** All `<ol><li>` items render as "1." -- automatic numbering is broken.
**Why it happens:** Confirmed OnlyOffice bug in PasteHtml, reported in OO community forums.
**How to avoid:** Test PasteHtml with `<ol><li>First</li><li>Second</li><li>Third</li></ol>` in OO 9.3.0-138. If the bug persists, document as known limitation for v2.1 rather than building complex InsertContent workaround. Unordered lists (`<ul>`) are likely unaffected.
**Warning signs:** All numbered list items show "1." in the document after reinsertion.

### Pitfall 2: Insert After Loses Original Formatting
**What goes wrong:** When using "Insert After", the original selection's formatting is lost because we reconstruct it from stored HTML or plain text.
**Why it happens:** PasteHtml replaces the current selection. We must include the original content in the pasted HTML.
**How to avoid:** Use `lastSelectedHtml` (stored from init()) to rebuild the original content. Concatenate: `lastSelectedHtml + separator + newHtml`. The plugin already stores class-stripped HTML in `lastSelectedHtml`.
**Warning signs:** Original text appears unformatted after "Insert After" action.

### Pitfall 3: marked Output HTML Entity Issues
**What goes wrong:** `marked.parse()` may produce HTML with entities or characters that conflict with PasteHtml parsing.
**Why it happens:** Markdown can contain characters like `&`, `<`, `>` in code blocks or inline code that get double-encoded.
**How to avoid:** Test with Markdown containing code blocks, inline code, and special characters. `marked` handles these correctly by default, but verify end-to-end.
**Warning signs:** Code blocks show HTML entities instead of actual characters in OO.

### Pitfall 4: Forgetting Plain Text Fallback
**What goes wrong:** If the LLM returns plain text (no Markdown formatting), `markdownToHtml()` wraps it in `<p>` tags. PasteHtml with `<p>wrapped text</p>` may behave differently than PasteText.
**Why it happens:** `marked.parse("hello world")` returns `<p>hello world</p>\n`.
**How to avoid:** This is actually fine -- PasteHtml with `<p>text</p>` is equivalent to PasteText for plain text. The fallback path (no `html` field) is for when the entire rich text pipeline is absent, not for plain text content.

### Pitfall 5: Plugin .gz Cache Files
**What goes wrong:** Plugin changes don't take effect after editing code.js.
**Why it happens:** OO creates `.gz` cache files that override source files.
**How to avoid:** Always run `rm -f plugins/onlyoffice-scribe/**/*.gz plugins/onlyoffice-scribe/*.gz` before testing plugin changes. This is documented in project memory.

## Code Examples

### View.jsx: handleReplace with HTML conversion

```javascript
// Source: .planning/research/ARCHITECTURE.md step 5
import { markdownToHtml } from '@/modules/views/OnlyOffice/Scribe/scribeConversion'

const handleReplace = useCallback(
  text => {
    const html = markdownToHtml(text)
    respond({ status: 'ok', action: 'replace', data: { text, html } })
    setTimeout(focusEditor, 100)
  },
  [respond, focusEditor]
)

const handleInsert = useCallback(
  text => {
    const html = markdownToHtml(text)
    respond({ status: 'ok', action: 'insert', data: { text, html } })
    setTimeout(focusEditor, 100)
  },
  [respond, focusEditor]
)
```

### Plugin code.js: handleIntentResponse with PasteHtml

```javascript
// ES5 -- plugin code.js
function handleIntentResponse(msg) {
  if (msg.action === "replace") {
    if (msg.data && msg.data.html) {
      log("Applying replace with formatted HTML (" + msg.data.html.length + " chars)");
      window.Asc.plugin.executeMethod("PasteHtml", [msg.data.html]);
    } else {
      log("Applying replace with plain text (fallback)");
      window.Asc.plugin.executeMethod("PasteText", [msg.data.text]);
    }
  } else if (msg.action === "insert") {
    if (msg.data && msg.data.html) {
      log("Applying insert after with formatted HTML");
      insertAfterWithHtml(msg.data.html);
    } else {
      log("Applying insert after with plain text");
      insertAfterWithText(msg.data.text);
    }
  } else if (msg.action === "cancel") {
    log("Intent cancelled -- no document modification");
  }
}
```

### Plugin code.js: insertAfterWithHtml

```javascript
// ES5 -- plugin code.js
function insertAfterWithHtml(newHtml) {
  // PasteHtml replaces the current selection.
  // Concatenate original HTML + empty paragraph separator + new HTML
  var separator = "<p>&nbsp;</p>";
  var combined = lastSelectedHtml + separator + newHtml;
  window.Asc.plugin.executeMethod("PasteHtml", [combined]);
}
```

### marked.parse() output examples

```javascript
// Input: "**bold** and *italic*"
// Output: "<p><strong>bold</strong> and <em>italic</em></p>\n"

// Input: "# Heading\n\nParagraph"
// Output: "<h1>Heading</h1>\n<p>Paragraph</p>\n"

// Input: "- item 1\n- item 2"
// Output: "<ul>\n<li>item 1</li>\n<li>item 2</li>\n</ul>\n"

// Input: "| A | B |\n|---|---|\n| 1 | 2 |"
// Output: "<table>\n<thead>\n<tr>\n<th>A</th>\n<th>B</th>\n</tr>\n</thead>\n<tbody><tr>\n<td>1</td>\n<td>2</td>\n</tr>\n</tbody></table>\n"
```

## State of the Art

| Old Approach (v2.0) | Current Approach (v2.1 Phase 13) | What Changed |
|---------------------|----------------------------------|--------------|
| PasteText for all reinsertion | PasteHtml for formatted, PasteText fallback | Formatting preserved through pipeline |
| insertAfterWithText (callCommand + InsertContent) | insertAfterWithHtml (PasteHtml with concatenation) | Simpler, preserves formatting |
| Response payload: `{ text }` only | Response payload: `{ text, html }` | Backward compatible, additive |

## Open Questions

1. **PasteHtml Ordered List Bug Status in OO 9.3.0-138**
   - What we know: Bug #79263 confirmed in earlier OO versions; all `<ol><li>` items render as "1."
   - What's unclear: Whether the bug is fixed in OO 9.3.0-138 (our version)
   - Recommendation: Test during implementation. If broken, accept as known limitation for v2.1. Do not build InsertContent workaround unless explicitly requested.

2. **Insert After Separator UX**
   - What we know: Need visual separation between original and inserted content
   - What's unclear: Best separator -- `<p>&nbsp;</p>` (empty paragraph), `<br/><br/>` (line breaks), `<hr/>` (horizontal rule)
   - Recommendation: Use `<p>&nbsp;</p>` as it matches normal paragraph spacing in OO documents. Can be adjusted based on user feedback.

## Sources

### Primary (HIGH confidence)
- Project codebase: `plugins/onlyoffice-scribe/scripts/code.js` -- current plugin implementation
- Project codebase: `src/modules/views/OnlyOffice/View.jsx` -- current response handling
- Project codebase: `src/modules/views/OnlyOffice/Scribe/scribeConversion.js` -- markdownToHtml already implemented
- `.planning/research/ARCHITECTURE.md` -- detailed PasteHtml architecture and protocol changes
- `.planning/research/PITFALLS.md` -- PasteHtml bug documentation, hybrid approach analysis

### Secondary (MEDIUM confidence)
- `.planning/research/FEATURES.md` -- feature dependency graph, PasteHtml API documentation references
- [OO PasteHtml API](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/PasteHtml/) -- official API documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and working from Phases 11-12
- Architecture: HIGH -- data flow well-defined in ARCHITECTURE.md, minimal new code needed
- Pitfalls: HIGH -- PasteHtml bug documented with tracking number, workaround strategies clear

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable -- OO version pinned, libraries already integrated)
