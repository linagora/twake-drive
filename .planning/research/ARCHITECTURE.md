# Architecture Patterns: Rich Text Formatting Preservation

**Domain:** Rich text extraction, Markdown conversion, and formatted reinsertion in a 3-layer iframe architecture
**Researched:** 2026-03-06

## Recommended Architecture

The rich text pipeline introduces a bidirectional conversion chain that flows through the existing postMessage protocol. The key architectural decision: **all conversion logic lives in the Cozy Drive React app**, not in the ES5 plugin. The plugin's role changes from "extract plain text" to "extract HTML" (a config change) and from "paste plain text" to "paste HTML" (a method change).

### High-Level Data Flow

```
[OO Editor] --init(html)--> [Plugin iframe] --postMessage--> [CozyBridge/Cozy Drive]
                                                                    |
                                                              turndown(html->md)
                                                                    |
                                                              buildMessages(md)
                                                                    |
                                                              callScribeAI() --> LLM
                                                                    |
                                                              LLM returns markdown
                                                                    |
                                                              react-markdown for preview
                                                              marked(md->html) for reinsertion
                                                                    |
                                                              respond({ html })
                                                                    |
[OO Editor] <--PasteHtml--- [Plugin iframe] <--postMessage-- [CozyBridge/Cozy Drive]
```

### Component Boundaries

| Component | Responsibility | Changes from v2.0 |
|-----------|---------------|-------------------|
| **Plugin config.json** | Declares `initDataType` | Change `"text"` to `"html"` |
| **Plugin code.js (ES5)** | Receives selection, posts to ancestors, applies responses | Sends HTML instead of text; uses `PasteHtml` instead of `PasteText`; strips OO class attributes from HTML before sending |
| **CozyBridge protocol** | Message routing between plugin and Cozy Drive | Data payload changes from `{ text: string }` to `{ text: string, html: string }` |
| **useCozyBridge hook** | React state management for intents | Passes `html` field through to ScribePopover |
| **htmlToMarkdown module (NEW)** | HTML-to-Markdown conversion | New module using turndown |
| **markdownToHtml module (NEW)** | Markdown-to-HTML conversion | New module using marked |
| **ScribePopover** | State machine (menu/loading/result) | Converts HTML to Markdown before LLM call; converts Markdown result for preview |
| **ScribeResultPanel** | Displays AI result | Renders Markdown via react-markdown instead of plain text |
| **scribeAI.js** | LLM prompt building and API calls | System prompt updated to request Markdown output |
| **View.jsx** | Orchestrates Scribe components | `handleReplace`/`handleInsert` pass `html` instead of `text` |

## Detailed Design: Where Each Step Lives

### Step 1: Rich Text Extraction (Plugin side -- minimal changes)

**Where:** `plugins/onlyoffice-scribe/config.json` + `code.js`
**Confidence:** HIGH

The official ONLYOFFICE HTML plugin demonstrates the pattern: set `initDataType: "html"` in config.json, and `init(data)` receives HTML instead of plain text. This is a config-level change -- OO handles the conversion internally.

```json
// config.json change
"initDataType": "html"
```

The plugin code.js needs three changes:

1. **Store raw HTML** in `lastSelectedHtml` (new var). The `init(data)` callback now receives HTML.
2. **Strip OO class attributes** from extracted HTML before sending (OO injects internal CSS classes like `class="MsoNormal"` that are meaningless outside the editor). The official HTML plugin does exactly this: `text.replace(/class="[a-zA-Z0-9-:;+"\\/=]*/g, "")`
3. **Also extract plain text** via `GetSelectedText` for the `text` field (used for display, word count, fallback) -- this runs in parallel via `executeMethod`

The intent payload becomes:
```javascript
castIntent("AI_TEXT_EDIT", { text: plainText, html: cleanedHtml });
```

For the SHOW_SCRIBE_BUTTON one-way intent, continue sending plain text only (it is only used for display/presence detection).

### Step 2: HTML-to-Markdown Conversion (Cozy Drive side)

**Where:** New module `src/modules/views/OnlyOffice/Scribe/htmlToMarkdown.js`
**Library:** turndown (v7.2.x)
**Confidence:** HIGH

