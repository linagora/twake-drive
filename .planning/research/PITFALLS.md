# Domain Pitfalls

**Domain:** Rich text formatting preservation for AI writing assistant in OnlyOffice plugin (Scribe v2.1)
**Researched:** 2026-03-06
**Confidence:** MEDIUM-HIGH (OO Plugin API verified via official docs and community discussions; conversion pitfalls from community experience and library analysis; LLM output reliability from broad ecosystem evidence)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or fundamental architecture failures.

---

### Pitfall 1: `initDataType: "html"` May Not Work with `type: "background"` Plugins

**What goes wrong:**
The plugin config is changed from `"initDataType": "text"` to `"initDataType": "html"` expecting to receive HTML-formatted selection in `init()`. The plugin continues to receive plain text, or receives nothing, or fails to initialize entirely.

**Why it happens:**
The current Scribe plugin is configured as `"type": "background"` -- a headless plugin with no visible UI panel. The `initDataType: "html"` feature is documented primarily in the context of **visual** plugins (the official "Get and Paste HTML" example uses a panel-type plugin with a CodeMirror editor to display the HTML). Background plugins may receive selection data differently than panel/window plugins.

The OO documentation does not explicitly state which `initDataType` values are supported per plugin type. The only confirmed combination from official examples is:
- `initDataType: "html"` + `type: "window"` or `type: "panel"` (visual plugins)
- `initDataType: "text"` + `type: "background"` (current Scribe config)

Changing to `initDataType: "html"` with `type: "background"` is **untested territory** per official docs.

**Consequences:**
- If it silently falls back to plain text: the entire rich text pipeline receives wrong input, all formatting is lost from step 1
- If `init()` stops being called: the selection detection mechanism breaks entirely (selection polling, SHOW_SCRIBE_BUTTON intent)
- The failure is silent -- no error thrown, just wrong data type

**Prevention:**

1. **Test the combination first, before building anything else.** Change `config.json` to `"initDataType": "html"`, restart OO (`./scripts/oo-dev-setup.sh`), select bold text, and log what `init(data)` receives. This is a 10-minute validation that gates the entire feature.

2. **Have a fallback extraction strategy ready.** If `initDataType: "html"` does not work with background plugins:
   - **Option A**: Switch to a dual-variation config -- one background variation for selection detection (text), one window/panel variation for HTML extraction on demand
   - **Option B**: Use `callCommand` with the Document Builder API to manually walk the selection and extract formatting via `ApiRun.GetBold()`, `ApiRun.GetItalic()`, etc. inside the OO sandbox
   - **Option C**: Use `GetSelectedContent` (newer API, availability depends on OO version) if it returns structured data

3. **If using callCommand for extraction**, remember that `callCommand` runs in OO's internal sandbox -- only JSON-serializable data passes through `Asc.scope`. You must serialize the formatted content structure to a JSON object, pass it through `Asc.scope`, then post it via `castIntent`.

**Detection:**
- `console.log("[Scribe] init() data type:", typeof data, "length:", data.length, "starts with:", data.substring(0, 50))` -- if the data starts with `<` and contains HTML tags, it works; if it is plain text, it does not
- Check if data contains `<b>`, `<i>`, `<span style=...>` for a selection with known bold/italic text

**Phase to address:** Phase 1, first task -- this is a go/no-go gate for the architecture.

**Confidence:** MEDIUM -- the feature exists in OO, but the specific combination with background plugins is not documented. Must be empirically validated.

---

### Pitfall 2: OO-Generated HTML is Verbose Inline-Style Soup, Not Semantic HTML

**What goes wrong:**
The `initDataType: "html"` (or equivalent extraction) returns HTML like:
```html
<span style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; color: #000000;">Bold text</span>
<span style="font-family: 'Times New Roman'; font-size: 12pt; font-style: italic; color: #000000;">italic text</span>
```
instead of semantic `<strong>Bold text</strong><em>italic text</em>`. The HTML-to-Markdown converter (Turndown or similar) does not recognize `font-weight: bold` as "bold" and outputs the text without any formatting markers.

**Why it happens:**
OnlyOffice internally represents text as runs with explicit style properties, not semantic HTML. When it exports to HTML, it serializes those styles as inline CSS on `<span>` elements. This is how word processors work -- they do not think in terms of `<strong>` and `<em>`.

The typical HTML output from OO includes:
- Inline `style` attributes with `font-weight`, `font-style`, `font-size`, `font-family`, `color`
- `<p>` tags with `style` attributes for paragraph-level formatting (alignment, spacing, indent)
- `<table>`, `<tr>`, `<td>` with inline styles for cell dimensions, borders, padding
- No CSS classes, no semantic tags (`<strong>`, `<em>`, `<h1>`-`<h6>`)
- Headings may appear as `<p style="font-size: 18pt; font-weight: bold;">` rather than `<h2>`

