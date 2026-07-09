# Phase 18: Token Pipeline + Minimal Builder Injection - Research

**Researched:** 2026-03-16
**Domain:** Markdown tokenization via marked.lexer(), Asc.scope token serialization, OO Document Builder API content construction (ES5 callCommand)
**Confidence:** HIGH

## Summary

Phase 18 proves the "parse outside, build inside" architecture end-to-end. The plugin iframe uses `marked.lexer()` (bundled UMD, 42KB) to tokenize the LLM's Markdown output into a structured token array. This array is serialized through `Asc.scope` to a single `callCommand`, where an ES5 interpreter walks the tokens and emits Builder API calls (`Api.CreateParagraph()`, `Api.CreateRun()`, `run.SetBold()`, `run.SetItalic()`, `doc.InsertContent()`). The scope is deliberately minimal: paragraphs + bold + italic + bold-italic only. No headings, no lists, no tables, no format snapshot, no post-injection selection. The PasteHtml fallback must be preserved for any Builder API failure.

The critical interface boundary is between React (View.jsx) and the plugin: View.jsx must send raw Markdown text (not HTML) to the plugin when the Builder API path is active, satisfying PARSE-03. The plugin then owns the entire tokenize-serialize-interpret-inject pipeline. The existing `pasteHtml()` function remains as fallback, triggered when the new path fails or when the response lacks markdown data.

**Primary recommendation:** Bundle `marked.umd.js` as a script tag in the plugin's `index.html`. Use `marked.lexer()` in plugin iframe context to tokenize. Flatten the nested token tree into a simple array of `{type, text, bold, italic}` run descriptors grouped by paragraph before passing through `Asc.scope`. Keep the callCommand interpreter under 80 lines of ES5.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PARSE-01 | Plugin OO parse le Markdown retourne par le LLM via marked (bundle dans code.js) et produit des tokens structures | `marked.lexer()` produces structured token tree; UMD bundle (42KB) loadable via script tag in plugin index.html; token types: paragraph, strong, em, text, space |
| PARSE-02 | Les tokens sont passes via Asc.scope a callCommand qui les interprete en appels Document Builder API | Asc.scope accepts JSON-serializable arrays; flatten marked tokens to simple run descriptors `[{type:"paragraph",runs:[{text,bold,italic}]}]`; interpreter creates ApiParagraph + ApiRun per token |
| PARSE-03 | L'interface entre Scribe (React) et le plugin reste du Markdown brut | View.jsx sends `{text, md}` instead of `{text, html}` in response payload; plugin detects `md` field to route to Builder API path; no token format leaks to React |
| INL-01 | Le texte gras, italique et gras+italique est injecte avec le formatage OO correspondant | `run.SetBold(true)` for strong tokens, `run.SetItalic(true)` for em tokens; marked tokenizes `***text***` as nested em>strong -- interpreter must walk children recursively to detect combined formatting |
| BLK-01 | Les paragraphes multiples sont injectes comme des paragraphes OO separes | Each `{type:"paragraph"}` token becomes a separate `Api.CreateParagraph()` call; `{type:"space"}` tokens between paragraphs are implicit separators (no action needed); `doc.InsertContent(contentArray)` inserts all paragraphs as distinct OO elements |
| INJ-01 | Toute l'injection se fait en un seul callCommand (un seul point d'undo Ctrl+Z) | All Builder API calls (CreateParagraph, CreateRun, SetBold, SetItalic, InsertContent) execute inside a single `callCommand` function body; this guarantees one undo point |
</phase_requirements>

## Standard Stack

### Core (already available -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| marked | 17.0.4 | Markdown tokenization via `marked.lexer()` | Already installed for React-side HTML conversion; UMD bundle available for plugin iframe |
| OO Document Builder API | (built into OO 9.3.0-138) | Content construction inside callCommand | Native API: Api.CreateParagraph, Api.CreateRun, doc.InsertContent |

### Supporting (already in place)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| marked (React side) | 17.0.4 | `markdownToHtml()` for preview panel | Unchanged -- preview still uses HTML rendering via react-markdown |
| Asc.scope | OO Plugin API | JSON data bridge between plugin iframe and callCommand sandbox | Pass flattened token array from plugin to callCommand |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| marked.lexer() in plugin iframe | Custom ES5 regex parser inside callCommand | Custom parser is ~150-250 lines of fragile ES5; marked is battle-tested, handles LLM quirks (nested emphasis, edge cases), and runs in the plugin iframe where modern JS is available |
| marked.lexer() in plugin iframe | Parse inside callCommand with marked bundled there | callCommand sandbox is isolated -- cannot load external scripts; marked uses modern JS internally |
| Flat run descriptors via Asc.scope | Pass raw marked token tree via Asc.scope | marked tokens have deep nesting (em>strong>text), circular-like `links` property; flattening before Asc.scope is safer and simplifies the ES5 interpreter |

