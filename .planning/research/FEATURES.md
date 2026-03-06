# Feature Landscape: v2.1 Rich Text Formatting Preservation

**Domain:** Rich text formatting preservation for AI writing assistant (Scribe) in OnlyOffice / Cozy Drive
**Researched:** 2026-03-06
**Milestone context:** v2.1 -- preserving and restoring rich text formatting through the Scribe AI cycle (extraction, Markdown conversion, LLM processing, preview, reinsertion)
**Confidence:** MEDIUM-HIGH -- OO APIs (GetSelectedContent, PasteHtml) are documented and proven by official plugins; conversion libraries (Turndown, marked, react-markdown) are mature and battle-tested; the integration between them in this specific plugin context needs validation.

---

## Existing v2.0 Foundation (Already Shipped)

These features are built and working. v2.1 builds directly on top of them.

| Feature | Status | Location |
|---------|--------|----------|
| Plain text extraction via `GetSelectedText` | Shipped | `plugins/onlyoffice-scribe/scripts/code.js` |
| Plain text insertion via `PasteText` | Shipped | `code.js` handleIntentResponse |
| Insert-after via `InsertContent` (callCommand) | Shipped | `code.js` insertAfterWithText |
| Action menu, submenus, free prompt | Shipped | `ScribeActionMenu.jsx`, `scribeActions.js` |
| Result preview panel (Insert/Replace/Cancel) | Shipped | `ScribeResultPanel.jsx` -- plain text display |
| LLM integration via cozy-stack (non-streaming) | Shipped | `scribeAI.js` |
| Error handling with retry, i18n (5 locales) | Shipped | `ScribePopover.jsx`, `ScribeResultPanel.jsx` |
| Floating button, Ctrl+I, context menu, toolbar | Shipped | `ScribeFloatingButton.jsx`, `code.js` |

---

## Pipeline Overview

The rich text milestone introduces a 5-stage pipeline:

```
[1] Extraction  -->  [2] Rich-to-MD  -->  [3] LLM  -->  [4] MD Preview  -->  [5] MD-to-Rich Reinsertion
    (OO API)         (Turndown)        (existing)     (react-markdown)      (marked + PasteHtml)
```

Stages 1 and 5 interact with the OO Plugin API (highest risk -- ES5 constrained, cross-iframe). Stages 2 and 5 are pure conversion (lowest risk, well-established libraries). Stage 4 is React UI rendering. Stage 3 (LLM call) already exists and needs no change -- LLMs handle Markdown natively and produce better-structured output when given Markdown input.

---

## Table Stakes

Features users expect. Missing any of these means the formatting milestone is incomplete.