turndown converts HTML to Markdown. It runs in the Cozy Drive React app, not in the ES5 plugin, because:
- turndown uses modern JS (classes, arrow functions) incompatible with ES5 plugin constraints
- The React app already bundles dependencies via webpack
- Keeps the plugin thin (extraction only, no conversion logic)

```javascript
import TurndownService from 'turndown'

const turndown = new TurndownService({
  headingStyle: 'atx',        // # Heading instead of underline
  bulletListMarker: '-',
  codeBlockStyle: 'fenced'
})

export function htmlToMarkdown(html) {
  if (!html || html.trim() === '') return ''
  return turndown.turndown(html)
}
```

The conversion happens in ScribePopover's `handleActionSelect`, right before building messages:

```javascript
const markdown = htmlToMarkdown(pendingIntent.data.html)
const messages = buildMessages(actionId, markdown, label, extra)
```

### Step 3: LLM Interaction (Cozy Drive side -- minimal change)

**Where:** `scribeAI.js`
**Confidence:** HIGH

The system prompt needs a single addition telling the LLM to preserve and output Markdown formatting:

```javascript
export const SYSTEM_PROMPT =
  'You are a writing assistant. Return only the transformed text in Markdown format, preserving any formatting (bold, italic, headings, lists). No explanations or commentary. Respond in the same language as the input text.'
```

No structural changes to `buildMessages()` or `callScribeAI()` -- they already pass strings through. The prompt templates in `SCRIBE_ACTIONS` use `{selectedText}` which now contains Markdown instead of plain text.

### Step 4: Markdown Rendering in Result Panel (Cozy Drive side)

**Where:** `ScribeResultPanel.jsx`
**Library:** react-markdown (v9.x)
**Confidence:** HIGH

The result panel currently renders `resultText` as plain text inside a `<div>`. Change this to render Markdown:

```jsx
import ReactMarkdown from 'react-markdown'

// In the render:
<div className={styles['scribe-result-text']}>
  {error ? error : <ReactMarkdown>{resultText}</ReactMarkdown>}
</div>
```

react-markdown renders to React elements (no dangerouslySetInnerHTML, safe by default). It supports CommonMark and GFM (tables, strikethrough) with the remark-gfm plugin.

Style the rendered Markdown with scoped CSS in a new `scribe-markdown.styl` targeting `.scribe-result-text h1`, `.scribe-result-text strong`, `.scribe-result-text ul`, etc. Use the existing MUI theme for colors and typography.

### Step 5: Markdown-to-HTML Conversion for Reinsertion (Cozy Drive side)

**Where:** New module `src/modules/views/OnlyOffice/Scribe/markdownToHtml.js`
**Library:** marked (v15.x)
**Confidence:** HIGH

When the user clicks Replace or Insert, the Markdown result must be converted back to HTML for `PasteHtml`:

```javascript
import { marked } from 'marked'

marked.setOptions({
  breaks: true,     // Convert \n to <br>
  gfm: true         // GitHub Flavored Markdown
})

export function markdownToHtml(markdown) {
  if (!markdown || markdown.trim() === '') return ''
  return marked.parse(markdown)
}
```

This is called in View.jsx's response handlers:

```javascript
const handleReplace = useCallback(
  text => {
    const html = markdownToHtml(text)
    respond({ status: 'ok', action: 'replace', data: { text, html } })
    setTimeout(focusEditor, 100)
  },
  [respond, focusEditor]
)
```

### Step 6: Formatted Reinsertion (Plugin side -- minimal change)

**Where:** `plugins/onlyoffice-scribe/code.js`
**Confidence:** HIGH for PasteHtml, MEDIUM for insert-after workaround

The `handleIntentResponse` function switches from `PasteText` to `PasteHtml`:

```javascript
// Before (v2.0):
window.Asc.plugin.executeMethod("PasteText", [msg.data.text]);

// After (v2.1):
window.Asc.plugin.executeMethod("PasteHtml", [msg.data.html || msg.data.text]);
```

`PasteHtml` is documented in the ONLYOFFICE API: `window.Asc.plugin.executeMethod("PasteHtml", ["<p><b>Bold text</b></p>"])`. It accepts a string of HTML and inserts it at the current cursor position or replaces the selection.