**No installation needed.** marked is already in node_modules. The UMD bundle needs to be added as a script tag in the plugin's `index.html`.

## Architecture Patterns

### Recommended Data Flow

```
View.jsx                         Plugin iframe (code.js)           callCommand sandbox
                                                                   (ES5 only)
User clicks Replace/Insert
  |
  v
respond({                        handleIntentResponse()
  status:'ok',                     |
  action:'replace',                v
  data: {                        if (msg.data.md) {
    text: resultText,              // NEW: Builder API path
    md: resultText                 var tokens = marked.lexer(md)
  }                                var flat = flattenTokens(tokens)
})                                 Asc.scope.tokens = JSON.stringify(flat)
                                   Asc.scope._mode = msg.action
                                   pasteInProgress = true
                                   stopHidePolling()
                                   |
                                   v
                                 callCommand(function() {       ------>  var tokens = JSON.parse(
                                                                           Asc.scope.tokens)
                                                                         var doc = Api.GetDocument()
                                                                         var content = []
                                                                         // walk tokens, build content
                                                                         for (...) {
                                                                           var p = Api.CreateParagraph()
                                                                           for each run:
                                                                             var r = Api.CreateRun()
                                                                             r.AddText(run.text)
                                                                             if (run.bold) r.SetBold(true)
                                                                             if (run.italic) r.SetItalic(true)
                                                                             p.AddElement(r)
                                                                           content.push(p)
                                                                         }
                                                                         doc.InsertContent(content)
                                 callback: pasteInProgress=false
                                 }
                                 } else if (msg.data.html) {
                                   // FALLBACK: existing PasteHtml path
                                   pasteHtml(msg.data.html, ...)
                                 }
```

### Token Flattening Strategy

marked.lexer() produces deeply nested tokens. The interpreter inside callCommand needs a simple flat structure. Flatten OUTSIDE callCommand (in plugin iframe, modern JS) before passing via Asc.scope.

**marked.lexer() output for `"**bold** and *italic* and ***both***"`:**
```javascript
[{
  type: "paragraph",
  tokens: [
    { type: "strong", tokens: [{ type: "text", text: "bold" }] },
    { type: "text", text: " and " },
    { type: "em", tokens: [{ type: "text", text: "italic" }] },
    { type: "text", text: " and " },
    { type: "em", tokens: [
      { type: "strong", tokens: [
        { type: "text", text: "both" }
      ]}
    ]}
  ]
}]
```

**Flattened output (what goes into Asc.scope):**
```javascript
[{
  type: "paragraph",
  runs: [
    { text: "bold", bold: true, italic: false },
    { text: " and ", bold: false, italic: false },
    { text: "italic", bold: false, italic: true },
    { text: " and ", bold: false, italic: false },
    { text: "both", bold: true, italic: true }
  ]
}]
```

The flattener recursively walks the marked token tree, tracking bold/italic state inherited from ancestor nodes (em wrapping strong means italic+bold). This runs in the plugin iframe with full JS access, not in callCommand.

### Key Design Decisions

**1. marked bundled in plugin iframe, NOT in callCommand**
- callCommand cannot load external scripts
- The plugin iframe is a full browser context that can load marked.umd.js via script tag
- marked.lexer() runs in plugin iframe, output flattened, then serialized to Asc.scope

**2. Flat token format, NOT raw marked tree through Asc.scope**
- marked tokens contain a `links` property on the root array (not plain JSON)
- Nesting depth varies (em>strong>text for bold+italic)
- Flat format makes the ES5 interpreter trivially simple (no recursion needed inside callCommand)

**3. View.jsx sends `md` field, NOT `html` field, for Builder path**
- Currently: View.jsx calls `markdownToHtml(text)` and sends `{text, html}`
- New: View.jsx sends `{text, md: text}` -- the text IS the markdown
- Plugin detects `md` field -> Builder path; `html` field -> PasteHtml fallback
- Both `md` and `html` can be sent simultaneously for graceful fallback

