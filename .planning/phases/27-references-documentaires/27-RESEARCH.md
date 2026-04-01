# Phase 27: References Documentaires - Research

**Researched:** 2026-04-01
**Domain:** OO Document API footnotes, cross-references, round-trip preservation through LLM pipeline
**Confidence:** MEDIUM

## Summary

This phase adds footnote and cross-reference preservation to the Scribe extraction/injection pipeline. The key challenge is that footnote reference marks and cross-reference fields are internal OO elements that the public API exposes only partially. There is no dedicated `GetClassType()` value for footnotes or cross-references -- they appear as either `"run"` elements with special styles or as internal field characters not directly accessible through the builder API iteration.

The research reveals that OO provides robust APIs for **creating** footnotes and cross-references (`AddFootnote()`, `AddFootnoteCrossRef()`, `AddHeadingCrossRef()`, `AddBookmarkCrossRef()`), but the **detection** of existing footnote references within paragraph elements requires empirical testing. The footnote reference mark is internally a `wDa`/`CRunFootnoteReference` element that may or may not be visible through `paragraph.GetElement(i)`. Cross-references are implemented as field codes (fldChar begin/instrText/separate/end pattern) which are similarly opaque through the API.

**Primary recommendation:** Implement a two-phase approach: (1) empirical testing via a diagnostic callCommand to determine exactly how footnote references and cross-references appear in paragraph element iteration, then (2) build the cache/marker/restore pattern matching the proven image round-trip architecture.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Footnote calls extracted as `[^N]` markers in markdown (standard markdown footnote syntax)
- Each footnote gets unique N (like `scribe-img-N` for images)
- Footnote content (text at bottom of page) is NOT extracted -- only the call marker
- If LLM removes `[^N]` marker, footnote call is dropped (same as images)
- Cross-references extracted as `{{REF:scribe-ref-N:visible text}}` markers
- Injection: footnotes via `Copy()` pre-cache (same as images), cross-references via API recreation or `Copy()` fallback
- Pattern follows image round-trip: extract -> mark -> cache -> inject
- Multiple footnotes per selection: each gets own `[^N]`
- Footnotes in table cells: same treatment via `extractCellContent` -> `paragraphToMarkdown`
- Endnotes are OUT OF SCOPE

### Claude's Discretion
- Exact OO API calls for footnote/cross-reference detection (GetClassType values, property access)
- Whether `Copy()` works on footnote/cross-reference elements (needs empirical testing)
- Cache key naming convention (e.g., `scribe-fn-N`, `scribe-ref-N`)
- System prompt additions to instruct LLM to preserve `[^N]` and `{{REF:...}}` markers

### Deferred Ideas (OUT OF SCOPE)
- Endnotes (notes de fin)
- Footnote content editing
- Table of contents references
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REF-01 | Footnotes in selection are detected and preserved in round-trip (content modifiable, reference stays intact) | Footnote detection via paragraph element iteration + `Copy()` pre-cache pattern; injection via `AddFootnote()` + `GetFootnotesFirstParagraphs()` or cached copy restoration |
| REF-02 | Cross-references (internal document references) in selection are detected and preserved in round-trip | Cross-reference recreation via `AddFootnoteCrossRef()` / `AddHeadingCrossRef()` / `AddBookmarkCrossRef()` APIs; `{{REF:...}}` marker pattern |
</phase_requirements>

## Architecture Patterns

### Critical Discovery: No Dedicated GetClassType for Footnotes/Cross-Refs

**Confidence: HIGH** (verified against OO SDK source `sdk-all.js` on running container)

The complete list of `GetClassType()` return values in the OO text document API is:
`"blockLvlSdt"`, `"chart"`, `"color"`, `"comment"`, `"document"`, `"documentContent"`, `"drawing"`, `"fill"`, `"group"`, `"hyperlink"`, `"image"`, `"inlineLvlSdt"`, `"paragraph"`, `"range"`, `"run"`, `"section"`, `"shape"`, `"style"`, `"table"`, `"tableCell"`, `"tableRow"`, `"textPr"`, `"unsupported"`, and various form/annotation types.

