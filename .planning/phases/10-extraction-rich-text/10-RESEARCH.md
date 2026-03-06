# Phase 10: Extraction Rich Text - Research

**Researched:** 2026-03-06
**Domain:** OnlyOffice plugin HTML extraction + postMessage protocol extension
**Confidence:** MEDIUM-HIGH

## Summary

Phase 10 is the entry point of the v2.1 rich text pipeline. Its scope is narrow but critical: change the plugin to extract HTML-formatted content instead of plain text, transport it through the existing postMessage protocol with a new `format` field, and ensure graceful fallback to plain text if extraction fails.

The primary approach is changing `initDataType` from `"text"` to `"html"` in `config.json`. The official OO HTML plugin demonstrates this exact pattern: `init(data)` receives HTML when `initDataType: "html"` is set, with `initOnSelectionChanged: true`. However, the official example uses a `panel`-type plugin, not `background`. This combination is undocumented and represents a go/no-go gate that must be validated first. If `initDataType: "html"` does not work with background plugins, the fallback is `executeMethod("GetSelectedContent", [{type:"html"}])` which is a Document Builder API method available since OO 8.x.

The protocol change is additive: the intent payload gains an optional `html` field and `format: "html"` discriminator alongside the existing `text` field. No protocol version bump needed. The plugin continues to extract plain text in parallel (via `GetSelectedText`) for display purposes and as fallback. All conversion logic stays in the React app (Phase 11), keeping this phase focused on extraction and transport only.

**Primary recommendation:** Start with a 10-minute validation of `initDataType: "html"` + `type: "background"`. If it works, the change is a 1-line config edit + ~30 lines of code.js changes. If not, use `GetSelectedContent({type:"html"})` via `executeMethod` as the fallback extraction method.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXTR-01 | Le plugin extrait le HTML formate de la selection via `GetSelectedContent({type:"html"})` | Two extraction approaches identified: `initDataType: "html"` (config change, HTML arrives in `init(data)`) or explicit `executeMethod("GetSelectedContent", [{type:"html"}])`. Both return HTML string. Go/no-go gate determines which. |
| EXTR-02 | Le protocole postMessage transporte le HTML avec un champ `format:"html"` | Additive protocol change: intent payload `{ text: "plain", html: "<b>formatted</b>", format: "html" }`. No version bump. Existing 1MB size limit sufficient. |
| EXTR-03 | Si l'extraction HTML echoue, le systeme revient silencieusement au texte brut | Dual-field payload pattern: always extract plain text via `GetSelectedText`. If HTML extraction fails, send `{ text: plainText }` without `html`/`format` fields. Host checks `format` field presence to decide pipeline. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| OnlyOffice Plugin API | 9.3.0 | `initDataType: "html"`, `GetSelectedContent`, `GetSelectedText` | Already in use; these are the official OO extraction APIs |
| cozy-bridge protocol | v1 | postMessage transport with intent routing | Already in use; additive field changes only |

### Supporting

No new npm dependencies for Phase 10. All changes are in the ES5 plugin (`code.js`, `config.json`) and the React bridge hook (`useCozyBridge.js`).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `initDataType: "html"` | `executeMethod("GetSelectedContent", [{type:"html"}])` | GetSelectedContent is an explicit API call (more reliable, no config-type ambiguity) but requires an async callback chain on every selection change instead of receiving HTML automatically in `init()` |
| `initDataType: "html"` | `callCommand` with Document Builder API (`GetRangeBySelect`, `GetAllParagraphs`, `ApiRun.GetBold/GetItalic`) | Full control over extracted data structure but ~80 lines of ES5 serializer code in `callCommand` sandbox; much more complex for the same result |

## Architecture Patterns

### Data Flow (Phase 10 only)

```
OO Editor selection
       |
       v
Plugin init(data)  ← receives HTML if initDataType:"html"
       |
       +---> lastSelectedHtml = stripOoClasses(data)
       |
       +---> GetSelectedText() ← parallel call for plain text
       |
       v
castIntent("AI_TEXT_EDIT", {
  text: plainText,
  html: cleanedHtml,
  format: "html"
})
       |
       v  (postMessage)
useCozyBridge receives intent
       |
       v
pendingIntent.data = { text, html, format }
       |
       v
ScribePopover receives selectedText + html (html used in Phase 11+)
```

### Pattern 1: Go/No-Go Gate First