**4. PasteHtml fallback: try-catch around Builder path**
- If Builder injection throws or fails, fall back to PasteHtml with `html` field
- View.jsx should send BOTH `md` and `html` fields so the plugin has fallback data
- This means View.jsx still calls `markdownToHtml()` -- it is NOT removed yet

### Files to Modify

| File | Change | LOC Estimate |
|------|--------|-------------|
| `plugins/onlyoffice-scribe/index.html` | Add `<script>` tag for marked.umd.js | 1 |
| `plugins/onlyoffice-scribe/scripts/code.js` | Add `flattenTokens()`, `buildAndInject()`, modify `handleIntentResponse()` | ~100-120 |
| `src/modules/views/OnlyOffice/View.jsx` | Add `md` field to response payload (keep `html` for fallback) | ~4 |

### Files NOT Modified

| File | Reason |
|------|--------|
| `ScribePopover.jsx` | Already passes `result.text` to onReplace/onInsert -- no change needed |
| `useCozyBridge.js` | Protocol unchanged -- response format is additive (new `md` field) |
| `scribeConversion.js` | Still needed for preview panel and fallback HTML generation |

### Recommended Project Structure (new code in code.js)

```
code.js additions:
  flattenTokens(markedTokens)    // Plugin iframe context (modern JS OK)
    -> walks marked.lexer() output
    -> produces [{type:"paragraph", runs:[{text,bold,italic}]}]

  buildAndInject(md, mode)       // Entry point for Builder API path
    -> calls marked.lexer(md) in plugin context
    -> calls flattenTokens(tokens)
    -> sets Asc.scope.tokens, Asc.scope._mode
    -> sets pasteInProgress = true, stopHidePolling()
    -> callCommand: ES5 interpreter reads tokens, builds content, InsertContent
    -> callback: pasteInProgress = false

  handleIntentResponse(msg)      // MODIFIED
    -> if (msg.data.md): try buildAndInject(md, mode)
                          catch: fallback to pasteHtml(msg.data.html, mode)
    -> else if (msg.data.html): pasteHtml(html, mode) [existing]
    -> else: PasteText fallback [existing]
```

### Anti-Patterns to Avoid

- **Do NOT parse markdown inside callCommand.** callCommand is an isolated ES5 sandbox with no access to marked or any library. Parse in the plugin iframe, flatten, serialize via Asc.scope.
- **Do NOT pass the raw marked token tree through Asc.scope.** The `links` property on the root array and deep nesting make serialization fragile. Flatten first.
- **Do NOT use `paragraph.AddText()` for mixed-format paragraphs.** AddText creates a single run -- you cannot apply bold to part of it. Always use `Api.CreateRun()` for each formatting span.
- **Do NOT remove the PasteHtml code path.** Keep it as fallback throughout Phase 18-20.
- **Do NOT use ES6 syntax inside the callCommand function body.** No const/let, no arrow functions, no template literals, no destructuring, no for...of.
- **Do NOT split Builder API content creation across multiple callCommand calls.** One callCommand = one undo point.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown tokenization | Custom ES5 regex parser | `marked.lexer()` (42KB UMD bundle) | marked handles edge cases (nested emphasis, LLM quirks, escapes) that a hand-rolled parser would miss; it's already a project dependency |
| Token flattening | N/A -- must be custom | `flattenTokens()` in plugin iframe | Simple recursive walk (~30 lines); no library needed; runs in modern JS context |
| Builder API calls | N/A -- must be custom | ES5 interpreter in callCommand | ~50-60 lines of ES5 for Phase 18 scope (paragraphs + bold/italic only) |
| HTML generation for fallback | Custom HTML builder | `markdownToHtml()` via marked.parse() | Already working in View.jsx, keep for fallback |

## Common Pitfalls

### Pitfall 1: marked.lexer() Tokenizes `***text***` as Nested em > strong, Not a Single Token
**What goes wrong:** The interpreter expects a `{type: "bold_italic"}` token but marked produces `{type: "em", tokens: [{type: "strong", tokens: [{type: "text", text: "both"}]}]}`. Bold+italic text gets only italic or only bold.
**Why it happens:** marked's token tree represents emphasis nesting, not combined formatting. `***text***` is em wrapping strong.
**How to avoid:** The `flattenTokens()` function must track inherited formatting state. When walking children of an `em` node, set italic=true in the context. When walking children of a `strong` node, set bold=true. Text leaf nodes inherit both flags from their ancestor chain.
**Warning signs:** Bold+italic text appears as only italic in the document.