There is **NO** `"footnote"`, `"footnoteReference"`, `"endnote"`, `"field"`, or `"crossReference"` class type.

**Implication:** Footnote reference marks and cross-reference fields inside paragraphs either:
1. Appear as regular `"run"` elements with special styling (FootnoteReference style, superscript)
2. Are skipped/invisible when iterating via `GetElement(i)` (internal elements not exposed through API)
3. Return `"unsupported"` as their class type

This MUST be determined empirically with a test macro before implementation.

### Internal SDK Representation (LOW confidence -- minified source analysis)

From the OO SDK (`sdk-all.js`), footnote references are internally `AscWord.wDa` objects with type code `ki`. They follow the OOXML structure where a footnote reference is a special run-like element inside a paragraph. Cross-references use the field character pattern (`fldChar` begin/instrText/separate/end).

The OOXML paragraph model stores these as:
```
Paragraph elements: [Run, Run, FootnoteReference, Run, ...]
                                  ^-- internal type, may not be exposed via GetElement()
```

### Recommended Detection Strategy

**Phase 1: Empirical Discovery (Wave 0)**

Create a diagnostic callCommand that:
1. Opens a document with known footnotes and cross-references
2. Iterates all paragraph elements via `GetElement(i)` and `GetClassType()`
3. Logs what types appear, what `GetText()` returns for each
4. Tests if footnote reference elements are visible or invisible
5. Tests `Copy()` on any discovered footnote elements

```javascript
// ES5 diagnostic code for callCommand
var doc = Api.GetDocument();
var paras = doc.GetAllParagraphs();
var results = [];
for (var pi = 0; pi < paras.length; pi++) {
  var para = paras[pi];
  var count = para.GetElementsCount();
  for (var ei = 0; ei < count; ei++) {
    var el = para.GetElement(ei);
    var ct = el.GetClassType ? el.GetClassType() : "unknown";
    var text = el.GetText ? el.GetText() : "";
    var style = "";
    if (ct === "run") {
      var tp = el.GetTextPr ? el.GetTextPr() : null;
      if (tp) {
        style = tp.GetStyle ? tp.GetStyle() : "";
        // Check for superscript (VertAlign)
        var va = tp.GetVertAlign ? tp.GetVertAlign() : "";
      }
    }
    results.push({
      para: pi, elem: ei, classType: ct, text: text,
      style: style, vertAlign: va
    });
  }
}
Asc.scope.diagnosticResults = JSON.stringify(results);
```

**Phase 2: Implementation Based on Discovery**

Three possible outcomes and their strategies:

| Discovery | Footnote Strategy | Cross-Ref Strategy |
|-----------|------------------|--------------------|
| Elements visible as `"run"` with specific style | Detect via style name "FootnoteReference" or superscript VertAlign | Detect via field-related properties |
| Elements visible as `"unsupported"` | Detect via `GetClassType() === "unsupported"`, use `Copy()` | Same pattern |
| Elements invisible (not returned by GetElement) | Use `GetFootnotesFirstParagraphs()` count + position correlation | Use document-level field scanning |

### Recommended Project Structure (extraction side)

```
paragraphToMarkdown() changes:
  |-- detect footnote ref elements --> emit [^N] marker
  |-- detect cross-ref elements --> emit {{REF:scribe-ref-N:visible text}} marker

Injection callCommand changes:
  |-- footnoteCache: { "scribe-fn-N": CopiedElement }  (like imageCache)
  |-- crossRefCache: { "scribe-ref-N": { type, target, ... } }
  |-- restoreFootnote(name): restore from cache
  |-- restoreCrossRef(name): recreate via API or restore from cache
```

### Pattern: Follow Image Round-Trip Architecture

The image round-trip is the proven pattern to replicate:

**Extraction (paragraphToMarkdown):**
```javascript
// After the existing hyperlink and run handling:
// NEW: footnote reference detection
if (classType === "run" || classType === "unsupported") {
  // Check if this is a footnote reference
  // (exact detection TBD after empirical testing)
  var fnName = "scribe-fn-" + Asc.scope.fnCounter;
  Asc.scope.fnCounter = Asc.scope.fnCounter + 1;
  annotatedParts.push({ text: "[^" + fnName + "]", raw: true });
}
```