**What:** Before writing any production code, validate the critical unknown (`initDataType: "html"` + `type: "background"`) with a 10-minute manual test.
**When to use:** Always when the entire approach depends on an undocumented API combination.
**Steps:**
1. Change `config.json`: `"initDataType": "html"`
2. `rm -f plugins/onlyoffice-scribe/**/*.gz plugins/onlyoffice-scribe/*.gz`
3. Restart OO: `./scripts/oo-dev-setup.sh`
4. Select bold text in OO editor
5. Check console for `[Scribe] init() called, data=` -- if data starts with `<` and contains HTML tags, it works

### Pattern 2: Dual-Field Payloads for Graceful Degradation

**What:** Always send both `text` and `html` fields in intent payloads. The `format` field discriminates.
**When to use:** Every AI_TEXT_EDIT intent.
**Example:**
```javascript
// Plugin code.js (ES5)
// If HTML extraction succeeded:
castIntent("AI_TEXT_EDIT", { text: plainText, html: cleanedHtml, format: "html" });

// If HTML extraction failed:
castIntent("AI_TEXT_EDIT", { text: plainText });
// (no html field, no format field = v2.0-compatible plain text)
```

### Pattern 3: OO Class Stripping

**What:** Strip OO-internal CSS classes from extracted HTML before sending.
**When to use:** Every time HTML is extracted from OO.
**Source:** Official OO HTML plugin (`code.js`) uses this exact pattern.
**Example:**
```javascript
// ES5 compatible - from official OO HTML plugin
function stripOoClasses(html) {
  return html.replace(/class="[a-zA-Z0-9\-:;+"\\/=]*/g, "");
}
```

### Pattern 4: Thin Plugin, Smart Host

**What:** The plugin extracts raw HTML and sends it. All conversion (HTML-to-Markdown, Markdown-to-HTML) happens in the React app.
**Why:** ES5 constraint in plugin. No bundler. Libraries like turndown/marked require modern JS. The React app has webpack and npm.
**Phase 10 implication:** The plugin sends raw (class-stripped) HTML. It does not attempt any conversion.

### Anti-Patterns to Avoid

- **Removing plain text extraction:** Keep `GetSelectedText` calls alongside HTML extraction. The `text` field is used for display (floating button, loading messages) and as fallback.
- **Breaking the SHOW_SCRIBE_BUTTON intent:** This one-way intent only needs plain text for display. Do not change its payload to HTML.
- **Protocol version bump:** Adding optional `html` and `format` fields is additive. No version bump needed.
- **HTML parsing in the plugin:** No DOMParser or library-based processing in the ES5 plugin. Just string-level class stripping.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML extraction | Manual DOM walking via callCommand | `initDataType: "html"` or `GetSelectedContent({type:"html"})` | OO has built-in HTML export; manual extraction is ~80 LOC of brittle ES5 |
| Class attribute stripping | Custom regex parser | Simple `replace(/class="[^"]*/g, "")` pattern from official plugin | Proven by OO's own reference implementation |
| Protocol routing | New message types | Existing `cozy-bridge:intent` with added fields | Protocol is designed for extensible payloads |

## Common Pitfalls

### Pitfall 1: initDataType "html" + background plugin

**What goes wrong:** Plugin config changed to `initDataType: "html"` but `init(data)` still receives plain text or stops being called entirely.
**Why it happens:** The combination of `initDataType: "html"` with `type: "background"` is undocumented. Official examples use panel/window types.
**How to avoid:** Run the go/no-go gate test first. Have `GetSelectedContent` fallback ready.
**Warning signs:** `init(data)` data does not start with `<`, contains no HTML tags, or `init()` stops firing on selection change.

### Pitfall 2: Forgetting to clear .gz cache files

**What goes wrong:** Plugin changes (config.json, code.js) don't take effect. OO serves stale cached versions.
**Why it happens:** OO creates `.gz` compressed copies of plugin files and serves those instead of source.
**How to avoid:** Always `rm -f plugins/onlyoffice-scribe/**/*.gz plugins/onlyoffice-scribe/*.gz` before testing.
**Warning signs:** Console still shows old log messages after code changes.

### Pitfall 3: OO HTML is inline-style soup

**What goes wrong:** Extracted HTML uses `<span style="font-weight:bold">` instead of `<strong>`. This is NOT a Phase 10 problem (conversion is Phase 11) but the raw HTML format must be understood.
**Why it happens:** OO represents text as styled runs, not semantic HTML.
**How to avoid:** Log and document the real OO HTML output format during Phase 10. This informs Phase 11 normalizer design.
**Warning signs:** HTML contains no `<strong>`, `<em>`, `<h1>`-`<h6>` tags; only `<span style="...">` and `<p style="...">`.