### Pitfall 2: Asc.scope.tokens Contains Unserializable Data
**What goes wrong:** `Asc.scope.tokens` arrives as `undefined` inside callCommand. The Builder path fails silently, no content injected.
**Why it happens:** Raw marked tokens have a `links` property on the root array (non-standard array property) and potentially non-serializable values. Also, forgetting `JSON.stringify()` means Asc.scope does structured clone which may fail on edge cases.
**How to avoid:** Always `JSON.stringify()` the flattened token array before assigning to `Asc.scope`. Inside callCommand, always `JSON.parse()`. The flattened format contains only plain objects with string/boolean primitives -- guaranteed serializable.
**Warning signs:** callCommand callback fires immediately; `Asc.scope.tokens` is `undefined` inside.

### Pitfall 3: callCommand Interpreter Uses ES6 Syntax
**What goes wrong:** The interpreter works in local dev (newer V8) but fails in the OO web editor sandbox. Content is not inserted, no error visible.
**Why it happens:** Easy to slip into `const`, `let`, arrow functions, `for...of`, or template literals when writing 50+ lines of loop logic.
**How to avoid:** Write the interpreter function body separately. Review every line for ES5 compliance. Common traps: `const` in loop headers, `Array.includes()` (use `indexOf !== -1`), `Object.keys().forEach()` (use for-in loop).
**Warning signs:** Works locally but not in production OO; callCommand silently does nothing.

### Pitfall 4: Insert Mode Doesn't Collapse Cursor Before InsertContent
**What goes wrong:** In "insert after" mode, `InsertContent` replaces the selection instead of inserting after it. The original selected text disappears.
**Why it happens:** `InsertContent` replaces the current selection. For insert-after, the cursor must first be collapsed to the end of the selection, just like the existing `pasteHtml()` does (code.js lines 112-126).
**How to avoid:** For insert mode, add cursor collapsing logic at the start of callCommand: `var range = doc.GetRangeBySelect(); var end = doc.GetRange(range.GetEndPos(), range.GetEndPos()); end.Select();`
**Warning signs:** "Insert After" deletes the original selected text.

### Pitfall 5: PasteHtml Fallback Not Triggered on Builder Failure
**What goes wrong:** Builder API throws inside callCommand (e.g., unexpected token type), but the error is swallowed by the sandbox. The user clicks Replace/Insert and nothing happens -- no content injected.
**Why it happens:** callCommand errors are silent in some OO versions. The callback may fire with undefined result, or may not fire at all.
**How to avoid:** Use a timeout-based fallback: if the callCommand callback doesn't fire within 5 seconds, trigger PasteHtml. Also, View.jsx must send BOTH `md` and `html` fields so the plugin has fallback data available.
**Warning signs:** User clicks Replace, nothing happens, no console error.

### Pitfall 6: pasteInProgress Guard Not Set for Builder Path
**What goes wrong:** During callCommand execution, OO fires `init()` with new selection data, resetting `lastSelectedText`. The next Scribe operation uses stale data.
**Why it happens:** The existing guard pattern in `pasteHtml()` (lines 97-98) must be replicated for the Builder path.
**How to avoid:** Set `pasteInProgress = true` and call `stopHidePolling()` before the callCommand. Reset in the callback. Copy the exact same pattern from `pasteHtml()`.
**Warning signs:** Console shows "[Scribe] init() called" during injection; subsequent operations fail.

## Code Examples

### Loading marked in plugin iframe

```html
<!-- plugins/onlyoffice-scribe/index.html -->
<body>
  <script type="text/javascript"
    src="https://onlyoffice.github.io/sdkjs-plugins/v1/plugins.js">
  </script>
  <script type="text/javascript" src="vendor/marked.umd.js"></script>
  <script type="text/javascript" src="scripts/code.js"></script>
</body>
```

The `marked.umd.js` file (42KB) is copied from `node_modules/marked/lib/marked.umd.js` to `plugins/onlyoffice-scribe/vendor/`. It exposes `window.marked` as a global.

### flattenTokens() -- Plugin iframe context (modern JS OK)