The `insertAfterWithText` function needs an HTML variant. Since `PasteHtml` replaces the current selection (same behavior as `PasteText`), the approach for "insert after" is:

**Recommended:** For "insert after", concatenate original HTML + separator + new HTML into a single string and call PasteHtml once:
```javascript
function insertAfterWithHtml(originalHtml, newHtml) {
  var combined = originalHtml + "<hr/>" + newHtml;
  window.Asc.plugin.executeMethod("PasteHtml", [combined]);
}
```

This eliminates the callCommand/InsertContent workaround entirely for the formatted case. The separator (`<hr/>`, `<br/><br/>`, or empty paragraph) is a UX decision.

## Protocol Changes

### Intent Payload (plugin -> Cozy Drive)

```javascript
// v2.0
{ text: "selected plain text" }

// v2.1
{ text: "selected plain text", html: "<p><b>selected</b> plain text</p>" }
```

Both fields sent for backward compatibility. `text` used for display (loading messages, word count). `html` used for the conversion pipeline.

### Response Payload (Cozy Drive -> plugin)

```javascript
// v2.0
{ text: "transformed plain text" }

// v2.1
{ text: "transformed markdown", html: "<p><b>transformed</b> markdown</p>" }
```

The plugin uses `html` for PasteHtml reinsertion, falls back to `text` with PasteText if `html` is absent.

### Protocol Version

Keep version at 1. These are additive payload changes (new optional fields), not breaking protocol changes. The existing `MAX_DATA_SIZE` (1MB) is sufficient -- HTML of selected text will rarely exceed a few KB.

## New vs Modified Components

### New Files (3)

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `src/.../Scribe/htmlToMarkdown.js` | Turndown wrapper, HTML-to-Markdown | ~30 LOC |
| `src/.../Scribe/markdownToHtml.js` | Marked wrapper, Markdown-to-HTML | ~20 LOC |
| `src/.../Scribe/scribe-markdown.styl` | Styles for rendered Markdown in result panel | ~50 LOC |

### Modified Files (7)

| File | Changes |
|------|---------|
| `plugins/onlyoffice-scribe/config.json` | `initDataType: "html"` |
| `plugins/onlyoffice-scribe/scripts/code.js` | HTML storage, class stripping, PasteHtml, dual text+html in intents, insertAfterWithHtml |
| `src/lib/cozy-bridge/types.js` | Document new `html` field in IntentMessage/ResponseMessage typedefs |
| `src/.../Scribe/ScribePopover.jsx` | Import htmlToMarkdown, convert HTML->MD before LLM call, pass markdown to result |
| `src/.../Scribe/ScribeResultPanel.jsx` | Import react-markdown, render Markdown instead of plain text |
| `src/.../Scribe/scribeAI.js` | Update SYSTEM_PROMPT to request Markdown output |
| `src/.../OnlyOffice/View.jsx` | Import markdownToHtml, convert MD->HTML in handleReplace/handleInsert |

### Unchanged Files

| File | Why Unchanged |
|------|---------------|
| `src/lib/cozy-bridge/index.js` | CozyBridge routes messages generically -- no format awareness needed |
| `src/lib/cozy-bridge/protocol.js` | Additive optional fields, no protocol version bump needed |
| `src/.../useCozyBridge.js` | Already passes `intentMessage.data` through -- html field flows automatically |
| `src/.../Scribe/scribeActions.js` | Action configs unchanged; `{selectedText}` placeholder works with Markdown input |
| `src/.../Scribe/ScribeActionMenu.jsx` | Menu UI unchanged |
| `src/.../Scribe/ScribeFloatingButton.jsx` | Button UI unchanged |
| `src/.../Scribe/mockTransform.js` | Already replaced by real API in v2.0 |

## Patterns to Follow

### Pattern 1: Thin Plugin, Smart Host

**What:** Keep the ES5 plugin as thin as possible. It extracts and reinserts. All conversion logic (turndown, marked, react-markdown) lives in the React app.

