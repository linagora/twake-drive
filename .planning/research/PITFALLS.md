# Domain Pitfalls

**Domain:** Document Builder API injection added to existing OnlyOffice plugin (Scribe v2.4)
**Researched:** 2026-03-15
**Confidence:** MEDIUM-HIGH -- based on OO official docs, community forum issues, OO blog pitfalls article, and direct analysis of existing plugin code (code.js). Some Builder API edge cases are LOW confidence (no first-party documentation found).

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or fundamental architecture failures.

---

### Pitfall 1: callCommand Sandbox Only Allows InsertContent -- No DOM APIs, No External Libraries, No Require

**What goes wrong:**
The developer writes a Markdown parser that uses `DOMParser`, `document.createElement`, regex libraries, or any browser/Node API inside `callCommand`. The code silently fails or throws an undefined reference error inside the OO editor sandbox.

**Why it happens:**
`callCommand` executes in an isolated JavaScript context inside the OO editor -- NOT in the plugin iframe window. This sandbox has access to the Office API (`Api.*`) and basic JS primitives, but nothing else. No `window`, no `document`, no `DOMParser`, no `require`, no `fetch`, no `console.log` (use the callback return value to debug). The existing code already discovered this: `stripOoClasses()` uses regex instead of DOMParser for exactly this reason (see code.js line 249, project memory: "Plugin sandbox interdit DOMParser").

**Consequences:**
Any Markdown-to-Builder-API converter that relies on DOM parsing will fail completely inside `callCommand`. The parser must be pure ES5 string/regex manipulation only.

**Prevention:**
1. Parse Markdown OUTSIDE `callCommand` -- in the plugin iframe context where `window`, `DOMParser`, and libraries are available
2. Transform the parsed AST/tokens into a serializable instruction set (plain JSON array)
3. Pass the instruction set via `Asc.scope` to `callCommand`
4. Inside `callCommand`, iterate the instruction set and call Builder API methods

This is the only viable architecture: **parse outside, build inside**.

**Detection:**
- `callCommand` callback returns `undefined` when the function should return data
- No visible error (sandbox swallows exceptions silently in some OO versions)
- Content is not inserted but no error callback fires

**Phase to address:** Phase 1 (architecture) -- this is the foundational design decision. Getting this wrong means rewriting the entire parser.

---

### Pitfall 2: Asc.scope Cannot Pass Functions and Has JSON Serialization Limits

**What goes wrong:**
The developer puts a parsed AST object with methods, circular references, or very large strings into `Asc.scope`. Inside `callCommand`, the data arrives as `undefined` or is truncated.

**Why it happens:**
`Asc.scope` serializes data across the message bridge between the plugin iframe and the editor sandbox. Per OO docs: "The functions cannot be passed to the callCommand method using the Asc.scope object." Only JSON-serializable primitives work: strings, numbers, booleans, arrays, plain objects. The OO blog (Jan 2026) warns: "The bridge is optimized for JSON-like payloads; large strings or nested objects increase latency."

The existing code already uses `Asc.scope` correctly (line 99: `Asc.scope._mode = mode`, lines 189-190: `Asc.scope.textToInsert`, `Asc.scope.originalLines`). These are small strings and arrays -- they work fine.

**Consequences:**
- Functions silently become `undefined`
- Very large base64 image strings may cause latency spikes or silent failures
- Circular references cause serialization errors

**Prevention:**
1. Design the instruction set as a flat array of plain objects: `[{type: "paragraph", children: [{type: "run", text: "hello", bold: true}]}]`
2. Keep base64 image data separate from the instruction set -- pass as a separate `Asc.scope` property or handle images in a dedicated second `callCommand` call
3. Test with realistic payload sizes (a full page of Markdown with formatting)
4. Never put functions, class instances, or DOM nodes into `Asc.scope`

**Detection:**
- `Asc.scope.myData` is `undefined` inside `callCommand` even though it was set outside
- `callCommand` callback fires immediately with no result
- Insertion works for short text but fails for longer content