### Pitfall 4: GetSelectedText callback timing with HTML init

**What goes wrong:** When `initDataType` is `"html"`, the `init(data)` callback receives HTML. But `GetSelectedText` (used for plain text fallback) is an async `executeMethod` call. If not properly sequenced, the intent is cast before plain text is available.
**Why it happens:** `init(data)` fires synchronously on selection change. `GetSelectedText` requires a callback.
**How to avoid:** Store HTML immediately from `init(data)`. Call `GetSelectedText` asynchronously. Cast the intent in the `GetSelectedText` callback (or if GetSelectedText fails, use text stripped from HTML as fallback).

### Pitfall 5: HTML payload size

**What goes wrong:** HTML is 3-5x larger than plain text. Very large selections could approach the 1MB protocol limit.
**Why it happens:** Inline styles add significant overhead per text run.
**How to avoid:** Class stripping reduces size. The 1MB limit is generous (covers ~200KB of plain text equivalent). Log payload sizes during testing. For Phase 10, this is informational -- no action needed unless sizes exceed expectations.

## Code Examples

### config.json change (EXTR-01)

```json
{
  "variations": [
    {
      "type": "background",
      "initDataType": "html",
      "initOnSelectionChanged": true
    }
  ]
}
```

### Plugin code.js: HTML extraction with fallback (EXTR-01, EXTR-03)

```javascript
// ES5 -- new state variable
var lastSelectedHtml = "";

// ES5 -- class stripping (from official OO HTML plugin)
function stripOoClasses(html) {
  return html.replace(/class="[a-zA-Z0-9\-:;+"\\/=]*/g, "");
}

// Updated init() for initDataType:"html"
window.Asc.plugin.init = function(data) {
  log("init() called, data type check: " + (data ? data.substring(0, 60) : "(null)"));

  if (!toolbarButtonAdded) {
    addToolbarButton();
    toolbarButtonAdded = true;
  }

  // With initDataType:"html", data is HTML string
  var htmlContent = data || "";
  var cleanedHtml = stripOoClasses(htmlContent);
  lastSelectedHtml = cleanedHtml;

  // Also get plain text for display/fallback
  window.Asc.plugin.executeMethod("GetSelectedText", [{
    Numbering: false, Math: false,
    TableCellSeparator: "\n", ParaSeparator: "\n",
    TabSymbol: String.fromCharCode(9)
  }], function(plainText) {
    var text = (plainText || "").replace(/^\s+|\s+$/g, "");
    lastSelectedText = text;

    if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer);

    if (text.length > 0) {
      selectionDebounceTimer = setTimeout(function() {
        castIntent("SHOW_SCRIBE_BUTTON", { text: text }, true);
        scribeButtonShown = true;
        startHidePolling();
      }, SELECTION_DEBOUNCE_MS);
    } else {
      if (scribeButtonShown) {
        scribeButtonShown = false;
        castIntent("HIDE_SCRIBE_BUTTON", {}, true);
      }
      stopHidePolling();
    }
  });
};
```

### Fallback: GetSelectedContent if initDataType fails (EXTR-01, EXTR-03)

```javascript
// ES5 -- alternative extraction via executeMethod
// Use if initDataType:"html" does not work with background plugins
function extractHtmlContent(callback) {
  window.Asc.plugin.executeMethod("GetSelectedContent", [{ type: "html" }], function(html) {
    if (html && html.length > 0) {
      callback(stripOoClasses(html));
    } else {
      callback("");
    }
  });
}
```

### Intent with format field (EXTR-02)

```javascript
// In trigger-intent handler and context menu click handler:
if (lastSelectedText.length > 0) {
  var intentData = { text: lastSelectedText };
  if (lastSelectedHtml && lastSelectedHtml.length > 0) {
    intentData.html = lastSelectedHtml;
    intentData.format = "html";
  }
  castIntent("AI_TEXT_EDIT", intentData);
}
```

### useCozyBridge: pass through html field (EXTR-02)

```javascript
// No change needed in useCozyBridge.js itself -- it already passes
// intentMessage.data through unchanged. The html field flows automatically.
// In View.jsx, the html is accessible via:
//   pendingIntent?.data?.html
//   pendingIntent?.data?.format === 'html'
```

## State of the Art