**Why:** The plugin runs in an ES5-constrained iframe with no bundler. Every library added there must be ES5-compatible and manually loaded via `<script>` tags. The React app has webpack, npm, and modern JS.

**Example:** The plugin sends raw HTML. The React app converts HTML->Markdown->LLM->Markdown->HTML. The plugin receives HTML and calls PasteHtml. The plugin never needs to know about Markdown.

### Pattern 2: Dual-Field Payloads for Graceful Degradation

**What:** Always send both `text` and `html` in payloads.

**Why:** If HTML extraction fails (OO version edge case, unsupported content type), the system falls back to plain text behavior identical to v2.0. No feature regression.

**Example:**
```javascript
// Plugin: if html extraction fails, send text-only
castIntent("AI_TEXT_EDIT", { text: plainText, html: htmlContent || "" });

// React: check html field, fall back to text
const markdown = pendingIntent.data.html
  ? htmlToMarkdown(pendingIntent.data.html)
  : pendingIntent.data.text  // plain text used as-is (no conversion)
```

### Pattern 3: Conversion Modules as Pure Functions

**What:** `htmlToMarkdown()` and `markdownToHtml()` are pure functions with no React or state dependencies.

**Why:** Testable in isolation with simple string assertions. Can be called from any component. No coupling to Scribe-specific logic. Easy to unit test edge cases (empty input, malformed HTML, nested formatting).

### Pattern 4: Canonical Format is Markdown

**What:** After initial extraction, Markdown is the canonical format throughout the pipeline. HTML exists only at the edges (extraction input and reinsertion output).

**Why:** The LLM thinks in Markdown. The preview renders Markdown. The system prompt asks for Markdown. Having one canonical format avoids confusion about "which version of the text is current."

**Data format at each stage:**
```
OO Editor  -> HTML (extraction)
Plugin     -> HTML (passthrough via postMessage)
Cozy Drive -> Markdown (after turndown conversion)
LLM        -> Markdown (input and output)
Result UI  -> Markdown (rendered by react-markdown)
Cozy Drive -> HTML (after marked conversion, for reinsertion)
Plugin     -> HTML (passthrough to PasteHtml)
OO Editor  -> Rich text (OO converts HTML internally)
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Putting Conversion Logic in the Plugin

**What:** Loading turndown/marked in the plugin iframe.
**Why bad:** ES5 constraint. No bundler. Script loading order issues. Increases plugin complexity and fragility. Plugin currently has zero external dependencies.
**Instead:** All conversions in React app. Plugin handles raw HTML only.

### Anti-Pattern 2: Storing Intermediate Formats in State

**What:** Storing HTML, Markdown, and plain text versions of the same content in React state.
**Why bad:** State sync bugs. Three sources of truth. Hard to debug which version is stale.
**Instead:** Store the canonical form (Markdown for result text, HTML for original input). Convert on-demand at the point of use.

### Anti-Pattern 3: Custom HTML Parsing

**What:** Regex-based or manual HTML-to-Markdown conversion instead of using turndown.
**Why bad:** HTML is not regular. Edge cases with nested tags, entities, self-closing tags, OO-specific markup. Maintenance burden grows with each formatting type.
**Instead:** Use turndown (battle-tested, 7M+ weekly npm downloads, handles edge cases).

### Anti-Pattern 4: Protocol Version Bump for Additive Changes

**What:** Incrementing protocol version to 2 for adding optional `html` field.
**Why bad:** Forces migration logic, breaks backward compatibility unnecessarily. A v1 plugin still works because it just ignores the `html` field.
**Instead:** Additive optional fields. Check for presence, fall back gracefully.

### Anti-Pattern 5: Using PasteHtml for Plain Text Fallback

**What:** Wrapping plain text in `<p>` tags and calling PasteHtml when no HTML is available.
**Why bad:** PasteHtml may interpret plain text differently (entity encoding, whitespace). PasteText is designed for plain text.
**Instead:** Check for `html` field. If present, use PasteHtml. If absent, use PasteText (v2.0 behavior).

## Build Order (Dependency-Aware)

The build order follows the data flow: extraction must work before conversion can be tested, conversion must work before reinsertion can be tested.

```
Phase 1: HTML Extraction
    |-- config.json: initDataType "html"
    |-- code.js: store HTML, strip classes, parallel GetSelectedText for plain text
    |-- code.js: send { text, html } in AI_TEXT_EDIT intent
    |-- Test: log received HTML in CozyBridge handler, verify formatting tags present
    v
