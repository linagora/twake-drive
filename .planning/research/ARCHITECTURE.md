# Architecture: Document Builder API Injection

**Domain:** Rich content injection via OO Document Builder API for Scribe AI assistant
**Researched:** 2026-03-15
**Confidence:** MEDIUM-HIGH (API surface verified via official docs; format snapshot iteration is partially verified)

## Current Architecture (v2.1-v2.3)

```
┌──────────────────────────────────────────────────────────────────┐
│  View.jsx                                                        │
│  markdownToHtml(resultText) → html                               │
│  unwrapSingleParagraph(html) → finalHtml                         │
│  respond({ action:'replace', data:{ text, html } })              │
├──────────────────────────────────────────────────────────────────┤
│  postMessage (cozy-bridge:response)                              │
│  ↓                                                               │
│  code.js (plugin, ES5)                                           │
│  handleIntentResponse() → pasteHtml(html, mode)                  │
│    Step 1: callCommand → detect adjacent chars (read-only)       │
│    Step 2: executeMethod("PasteHtml", [html]) → injects content  │
│  Result: single undo point (PasteHtml only)                      │
└──────────────────────────────────────────────────────────────────┘
```

### What Works
- HTML round-trip: OO HTML → normalizeHtml → Turndown → MD → LLM → MD → marked → HTML → PasteHtml
- Single undo point via PasteHtml
- Smart spacing with nbsp

### What Breaks
- **No post-paste selection** - PasteHtml returns inconsistent cursor positions
- **Format loss** - Markdown cannot represent font size, font family, colors, paragraph spacing, indentation
- **No image preservation** - Images stripped by Turndown (intentionally)
- **Table structure loss** - Column widths, cell borders, merged cells lost in MD round-trip
- **No element-level control** - PasteHtml is a black box; cannot manipulate individual runs

## Target Architecture (v2.4)

### Core Principle: Build, Don't Paste

Replace `PasteHtml` with `callCommand` using Document Builder API to construct content element-by-element. This gives:
1. Element-level control over every paragraph, run, table cell
2. Ability to apply format metadata (font, size, color) from original selection
3. Ability to track positions for post-injection selection
4. Single undo point (callCommand = one undo operation)

### New Data Flow

```
                     CAPTURE PHASE (before LLM)
┌──────────────────────────────────────────────────────────────┐
│  code.js: init() receives HTML (existing)                    │
│  NEW: callCommand → snapshot format metadata from selection   │
│    - iterate paragraphs via GetAllParagraphs()               │
│    - iterate runs via GetElement(i) / GetElementsCount()     │
│    - extract per-run: GetBold, GetItalic, GetFontSize,       │
│      GetFontFamily, GetColor, GetUnderline, GetStrikeout     │
│    - extract per-paragraph: GetJc, GetIndLeft, GetIndRight,  │
│      GetSpacingBefore, GetSpacingAfter                       │
│    - serialize to JSON → store in lastFormatSnapshot          │
│  castIntent("AI_TEXT_EDIT", { text, html, formatSnapshot })  │
└──────────────────────────────────────────────────────────────┘
                           ↓
                     LLM ROUND-TRIP (unchanged)
┌──────────────────────────────────────────────────────────────┐
│  ScribePopover: htmlToMarkdown → messages → callScribeAI     │
│  LLM returns markdown text                                   │
└──────────────────────────────────────────────────────────────┘
                           ↓
                     INJECTION PHASE (new)
┌──────────────────────────────────────────────────────────────┐
│  View.jsx: respond({ action:'replace',                       │
│    data:{ text, md, formatSnapshot } })                      │
│  NOTE: no more markdownToHtml conversion in View.jsx         │
│  Raw MD sent to plugin                                       │
├──────────────────────────────────────────────────────────────┤
│  code.js: handleIntentResponse()                             │
│    NEW: parseMarkdown(md) → AST (inline MD parser, ES5)      │
│    NEW: buildContent(ast, formatSnapshot) → Builder API calls │
│    callCommand(function() {                                  │
│      // Parse MD → paragraphs + inline tokens                │
│      // For each paragraph:                                  │
│      //   p = Api.CreateParagraph()                          │
│      //   apply para-level format from snapshot              │
│      //   For each inline token (text, bold, italic, link):  │
│      //     run = Api.CreateRun()                            │
│      //     run.AddText(token.text)                          │
│      //     apply run-level format (merge snapshot + MD)     │
│      //     p.AddElement(run)                                │
│      //   content.push(p)                                    │
│      // For tables: Api.CreateTable(cols, rows)              │
│      // doc.InsertContent(content)                           │
│      // Track positions → select injected range              │
│    })                                                        │
└──────────────────────────────────────────────────────────────┘
```