**Consequences:**
- Markdown conversion produces plain text with no `**bold**` or `*italic*` markers
- Headings become regular paragraphs
- Lists may lose their structure (OO may export `<p>` with manual numbering instead of `<ol>/<li>`)
- The LLM receives plain text, returns plain text, and all original formatting is permanently lost

**Prevention:**

1. **Build a normalizer between OO HTML extraction and Markdown conversion.** This normalizer converts inline styles to semantic HTML before Turndown processes it:
   ```javascript
   // Normalize font-weight: bold spans to <strong>
   // Normalize font-style: italic spans to <em>
   // Detect heading-like paragraphs by font-size thresholds
   // Convert manual numbering patterns to <ol>/<li>
   ```

2. **Configure Turndown with custom rules** that understand inline-style patterns:
   ```javascript
   turndownService.addRule('boldSpan', {
     filter: function(node) {
       return node.style && node.style.fontWeight === 'bold'
     },
     replacement: function(content) {
       return '**' + content + '**'
     }
   })
   ```

3. **Test with real OO output, not hand-written HTML.** The normalizer must be built against actual OO HTML output, not assumptions about what it looks like. Extract HTML from selections with different formatting and log the exact output.

4. **Expect the OO HTML format to vary between OO versions.** The exact inline-style output is an implementation detail, not a stable API. Pin the OO version in dev and document the HTML patterns for the target version (9.3.0-138).

**Detection:**
- Extract HTML from a selection with known bold text. If the Markdown output is `Bold text` instead of `**Bold text**`, the normalizer is missing or incomplete.
- Check for `<span style=` in the extracted HTML -- if present, normalize before converting.

**Phase to address:** Phase 1 (HTML extraction) and Phase 2 (conversion pipeline).

**Confidence:** HIGH -- this is the documented behavior of word processor HTML export across OO, Google Docs, and MS Word.

---

### Pitfall 3: PasteHtml Numbered List Bug (OO Defect #79263)

**What goes wrong:**
After the LLM returns Markdown with numbered lists, the pipeline converts it to HTML (`<ol><li>...</li></ol>`) and uses `PasteHtml` to insert it back into the document. All list items render as "1." -- the automatic numbering is broken.