Phase 2: HTML-to-Markdown Conversion
    |-- New: htmlToMarkdown.js (turndown wrapper)
    |-- ScribePopover: convert HTML to MD before buildMessages()
    |-- scribeAI.js: update SYSTEM_PROMPT for Markdown output
    |-- Test: select bold text, verify LLM receives **bold** in prompt
    v
Phase 3: Markdown Preview
    |-- ScribeResultPanel: render with react-markdown
    |-- New: scribe-markdown.styl for Markdown element styles
    |-- Test: LLM returns **bold** text, verify it renders as bold in result panel
    v
Phase 4: Markdown-to-HTML Reinsertion
    |-- New: markdownToHtml.js (marked wrapper)
    |-- View.jsx: convert MD to HTML in handleReplace/handleInsert
    |-- code.js: PasteHtml in handleIntentResponse
    |-- Test: click Replace, verify document shows bold formatting
    v
Phase 5: Insert-After + Edge Cases
    |-- code.js: insertAfterWithHtml using concatenated HTML
    |-- Graceful degradation: plain text fallback when html field is empty
    |-- Test: click Insert, verify original formatting preserved + new content added
```

Each phase is independently committable and testable. Phase 2 depends on Phase 1 for real HTML input but can be developed with hardcoded HTML test strings. Phase 3 depends on Phase 2 only for integration (can develop with hardcoded Markdown). Phase 4 depends on Phase 3 for user flow but is mechanically independent.

## Scalability Considerations

| Concern | Impact | Notes |
|---------|--------|-------|
| Payload size | Low | HTML is ~3-5x larger than plain text, but typical selections are <10KB. Well under the 1MB protocol limit. |
| Conversion time | Negligible | turndown + marked each process in <5ms for typical document selections |
| LLM token overhead | ~20% increase | Markdown adds formatting tokens vs plain text. Minimal cost impact. |
| Bundle size increase | ~34KB gzipped | turndown (~14KB) + marked (~12KB) + react-markdown (~8KB). Acceptable for the feature value. |
| OO initDataType change | Backward compatible | If OO version doesn't support `initDataType: "html"`, it falls back to text (verified: Scribe requires OO 8.2.0+, HTML init has been supported since before that) |

## Sources

- [ONLYOFFICE Plugin Configuration - initDataType](https://api.onlyoffice.com/docs/plugin-and-macros/structure/configuration/) -- HIGH confidence
- [ONLYOFFICE GetSelectedText API](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/GetSelectedText/) -- HIGH confidence
- [ONLYOFFICE PasteHtml API](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/PasteHtml/) -- HIGH confidence
- [ONLYOFFICE Official HTML Plugin (Get and Paste HTML)](https://api.onlyoffice.com/samples/docs/plugin-and-macros/plugin-samples/get-and-paste-html/) -- HIGH confidence (reference implementation using initDataType html + PasteHtml)
- [ONLYOFFICE HTML Plugin Source on GitHub](https://github.com/ONLYOFFICE/onlyoffice.github.io/blob/master/sdkjs-plugins/content/html/scripts/code.js) -- HIGH confidence
- [ONLYOFFICE GetRangeBySelect API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/GetRangeBySelect/) -- MEDIUM confidence (alternative approach for per-run formatting extraction, not recommended)
- [turndown - HTML to Markdown](https://github.com/mixmark-io/turndown) -- HIGH confidence
- [marked - Markdown to HTML](https://github.com/markedjs/marked) -- HIGH confidence
- [react-markdown - React Markdown renderer](https://github.com/remarkjs/react-markdown) -- HIGH confidence
- [ONLYOFFICE community: getSelectedText HTML format](https://community.onlyoffice.com/t/getselectedtext-html-format-paste-via-context-menu/8733) -- MEDIUM confidence (community confirmation that GetSelectedText returns plain text only, GetSelectedContent or initDataType html needed for formatted content)