## New Components

### 1. Format Snapshot Extractor (code.js, ES5)

**Location:** `code.js`, new function `captureFormatSnapshot()`
**Trigger:** Called inside `init()` after selection detected, before castIntent
**Runs in:** `callCommand` (has access to Builder API)

```
captureFormatSnapshot() → callCommand(function() {
  var doc = Api.GetDocument();
  var range = doc.GetRangeBySelect();
  var paragraphs = range.GetAllParagraphs();
  var snapshot = { paragraphs: [] };

  for (var i = 0; i < paragraphs.length; i++) {
    var para = paragraphs[i];
    var paraData = {
      jc: para.GetJc(),
      indLeft: para.GetIndLeft(),
      indRight: para.GetIndRight(),
      spacingBefore: para.GetSpacingBefore(),
      spacingAfter: para.GetSpacingAfter(),
      runs: []
    };
    var count = para.GetElementsCount();
    for (var j = 0; j < count; j++) {
      var el = para.GetElement(j);
      // Elements may not all be runs - check GetClassType
      if (el.GetClassType && el.GetClassType() === "run") {
        paraData.runs.push({
          text: el.GetText(),
          bold: el.GetBold(),
          italic: el.GetItalic(),
          fontSize: el.GetFontSize(),
          fontFamily: el.GetFontFamily(),
          color: el.GetColor(),
          underline: el.GetUnderline(),
          strikeout: el.GetStrikeout()
        });
      }
    }
    snapshot.paragraphs.push(paraData);
  }
  return JSON.stringify(snapshot);
}, false, false, callback);
```

**Confidence:** MEDIUM - GetAllParagraphs on range is documented. GetElement/GetElementsCount on paragraph is documented. Whether GetBold/GetItalic etc. return simple values from runs inside callCommand needs testing.

**Risk:** GetColor returns an ApiRGBColor object, not a plain value. May need `.GetClassType()` checks and manual extraction. Test early.

### 2. Markdown Parser (code.js, ES5)

**Location:** `code.js`, new function `parseMarkdown(md)`
**Constraint:** Must be ES5 (no arrow functions, no const/let, no template literals)
**Runs in:** Inside `callCommand` (isolated context) OR in plugin context then passed via `Asc.scope`

**Strategy:** Write a minimal inline MD parser. Do NOT try to port a full library.

**Tokens to support (ordered by priority):**