**Why it happens:**
This is a confirmed OnlyOffice bug (internal defect #79263, reported in the community thread "Best Practices for Retaining Formatting When Pasting AI Responses in OnlyOffice"). When HTML with `<ol><li>` is pasted via the `PasteHtml` API, the numbering resets to 1 for every item.

**Consequences:**
- All ordered lists from LLM output display as `1. 1. 1. 1.` instead of `1. 2. 3. 4.`
- Users see corrupt formatting and lose trust in the feature
- Manually fixing list numbering after every AI operation defeats the purpose

**Prevention:**

1. **Check if the bug is fixed in OO 9.3.0-138.** The bug was reported in 2025 -- it may be patched in newer versions. Test with a simple `PasteHtml` call containing `<ol><li>A</li><li>B</li><li>C</li></ol>` and verify numbering.

2. **If the bug persists, use callCommand with Document Builder API for list insertion instead of PasteHtml:**
   ```javascript
   // Inside callCommand (ES5, OO sandbox):
   var doc = Api.GetDocument();
   var numbering = doc.CreateNumbering("numbered");
   for (var i = 0; i < items.length; i++) {
     var p = Api.CreateParagraph();
     p.SetNumbering(numbering.GetLevel(0));
     p.AddText(items[i]);
     content.push(p);
   }
   doc.InsertContent(content);
   ```

3. **For unordered (bullet) lists, test separately.** The bug may be specific to `<ol>` -- `<ul>` might work fine via PasteHtml.

4. **Hybrid approach:** Use PasteHtml for simple formatting (bold, italic, paragraphs) and callCommand/InsertContent with Document Builder for structural elements (lists, headings, tables) where PasteHtml has known issues.

**Detection:**
- Paste `<ol><li>First</li><li>Second</li><li>Third</li></ol>` via PasteHtml. If all items show as "1.", the bug exists in your OO version.

**Phase to address:** Phase 1 (validate during initial API exploration). Phase 3 (implement workaround during reinsertion).

**Confidence:** HIGH -- confirmed bug with OO internal tracking number, reported by multiple users.

---

### Pitfall 4: LLM Strips or Corrupts Markdown Formatting in Output

**What goes wrong:**
The pipeline sends well-formed Markdown to the LLM (e.g., `**bold text** and *italic text*`). The LLM returns text where formatting markers are inconsistent, missing, or broken: unbalanced asterisks, escaped backticks, heading levels changed, list indentation destroyed.

**Why it happens:**
LLMs predict tokens one at a time without enforcing structural validity. They were not trained to preserve Markdown syntax -- they were trained to produce likely token sequences. Specific failure modes:

1. **Unbalanced markers**: `**bold text*` (opened with `**`, closed with single `*`)
2. **Marker stripping**: LLM "simplifies" the text and drops `**` markers entirely, returning plain text
3. **Heading level drift**: Input has `## Section`, output has `### Section` or `# Section`
4. **List format changes**: Input uses `- item`, output uses `* item` or `1. item`
5. **Code block corruption**: Backtick fences inside the response create nested/broken code blocks
6. **Escaping**: LLM adds backslashes before `*`, `_`, `#` characters, producing `\*\*not bold\*\*`
7. **Added formatting**: LLM adds Markdown formatting that was not in the input (adds `##` headings, wraps things in code blocks, adds bullet points to prose)

**Why it matters for Scribe specifically:**
The current system prompt says: "Return only the transformed text, no explanations or commentary." This works for plain text. But for Markdown-formatted input, the LLM needs different instructions. If told "preserve formatting," it may interpret this literally and add formatting. If not told about formatting, it strips markers as "noise."

**Consequences:**
- Bold text becomes plain text after a "fix grammar" operation
- The user sees formatting loss even though the pipeline supports formatting
- Round-trip fidelity degrades with each AI operation (ratcheting formatting loss)

**Prevention:**

1. **Add explicit formatting instructions to the system prompt:**
   ```
   The input text uses Markdown formatting (bold, italic, headings, lists).
   Preserve all Markdown formatting markers exactly as they appear in the input.
   Do not add new formatting markers that were not in the original text.
   Do not change heading levels.
   Do not escape Markdown syntax characters.
   Return only the transformed text with original formatting preserved.
   ```

2. **Validate Markdown output before rendering/reinsertion.** Run the LLM output through a Markdown parser and check:
   - All bold markers (`**`) are balanced (even count per line)
   - All italic markers (`*`) are balanced
   - Heading levels match input heading levels
   - No escaped formatting characters (`\*`, `\_`)

3. **Post-process common LLM formatting mistakes:**
   ```javascript
   // Fix escaped markers
   output = output.replace(/\\\*/g, '*')
   output = output.replace(/\\_/g, '_')
   // Fix unbalanced bold (odd number of ** on a line)
   // This is heuristic and imperfect
   ```

4. **For actions that restructure text (bullets, expand, shorten), accept formatting changes.** Only enforce formatting preservation for actions that should not change structure (grammar, tone, translate).

5. **Consider using a diff-based approach for grammar/spelling corrections:** Send the text as Markdown, but also tell the LLM to output a minimal diff (or just the corrected text), then apply only the textual changes while preserving the original Markdown structure programmatically.

**Detection:**
- Select bold text, run "Correct Grammar." If the result is no longer bold, formatting was lost.
- Select a heading, run "Change Tone." If the heading level changes or disappears, the LLM modified structure.
- Compare input and output Markdown marker counts.

**Phase to address:** Phase 2 (prompt engineering and output validation). This is an ongoing concern, not a one-time fix.

**Confidence:** HIGH -- this is a universally documented LLM behavior problem, not specific to any model.

---

## Moderate Pitfalls

Mistakes that cause significant bugs or rework but do not invalidate the architecture.

---

### Pitfall 5: Markdown Round-Trip Lossy for Tables, Merged Cells, and Nested Lists

**What goes wrong:**
The user selects a formatted table with merged cells, nested lists inside table cells, or complex multi-level lists. The HTML-to-Markdown conversion loses structural information that cannot be recovered during Markdown-to-HTML conversion for reinsertion.

**Why it happens:**
Standard Markdown (CommonMark) has fundamental limitations:

| OO Feature | Markdown Support | What's Lost |
|-----------|-----------------|-------------|
| Merged cells (rowspan/colspan) | Not supported | Cells un-merge, data duplicates or disappears |
| Nested lists in tables | Requires HTML within Markdown | Most parsers reject mixed syntax |
| Table cell alignment | Partial (`:---`, `:---:`) | Vertical alignment, custom widths lost |
| Colored/highlighted text | Not supported | Color information disappears |
| Font size variations | Not supported | All text becomes same size |
| Superscript/subscript | Not standard | Lost unless using HTML fallback |
| Inline images | Supported (`![](url)`) | Image data may be too large for postMessage |
| Footnotes | Extension, not standard | Depends on parser configuration |

The conversion is inherently lossy: `rich OO HTML -> Markdown -> LLM -> Markdown -> HTML -> OO` loses more information at each step.

**Consequences:**
- Tables with merged cells become garbled
- Document formatting is visibly degraded after AI operation
- Users with complex documents avoid the feature entirely

**Prevention:**

1. **Define a supported formatting subset and communicate it clearly.** Start with:
   - Supported: bold, italic, underline, strikethrough, headings (H1-H6), ordered/unordered lists, simple tables (no merged cells), links, code blocks
   - Unsupported (with graceful degradation): merged cells, colored text, font sizes, images, footnotes

2. **For unsupported formatting, preserve it as pass-through HTML in the Markdown.** Turndown can be configured to leave unrecognized HTML tags as-is:
   ```javascript
   turndownService.keep(['span', 'sup', 'sub', 'mark'])
   ```
   The LLM will see raw HTML tags in its input, which it may corrupt -- but at least the data is not silently dropped.

3. **Detect complex formatting in the selection and warn the user** before proceeding:
   ```
   "This selection contains formatting (tables, colors) that may not be fully preserved. Continue?"
   ```

4. **Consider a "text-only" fallback mode** for selections with complex formatting -- use the existing plain-text pipeline (current v2.0 behavior) when the formatting is too complex for the rich text pipeline to handle faithfully.

**Detection:**
- Select a table with merged cells, run any action, check if the table structure is preserved
- Select nested lists (3+ levels deep), check if nesting is maintained after round-trip

**Phase to address:** Phase 2 (conversion pipeline design -- define the supported subset). Phase 3 (graceful degradation for unsupported features).

**Confidence:** HIGH -- these are inherent Markdown format limitations, well-documented.

---

### Pitfall 6: `callCommand` Sandbox Prevents Library Usage for HTML Extraction

**What goes wrong:**
The developer tries to use a library (DOMParser, Turndown, marked) inside `callCommand` to extract or convert formatted text. The code crashes with "X is not defined" because `callCommand` runs in OO's isolated JavaScript sandbox, not in the plugin iframe's browser context.

**Why it happens:**
As documented in the plugin README: "`callCommand` runs in OO's internal JS sandbox, not the plugin's iframe. Only JSON-serializable data passes through `Asc.scope`. No async operations inside `callCommand`."

The sandbox has access to:
- The Document Builder API (`Api`, `ApiDocument`, `ApiParagraph`, `ApiRun`, etc.)
- `Asc.scope` for data passing
- Basic JavaScript builtins
- **NOT**: `window`, `document`, `DOMParser`, `fetch`, `Promise`, `setTimeout`, external libraries

This means:
- HTML-to-Markdown conversion must happen in the plugin iframe or in Cozy Drive, not inside callCommand
- Document Builder API calls for extraction must happen inside callCommand, then pass data out via `Asc.scope`
- The extraction and conversion are in two different execution contexts with only JSON serialization between them

**Consequences:**
- Developer wastes time trying to use libraries inside callCommand
- Extraction logic must be split across two contexts (OO sandbox for API access, plugin iframe for processing)
- Data serialization through `Asc.scope` adds complexity

**Prevention:**

1. **Split extraction into two steps:**
   - Step 1 (inside callCommand): Walk the document model, extract a JSON structure representing the formatted content:
     ```javascript
     // Inside callCommand (ES5, OO sandbox):
     var paragraphs = [];
     // ... walk selection, build JSON structure:
     // [{ type: "paragraph", runs: [{ text: "Hello", bold: true, italic: false }, ...] }, ...]
     Asc.scope.extractedContent = JSON.stringify(paragraphs);
     ```
   - Step 2 (in plugin iframe): Receive the JSON via `Asc.scope`, convert to Markdown using a library

2. **If using `initDataType: "html"` instead of callCommand extraction**, the HTML arrives directly in `init(data)` in the plugin iframe context, where DOMParser and libraries are available. This is the simpler path -- validate Pitfall 1 first.

3. **If using callCommand for reinsertion**, the Markdown-to-OO conversion (creating ApiParagraph/ApiRun objects with formatting) must happen inside callCommand using the Document Builder API. Pass the structured data (not HTML, not Markdown) through `Asc.scope`:
   ```javascript
   // In plugin iframe: convert Markdown to structured JSON
   Asc.scope.contentToInsert = JSON.stringify([
     { type: "paragraph", runs: [
       { text: "Bold ", bold: true },
       { text: "and normal", bold: false }
     ]}
   ]);
   // In callCommand: create ApiRun objects from JSON
   ```

**Detection:**
- `ReferenceError: DOMParser is not defined` inside callCommand
- `ReferenceError: require is not defined` inside callCommand

**Phase to address:** Phase 1 (architecture decision: which code runs where).

**Confidence:** HIGH -- verified from existing code and README documentation of the callCommand constraint.

---

### Pitfall 7: ES5 Constraint Blocks Modern Conversion Libraries in Plugin Iframe

**What goes wrong:**
The developer adds Turndown (HTML-to-Markdown) or marked/markdown-it (Markdown-to-HTML) to the plugin iframe's `code.js`. The plugin crashes on load because the library uses `const`, `let`, arrow functions, template literals, `class`, or other ES6+ syntax.

**Why it happens:**
The plugin's `code.js` must use ES5 syntax (documented in README and project memory). The plugin iframe loads the script directly -- there is no build step, no Babel transpilation. The code runs as-is in whatever JavaScript context OO provides for plugin iframes.

Turndown's browser bundle (`turndown.browser.umd.js`) uses ES6 syntax in recent versions (7.x). marked and markdown-it similarly use modern syntax in their current releases.

**Consequences:**
- Plugin fails to load entirely (syntax error stops all script execution)
- All Scribe functionality is broken, not just the new formatting feature
- Debugging is difficult because the error may be swallowed by OO's plugin loader

**Prevention:**

1. **Do NOT run conversion libraries in the plugin iframe.** Run them in the Cozy Drive React context (which has a full Webpack/Babel build pipeline). The plugin extracts HTML and sends it to Cozy Drive via `castIntent`. Cozy Drive does all conversion.

2. **If conversion MUST happen in the plugin iframe** (e.g., for performance or to avoid large postMessage payloads):
   - Use an older version of the library that targets ES5
   - Transpile the library with Babel as part of a build step for the plugin
   - Write a minimal custom converter in ES5 (feasible for the limited formatting subset)

3. **Recommendation: Keep the plugin thin.** The plugin's job is:
   - Extract content (HTML or structured JSON) from OO
   - Send it to Cozy Drive via postMessage
   - Receive converted content back from Cozy Drive
   - Insert it into OO via PasteHtml or callCommand/InsertContent

   All conversion logic lives in Cozy Drive's React codebase where modern JS and npm libraries are available.

**Detection:**
- Plugin stops working entirely after adding a library
- Browser console shows `SyntaxError: Unexpected token 'const'` or similar from the plugin iframe
- OO's plugin panel shows the plugin as failed/crashed

**Phase to address:** Phase 1 (architecture decision). This is a design constraint, not a bug to fix later.

**Confidence:** HIGH -- verified constraint from existing code and project documentation.

---

### Pitfall 8: postMessage Payload Size for Rich HTML Content

**What goes wrong:**
Large document selections (multi-page, tables, embedded content) produce HTML strings that exceed the cozy-bridge 1MB payload limit. The intent is silently dropped or throws a validation error. The user sees no response from Scribe.

**Why it happens:**
The cozy-bridge protocol validates payload size:
```javascript
if (JSON.stringify(msg.data).length > MAX_DATA_SIZE) {
  // 1MB limit
}
```

OO-generated HTML is verbose -- inline styles on every `<span>` can easily produce 10-50x the character count of the plain text content. A 5,000-character text selection might generate 50,000-250,000 characters of HTML. A selection with tables, multiple formatting runs, and complex structure could approach or exceed 1MB.

Additionally, `postMessage` itself uses the structured clone algorithm, which has implementation-dependent limits. While browsers generally handle multi-MB payloads, the serialization/deserialization overhead for very large messages can cause UI jank (the main thread is blocked during structured clone).

**Consequences:**
- Silent failure for large selections (no error shown to user)
- UI freezes during serialization of large HTML payloads
- Inconsistent behavior: works for small selections, fails for large ones

**Prevention:**

1. **Increase the cozy-bridge limit or make it configurable.** 1MB may be too restrictive for HTML payloads. Consider 5MB or 10MB for rich text data, or remove the limit and rely on browser limits.

2. **Compress the HTML or use a compact intermediate format.** Instead of sending raw OO HTML, convert to a compact JSON structure in the plugin:
   ```javascript
   // Instead of sending 250KB of HTML:
   { html: "<span style='font-weight:bold;font-family:...'>" }
   // Send 5KB of structured data:
   { runs: [{ text: "Hello", b: true }, { text: " world", b: false }] }
   ```

3. **Truncate with warning for extremely large selections.** If the selection exceeds a threshold (e.g., 10,000 characters of source text), warn the user and offer to process plain text instead.

4. **Measure actual payload sizes** during development. Log `JSON.stringify(msg.data).length` for various selection sizes and formatting complexity levels.

**Detection:**
- Select 5+ pages of formatted text, trigger Scribe. If nothing happens, check browser console for cozy-bridge size validation errors.
- Add logging: `console.log("[Scribe] payload size:", JSON.stringify(data).length)` in `castIntent`

**Phase to address:** Phase 1 (size validation) and Phase 2 (compact format design).

**Confidence:** HIGH -- the 1MB limit is in the existing codebase; HTML verbosity is well-known.

---

### Pitfall 9: Markdown Preview Re-renders Entire Document on Each LLM Token (Streaming)

**What goes wrong:**
The result panel uses react-markdown to render the LLM's Markdown output. During streaming (if/when streaming is added), each new token triggers a full re-render of the entire Markdown tree. With a 500-word response, the final tokens cause react-markdown to parse and render the full 500-word Markdown document 50+ times per second. The UI freezes, the browser tab becomes unresponsive.

**Why it happens:**
react-markdown parses the entire input string on every render. It builds a full AST (using remark), transforms it (using rehype), and renders it to React elements. There is no incremental parsing -- even a single new character causes a full re-parse.

react-markdown bundle size: ~42.6KB min+gzip (core), ~60KB with rehype-raw. For a writing assistant in an already-heavy OO editor page, this is significant but not prohibitive.

**Consequences:**
- UI jank during streaming (browser uses 100% CPU on Markdown parsing)
- OO editor iframe becomes unresponsive (shares the main thread)
- Users think the editor is frozen/crashed

**Prevention:**

1. **For v2.1 (non-streaming), this is less critical.** The full LLM response arrives at once, react-markdown renders once. Performance is fine for responses under ~2000 words.

2. **If/when streaming is added, use the token-batching approach from v2.0 pitfalls research:**
   - Accumulate tokens in a ref
   - Flush to state every 100-200ms (not every token)
   - During streaming, render plain text (not Markdown) for the in-progress content
   - Only render as Markdown after streaming completes (or after a pause of 500ms+)

3. **Use React.memo on the Markdown renderer component** to prevent re-renders from parent state changes that do not affect the Markdown content.

4. **Consider lighter alternatives to react-markdown:**
   - `marked` (parse to HTML string) + `dangerouslySetInnerHTML` -- faster but loses React component benefits and requires HTML sanitization
   - A simple custom renderer for the limited Markdown subset (bold, italic, headings, lists) -- much smaller bundle, much faster parsing
   - `micromark` -- smaller and faster than remark for simple Markdown

5. **Lazy-load the Markdown renderer.** Use `React.lazy()` + `Suspense` so the Markdown parsing library is not loaded until the user actually triggers Scribe and receives a result.

**Detection:**
- Open Chrome DevTools Performance tab, trigger a Scribe action with a long response, check for long tasks during rendering
- Monitor `performance.now()` before and after Markdown render -- if > 16ms, it will cause visible jank

**Phase to address:** Phase 3 (Markdown preview rendering). Less critical for non-streaming v2.1, more critical if streaming is added later.

**Confidence:** MEDIUM -- react-markdown performance is well-documented, but v2.1 is non-streaming so the severity depends on future streaming plans.

---

### Pitfall 10: PasteHtml vs InsertContent: Choosing the Wrong Reinsertion API

**What goes wrong:**
The developer uses `PasteHtml` for all reinsertion because it accepts HTML strings directly. Some formatting works, some does not. Alternatively, the developer uses `InsertContent` with Document Builder objects for everything, which is verbose and error-prone for complex formatting.

**Why it happens:**
OO provides two reinsertion paths, each with tradeoffs:

| Aspect | PasteHtml | InsertContent (Document Builder) |
|--------|-----------|----------------------------------|
| Input format | HTML string | Array of ApiParagraph objects |
| Bold/italic | Works (via `<strong>`, `<em>`) | Works (via ApiRun.SetBold()) |
| Headings | Works (via `<h1>`-`<h6>`) | Works (via ApiParagraph.SetStyle()) |
| Ordered lists | **BROKEN** (bug #79263) | Works (via CreateNumbering()) |
| Tables | Mostly works | Complex but reliable |
| Links | Works (via `<a href>`) | Works (via ApiHyperlink) |
| Undo support | Single undo step | Single undo step |
| Code simplicity | Simple (just pass HTML) | Complex (build object tree) |
| ES5 constraint | N/A (called from plugin iframe) | Must use ES5 inside callCommand |

**Consequences:**
- Using only PasteHtml: ordered lists are broken, some edge cases fail
- Using only InsertContent: excessive complexity, harder to maintain, more bugs
- Mixing both without clear rules: inconsistent behavior, harder to debug

**Prevention:**

1. **Use a hybrid approach with clear rules:**
   - PasteHtml for: paragraphs with inline formatting (bold, italic, underline, links)
   - InsertContent for: ordered lists, headings with specific styles, tables with complex structure
   - Decision point: if the HTML contains `<ol>`, route through InsertContent path

2. **Validate PasteHtml behavior for each supported formatting type** in your OO version (9.3.0-138) before building the full pipeline. Create a test matrix:
   - `<strong>` bold
   - `<em>` italic
   - `<h1>` through `<h6>` headings
   - `<ul><li>` unordered lists
   - `<ol><li>` ordered lists
   - `<a href>` links
   - `<table>` simple tables

3. **Wrap the reinsertion in a single function** that chooses the right API based on content analysis:
   ```javascript
   function insertFormattedContent(html) {
     if (hasOrderedLists(html) || hasComplexTables(html)) {
       return insertViaDocumentBuilder(html)
     }
     return insertViaPasteHtml(html)
   }
   ```

**Detection:**
- Build the PasteHtml test matrix in Phase 1. Any cell that fails = needs InsertContent fallback.

**Phase to address:** Phase 1 (API validation), Phase 3 (reinsertion implementation).

**Confidence:** HIGH -- the PasteHtml bug is confirmed; the InsertContent API is documented.

---

## Minor Pitfalls

Issues that cause friction or minor bugs but are easily fixable.

---

### Pitfall 11: Turndown Drops Empty Paragraphs and Whitespace

**What goes wrong:**
OO HTML contains empty paragraphs (`<p>&nbsp;</p>` or `<p><br/></p>`) used as spacing between sections. Turndown strips these during conversion, collapsing the document's visual structure. After the LLM round-trip, spacing between sections disappears.

**Prevention:**
- Configure Turndown to preserve blank lines: `turndownService.addRule('blankParagraph', { filter: ... })`
- Or normalize spacing after conversion: ensure double newlines between paragraphs
- Test with a document that uses empty paragraphs for spacing (common in business documents)

**Phase to address:** Phase 2 (conversion pipeline).

---

### Pitfall 12: `dangerouslySetInnerHTML` for Markdown Preview Creates XSS Vector

**What goes wrong:**
The developer renders LLM Markdown output by converting to HTML with `marked` and inserting via `dangerouslySetInnerHTML`. The LLM output (or a prompt injection attack via the source document) contains `<script>` tags or `onerror` handlers that execute in the Cozy Drive context.

**Prevention:**
- Use react-markdown (renders via React elements, inherently safe) instead of `dangerouslySetInnerHTML`
- If using `dangerouslySetInnerHTML`, sanitize with DOMPurify: `DOMPurify.sanitize(html, { ALLOWED_TAGS: ['strong', 'em', 'h1', ...] })`
- Never trust LLM output as safe HTML

**Phase to address:** Phase 3 (preview rendering). Non-negotiable security requirement.

---

### Pitfall 13: Heading Detection Heuristic Produces False Positives

**What goes wrong:**
The HTML normalizer (Pitfall 2 prevention) detects "heading-like" paragraphs by font-size threshold (e.g., font-size > 14pt = heading). A user's document has 14pt body text with 18pt emphasis -- the normalizer incorrectly converts emphasis to headings, which the LLM then treats as section headers.

**Prevention:**
- Use relative size comparisons (significantly larger than surrounding text), not absolute thresholds
- Only detect headings that are alone on their paragraph (a paragraph with mixed sizes is not a heading)
- Consider using OO's internal paragraph styles if accessible via the Document Builder API (`ApiParagraph.GetStyle()`) rather than heuristic font-size analysis
- Allow users to disable heading detection if it produces false positives

**Phase to address:** Phase 2 (normalizer design).

---

### Pitfall 14: Right-to-Left (RTL) Text Direction Lost in Markdown

**What goes wrong:**
Users with Arabic (`ar`) language locale select RTL text. The HTML contains `dir="rtl"` or `direction: rtl` styles. Markdown has no concept of text direction. After round-trip, the text is inserted as LTR, breaking layout for RTL users.

**Prevention:**
- Detect RTL direction in the source HTML and preserve it as metadata alongside the Markdown
- Re-apply direction during reinsertion (set on the paragraph level via Document Builder or as HTML attribute via PasteHtml)
- Test with Arabic text selection (listed in LANG_NAMES in scribeActions.js)

**Phase to address:** Phase 3 (edge case handling). Lower priority if Arabic users are a small percentage.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| API exploration / go-no-go | `initDataType: "html"` may not work with background plugin (Pitfall 1) | 10-minute test, first task of Phase 1 |
| API exploration / go-no-go | PasteHtml ordered list bug (Pitfall 3) | Test PasteHtml with `<ol>` in target OO version |
| HTML extraction | OO HTML is inline-style soup, not semantic (Pitfall 2) | Build normalizer against real OO output |
| Extraction architecture | callCommand sandbox blocks library usage (Pitfall 6) | Run conversion in Cozy Drive, not plugin |
| Plugin code | ES5 blocks modern libraries (Pitfall 7) | Keep plugin thin, do conversion in React |
| postMessage payloads | HTML payloads may exceed 1MB limit (Pitfall 8) | Use compact JSON format, increase limit |
| Conversion pipeline | Markdown lossy for tables, merged cells (Pitfall 5) | Define supported subset, graceful degradation |
| LLM prompts | LLM corrupts Markdown structure (Pitfall 4) | Format-aware system prompt, output validation |
| Reinsertion | PasteHtml vs InsertContent choice (Pitfall 10) | Hybrid approach based on content analysis |
| Preview rendering | react-markdown size and streaming perf (Pitfall 9) | Lazy load, memo, plain text during stream |
| Preview rendering | XSS via LLM output (Pitfall 12) | Use react-markdown, not dangerouslySetInnerHTML |
| Edge cases | RTL text direction, empty paragraphs (Pitfalls 14, 11) | Phase 3 polish |

---

## "Looks Done But Isn't" Checklist for v2.1

- [ ] **Bold round-trip**: Select bold text, run "Correct Grammar." Verify the result is still bold after insertion.
- [ ] **Mixed formatting**: Select a paragraph with bold, italic, and a link. Run "Change Tone." Verify all three formatting types survive.
- [ ] **Heading preservation**: Select an H2 heading, run "Translate." Verify it is still an H2 after insertion, not a plain paragraph.
- [ ] **Ordered list**: Select a numbered list (1-5 items). Run any action. Verify numbering is correct (1, 2, 3, 4, 5 -- not 1, 1, 1, 1, 1).
- [ ] **Table**: Select a simple 3x3 table. Run "Improve." Verify the table structure is preserved.
- [ ] **Large selection**: Select 3+ pages of formatted text. Verify no postMessage size errors, no UI freeze.
- [ ] **Plain text fallback**: Select text with no formatting. Verify the feature still works (no regression from v2.0 behavior).
- [ ] **Preview rendering**: Verify Markdown preview shows bold as bold, headings as headings, lists as lists.
- [ ] **LLM formatting fidelity**: Run 10 operations on formatted text. Count how many preserve formatting correctly. Target: 8/10 minimum.
- [ ] **Empty paragraphs**: Select text with blank lines between paragraphs. Verify spacing is preserved after round-trip.

---

## Sources

- [OnlyOffice GetSelectedText API](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/GetSelectedText/) -- HIGH confidence (official docs)
- [OnlyOffice Plugin Configuration (initDataType)](https://api.onlyoffice.com/docs/plugin-and-macros/structure/configuration/) -- HIGH confidence (official docs)
- [OnlyOffice Get and Paste HTML Plugin Example](https://api.onlyoffice.com/samples/docs/plugin-and-macros/plugin-samples/get-and-paste-html/) -- HIGH confidence (official example)
- [OnlyOffice Plugin Types](https://api.onlyoffice.com/docs/plugin-and-macros/structure/configuration/types/) -- HIGH confidence (official docs)
- [OnlyOffice PasteHtml API](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/PasteHtml/) -- HIGH confidence (official docs)
- [Best Practices for Retaining Formatting When Pasting AI Responses in OnlyOffice](https://community.onlyoffice.com/t/best-practices-for-retaining-formatting-when-pasting-ai-responses-in-onlyoffice/12811) -- HIGH confidence (official community forum, OO team responses, bug #79263 confirmed)
- [GetSelectedText HTML Format Discussion](https://community.onlyoffice.com/t/getselectedtext-html-format-paste-via-context-menu/8733) -- HIGH confidence (official community, `initDataType: "html"` recommended by OO team)
- [Turndown HTML-to-Markdown Converter](https://github.com/mixmark-io/turndown) -- HIGH confidence (official repo)
- [react-markdown Bundle Size](https://bundlephobia.com/package/react-markdown) -- HIGH confidence (official bundlephobia)
- [react-markdown Performance Discussion](https://github.com/orgs/remarkjs/discussions/1027) -- MEDIUM confidence (community discussion)
- [Why Can't AI Models Output Clean Markdown?](https://medium.com/@CultmanSachs/why-cant-ai-models-output-clean-markdown-a-technical-mess-that-still-isn-t-fixed-1dc70ff366a3) -- MEDIUM confidence (community analysis)
- [OnlyOffice Text Extraction Sample](https://api.onlyoffice.com/docs/office-api/samples/text-document-editor/extracting-text-from-document/) -- HIGH confidence (official docs)
- [OnlyOffice InsertContent API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/InsertContent/) -- HIGH confidence (official docs)
- cozy-drive source: `plugins/onlyoffice-scribe/`, `src/lib/cozy-bridge/protocol.js`, `src/modules/views/OnlyOffice/Scribe/` -- HIGH confidence (direct code analysis)

---
*Pitfalls research for: Rich text formatting preservation in Scribe v2.1 (Cozy Drive + OnlyOffice)*
*Researched: 2026-03-06*