```javascript
// Source: Verified against marked v17.0.4 lexer output
function flattenTokens(markedTokens) {
  var blocks = [];

  function flattenInline(tokens, parentBold, parentItalic) {
    var runs = [];
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      if (tok.type === "text") {
        runs.push({ text: tok.text, bold: !!parentBold, italic: !!parentItalic });
      } else if (tok.type === "strong") {
        var childRuns = flattenInline(tok.tokens, true, parentItalic);
        runs = runs.concat(childRuns);
      } else if (tok.type === "em") {
        var childRuns2 = flattenInline(tok.tokens, parentBold, true);
        runs = runs.concat(childRuns2);
      } else if (tok.tokens) {
        // Other token types with children -- pass through
        var childRuns3 = flattenInline(tok.tokens, parentBold, parentItalic);
        runs = runs.concat(childRuns3);
      } else if (tok.text) {
        // Leaf token without children
        runs.push({ text: tok.text, bold: !!parentBold, italic: !!parentItalic });
      }
    }
    return runs;
  }

  for (var i = 0; i < markedTokens.length; i++) {
    var block = markedTokens[i];
    if (block.type === "paragraph") {
      blocks.push({
        type: "paragraph",
        runs: flattenInline(block.tokens || [], false, false)
      });
    } else if (block.type === "space") {
      // Paragraph separator -- no action needed (implicit between paragraph blocks)
    }
    // Phase 18: ignore heading, list, table, code, etc. -- treated as paragraph fallback
    // Future phases will handle these block types
  }

  return blocks;
}
```

### callCommand interpreter -- ES5 inside callCommand

```javascript
// Source: OO Builder API docs (ApiParagraph, ApiRun, InsertContent)
// ES5 ONLY -- runs in callCommand sandbox
window.Asc.plugin.callCommand(function() {
  var tokensJson = Asc.scope.tokens;
  var mode = Asc.scope._mode;
  if (!tokensJson) return;

  var blocks = JSON.parse(tokensJson);
  var doc = Api.GetDocument();

  // For insert mode: collapse cursor to end of selection
  if (mode === "insert") {
    var range = doc.GetRangeBySelect();
    if (range) {
      var endPos = range.GetEndPos();
      var endRange = doc.GetRange(endPos, endPos);
      if (endRange) endRange.Select();
    }
  }

  var content = [];
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    if (block.type === "paragraph") {
      var p = Api.CreateParagraph();
      var runs = block.runs || [];
      for (var j = 0; j < runs.length; j++) {
        var run = runs[j];
        var r = Api.CreateRun();
        r.AddText(run.text);
        if (run.bold) r.SetBold(true);
        if (run.italic) r.SetItalic(true);
        p.AddElement(r);
      }
      content.push(p);
    }
  }

  if (content.length > 0) {
    doc.InsertContent(content);
  }
}, false, false, function() {
  pasteInProgress = false;
});
```

### View.jsx modification -- Send both md and html

```javascript
// Source: existing View.jsx handleReplace pattern + PARSE-03 requirement
const handleReplace = useCallback(
  text => {
    const html = unwrapSingleParagraph(markdownToHtml(text).trim())
    respond({ status: 'ok', action: 'replace', data: { text, html, md: text } })
    setTimeout(focusEditor, 100)
  },
  [respond, focusEditor]
)

const handleInsert = useCallback(
  text => {
    const html = unwrapSingleParagraph(markdownToHtml(text).trim())
    respond({ status: 'ok', action: 'insert', data: { text, html, md: text } })
    setTimeout(focusEditor, 100)
  },
  [respond, focusEditor]
)
```

### handleIntentResponse modification with fallback

```javascript
// ES5 -- plugin code.js
function handleIntentResponse(msg) {
  if (msg.action === "replace" || msg.action === "insert") {
    if (msg.data && msg.data.md) {
      // NEW: Builder API path with PasteHtml fallback
      try {
        buildAndInject(msg.data.md, msg.action, msg.data.html);
      } catch (e) {
        log("Builder injection failed: " + e.message + " -- falling back to PasteHtml");
        if (msg.data.html) {
          pasteHtml(msg.data.html, msg.action);
        } else {
          window.Asc.plugin.executeMethod("PasteText", [msg.data.text]);
        }
      }
    } else if (msg.data && msg.data.html) {
      // EXISTING: PasteHtml path
      pasteHtml(msg.data.html, msg.action);
    } else {
      // EXISTING: Plain text fallback
      if (msg.action === "replace") {
        window.Asc.plugin.executeMethod("PasteText", [msg.data.text]);
      } else {
        insertAfterWithText(msg.data.text);
      }
    }
  } else if (msg.action === "cancel") {
    log("Intent cancelled -- no document modification");
  }
}
```