**Phase to address:** Phase 1 (instruction set design) -- validate the serialization boundary early with a representative payload.

---

### Pitfall 3: Multiple callCommand Calls Create Multiple Undo Points -- User Must Ctrl+Z Repeatedly

**What goes wrong:**
The developer chains two `callCommand` calls (e.g., one to clear the selection, one to insert content). The user presses Ctrl+Z expecting to undo the entire Scribe operation, but only the second operation is undone. They press Ctrl+Z again to undo the first. Worse, if they don't know about the second undo, the document is left in a half-modified state.

**Why it happens:**
Each `callCommand` call that modifies the document creates a separate undo history entry. The existing v2.1 code understood this: `pasteHtml()` uses a read-only `callCommand` (to detect adjacent chars) followed by a single `PasteHtml` (the only undo point). The comment at line 93 explicitly says: "This produces a single undo point (PasteHtml only -- the read-only callCommand doesn't count)."

With the Builder API approach, all content creation AND insertion must happen in a single `callCommand` call to maintain a single undo point.

**Consequences:**
- User confusion: "Undo didn't work" (it only undid half the operation)
- Document corruption: half-applied Scribe result mixed with original content
- No programmatic way to group multiple `callCommand` calls into one undo point

**Prevention:**
1. Build ALL content (paragraphs, runs, tables, images) and call `InsertContent` exactly once, all within a single `callCommand` function
2. Do NOT split the operation across multiple `callCommand` calls (e.g., "first call creates paragraphs, second call creates tables")
3. If you need pre-insertion data (like the current selection range), use a read-only `callCommand` first (read-only commands don't create undo points), then do the actual insertion in a second `callCommand`
4. The existing pattern in `pasteHtml()` (read-only prep + single modification) is the correct model

**Detection:**
- Press Ctrl+Z after Scribe insert -- if the document goes to an intermediate state instead of back to original, you have multiple undo points
- Count the number of `callCommand` calls with `isCalc: true` (default) that modify content

**Phase to address:** Phase 1 (architecture) -- the single-callCommand constraint shapes the entire instruction interpreter design.

---

### Pitfall 4: Redo Is Broken After callCommand -- Known OO Bug

**What goes wrong:**
After a `callCommand` execution, the Redo button is permanently disabled. The user performs an action, undoes it with Ctrl+Z (works), then tries Ctrl+Y to redo -- nothing happens.

**Why it happens:**
This is a confirmed OnlyOffice bug (reported March 2025, registered as a bug by the OO team). The `callCommand` method disrupts the redo history regardless of whether the command modifies content or not. The OO team's workaround suggestion was to use `executeMethod` instead, but `executeMethod` cannot create structured content via the Builder API.

**Consequences:**
- Users cannot redo Scribe operations
- Users cannot redo ANY operation after Scribe has executed a `callCommand`
- This is an upstream OO bug -- no workaround exists within the plugin

**Prevention:**
1. Accept this as a known limitation and document it
2. Do NOT try to work around it by chaining `executeMethod` calls -- the Builder API requires `callCommand`
3. Minimize the number of `callCommand` calls to reduce the window where redo is disrupted
4. Monitor the OO bug tracker for a fix (it was registered as a bug, fix not yet released as of March 2026)

**Detection:**
- After any Scribe operation, check if Ctrl+Y / Redo button works for operations done before the Scribe action

**Phase to address:** All phases -- this is an upstream limitation to accept and document, not to fix.

---

### Pitfall 5: ES5 Constraint Inside callCommand -- No Arrow Functions, No const/let, No Template Literals, No Destructuring

**What goes wrong:**
The developer writes the `callCommand` function body using modern JS syntax. The code fails silently or throws a syntax error in the OO editor sandbox.

**Why it happens:**
The `callCommand` function body is serialized as a string and executed in the OO editor's JS engine, which requires ES5 syntax. This is already documented in the project memory and code.js uses ES5 throughout. But the NEW risk is: the Markdown-to-Builder instruction interpreter will be the most complex code ever written inside `callCommand` for this plugin. It's easy to slip into ES6 syntax when writing 50+ lines of loop/switch logic.

**Consequences:**
- Silent failure: content not inserted, no error visible
- Intermittent: may work in dev (if OO desktop uses a newer engine) but fail in production web editor

**Prevention:**
1. Write the `callCommand` interpreter function in a separate file, clearly marked ES5-only
2. Use a linter rule or pre-commit check to flag ES6 syntax in that function
3. Test in the actual OO web editor (not just desktop), as the web sandbox is more restrictive
4. Patterns to avoid inside callCommand:
   - `const` / `let` -- use `var`
   - `() => {}` -- use `function() {}`
   - `` `template ${literals}` `` -- use `"string " + concatenation`
   - `{a, b} = obj` -- use `var a = obj.a; var b = obj.b;`
   - `for...of` -- use indexed `for` loops
   - `Array.from`, `Object.entries`, `Array.includes` -- use ES5 equivalents

**Detection:**
- callCommand silently does nothing
- Works in one OO environment but not another
- Browser console shows syntax error from OO internal eval

**Phase to address:** Phase 1 onward -- every phase that writes code inside callCommand must follow ES5.

---

## High-Severity Pitfalls

Mistakes that cause significant bugs, data issues, or major rework.

---

### Pitfall 6: InsertContent Replaces the Current Selection -- Must Manage Selection State Carefully

**What goes wrong:**
The developer calls `InsertContent` expecting it to insert at the cursor position, but it replaces whatever is currently selected. If the user's selection has changed between the time Scribe received the text and the time the Builder API runs, wrong content gets replaced.

**Why it happens:**
`InsertContent` inserts at the current document position, which means it replaces the active selection. The existing code handles this for `PasteHtml` (replace mode) and carefully manages cursor position for insert mode (see `pasteHtml()` lines 102-140). The Builder API via `InsertContent` has the same behavior.

The risk is amplified because the Builder API path involves more processing time (parse MD, build instruction set, execute), during which the user might click elsewhere in the document.

**Consequences:**
- Wrong text gets replaced
- User loses content they didn't intend to modify
- Especially dangerous in "insert after" mode -- the cursor must be positioned at the end of the selection before `InsertContent`

**Prevention:**
1. Use the same two-step pattern as the existing `pasteHtml()`: read-only `callCommand` to capture selection state + position cursor, then modification `callCommand` to insert
2. Set `pasteInProgress = true` before the operation to suppress `init()` interference (already done in existing code, line 97)
3. Stop hide polling during the operation (already done, line 98)
4. Keep the time between selection capture and insertion minimal -- do all MD parsing BEFORE the first callCommand, not between the two

**Detection:**
- Content appears in the wrong place in the document
- Original selection is not replaced (or wrong text is replaced)
- `init()` fires during the operation and resets `lastSelectedText`

**Phase to address:** Phase 1 -- selection management must be designed alongside the instruction interpreter.

---

### Pitfall 7: Post-Insertion Selection Is Unreliable -- GetRange/Select After InsertContent Fails

**What goes wrong:**
After `InsertContent`, the developer tries to select the newly inserted content (to highlight what Scribe added). `GetRange()` on the inserted paragraphs throws an error or returns null. `Select()` does nothing. The cursor ends up in an unpredictable position.

**Why it happens:**
This is a known OO limitation documented in their community forums. After `InsertContent`, the inserted elements are not yet fully processed as document elements. `GetRange()` on the inserted paragraph throws, `GetPosInParent()` returns null, and `Select()` does not work. The OO-suggested workaround is: use `Search()` to find the inserted text, then `GetRangeBySelect()` to get a range.

The project memory confirms this was already investigated: "OO returns inconsistent positions after PasteHtml -- see phase13-paste-select.md" and "post-paste selection was previously impossible with PasteHtml."

**Consequences:**
- Cannot highlight the inserted content for the user
- Cursor position after insert is unpredictable
- Attempting to select inserted content may cause OO errors

**Prevention:**
1. Do NOT try to select inserted content within the same `callCommand` that calls `InsertContent` -- the elements are not queryable yet
2. If post-insert selection is needed, use a separate follow-up approach:
   a. Insert a unique marker string (e.g., a zero-width character or unique ID) at the start and end of the content
   b. In a second (read-only) `callCommand`, use `Search()` to find the markers, then `GetRangeBySelect()` to select between them
   c. In a third `callCommand`, remove the markers
3. Accept that post-insert selection is a stretch goal, not a Phase 1 requirement
4. The Builder API may offer better positioning than PasteHtml since you control element creation -- but this needs empirical validation

**Detection:**
- `GetRange()` throws inside callCommand after InsertContent
- Cursor appears at the document start or end instead of at the insertion point
- Selection highlight does not appear

**Phase to address:** Dedicated late phase -- post-insert selection is complex and should not block core injection functionality.

---

### Pitfall 8: Base64 Images Via Asc.scope Can Bloat the Payload and Cause Latency or Failure

**What goes wrong:**
The developer passes base64-encoded images (extracted from the original document) through `Asc.scope` to recreate them via `Api.CreateImage("data:image/jpeg;base64,...")`. For documents with multiple images or high-resolution images, the `Asc.scope` payload becomes several megabytes. The bridge slows down or silently drops the data.

**Why it happens:**
Base64 encoding increases data size by ~33%. A single high-res image can be 2-5MB in base64. The OO message bridge between the plugin iframe and editor sandbox is optimized for small JSON payloads (the OO blog specifically warns about this). Additionally, OO's JWT documentation warns against sending base64 images through JWT because "the token will be too long" -- the same principle applies to `Asc.scope`.

**Consequences:**
- Insertion hangs or takes several seconds
- Large images silently fail to insert
- Plugin appears frozen during the bridge transfer

**Prevention:**
1. For the initial Builder API implementation, skip image handling entirely -- focus on text formatting (bold, italic, lists, headings)
2. When images are needed, consider alternatives to base64:
   a. If the image has a URL (e.g., hosted on Cozy), pass the URL to `Api.CreateImage(url, width, height)` instead of base64
   b. If base64 is required, pass images as separate Asc.scope properties (not inline in the instruction array) and reference them by index
3. Set a size limit: skip images larger than 500KB base64 and log a warning
4. Test with realistic image sizes from actual Cozy Drive documents

**Detection:**
- callCommand takes > 2 seconds to execute
- Callback never fires for documents with images
- Small-image documents work, large-image documents fail

**Phase to address:** Dedicated image phase (not Phase 1) -- text formatting first, images second.

---

### Pitfall 9: Markdown Parser Must Handle LLM Output Quirks, Not Just Spec-Compliant Markdown

**What goes wrong:**
The ES5 Markdown parser handles standard Markdown correctly but fails on common LLM output patterns: inconsistent heading levels, code blocks without language tags, lists with mixed indentation, bare URLs, excessive blank lines, markdown inside code blocks.

**Why it happens:**
LLMs (GPT, Claude, Mistral) produce Markdown-like output that often deviates from CommonMark:
- Double newlines inside list items (breaks list continuation)
- `**bold**` immediately adjacent to punctuation without spaces
- Nested lists with 2-space indent (CommonMark requires 4)
- HTML entities mixed with Markdown (`&mdash;` inside bold markers)
- Trailing whitespace that creates unintended `<br>` in strict parsers

The existing pipeline uses `marked` (a mature parser) on the React side for preview rendering, but the callCommand parser must be a custom ES5 implementation that handles these same quirks.

**Consequences:**
- Bold/italic not detected in edge cases
- Lists rendered as separate paragraphs instead of list items
- Preview (react-markdown) looks correct but injected document looks wrong

**Prevention:**
1. Build a test suite of real LLM outputs (capture 20+ actual Scribe responses across all actions)
2. Compare parsed output against `marked` output for each test case
3. Handle common LLM quirks explicitly:
   - Normalize line endings (`\r\n` to `\n`)
   - Collapse 3+ blank lines to 2
   - Support both 2-space and 4-space list indentation
   - Handle `**bold**` adjacent to punctuation
4. Keep the parser simple: support headings, bold, italic, lists (ordered/unordered), code blocks, paragraphs. Do NOT try to support the full CommonMark spec -- it's unnecessary and adds ES5 complexity
5. Use a token-based approach (line-by-line for blocks, regex for inline) rather than a full AST parser

**Detection:**
- Preview panel shows correct formatting but inserted document has wrong formatting
- Lists appear as numbered paragraphs
- Bold text appears as `**text**` literally in the document

**Phase to address:** Phase 1-2 -- the parser is foundational. Build with test cases from day one.

---

### Pitfall 10: CreateTable Width/Formatting Lost When InsertContent Places Table in Document

**What goes wrong:**
The developer creates a table with `Api.CreateTable(cols, rows)`, sets column widths with `SetWidth("twips", value)`, applies cell formatting -- then calls `InsertContent([table])`. The table appears in the document but column widths are reset to auto, borders are missing, or cell alignment is lost.

**Why it happens:**
`InsertContent` has a `KeepTextOnly` option and default property-preservation behavior that may strip table formatting. The `isInline` parameter behavior with tables is undocumented. Additionally, tables created via Builder API may have different default styling than tables created through the OO UI -- the UI applies the current table style, while the API creates unstyled tables.

**Consequences:**
- Tables appear but look wrong (wrong widths, no borders, misaligned)
- Significant debugging time because the table "works" but looks different from what the user expects

**Prevention:**
1. After creating a table, explicitly set ALL formatting properties:
   - `table.SetWidth("percent", 100)` for full-width tables
   - `table.SetTableLayout("fixed")` if column widths should be preserved
   - Set borders explicitly on each cell (do not rely on default table style)
   - Set cell padding/margin explicitly
2. Test table insertion with `InsertContent` specifically -- table formatting that works with `Push()` in Document Builder standalone may behave differently with `InsertContent` in a plugin
3. Start with simple tables (no merged cells, uniform column widths) and add complexity incrementally

**Detection:**
- Table appears in document but looks different from the preview
- Column widths are equal despite being set to different values
- Borders are missing or inconsistent

**Phase to address:** Dedicated table phase -- tables are complex enough to warrant their own implementation phase after basic text formatting works.

---

## Moderate Pitfalls

---

### Pitfall 11: PasteHtml Fallback Path Must Be Preserved -- Builder API Is Not a Complete Replacement on Day One

**What goes wrong:**
The developer removes the existing `PasteHtml` path (lines 96-155 of code.js) to replace it with Builder API injection. The Builder API handles basic formatting but fails on an edge case (e.g., complex nested lists). The user gets no content insertion at all instead of a degraded-but-functional PasteHtml insertion.

**Why it happens:**
The Builder API migration is incremental. The v2.1 PasteHtml pipeline works for most cases. Removing it before the Builder API handles ALL cases means regression.

**Prevention:**
1. Keep PasteHtml as a fallback: `if (builderApiSupported && !fallbackNeeded) { useBuilderApi() } else { usePasteHtml() }`
2. Add a feature flag or capability check to switch between Builder API and PasteHtml
3. The Builder API path should be additive (new code path), not a replacement of existing code
4. Only remove PasteHtml after ALL content types (text, lists, tables, images) are handled by Builder API

**Detection:**
- Content that previously inserted correctly now fails to insert
- Regression in basic text insertion while working on advanced features

**Phase to address:** Phase 1 (architecture) -- design the fallback strategy from the start.

---

### Pitfall 12: Paragraph Properties (Alignment, Spacing, Indentation) Not Preserved Through Markdown Round-Trip

**What goes wrong:**
The user has a paragraph with center alignment, 1.5 line spacing, and 12pt after-paragraph spacing. Scribe extracts the text, sends it to the LLM, gets back Markdown, and injects via Builder API. The new paragraph has default properties: left-aligned, single-spaced, no extra spacing. The formatting of the original document is destroyed.

**Why it happens:**
Markdown has no concept of paragraph alignment, spacing, or indentation. The HTML-to-Markdown conversion (Turndown) loses these properties. The LLM operates on Markdown text and cannot preserve what was lost. The Builder API creates paragraphs with default properties.

This is acknowledged in the project requirements: "Strategie de preservation du formatage d'origine perdu par l'aller-retour Markdown."

**Prevention:**
1. Before sending to the LLM, capture the paragraph properties of the selected content via a read-only `callCommand`:
   - `paragraph.GetJc()` (alignment)
   - `paragraph.GetSpacingBefore()` / `GetSpacingAfter()`
   - `paragraph.GetIndLeft()` / `GetIndRight()` / `GetIndFirstLine()`
   - `paragraph.GetStyle()` (style name)
2. Store these properties alongside the instruction set
3. When building paragraphs in the insertion callCommand, apply the captured properties:
   - `newParagraph.SetJc(originalAlignment)`
   - `newParagraph.SetSpacingBefore(originalSpacing)`
4. For "replace" mode: apply the first original paragraph's properties to all new paragraphs (or map 1:1 if paragraph count matches)
5. For "insert" mode: use the last original paragraph's properties as a template

**Detection:**
- Inserted text has different alignment than original
- Line spacing changes after Scribe replace
- Indentation is lost

**Phase to address:** Phase 2-3 -- property preservation requires the read-only prep callCommand to be extended.

---

### Pitfall 13: OO Ordered List Bug (#79263) Still Exists -- Builder API May Have the Same Issue

**What goes wrong:**
Ordered lists inserted via the API render incorrectly -- numbering restarts at 1 for each item, or list items are not recognized as part of a list.

**Why it happens:**
The project context mentions a known OO bug (#79263) with ordered lists in PasteHtml. This may or may not affect Builder API list creation (different code path in OO). But `Api.CreateNumbering("numbered")` and paragraph `SetNumbering()` use the same internal numbering engine.

**Prevention:**
1. Test ordered list creation via Builder API early -- before building the full parser
2. Create a minimal test: 3-item numbered list via `callCommand` with `Api.CreateNumbering("numbered")` and verify rendering
3. If the bug affects Builder API too, document it and provide a workaround (e.g., manually setting list level and start number)
4. Compare Builder API list rendering with PasteHtml list rendering to determine which is more reliable

**Detection:**
- Numbered list starts at 1 for every item instead of incrementing
- List items appear as regular paragraphs with "1. " prefix text
- List indentation is wrong

**Phase to address:** Phase 1-2 -- test early, before investing in a complex list parser.

---

### Pitfall 14: callCommand Return Value Only Supports JS Standard Types -- Objects Return as undefined

**What goes wrong:**
The developer returns a complex object from `callCommand` to get information about the insertion result (e.g., position, paragraph count). The callback receives `undefined`.

**Why it happens:**
Per OO docs: "Only the js standard types are available (any objects will be replaced with undefined)." This means you can return strings, numbers, booleans -- but not objects or arrays directly. You must `JSON.stringify()` inside callCommand and `JSON.parse()` in the callback. The existing code already does this correctly (line 140-141: `return JSON.stringify(result)` inside callCommand, `JSON.parse(prepResult)` in callback).

**Prevention:**
1. Always `JSON.stringify()` any structured return value inside callCommand
2. Always `JSON.parse()` in the callback
3. Keep return payloads small (the return also crosses the message bridge)
4. Follow the existing pattern in `pasteHtml()` -- it's the proven approach

**Detection:**
- Callback receives `undefined` when an object was returned
- Callback receives `"[object Object]"` (toString instead of serialize)

**Phase to address:** All phases -- follow the existing pattern, no new design needed.

---

## Minor Pitfalls

---

### Pitfall 15: Api.CreateRun() vs Paragraph.AddText() -- Formatting Granularity Confusion

**What goes wrong:**
The developer uses `paragraph.AddText("hello world")` and then tries to apply bold to only "hello". It applies to the entire paragraph text because `AddText` creates a single run.

**Why it happens:**
`AddText()` is a convenience method that creates one run with the given text. To apply different formatting to different parts of the same paragraph, you must create separate `ApiRun` objects: `var run1 = Api.CreateRun(); run1.AddText("hello"); run1.SetBold(true); paragraph.AddElement(run1);`

**Prevention:**
1. Use `Api.CreateRun()` for ALL text insertion, never `paragraph.AddText()` for mixed-format paragraphs
2. Each inline formatting span (bold, italic, bold+italic) needs its own Run
3. The instruction set should emit one "run" entry per formatting change

**Detection:**
- Entire paragraph is bold when only one word should be
- Formatting changes apply to wrong text spans

**Phase to address:** Phase 1 -- the instruction interpreter must use Runs, not AddText.

---

### Pitfall 16: Image Dimensions Must Be Specified in EMUs (English Metric Units), Not Pixels

**What goes wrong:**
The developer calls `Api.CreateImage(src, 200, 100)` thinking the dimensions are pixels. The image appears as a tiny speck in the document.

**Why it happens:**
`Api.CreateImage(sImageSrc, nWidth, nHeight)` expects dimensions in EMUs (1 inch = 914400 EMUs, 1 pixel ~= 9525 EMUs at 96 DPI). The OO docs and examples use values like `150 * 36000` (which is 150mm in EMUs).

**Prevention:**
1. Always multiply pixel dimensions by 9525 to convert to EMUs: `Api.CreateImage(src, widthPx * 9525, heightPx * 9525)`
2. Or use mm: multiply by 36000
3. Add a helper comment in the callCommand code: `// OO EMU: 1px = 9525 EMU, 1mm = 36000 EMU`
4. Set reasonable defaults for images without known dimensions (e.g., 300px width, proportional height)

**Detection:**
- Images appear microscopic in the document
- Images appear enormous (raw pixel values interpreted as EMUs)

**Phase to address:** Image handling phase -- not Phase 1.

---

### Pitfall 17: pasteInProgress Guard Must Extend to Builder API Path

**What goes wrong:**
The developer adds a new Builder API insertion path but forgets to set `pasteInProgress = true` before the operation. During the callCommand execution, OO fires `init()` with new selection data (because the document changed), which resets `lastSelectedText` and `lastSelectedHtml`. The next Scribe operation uses stale or empty data.

**Why it happens:**
The existing `pasteInProgress` guard (code.js line 86, checked at line 296) suppresses `init()` during PasteHtml operations. The Builder API path needs the same guard, plus `stopHidePolling()`.

**Prevention:**
1. Set `pasteInProgress = true` and call `stopHidePolling()` at the start of any Builder API insertion
2. Reset `pasteInProgress = false` in the final callback
3. Follow the exact same pattern as `pasteHtml()` lines 97-98 and 152

**Detection:**
- `init()` fires during insertion (visible in console as "[Scribe] init() called")
- `lastSelectedText` becomes empty mid-operation
- Subsequent Scribe operations fail because selection state was reset

**Phase to address:** Phase 1 -- copy the guard pattern from day one.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| MD Parser (ES5) | Parser relies on DOM APIs not available in callCommand sandbox | Parse OUTSIDE callCommand, pass instruction set via Asc.scope |
| MD Parser (ES5) | ES6 syntax slips into callCommand function body | Linter rule or manual review for ES5 compliance |
| MD Parser (ES5) | LLM output quirks break parser | Build test suite from real Scribe LLM responses |
| Instruction Interpreter | Multiple callCommand calls create multiple undo points | Single callCommand for all content creation + InsertContent |
| Instruction Interpreter | Asc.scope payload too large (images) | Defer images; keep initial payload text-only |
| Instruction Interpreter | Return value from callCommand is undefined (object, not string) | JSON.stringify in callCommand, JSON.parse in callback |
| Text Formatting | AddText instead of CreateRun for mixed formatting | Always use CreateRun for inline formatting |
| Text Formatting | Paragraph properties (alignment, spacing) lost | Capture original properties in read-only prep callCommand |
| List Handling | OO ordered list bug affects Builder API too | Test list creation early with minimal example |
| Table Handling | Column widths reset after InsertContent | Set table layout to "fixed", set widths explicitly |
| Image Handling | Base64 bloats Asc.scope, EMU dimensions wrong | URL-based images preferred, convert px to EMU |
| Selection Post-Insert | GetRange/Select fails after InsertContent | Marker-based search workaround, defer to late phase |
| Integration | PasteHtml fallback removed prematurely | Keep PasteHtml as fallback until Builder API covers all cases |
| Integration | pasteInProgress not set for Builder API path | Copy existing guard pattern from pasteHtml() |

---

## Integration Pitfalls with Existing PasteHtml Fallback

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Builder API succeeds for paragraphs but fails for tables | User gets partial content | Detect failure, fall back to PasteHtml for the entire content |
| Builder API and PasteHtml both active in same session | Inconsistent undo behavior (PasteHtml = 1 undo point via executeMethod, Builder = 1 via callCommand) | Both should be single undo point -- test both paths |
| Feature flag switches mid-operation | Race condition between paths | Feature flag checked once at operation start, not per-element |
| Builder API callCommand fails silently | User clicks Replace, nothing happens | Add timeout detection: if callback doesn't fire within 5s, fall back to PasteHtml |

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Parser inside callCommand (Pitfall 1) | HIGH | Rewrite: move parser outside, design instruction set, rewrite callCommand as interpreter |
| Multiple undo points (Pitfall 3) | HIGH | Merge all content creation into single callCommand -- may require rearchitecting the instruction interpreter |
| ES6 in callCommand (Pitfall 5) | LOW | Find and replace ES6 syntax -- mechanical fix |
| Lost paragraph properties (Pitfall 12) | MEDIUM | Add property capture in prep callCommand, apply in insertion callCommand |
| Premature PasteHtml removal (Pitfall 11) | MEDIUM | Restore from git, add fallback branching |
| Post-insert selection fails (Pitfall 7) | LOW (if deferred) | Accept limitation, implement marker-based workaround in later phase |

---

## Sources

- [OO callCommand documentation](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/) -- HIGH confidence, official docs
- [OO Redo bug after callCommand](https://community.onlyoffice.com/t/can-not-redo-after-execute-connectors-callcommand-method/12614) -- HIGH confidence, confirmed bug by OO team
- [OO InsertContent API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/InsertContent/) -- HIGH confidence, official docs
- [OO Creating formatted table sample](https://api.onlyoffice.com/docs/office-api/samples/text-document-editor/creating-formatted-table/) -- HIGH confidence, official example
- [OO CreateImage API](https://api.onlyoffice.com/docbuilder/textdocumentapi/api/createimage) -- HIGH confidence, official docs
- [OO Plugin tips, tricks, and pitfalls (Jan 2026)](https://www.onlyoffice.com/blog/2026/01/creating-onlyoffice-plugins-tips-tricks-and-hidden-pitfalls) -- HIGH confidence, official blog
- [OO Issue: retrieving paragraph after InsertContent](https://community.onlyoffice.com/t/issue-in-retrieving-newly-created-paragraph-element/10415) -- MEDIUM confidence, community forum
- [OO Creating auto-width table](https://api.onlyoffice.com/docs/office-api/samples/text-document-editor/creating-auto-width-table/) -- HIGH confidence, official sample
- Direct analysis of `plugins/onlyoffice-scribe/scripts/code.js` -- HIGH confidence, source code
- Project memory (MEMORY.md) -- HIGH confidence, verified project history

---
*Pitfalls research for: Document Builder API injection in Scribe v2.4 (Cozy Drive + OnlyOffice)*
*Researched: 2026-03-15*