| Priority | Token | MD Syntax | Builder API |
|----------|-------|-----------|-------------|
| P0 | Plain text | `text` | `run.AddText()` |
| P0 | Bold | `**text**` | `run.SetBold(true)` |
| P0 | Italic | `*text*` | `run.SetItalic(true)` |
| P0 | Bold+Italic | `***text***` | `run.SetBold(true); run.SetItalic(true)` |
| P0 | Paragraphs | `\n\n` | `Api.CreateParagraph()` |
| P1 | Headings | `# text` | `p.SetStyle("Heading N")` or `run.SetFontSize(N)` + `run.SetBold(true)` |
| P1 | Unordered lists | `- item` | `Api.CreateNumbering("bullet")` + `p.SetNumbering(numbering)` |
| P1 | Ordered lists | `1. item` | `Api.CreateNumbering("numbered")` + `p.SetNumbering(numbering)` |
| P1 | Inline code | `` `code` `` | `run.SetFontFamily("Courier New")` + `run.SetShd(...)` |
| P2 | Links | `[text](url)` | `run.AddHyperlink(url, text)` |
| P2 | Tables | `\|a\|b\|` | `Api.CreateTable(cols, rows)` |
| P2 | Code blocks | ` ``` ` | Monospace paragraph with shading |
| P3 | Images | `![alt](url)` | Deferred - complex (need to handle blob URLs) |

**Architecture decision:** The parser lives entirely in `code.js` as a self-contained ES5 function. It is NOT imported from React. Rationale:
- It runs inside `callCommand` which is an isolated context
- No module system available inside callCommand
- Must be ES5
- Keeps the injection pipeline atomic (parse + build + insert = single callCommand = single undo)

**Parser output format (AST):**
```javascript
[
  { type: "paragraph", children: [
    { type: "text", text: "Hello " },
    { type: "bold", children: [{ type: "text", text: "world" }] },
    { type: "text", text: "!" }
  ]},
  { type: "heading", level: 2, children: [
    { type: "text", text: "Section" }
  ]},
  { type: "list", ordered: false, items: [
    { children: [{ type: "text", text: "item 1" }] },
    { children: [{ type: "text", text: "item 2" }] }
  ]},
  { type: "table", headers: ["A", "B"], rows: [["1", "2"]] }
]
```

### 3. Builder Content Generator (code.js, ES5)

**Location:** `code.js`, new function `buildContent(ast, snapshot)`
**Runs in:** Inside same `callCommand` as parser

Converts parsed AST + format snapshot into Builder API calls:

```
buildContent(ast, snapshot) {
  var content = [];
  for each node in ast:
    if paragraph:
      p = Api.CreateParagraph()
      applyParaFormat(p, snapshot)  // from snapshot if available
      for each inline child:
        run = Api.CreateRun()
        run.AddText(child.text)
        applyRunFormat(run, child, snapshot)  // merge MD formatting + snapshot
        p.AddElement(run)
      content.push(p)
    if table:
      t = Api.CreateTable(cols, rows)
      // fill cells
      content.push(t)
  return content;
}
```

### 4. Post-Injection Selector (code.js, ES5)

**Location:** `code.js`, within the same `callCommand` as buildContent
**Challenge:** After `InsertContent(content)`, the inserted elements exist in the document but getting their range is non-trivial.

**Strategy: Bookmark approach**
```
// Before InsertContent:
var startRange = doc.GetRangeBySelect();  // current selection = insertion point
var startPos = startRange.GetStartPos();

// After InsertContent:
// Calculate end position from content length
// Create range from startPos to endPos
// range.Select()
```

**Confidence:** LOW - The community discussion confirms that InsertContent does not return references to inserted elements. The workaround (search for text + GetRangeBySelect) is fragile for non-unique text. Position-based approach (track startPos, calculate endPos from content) needs empirical testing.

**Alternative: Marker approach**
1. Insert a unique zero-width character (e.g., `\u200B`) at start and end of content
2. After InsertContent, search for markers
3. Select range between markers
4. Delete markers

**Recommendation:** Defer post-injection selection to a sub-phase. Build content injection first, add selection after. The marker approach is more robust than position calculation but adds complexity.

## Format Preservation Strategy

### The Problem

Markdown is a lossy format. When original text goes through the LLM:
```
Original: 14pt Calibri, blue, 1.5 line spacing, justified
   ↓ HTML extraction
   ↓ normalizeHtml → Turndown → Markdown
"Hello **world**"  (only bold survived)
   ↓ LLM transforms text
"Bonjour **monde**"
   ↓ What formatting should the output have?
```

### Strategy Comparison

| Strategy | Description | Pros | Cons |
|----------|-------------|------|------|
| **Snapshot-only** | Capture original format, apply wholesale to all output | Simple, preserves document style | Ignores MD formatting entirely |
| **MD-only** | Parse MD, apply only MD-indicated formatting | Respects LLM's formatting intent | Loses all original styling (font, size, color) |
| **Fusion** (recommended) | MD formatting as layer on top of snapshot defaults | Best of both worlds | More complex merge logic |

### Recommended: Fusion Strategy

**Principle:** The format snapshot provides *defaults*, MD formatting provides *overrides*.

```
For each output run:
  1. Start with snapshot defaults (font, size, color, spacing)
     - Use paragraph-level snapshot for para properties
     - Use first-run snapshot for run properties (dominant style)
  2. Apply MD-indicated formatting on top:
     - **bold** in MD → SetBold(true), regardless of snapshot
     - *italic* in MD → SetItalic(true), regardless of snapshot
     - # heading → SetFontSize(large), overrides snapshot size
     - Plain text → inherit snapshot bold/italic/etc. as-is