## State of the Art

| Old Approach (v2.1-v2.3) | New Approach (Phase 18) | Impact |
|---------------------------|-------------------------|--------|
| View.jsx converts MD to HTML, sends `{text, html}` | View.jsx sends `{text, html, md}` -- md is raw markdown | Plugin can choose Builder or PasteHtml path |
| Plugin calls PasteHtml (black box, no element control) | Plugin tokenizes MD, builds paragraphs+runs via Builder API | Per-element formatting control, single undo point |
| All MD parsing in React side (marked.parse) | MD tokenization in plugin iframe (marked.lexer) | Plugin owns injection pipeline end-to-end |
| No MD library in plugin | marked.umd.js bundled in plugin (42KB) | Enables marked.lexer() in plugin context |

## Open Questions

1. **marked.umd.js loading in OO plugin context**
   - What we know: OO plugins load JS via script tags in index.html; the UMD bundle exposes `window.marked`
   - What's unclear: Whether OO's plugin iframe CSP allows loading local vendor scripts (the existing plugins.js loads from onlyoffice.github.io)
   - Recommendation: Test immediately. If CSP blocks it, use inline script (copy marked.umd.js content into index.html) or load from the same relative path as code.js

2. **Asc.scope payload size for realistic token arrays**
   - What we know: Small strings/arrays work fine (proven in existing code); token arrays for typical Scribe use (1-5 paragraphs) should be <5KB JSON
   - What's unclear: Upper limit before Asc.scope silently drops data
   - Recommendation: Test with a 50-paragraph markdown payload early. If failures occur above a threshold, add size checking and fall back to PasteHtml for large content

3. **callCommand timeout for many Builder API calls**
   - What we know: Typical Scribe results are 1-5 paragraphs with a few formatted runs each (~10-30 Builder API calls total)
   - What's unclear: Whether 50+ Builder API calls in one callCommand cause a timeout or UI freeze
   - Recommendation: Not a concern for Phase 18 scope (minimal formatting). Monitor in later phases when content grows more complex.

4. **marked.lexer() handling of escaped markdown in LLM output**
   - What we know: marked handles standard escapes correctly; LLM output may contain raw HTML entities or non-standard escapes
   - What's unclear: Edge cases with emojis, Unicode, or HTML entities in LLM output
   - Recommendation: Test with real Scribe AI responses during implementation. The flattenTokens function should gracefully handle unknown token types by extracting text content.

## Sources

### Primary (HIGH confidence)
- `marked` v17.0.4 lexer API -- empirically verified by running `marked.lexer()` against test inputs; token format: `{type, raw, text, tokens}` with nesting for strong/em
- `marked.umd.js` -- 42,466 bytes; exports `window.marked` with `.lexer()` method; path: `node_modules/marked/lib/marked.umd.js`
- [OO ApiParagraph.AddElement](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/) -- adds ApiRun to paragraph
- [OO ApiRun.SetBold/SetItalic](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRun/) -- per-run formatting
- [OO ApiDocument.InsertContent](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/InsertContent/) -- inserts array of document elements at cursor/selection
- [OO callCommand docs](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/) -- ES5 sandbox, Asc.scope bridge, callback protocol
- Existing `plugins/onlyoffice-scribe/scripts/code.js` -- pasteHtml() pattern, pasteInProgress guard, insert mode cursor collapsing

### Secondary (MEDIUM confidence)
- [marked.js Using Pro documentation](https://marked.js.org/using_pro) -- lexer API description
- [marked lexer DeepWiki](https://deepwiki.com/markedjs/marked/2.1-lexer-and-tokenizer) -- tokenization process details
- `.planning/research/ARCHITECTURE.md` -- parse-outside-build-inside architecture, format snapshot strategy
- `.planning/research/STACK.md` -- Builder API method reference, full API surface
- `.planning/research/PITFALLS.md` -- ES5 constraint, Asc.scope limits, single undo point requirement

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- marked already installed (v17.0.4), UMD bundle verified (42KB), lexer output empirically tested
- Architecture: HIGH -- parse-outside-build-inside is a locked decision; data flow clear; flattenTokens design validated against real marked output
- Pitfalls: HIGH -- grounded in existing code analysis, confirmed OO constraints, and project memory
- Token format: HIGH -- empirically verified by running marked.lexer() with representative markdown inputs

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- marked version pinned, OO API stable, architecture locked)