**Pre-cache (injection callCommand):**
```javascript
// Like drawingIndex + imageCache, build footnoteIndex + footnoteCache
var footnoteIndex = {};  // name -> element reference
var footnoteCache = {};  // name -> Copy()
// Scan paragraphs for footnote references, index them
// Then Copy() referenced ones before InsertContent destroys selection
```

**Injection (addRunsToParagraph):**
```javascript
// Like run.imageMarker handling:
if (run.footnoteMarker) {
  var fnElement = restoreFootnote(run.footnoteMarker);
  if (fnElement) {
    para.AddElement(fnElement);
  }
}
```

### Anti-Patterns to Avoid
- **Don't try to parse OOXML directly** -- use the API, not internal document format
- **Don't recreate footnotes from scratch unless Copy() fails** -- footnote content lives outside the selection; recreation would lose it
- **Don't merge `[^N]` markers during flattenTokens** -- they're plain text tokens, they just pass through
- **Don't add footnote definitions (`[^N]: text`) to the markdown** -- the footnote body is not in scope

## Standard Stack

### Core (existing -- no new libraries needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| marked | 17.0.4 | Markdown lexer/parser | Already in vendor/, `[^N]` passes through as plain text |
| OO Document API | 9.x | Document manipulation | Already the runtime environment |

### No New Dependencies

This phase adds no new libraries. All work is in `code.js` (extraction/injection) and `scribeAI.js` (system prompt). The `[^N]` and `{{REF:...}}` markers survive `marked.lexer` as plain text without any changes to the parser.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Footnote creation | Custom footnote builder | `Copy()` from pre-cache | Footnote content is outside selection -- can't recreate it |
| Cross-ref to headings | Manual field code insertion | `AddHeadingCrossRef()` | API handles complex field code generation |
| Cross-ref to bookmarks | Manual field code insertion | `AddBookmarkCrossRef()` | API handles complex field code generation |
| Cross-ref to footnotes | Manual field code insertion | `AddFootnoteCrossRef()` | API handles complex field code generation |
| Footnote numbering | Manual superscript number | OO automatic numbering | OO manages footnote numbers automatically |

## OO API Reference: Footnotes and Cross-References

### Footnote APIs (on ApiDocument)

**Confidence: HIGH** (verified via official docs)

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `AddFootnote()` | none | `ApiDocumentContent` | Adds footnote at current selection/position |
| `GetFootnotesFirstParagraphs()` | none | `ApiParagraph[]` | Returns first paragraph of each footnote |
| `GetEndNotesFirstParagraphs()` | none | `ApiParagraph[]` | Returns first paragraph of each endnote |
| `SelectNoteReference()` | none | `boolean` | Selects the reference mark (the superscript number) |
| `GetCurrentFootEndnote()` | none | `ApiDocumentContent` | Returns footnote/endnote content if cursor is inside one |

### Cross-Reference APIs (on ApiParagraph)

**Confidence: HIGH** (verified via official docs)

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `AddFootnoteCrossRef(sRefType, oParaTo, bLink, bAboveBelow)` | `footnoteRefTo` enum, `ApiParagraph`, bool, bool | `boolean` | Adds cross-ref to a footnote |
| `AddHeadingCrossRef(sRefType, oParaTo, bLink, bAboveBelow)` | `headingRefTo` enum, `ApiParagraph`, bool, bool | `boolean` | Adds cross-ref to a heading |
| `AddBookmarkCrossRef(sRefTo, sBookmarkName, bLink, bAboveBelow, sSepWith)` | `bookmarkRefTo` enum, string, bool, bool, string | `boolean` | Adds cross-ref to a bookmark |
| `AddEndnoteCrossRef(sRefType, oParaTo, bLink, bAboveBelow)` | enum, `ApiParagraph`, bool, bool | `boolean` | Adds cross-ref to an endnote |
| `AddNumberedCrossRef(...)` | ... | `boolean` | Adds cross-ref to a numbered paragraph |
| `AddCaptionCrossRef(...)` | ... | `boolean` | Adds cross-ref to a caption |