| Old Approach (v2.0) | New Approach (v2.1 Phase 10) | Impact |
|----------------------|-------------------------------|--------|
| `initDataType: "text"` | `initDataType: "html"` | `init(data)` receives HTML instead of plain text |
| `lastSelectedText` only | `lastSelectedText` + `lastSelectedHtml` | Two representations maintained |
| Intent data: `{ text }` | Intent data: `{ text, html, format }` | Additive fields, backward compatible |
| No format discrimination | `format: "html"` discriminator | Host can choose plain text vs rich text pipeline |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual testing (OO plugin in browser) |
| Config file | None -- browser-based manual validation |
| Quick run command | Select bold text in OO, check browser console for `[Scribe]` logs |
| Full suite command | N/A (no automated test infrastructure for OO plugin integration) |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXTR-01 | HTML extraction from OO selection | manual | Select bold/italic text, check `init(data)` log shows HTML tags | N/A |
| EXTR-02 | HTML transported via postMessage with format field | manual | Trigger Scribe, check `useCozyBridge` receives `data.html` and `data.format === "html"` | N/A |
| EXTR-03 | Fallback to plain text on HTML failure | manual | Temporarily break HTML extraction, verify Scribe still works with plain text | N/A |

### Sampling Rate

- **Per task commit:** Manual test: select formatted text, trigger Scribe, verify console logs show HTML in intent
- **Per wave merge:** Full manual flow: select bold+italic text, trigger via button/context menu/Ctrl+I, verify HTML arrives in React component
- **Phase gate:** All 3 requirements manually verified before Phase 11

### Wave 0 Gaps

- [ ] Go/no-go validation of `initDataType: "html"` + `type: "background"` -- must be first action
- [ ] Document real OO HTML output format (bold, italic, headings, lists) for Phase 11 normalizer design

## Open Questions

1. **Does `initDataType: "html"` work with `type: "background"` plugins?**
   - What we know: Official docs do not restrict it. Official examples only show it with panel/window types.
   - What's unclear: Whether OO internally handles this combination or silently falls back to text.
   - Recommendation: 10-minute manual test as first task. Fallback: `GetSelectedContent({type:"html"})` via `executeMethod`.

2. **What exact HTML format does OO 9.3.0-138 produce?**
   - What we know: General pattern is inline-style spans, not semantic HTML. Bold = `font-weight: bold`, italic = `font-style: italic`.
   - What's unclear: Exact tags for headings, lists, tables in our OO version.
   - Recommendation: Log real output during validation. Save sample HTML for Phase 11 normalizer development.

3. **Should SHOW_SCRIBE_BUTTON intent also carry HTML?**
   - What we know: It's a one-way intent for UI display only (show/hide button). Currently carries `{ text }`.
   - What's unclear: Whether Phase 12+ preview needs HTML from button hover state.
   - Recommendation: No. Keep SHOW_SCRIBE_BUTTON as text-only. HTML is only needed when AI_TEXT_EDIT is triggered.

## Sources

### Primary (HIGH confidence)
- [OO Plugin Configuration - initDataType](https://api.onlyoffice.com/docs/plugin-and-macros/structure/configuration/) -- documents `"html"` as valid `initDataType` value
- [OO GetSelectedContent API](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/GetSelectedContent/) -- `{type:"html"}` parameter returns HTML string
- [OO Get and Paste HTML Plugin Sample](https://api.onlyoffice.com/docs/plugin-and-macros/samples/plugin-samples/get-and-paste-html/) -- reference implementation using `initDataType: "html"` + `PasteHtml`
- [OO Official HTML Plugin Source](https://github.com/nicedoc/onlyoffice.github.io/blob/master/sdkjs-plugins/content/html/scripts/code.js) -- class stripping pattern: `text.replace(/class="[a-zA-Z0-9-:;+"\\/=]*/g, "")`
- Project research files: `.planning/research/ARCHITECTURE.md`, `.planning/research/FEATURES.md`, `.planning/research/PITFALLS.md`, `.planning/research/SUMMARY.md`

### Secondary (MEDIUM confidence)
- [OO Community: GetSelectedText HTML format](https://community.onlyoffice.com/t/getselectedtext-html-format-paste-via-context-menu/8733) -- confirms `GetSelectedText` is plain-text only; `initDataType: "html"` or `GetSelectedContent` needed for formatted content

### Tertiary (LOW confidence)
- `initDataType: "html"` + `type: "background"` combination -- NO documentation found, must be empirically validated

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all APIs are documented OO features already in use
- Architecture: HIGH -- extends existing patterns (postMessage protocol, dual-field payloads)
- Pitfalls: HIGH -- critical risk (initDataType+background) well-documented with mitigation strategy
- Extraction approach: MEDIUM -- primary approach undocumented for background plugins, but fallback is solid

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable OO API, no expected breaking changes)