| # | Feature | Category | Why Expected | Complexity | Dependencies | Notes |
|---|---------|----------|-------------|------------|--------------|-------|
| 1 | **Extract selected text with HTML formatting** | Extraction | Without formatted extraction, the entire pipeline has no structured input. The current `GetSelectedText` strips all formatting. | Medium | OO Plugin API `GetSelectedContent({type:"html"})` returns HTML string of the selection. Proven by the official [OO HTML plugin](https://github.com/ONLYOFFICE/plugin-html). | Must run in plugin ES5 context via `executeMethod`. Returns HTML with `<b>`, `<i>`, `<h1>`-`<h6>`, `<ul>/<ol>/<li>`, `<a>`, `<table>`, `<p>` tags. Config needs `"initDataType": "html"` and `"initOnSelectionChanged": true`. |
| 2 | **Convert extracted HTML to Markdown** | Conversion | Markdown is the lingua franca for LLMs. Sending structured Markdown input produces better, more structured output than plain text. | Low | [Turndown](https://github.com/mixmark-io/turndown) library (~4.6kB gzip). Runs on the React/Cozy Drive side, not in the ES5 plugin. | One function call: `new TurndownService().turndown(htmlString)`. Handles bold, italic, headings, lists, links, paragraphs out of the box. Custom rules available for OO-specific quirks (e.g., stripping `<img>` data URIs, normalizing OO's span-based formatting). |
| 3 | **Render LLM response as formatted Markdown in result panel** | Preview | Users must see what the formatted result looks like before accepting. A plain-text dump of Markdown source (`**bold**`, `# heading`) is confusing. | Medium | [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) for GFM table/strikethrough support. | Current `ScribeResultPanel` displays `{error \|\| resultText}` in a plain div. Must be replaced with `<ReactMarkdown>{resultText}</ReactMarkdown>`. Needs styling to match Scribe UI theme (Paper background, theme-aware text colors). Safe by default -- no `dangerouslySetInnerHTML`. |
| 4 | **Convert Markdown response back to HTML** | Conversion | HTML is the required input format for OO reinsertion via `PasteHtml`. | Low | [marked](https://github.com/markedjs/marked) library (~40kB, fast, CommonMark compliant). | Single function call: `marked.parse(markdownString)`. Produces clean HTML. Alternative: use `react-markdown`'s internal pipeline to render to HTML string, but marked is simpler and avoids coupling to React. |
| 5 | **Reinsert formatted text into OO editor** | Reinsertion | The whole point -- formatted text must appear correctly in the document with bold, italic, headings, lists preserved. | Medium | OO Plugin API `PasteHtml(htmlString)`. Replaces current `PasteText` call. | Proven by official OO HTML plugin and [Get and Paste HTML sample](https://api.onlyoffice.com/docs/plugin-and-macros/samples/plugin-samples/get-and-paste-html/). Official example: `executeMethod("PasteHtml", ["<p><b>Bold</b></p><ul><li>Item</li></ul>"])`. PasteHtml replaces the current selection, which aligns with the "Replace" action. |
| 6 | **Adapt "Insert After" for HTML content** | Reinsertion | The current `insertAfterWithText` uses `callCommand` with `Api.CreateParagraph().AddText()` which is plain-text only. Must handle HTML/formatted content for the "Insert" action. | Medium | OO Document Builder API inside `callCommand`. | Two approaches: (a) Use `PasteHtml` after moving cursor past selection (complex cursor manipulation), or (b) Use `callCommand` to create paragraphs with formatting via `ApiRun.SetBold()`, `SetItalic()` etc (requires parsing HTML to API calls). Approach (a) is simpler if cursor positioning works reliably. |
| 7 | **Pass HTML through postMessage protocol** | Protocol | HTML strings must flow from plugin (ES5) through postMessage to React (Cozy Drive frame) and back. | Low | Existing `castIntent` / `handleIntentResponse` protocol. | HTML is just a string -- postMessage handles it. The `data.text` field in the intent protocol currently carries plain text; it will carry HTML. No protocol changes needed, just larger payloads. Must ensure no HTML size limits in postMessage (there are none in practice). |
| 8 | **Bold and italic round-trip** | Pipeline integrity | The most common formatting. Users will immediately notice if bold/italic is lost. | Low | All pipeline stages. | `<strong>`/`<b>` maps to `**text**` (Turndown) and back to `<strong>` (marked). `<em>`/`<i>` maps to `*text*` and back. Clean bidirectional mapping. |
| 9 | **Heading round-trip** | Pipeline integrity | Users with heading-structured text expect headings to survive the AI cycle. | Low | All pipeline stages. | `<h1>`-`<h6>` maps to `#`-`######` (Turndown) and back (marked). PasteHtml supports heading tags. Clean mapping. |
| 10 | **List round-trip (bulleted and numbered)** | Pipeline integrity | Lists are among the most common formatting structures. The "Improve > Bullets" action explicitly creates lists. | Low-Medium | All pipeline stages. | `<ul>/<ol>/<li>` maps to `- item` / `1. item` (Turndown). Nested lists need attention -- depth > 2 can produce surprising Markdown indentation. PasteHtml supports list tags. |
| 11 | **Paragraph structure preservation** | Pipeline integrity | Multi-paragraph selections must maintain paragraph breaks through the cycle. | Low | All pipeline stages. | `<p>` tags map to `\n\n` in Markdown and back. Natural mapping at every stage. |

---

## Differentiators

Features that add polish. Not strictly required for a working pipeline but significantly improve perceived quality.

| # | Feature | Category | Value Proposition | Complexity | Dependencies | Notes |
|---|---------|----------|-------------------|------------|--------------|-------|
| D1 | **Table formatting round-trip** | Pipeline integrity | Tables in documents should survive the AI cycle. Not all users have tables, but those who do will immediately notice breakage. | Medium | [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) for HTML-to-MD table conversion. [remark-gfm](https://github.com/remarkjs/remark-gfm) for preview rendering. marked supports GFM tables natively. | GFM pipe table syntax (`\| col \| col \|`). Turndown needs the GFM plugin explicitly for tables. OO PasteHtml supports `<table>`. |
| D2 | **Link preservation** | Pipeline integrity | Hyperlinks in text should survive and remain clickable in the document. | Low | All pipeline stages. | `<a href="url">text</a>` maps to `[text](url)` cleanly. Low effort, high perceived quality. |
| D3 | **Code block/inline code round-trip** | Pipeline integrity | Users with code snippets in documents expect preservation. | Low | All pipeline stages. | `<code>` maps to backticks. `<pre><code>` maps to fenced code blocks. Standard Markdown. |
| D4 | **Graceful fallback to plain text** | Resilience | If `GetSelectedContent` fails (unsupported OO version, edge case), fall back silently to `GetSelectedText`. | Low | Error handling in plugin code. | The current plain-text pipeline should remain as fallback. Try HTML extraction first; on error, use plain text. The rest of the pipeline handles plain text already. |
| D5 | **Copy raw Markdown to clipboard** | Preview UX | Power users may want the raw Markdown for use elsewhere (notes, emails, other editors). | Low | `navigator.clipboard.writeText()` | Small icon button in result panel header. Trivial to implement. |
| D6 | **Styled Markdown preview matching Scribe theme** | Preview UX | The rendered Markdown must use the Scribe UI's colors, fonts, and spacing -- not default browser styling. | Medium | CSS/styled-components for react-markdown custom components. | react-markdown accepts a `components` prop to override default HTML elements with custom styled React components. Must use MUI `theme.palette` tokens for dark/light mode. |
| D7 | **Strip unsupported elements before conversion** | Resilience | OO may include `<img>` tags (with data URIs), `<svg>`, `<math>`, or proprietary spans in the extracted HTML. These should be cleaned before Markdown conversion. | Low | HTML sanitization before Turndown. | Use Turndown's `remove` rules to strip `<img>`, `<svg>`, `<math>`. Or use a lightweight DOM parser (DOMParser available in browser) to strip before passing to Turndown. |

---

## Anti-Features

Features to explicitly NOT build for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Editable Markdown editor in result panel** | Adding a full Markdown editor (MDXEditor, CodeMirror, textarea+preview) to the result panel introduces major complexity: controlled state management, cursor handling, re-rendering on every keystroke, two-panel layout. The result panel is a preview/decision UI, not an editing environment. | Keep the result panel read-only with rendered Markdown. Users accept or reject. If they want to tweak, they Replace into OO and edit there. Revisit in v2.2+ if user feedback demands it. |
| **Custom font/color/size preservation** | Markdown has no concept of font families, sizes, or colors. Attempting to preserve these through `<span style="...">` tags would require a parallel HTML pipeline bypassing Markdown entirely, defeating the purpose of the Markdown-based architecture. | Preserve structural formatting only (bold, italic, headings, lists, links, tables, code). Document this limitation. Font/color applied by the document's styles will be reapplied by OO based on the document's style definitions. |
| **Image extraction/reinsertion** | Images in OO are embedded objects with internal references or base64 data URIs. They cannot survive the LLM round-trip (LLMs cannot process images in a text completion context). Including them inflates the HTML payload and confuses Turndown. | Strip `<img>` tags from extracted HTML before conversion. If the selection contains only images, fall back to plain text with a user-facing message. |
| **Track changes / revision marks** | OO track changes are a separate document layer with accept/reject semantics. Mixing AI replacement with tracked changes creates confusing revision history and potential data corruption. | Apply AI changes as final content, not tracked changes. The user's explicit Replace/Insert action is the approval mechanism. |
| **Streaming Markdown rendering** | Rendering partial Markdown as it streams produces flickering, broken formatting (incomplete `**bold**` markers, half-built tables). The current non-streaming LLM integration avoids this problem entirely. | Keep non-streaming for v2.1. The Markdown is rendered only after the full LLM response is received. Streaming Markdown rendering (with token buffering) is a v3.0 concern. |
| **Math/equation preservation** | LaTeX/MathML equations require specialized Markdown extensions (KaTeX, MathJax) and add significant complexity for a niche use case. | Strip or pass through as plain text. Flag as known limitation. |
| **Merge original + LLM formatting** | Attempting to keep the original document's formatting (e.g., specific fonts, spacing) while applying the LLM's structural changes (new headings, reordered lists) is an unsolved diffing problem. | The LLM's Markdown output defines the formatting. On "Replace", original formatting is replaced entirely. On "Insert After", the new content uses the document's default styles. |
| **Diff view between original and result** | Showing a word-level diff between original and AI-transformed text with formatting is visually complex and computationally expensive. Better suited for a future milestone. | Show the full rendered result. Users compare visually with the document behind the Scribe panel. Defer diff view to v2.2+. |

---

## Feature Dependencies

### Pipeline Data Flow

```
Plugin (ES5, OO iframe)                    React (Cozy Drive iframe)
========================                    ==========================

GetSelectedContent(html)
        |
        v
  castIntent("AI_TEXT_EDIT",
    { text: htmlString })
        |                    postMessage
        +-------------------------------------->  useCozyBridge receives intent
                                                        |
                                                        v
                                                  Turndown: HTML -> Markdown
                                                        |
                                                        v
                                                  LLM call (existing scribeAI.js)
                                                  prompt: "...\n\n{markdownText}"
                                                        |
                                                        v
                                                  LLM response (Markdown string)
                                                        |
                                                  +-----+-----+
                                                  |           |
                                                  v           v
                                            react-markdown  marked: MD -> HTML
                                            (preview)       (for reinsertion)
                                                              |
                                              respond({       |
                                                action:"replace",
                                                data:{ html: htmlString }
                                              })              |
                                                  |           |
        +<--------------------------------------+
        |                    postMessage
        v
  handleIntentResponse
  executeMethod("PasteHtml", [htmlString])
```

### Stage-by-Stage Dependencies

```
Feature 1 (GetSelectedContent)  ----required by---->  Feature 2 (Turndown HTML->MD)
Feature 2 (Turndown)            ----required by---->  LLM call (existing, no change)
LLM response                    ----required by---->  Feature 3 (react-markdown preview)
LLM response                    ----required by---->  Feature 4 (marked MD->HTML)
Feature 4 (marked)              ----required by---->  Feature 5 (PasteHtml reinsertion)
Feature 5 (PasteHtml)           ----required by---->  Feature 6 (Insert After adaptation)
Feature 7 (postMessage HTML)    ----required by---->  Features 1 & 5 (data transport)

Features 8-11 (format round-trips) ----validated across---->  All stages
```

**Key insight:** Features 1, 5, and 6 are the OO integration points (highest risk, ES5 constrained). Features 2 and 4 are pure library calls (lowest risk). Feature 3 is standard React rendering. Feature 7 is trivial (strings through postMessage).

### Protocol Change

The intent protocol currently carries `{ text: "plain string" }`. For rich text, it must carry `{ text: "html string", format: "html" }`. The `format` field enables the fallback: when `format` is absent or `"text"`, the existing plain-text pipeline runs. When `format` is `"html"`, the rich-text pipeline runs.

The response protocol similarly changes: `{ action: "replace", data: { text: "..." } }` becomes `{ action: "replace", data: { html: "..." } }`. The plugin checks for `data.html` first, falls back to `data.text`.

---

## MVP Recommendation

### Phase 1: OO API validation + conversion pipeline (Features 1, 5, 7, 2, 4)

Build the extraction and reinsertion endpoints first. These are the highest-risk, least-known parts.

1. **Feature 1** -- Replace `GetSelectedText` with `GetSelectedContent({type:"html"})` in plugin
2. **Feature 7** -- Pass HTML string through postMessage (add `format: "html"` field)
3. **Feature 2** -- Add Turndown on React side: HTML -> Markdown before LLM call
4. **Feature 4** -- Add marked on React side: Markdown -> HTML after LLM response
5. **Feature 5** -- Replace `PasteText` with `PasteHtml` in plugin response handler

Validate with a simple test: select bold text in OO, run "Correct grammar", verify bold survives in the replaced text.

### Phase 2: Preview rendering (Feature 3, D4, D6, D7)

6. **Feature 3** -- Replace plain-text div with react-markdown in ScribeResultPanel
7. **D6** -- Style the rendered Markdown to match Scribe theme
8. **D4** -- Add fallback to GetSelectedText on extraction failure
9. **D7** -- Strip images/unsupported elements before Turndown

### Phase 3: Format coverage + Insert After (Features 6, 8-11, D1-D3)

10. **Feature 6** -- Adapt insertAfterWithText for HTML content
11. **Features 8-11** -- Systematic round-trip validation for each format type
12. **D1** -- Add GFM table support (turndown-plugin-gfm + remark-gfm)
13. **D2** -- Validate link preservation
14. **D3** -- Validate code block preservation

### Defer:

- **Editable Markdown** -- Not needed for v2.1. Preview is sufficient.
- **Diff view** -- Nice-to-have, not essential. Defer to v2.2+.
- **Streaming Markdown** -- Requires buffering strategy. Defer to v3.0.

---

## Sources

### OnlyOffice API (HIGH confidence)
- [GetSelectedContent](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/GetSelectedContent/) -- returns HTML string of selection with `{type:"html"}` param
- [PasteHtml](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/PasteHtml/) -- inserts HTML into document at cursor/selection
- [Get and Paste HTML sample](https://api.onlyoffice.com/docs/plugin-and-macros/samples/plugin-samples/get-and-paste-html/) -- official plugin sample showing both methods
- [Official plugin-html (GitHub)](https://github.com/ONLYOFFICE/plugin-html) -- first-party reference implementation proving the HTML extraction/reinsertion pattern
- [ApiParagraph reference](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/) -- Document Builder API for callCommand-based formatting
- [Text Document API plugin methods](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/) -- full method list including GetSelectedContent, PasteHtml

### Conversion Libraries (HIGH confidence)
- [Turndown (HTML-to-Markdown)](https://github.com/mixmark-io/turndown) -- de facto standard, ~4.6kB gzip, browser + Node, customizable rules
- [marked (Markdown-to-HTML)](https://github.com/markedjs/marked) -- fast, CommonMark compliant, ~40kB, single function call
- [react-markdown](https://github.com/remarkjs/react-markdown) -- safe React Markdown renderer, no dangerouslySetInnerHTML, extensible via remark/rehype plugins

### Community Validation (MEDIUM confidence)
- [OO community: retaining formatting with AI responses](https://community.onlyoffice.com/t/best-practices-for-retaining-formatting-when-pasting-ai-responses-in-onlyoffice/12811) -- confirms PasteHtml as recommended approach for AI content insertion
- [OO API Updates December 2025](https://www.onlyoffice.com/blog/2025/12/api-updates-december-2025) -- confirms active API development, expanded paragraph/run methods

---
*Feature research for: v2.1 Rich Text Formatting Preservation*
*Researched: 2026-03-06*