### Cross-Reference Enum Values

**footnoteRefTo:** `"footnoteNum"`, `"pageNum"`, `"aboveBelow"`, `"formFootnoteNum"`

**headingRefTo:** `"text"`, `"pageNum"`, `"headingNum"`, `"noCtxHeadingNum"`, `"fullCtxHeadingNum"`, `"aboveBelow"`

**bookmarkRefTo:** `"text"`, `"pageNum"`, `"paraNum"`, `"noCtxParaNum"`, `"fullCtxParaNum"`, `"aboveBelow"`

### Cross-Reference Recreation Pattern

```javascript
// ES5 -- inside callCommand
// To recreate a heading cross-reference:
var headingParas = doc.GetAllHeadingParagraphs();
var targetPara = headingParas[targetIndex]; // need to identify correct heading
var newPara = Api.CreateParagraph(); // or use existing para
newPara.AddHeadingCrossRef("text", targetPara, true, false);

// To recreate a footnote cross-reference:
var fnParas = doc.GetFootnotesFirstParagraphs();
var targetFnPara = fnParas[targetFnIndex];
var newPara = Api.CreateParagraph();
newPara.AddFootnoteCrossRef("formFootnoteNum", targetFnPara, true, false);

// To recreate a bookmark cross-reference:
var bookmarkNames = doc.GetAllBookmarksNames();
newPara.AddBookmarkCrossRef("text", bookmarkNames[targetIdx], true, false);
```

## Common Pitfalls

### Pitfall 1: Footnote Reference Elements May Be Invisible
**What goes wrong:** Iterating paragraph elements via `GetElement(i)` may skip footnote reference marks entirely. The API may only expose text runs and hyperlinks, hiding internal footnote/field elements.
**Why it happens:** The builder API was designed for document creation, not introspection. Not all internal OOXML elements are mapped to API objects.
**How to avoid:** Run the diagnostic macro FIRST. If elements are invisible, use an alternative detection strategy (footnote count correlation, text content analysis).
**Warning signs:** `GetElementsCount()` returns fewer elements than expected; no `"unsupported"` types appear where footnotes should be.

### Pitfall 2: Copy() May Not Work on Footnote References
**What goes wrong:** `Copy()` on a footnote reference element may throw or return null, unlike image drawings where `Copy()` works reliably.
**Why it happens:** Footnote references are linked to footnote content objects; copying the reference without the content may be undefined behavior.
**How to avoid:** Always wrap `Copy()` in try/catch (existing pattern). Have a fallback: if `Copy()` fails, use `AddFootnote()` + content restoration via `GetFootnotesFirstParagraphs()`.
**Warning signs:** `Copy()` throws, returns null, or the copied element doesn't insert properly.

### Pitfall 3: Cross-Reference Recreation Requires Target Identification
**What goes wrong:** `AddHeadingCrossRef()` requires a reference to the target paragraph. During injection, you need to map from the `{{REF:scribe-ref-N}}` marker back to the correct heading/bookmark/footnote in the document.
**Why it happens:** Cross-references are field codes that point to specific document locations. The marker must carry enough metadata to re-identify the target.
**How to avoid:** Store target identification metadata in the cache: heading text, bookmark name, footnote index, paragraph internal ID. Use this to find the target paragraph during injection.
**Warning signs:** Cross-reference points to wrong target or inserts as dead text.

### Pitfall 4: InsertContent Destroys Footnote Elements
**What goes wrong:** Like images, footnote references in the selection are destroyed when `InsertContent` replaces the selection. Pre-caching via `Copy()` must happen BEFORE `InsertContent`.
**Why it happens:** `InsertContent` removes the selected range entirely, including any embedded objects.
**How to avoid:** Follow the image pattern exactly: build index -> `Copy()` -> `InsertContent` -> restore from cache.
**Warning signs:** Footnotes disappear after Replace/Insert.