```

**Key insight:** MD formatting is *additive*. If the LLM wraps text in `**bold**`, it means "make this bold." If it doesn't, it means "leave formatting as default" -- which should be the original document's style, not browser defaults.

**Implementation:**

```javascript
function applyRunFormat(run, mdNode, snapshot) {
  // 1. Apply snapshot defaults (dominant run style)
  var defaults = snapshot && snapshot.dominantRun;
  if (defaults) {
    if (defaults.fontFamily) run.SetFontFamily(defaults.fontFamily);
    if (defaults.fontSize) run.SetFontSize(defaults.fontSize);
    if (defaults.color) run.SetColor(defaults.color.r, defaults.color.g, defaults.color.b);
  }

  // 2. Apply MD overrides
  if (mdNode.type === "bold" || mdNode.bold) run.SetBold(true);
  if (mdNode.type === "italic" || mdNode.italic) run.SetItalic(true);
  // ... etc
}
```

**Edge case: bold-in-original + bold-in-MD**
If original text was bold and LLM returns `**text**`, the output should be bold. If LLM returns `text` (no bold), the output should also be bold (snapshot default). This is correct behavior -- the LLM removing bold markers for originally-bold text is a no-op, not an instruction to un-bold.

**Edge case: LLM adds structure not in original**
If original was a plain paragraph and LLM returns a list, the list structure from MD takes precedence. Snapshot paragraph formatting (spacing, alignment) still applies to list items.

### Snapshot Granularity Decision

**Option A: Per-run mapping** - Map each original run to each output run. Complex, fragile (LLM may restructure text completely).

**Option B: Dominant style** (recommended) - Extract the most common formatting from the selection as "defaults." Simple, robust, handles text restructuring gracefully.

Implementation: count occurrences of each font/size/color across all runs in snapshot, pick the mode (most frequent).

```javascript
function computeDominantStyle(snapshot) {
  var fonts = {}, sizes = {}, colors = {};
  for (var i = 0; i < snapshot.paragraphs.length; i++) {
    var runs = snapshot.paragraphs[i].runs;
    for (var j = 0; j < runs.length; j++) {
      var r = runs[j];
      fonts[r.fontFamily] = (fonts[r.fontFamily] || 0) + r.text.length;
      sizes[r.fontSize] = (sizes[r.fontSize] || 0) + r.text.length;
      // ... same for color
    }
  }
  return {
    fontFamily: maxKey(fonts),
    fontSize: maxKey(sizes),
    color: maxKey(colors),
    // para-level: use first paragraph's properties
    jc: snapshot.paragraphs[0].jc,
    indLeft: snapshot.paragraphs[0].indLeft
  };
}
```

## Component Boundaries

| Component | Location | Language | Responsibility | Communicates With |
|-----------|----------|----------|---------------|-------------------|
| Format Snapshot Extractor | code.js | ES5 | Capture original format metadata via Builder API | init() triggers it; data sent with AI_TEXT_EDIT intent |
| MD Parser | code.js | ES5 | Parse LLM markdown result into AST | Called inside buildContent's callCommand |
| Builder Content Generator | code.js | ES5 | Convert AST + snapshot → Builder API calls → InsertContent | Called inside same callCommand as parser |
| Post-Injection Selector | code.js | ES5 | Select the injected content range | Called inside same callCommand after InsertContent |
| View.jsx response handler | View.jsx | React | Pass raw MD + snapshot to plugin (no more markdownToHtml) | Sends via respond() → postMessage |
| ScribePopover | ScribePopover.jsx | React | State machine unchanged; passes MD text as-is | No structural change |

### What Changes in Existing Components

| File | Change | Reason |
|------|--------|--------|
| `code.js` | Add captureFormatSnapshot(), parseMarkdown(), buildContent(), new handleIntentResponse branch | Core new functionality |
| `code.js` | Modify init() to call captureFormatSnapshot before castIntent | Capture format metadata |
| `code.js` | Add `lastFormatSnapshot` state variable | Store snapshot between capture and injection |
| `View.jsx` | handleReplace/handleInsert: send `{ text, md: text, formatSnapshot }` instead of `{ text, html }` | Plugin does MD→Builder instead of React doing MD→HTML |
| `View.jsx` | Remove markdownToHtml call from handleReplace/handleInsert | No longer needed for injection path |
| `useCozyBridge.js` | No change | Format snapshot is in intent data, flows through existing protocol |
| `ScribePopover.jsx` | No change | Already passes result.text to onReplace/onInsert |
| `scribeConversion.js` | No change (still used for preview panel + dev mode) | markdownToHtml still needed for react-markdown preview |

## Data Flow: Complete Cycle

### 1. Selection + Snapshot (user selects text)

```
User selects text in OO Editor
  → OO calls plugin init(htmlData) [existing]
  → code.js stores lastSelectedHtml [existing]
  → code.js calls captureFormatSnapshot() [NEW]
    → callCommand: iterate selection's paragraphs+runs
    → callback: store JSON in lastFormatSnapshot [NEW]
  → code.js calls castIntent("AI_TEXT_EDIT", { text, html, formatSnapshot }) [MODIFIED]
```

**Timing concern:** captureFormatSnapshot uses callCommand which is async. The castIntent must wait for the callback. This changes the init() flow from synchronous to callback-chained.

### 2. LLM Round-Trip (unchanged)

```
CozyBridge receives AI_TEXT_EDIT intent
  → ScribePopover opens
  → User picks action
  → htmlToMarkdown(selectedHtml) → input MD [existing]
  → callScribeAI(messages) → output MD [existing]
  → ScribeResultPanel shows preview [existing]
```

### 3. User Confirms (Replace/Insert)

```
User clicks Replace/Insert
  → View.jsx: respond({ action:'replace', data:{ text, md: resultText }}) [MODIFIED]
    NOTE: formatSnapshot stored in code.js, not round-tripped through React
  → postMessage → code.js handleIntentResponse()
```

**Key design decision:** The formatSnapshot does NOT travel through the React layer. It is captured in code.js and stored there. When the response comes back, code.js already has it. This avoids:
- Serializing large snapshot objects through postMessage twice
- React needing to understand format data it doesn't use
- Potential data loss in the bridge protocol

### 4. Injection (new)

```
code.js handleIntentResponse():
  if (msg.data.md) {
    // NEW: Builder API injection path
    Asc.scope._md = msg.data.md;
    Asc.scope._snapshot = lastFormatSnapshot; // captured earlier
    Asc.scope._mode = msg.action; // "replace" or "insert"

    callCommand(function() {
      var md = Asc.scope._md;
      var snapshot = Asc.scope._snapshot ? JSON.parse(Asc.scope._snapshot) : null;
      var mode = Asc.scope._mode;
      var doc = Api.GetDocument();

      // For insert mode: collapse to end of selection first
      if (mode === "insert") {
        var range = doc.GetRangeBySelect();
        if (range) {
          var endRange = doc.GetRange(range.GetEndPos(), range.GetEndPos());
          if (endRange) endRange.Select();
        }
      }

      // Parse markdown → AST
      var ast = parseMarkdown(md);

      // Build content from AST + snapshot
      var content = buildContent(ast, snapshot);

      // Insert (replaces selection in replace mode, inserts at cursor in insert mode)
      doc.InsertContent(content);

      // Post-injection selection (phase 2)
      // selectInjectedContent(startPos, content);
    });
  } else if (msg.data.html) {
    // FALLBACK: existing PasteHtml path
    pasteHtml(msg.data.html, msg.action);
  }