### Pitfall 5: `[^N]` Looks Like Markdown Footnote Definition to Some LLMs
**What goes wrong:** LLMs familiar with markdown footnotes may try to add `[^N]: definition text` at the bottom of their response, thinking the footnote is incomplete.
**Why it happens:** Standard markdown footnote syntax has both a reference (`[^1]`) and a definition (`[^1]: text`).
**How to avoid:** System prompt must explicitly state: "The `[^N]` markers are footnote references. Do NOT add footnote definitions (`[^N]: text`). The footnote content is managed separately."
**Warning signs:** LLM adds `[^1]: Some text` at the end of its response.

### Pitfall 6: ES5 Constraint in callCommand
**What goes wrong:** Using `const`, `let`, arrow functions, or template literals in callCommand code.
**Why it happens:** Habit from writing modern JavaScript.
**How to avoid:** All code inside callCommand must use `var`, `function`, string concatenation. Existing pattern is well-established.

## Code Examples

### Marker Format Examples

```
Input text in OO:   "This sentence has a footnote¹ and references See Chapter 3 elsewhere."
                                               ^                   ^^^^^^^^^^^^^^^
                                          footnote ref          cross-reference field

Extracted markdown: "This sentence has a footnote[^scribe-fn-1] and references {{REF:scribe-ref-1:See Chapter 3}} elsewhere."

LLM modified:      "This phrase contains a footnote[^scribe-fn-1] and points to {{REF:scribe-ref-1:See Chapter 3}} in the document."

After injection:   "This phrase contains a footnote¹ and points to See Chapter 3 in the document."
                                                   ^                ^^^^^^^^^^^^^^^
                                          restored footnote     restored cross-ref
```

### System Prompt Additions

```javascript
// In scribeAI.js buildMessages():
if (extra?.enrichedMd && (extra.enrichedMd.includes('[^scribe-fn-') || extra.enrichedMd.includes('{{REF:'))) {
  systemBase += ' Preserve all [^scribe-fn-N] footnote markers exactly as-is. Do NOT add footnote definitions ([^N]: text). '
    + 'Preserve all {{REF:scribe-ref-N:visible text}} cross-reference markers exactly as-is. '
    + 'You may modify the surrounding text but must keep these markers intact and in their original positions relative to the content they annotate.';
}
```

### Image Cache Pattern (reference for replication)

```javascript
// Existing pattern in code.js (injection callCommand):
// 1. Build index: scan all paragraphs for named drawings
var drawingIndex = {};  // name -> ApiDrawing
// 2. Copy referenced ones before InsertContent
var imageCache = {};    // name -> ApiDrawing (copy)
if (drawingIndex[name]) {
  try { imageCache[name] = drawingIndex[name].Copy(); } catch (e) {}
}
// 3. Restore function (re-copies for reuse)
function restoreImage(name) {
  var cached = imageCache[name];
  if (!cached) return null;
  try { imageCache[name] = cached.Copy(); } catch (e) { imageCache[name] = null; }
  return cached;
}
```

### flattenTokens: No Changes Needed

Both `[^scribe-fn-N]` and `{{REF:scribe-ref-N:visible text}}` pass through `marked.lexer` as plain text tokens. The `flattenTokens` function already handles plain text correctly. However, the injection side (`flattenInline` or a pre-processing step in `buildAndInject`) needs to detect these markers in text runs and convert them to special run types:

```javascript
// In buildAndInject(), before passing to callCommand:
// Convert footnote markers in runs
md = md.replace(/\{\{REF:(scribe-ref-\d+):([^}]*)\}\}/g, '{{REF:$1}}');
// Note: visible text is stripped for the LLM response parsing;
// the actual display text comes from the restored cross-reference
```

Or in `flattenInline`, add marker detection similar to the image marker pattern:

```javascript
// After existing image marker handling in flattenInline:
if (tok.type === "text") {
  var fnMatch = tok.text.match(/\[\^(scribe-fn-\d+)\]/);
  if (fnMatch) {
    // Split text around the marker, emit footnoteMarker run
    runs.push({ text: "", footnoteMarker: fnMatch[1] });
  }
  var refMatch = tok.text.match(/\{\{REF:(scribe-ref-\d+)\}\}/);
  if (refMatch) {
    runs.push({ text: "", crossRefMarker: refMatch[1] });
  }
}
```

## Open Questions

1. **How do footnote references appear in paragraph element iteration?**
   - What we know: `GetClassType()` has no "footnote" value; internally they're `AscWord.wDa` objects
   - What's unclear: Does `GetElement(i)` return them at all? If yes, as `"run"` or `"unsupported"`?
   - Recommendation: **Mandatory empirical test** (diagnostic callCommand) before implementation

2. **Does `Copy()` work on footnote reference elements?**
   - What we know: `Copy()` works reliably on `ApiDrawing` and `ApiTable`
   - What's unclear: Whether `Copy()` on a footnote ref preserves the link to footnote content
   - Recommendation: Test in diagnostic macro; prepare `AddFootnote()` fallback

3. **Can cross-references be detected by iterating paragraph elements?**
   - What we know: Cross-refs are field codes internally (fldChar pattern); field elements may not be exposed
   - What's unclear: Whether field begin/end markers appear as elements, or are invisible
   - Recommendation: Test in diagnostic macro alongside footnote detection

4. **How to identify cross-reference targets for recreation?**
   - What we know: `AddHeadingCrossRef()` needs the target `ApiParagraph`, `AddBookmarkCrossRef()` needs bookmark name
   - What's unclear: Best strategy to store enough metadata to re-find the target during injection
   - Recommendation: Cache cross-ref metadata (target type, target identifier like heading text or bookmark name, ref display type) alongside the element

5. **What happens to footnote numbering when a footnote ref is removed and re-added?**
   - What we know: OO manages footnote numbers automatically
   - What's unclear: If we remove a footnote ref (via InsertContent) and restore it (via cache), does the number stay correct?
   - Recommendation: Test during empirical phase

## Sources

### Primary (HIGH confidence)
- OO SDK `sdk-all.js` (running container) -- `GetClassType()` complete return value list, internal footnote class `wDa`
- [AddFootnoteCrossRef](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/Methods/AddFootnoteCrossRef/) -- parameters, example code
- [AddHeadingCrossRef](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/Methods/AddHeadingCrossRef/) -- parameters, example code
- [AddBookmarkCrossRef](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/Methods/AddBookmarkCrossRef/) -- parameters, example code
- [AddFootnote](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/AddFootnote/) -- returns ApiDocumentContent
- [GetFootnotesFirstParagraphs](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/GetFootnotesFirstParagraphs/) -- returns ApiParagraph[]
- [footnoteRefTo enum](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/Enumeration/footnoteRefTo/) -- enum values
- [headingRefTo enum](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/Enumeration/headingRefTo/) -- enum values
- [bookmarkRefTo enum](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/Enumeration/bookmarkRefTo/) -- enum values
- marked v17.0.4 (local vendor) -- confirmed `[^N]` and `{{REF:...}}` pass through as plain text

### Secondary (MEDIUM confidence)
- [ONLYOFFICE Community: Footnote Reference macro](https://community.onlyoffice.com/t/macro-help-insert-text-run-next-to-each-footnote-reference-in-body/17622) -- attempted `GetClassType() === "footnoteReference"` (did not work)
- [SelectNoteReference](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/SelectNoteReference/) -- selects footnote/endnote reference mark
- Existing code.js image round-trip pattern (code analysis)

### Tertiary (LOW confidence)
- OO SDK minified source analysis for internal types (`wDa`, `sPb`, field character patterns) -- needs empirical validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed, existing pipeline handles markers
- Architecture (detection): LOW -- footnote/cross-ref detection via GetElement is unverified; needs empirical testing
- Architecture (injection): MEDIUM -- OO API for creating footnotes/cross-refs is well-documented but untested in callCommand context
- Pitfalls: HIGH -- identified from direct code analysis and SDK inspection

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable OO API, unlikely to change)