```

## Build Order (Progressive Complexity)

### Phase A: Minimal Builder Injection (P0)

**Goal:** Replace PasteHtml with Builder API for plain text + bold/italic. Prove the pipeline works.

1. Write `parseMarkdown()` - handle paragraphs, bold, italic, bold+italic only
2. Write `buildContent()` - create paragraphs + runs, no snapshot fusion yet
3. Modify `handleIntentResponse()` to use new path when `msg.data.md` present
4. Modify `View.jsx` to send `md` field instead of `html`
5. Test: replace and insert modes work

**No snapshot, no tables, no lists, no selection.** Pure MD-to-Builder proof of concept.

### Phase B: Format Snapshot + Fusion

**Goal:** Preserve original document formatting through the LLM round-trip.

1. Write `captureFormatSnapshot()` in code.js
2. Modify `init()` to chain snapshot capture before castIntent
3. Write `computeDominantStyle()` for snapshot → defaults
4. Modify `buildContent()` to apply fusion (snapshot defaults + MD overrides)
5. Test: text injected with original font/size/color preserved

### Phase C: Extended MD Support

**Goal:** Support headings, lists, inline code, links.

1. Extend `parseMarkdown()` for headings, unordered lists, ordered lists
2. Extend `buildContent()` for headings (SetStyle or font size), lists (CreateNumbering)
3. Add inline code support (font family change)
4. Add link support (AddHyperlink on run)
5. Test: all common MD structures render correctly

### Phase D: Tables

**Goal:** Support GFM tables via Builder API.

1. Extend `parseMarkdown()` for table syntax
2. Extend `buildContent()` to use `Api.CreateTable(cols, rows)`
3. Apply snapshot formatting to table cells
4. Test: tables inject with correct structure

### Phase E: Post-Injection Selection

**Goal:** Select the injected content after insertion.

1. Implement marker-based selection (zero-width chars)
2. Or implement position-tracking selection
3. Test: injected content is selected after replace/insert

### Phase F: Smart Spacing

**Goal:** Handle leading/trailing whitespace at injection boundaries.

1. Adapt existing smart spacing logic from pasteHtml to Builder path
2. Handle paragraph-boundary cases (no spacing needed between paragraphs)
3. Test: no double-spaces or missing spaces at boundaries

## Anti-Patterns to Avoid

### Anti-Pattern 1: Parsing MD in React, sending Builder instructions to plugin
**Why bad:** Doubles message complexity. React doesn't have Builder API access. Instructions would need serialization/deserialization. Increases postMessage payload size.
**Instead:** Parse MD inside callCommand where Builder API is available.

### Anti-Pattern 2: Per-run format mapping between original and output
**Why bad:** LLM may completely restructure text (merge paragraphs, split sentences, reorder). Mapping run-by-run is fragile and breaks on any structural change.
**Instead:** Use dominant style as defaults. Accept that per-run uniqueness is lost through LLM.

### Anti-Pattern 3: Importing a full MD parser library into plugin
**Why bad:** Plugin runs ES5 in isolated context. No module system. Full parsers (marked, remark) are complex, ES6+, and way more than needed.
**Instead:** Write a minimal inline parser handling only the tokens LLMs actually produce.

### Anti-Pattern 4: Two callCommand calls for injection (one to parse, one to insert)
**Why bad:** Two undo points. User has to undo twice.
**Instead:** Parse + build + insert all inside a single callCommand.

### Anti-Pattern 5: Sending formatSnapshot through React
**Why bad:** Extra postMessage round-trips, React doesn't need it, increases protocol complexity.
**Instead:** Keep snapshot in code.js. It's captured there, consumed there.

## Scalability Considerations

| Concern | Small selection (1-3 paras) | Medium (10-20 paras) | Large (50+ paras) |
|---------|----------------------------|----------------------|-------------------|
| Snapshot capture | Instant | ~50ms | ~200ms, may need async chunking |
| MD parsing | Instant | ~10ms | ~50ms |
| Builder API calls | Instant | ~100ms | ~500ms, may cause visible delay |
| InsertContent | Instant | ~50ms | ~200ms |

**Mitigation for large selections:** Consider a size threshold. Above N paragraphs, fall back to PasteHtml (which handles large content well). Document Builder API injection is most valuable for typical Scribe use cases (1-10 paragraphs).

## Open Questions

1. **GetColor() return type** - Does ApiRun.GetColor() return {r, g, b} or an ApiRGBColor object? Needs empirical testing in callCommand context. (MEDIUM risk)

2. **GetElementsCount/GetElement on paragraphs within range** - Does this return runs or all child elements? Non-run elements (drawings, inline content controls) need handling. (LOW risk)

3. **InsertContent behavior with mixed content** - When content array includes both paragraphs and tables, does OO handle ordering correctly? (LOW risk, likely works)

4. **callCommand payload size limit** - Is there a limit on Asc.scope data size? Large snapshots (50+ paragraphs with runs) could be several KB. (LOW risk)

5. **Numbering API** - `Api.CreateNumbering("bullet")` vs `Api.CreateNumbering("numbered")` - exact parameter format needs verification. (LOW risk, documented)

## Sources

- [OnlyOffice callCommand documentation](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/)
- [ApiRun methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRun/)
- [ApiRange methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRange/)
- [ApiParagraph methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/)
- [CreateTable](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/Api/Methods/CreateTable/)
- [CreateRange](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/Api/Methods/CreateRange/)
- [GetRangeBySelect](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/GetRangeBySelect/)
- [Community: post-insertion element retrieval](https://community.onlyoffice.com/t/issue-in-retrieving-newly-created-paragraph-element/10415)
- [OO API Updates Dec 2025](https://www.onlyoffice.com/blog/2025/12/api-updates-december-2025)
- [OO Plugin Tips & Pitfalls Jan 2026](https://www.onlyoffice.com/blog/2026/01/creating-onlyoffice-plugins-tips-tricks-and-hidden-pitfalls)
