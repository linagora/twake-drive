# Proposal: ApiRun.GetInlineDrawings() — expose inline drawing positions within runs

## Summary

Add `ApiRun.prototype.GetInlineDrawings()` to return inline drawings contained in a run, with their character position. This enables plugins to determine the exact position of inline images relative to text — currently impossible.

## Problem statement

### The gap

`ApiParagraph` provides two disconnected ways to access content:

| Method | Returns | Includes drawings? | Position info? |
|--------|---------|---------------------|----------------|
| `GetElementsCount()` + `GetElement(i)` | Runs and hyperlinks in order | **No** | Yes (index) |
| `GetAllDrawingObjects()` | All drawings in the paragraph | Yes | **No** |

There is no way to determine where an inline drawing sits relative to text within its parent run.

### Internal model

Inline drawings are **children of runs**, not direct children of the paragraph:

```
Paragraph.Content[] = [ParaRun, ParaRun, ParaHyperlink, ...]
                           │
                    ParaRun.Content[] = [CRunText, CRunText, ParaDrawing, CRunText, ...]
                                         'H'       'i'       (image)      '!'
```

Source references:
- `Paragraph.prototype.GetAllDrawingObjects()` (`word/Editor/Paragraph.js:467`) — iterates `Content[]`, delegates to runs
- `ParaRun.prototype.GetAllDrawingObjects()` (`word/Editor/Run.js:411`) — scans run's `Content[]` for `para_Drawing` (0x0016)
- `private_GetSupportedParaElement()` (`word/apiBuilder.js:22728`) — wraps `ParaRun` as `ApiRun`, drawings inside are invisible
- `ApiParagraph.prototype.GetAllDrawingObjects()` (`word/apiBuilder.js:8881`) — wraps via `new ApiDrawing(item.GraphicObj)`

### Use case: AI text assistant

We are building an AI writing assistant plugin for OnlyOffice. The workflow:

1. User selects text containing inline images
2. Plugin extracts the selection as markdown with image placeholders at their correct positions: `"some text {{IMG:id}} more text"`
3. LLM processes the text (rephrase, translate, etc.) and returns modified markdown preserving placeholders
4. Plugin reinjects text and restores images at their new positions

Step 2 is currently impossible — we can detect that a paragraph contains drawings, but not their position within the text.

### What we tried (OO 9.3.0-138, `callCommand` context)

| Approach | Result |
|----------|--------|
| `GetElement(i)` checking `classType === "drawing"` | Never returned — drawings are inside runs, not at paragraph level |
| `para.GetElements()` (plural, as suggested by OO community) | Method does not exist in 9.3.0 |
| `drawing.GetParentRun()` | Method does not exist |
| `drawing.GetParentParagraph()` | Exists but gives no position info within the paragraph |
| `drawing.GetRange()` / `drawing.GetPosition()` | Do not exist |
| `para.private.Content` (internal CParagraph) | `.private` property does not exist on ApiParagraph wrapper in 9.3.0 |
| `para.Content` directly | Does not exist — wrapper is not the internal object |
| `para.Paragraph` (known internal property name from source) | Property name is minified in production builds, inaccessible from plugins |
| `Object.keys(para)` to discover minified property names | Crashes callCommand silently (likely due to prototype chain depth) |
| Direct property probing (`para.ya`, `para.ab`, etc.) | Properties exist but none has a `.Content` array — the internal object is deeper |
| `AscBuilder.ApiRun` / `AscBuilder.ApiDrawing` | `AscBuilder` exists but constructor names are minified — `ApiRun` key not found |
| Empty-run heuristic (drawings create empty anchor runs) | Works when no whitespace is adjacent to the drawing. **Fails** when a space follows the image — the anchor run merges with the space and becomes a regular space-only run, indistinguishable from non-anchor runs |
| Rebuilding SDK from source (non-minified concatenation) | Two chunks (min + all) share scope via Closure Compiler's `--chunk` option. Concatenating source files without the compiler breaks cross-chunk references. Both minified builds and non-minified wrapped builds fail with `ReferenceError` or `TypeError` |

### Key lessons learned during exploration

1. **OO's production builds use Google Closure Compiler with `--chunk`** — the SDK is split into `sdk-all-min.js` (37 core files) and `sdk-all.js` (354 common files). These are NOT independent: they share a compilation scope. Replacing one without the other, or replacing either with non-compiled sources, causes runtime errors.

2. **The only reliable way to test a SDK patch is to compile from the exact source tag** (`v9.3.0.138` from `github.com/ONLYOFFICE/sdkjs`) using the same Closure Compiler pipeline. We built this via a `Dockerfile.build` that installs Java + runs `grunt compile-word`.

3. **`new ApiDrawing(graphicObj)` is wrong in v9.3.0** — the codebase switched to `GetApiDrawing(graphicObj)` factory which dispatches to `ApiImage`, `ApiShape`, `ApiGroup`, etc. based on `getObjectType()`. Using the base `ApiDrawing` constructor directly produces objects where `GetName()` returns `undefined` because the type-specific wiring is missing.

4. **Inline images in OO are typically in their own run** (not mixed with text in the same run). OO splits runs around drawings. So `GetInlineDrawings()` on a drawing's run typically returns `[{drawing, position: 0}]` with the surrounding text in adjacent runs. The method still correctly handles the mixed case (text + drawing in same run).

## Proposed API

### `ApiRun.prototype.GetInlineDrawings()`

Returns an array of objects describing inline drawings contained in this run, each with the drawing object and its character position within the run's text.

```javascript
/**
 * Returns the inline drawings contained in this run, with their
 * character position within the run text.
 *
 * Each entry contains the ApiDrawing object and the character index
 * at which it appears in the text returned by GetText(). This allows
 * callers to reconstruct the full mixed content (text + drawings) in
 * document order.
 *
 * Returns an empty array if the run contains no inline drawings.
 *
 * @memberof ApiRun
 * @typeofeditors ["CDE"]
 * @returns {Array<{drawing: ApiDrawing, position: number}>}
 *
 * @example
 * // Typical usage: serialize a paragraph with inline images to markdown.
 * // First, check at the paragraph level if there are any drawings.
 * var paraDrawings = paragraph.GetAllDrawingObjects();
 * if (paraDrawings.length === 0) {
 *   // No drawings — fast path, plain text only
 *   for (var i = 0; i < paragraph.GetElementsCount(); i++) {
 *     markdown += paragraph.GetElement(i).GetText();
 *   }
 * } else {
 *   // Has drawings — inspect each run for inline drawing positions
 *   for (var i = 0; i < paragraph.GetElementsCount(); i++) {
 *     var el = paragraph.GetElement(i);
 *     if (el.GetClassType() === "run") {
 *       var text = el.GetText();
 *       var inlineDrawings = el.GetInlineDrawings();
 *       if (inlineDrawings.length === 0) {
 *         markdown += text;
 *       } else {
 *         // Split text at drawing positions and interleave placeholders
 *         var lastPos = 0;
 *         for (var j = 0; j < inlineDrawings.length; j++) {
 *           var pos = inlineDrawings[j].position;
 *           markdown += text.substring(lastPos, pos);
 *           markdown += "{{IMG:" + inlineDrawings[j].drawing.GetName() + "}}";
 *           lastPos = pos;
 *         }
 *         markdown += text.substring(lastPos);
 *       }
 *     }
 *   }
 * }
 *
 * @see office-js-api/Examples/{Editor}/ApiRun/Methods/GetInlineDrawings.js
 */
ApiRun.prototype.GetInlineDrawings = function()
{
    var result = [];
    var runContent = this.Run.Content;
    var charIndex = 0;

    for (var i = 0, len = runContent.length; i < len; i++)
    {
        var item = runContent[i];

        if (para_Drawing === item.Type)
        {
            result.push({
                "drawing"  : GetApiDrawing(item.GraphicObj) || new ApiDrawing(item.GraphicObj),
                "position" : charIndex
            });
        }
        else if (para_Text === item.Type
              || para_Space === item.Type
              || para_Tab === item.Type
              || para_NewLine === item.Type)
        {
            charIndex++;
        }
    }

    return result;
};
```

### Design rationale

**Why a method on `ApiRun` rather than `ApiParagraph`?**

- **Purely additive:** no changes to existing methods, no new return types in existing APIs
- **No synthetic objects:** returns real `ApiDrawing` wrappers for existing internal drawings, no copies or splits
- **Minimal API surface:** one new method, follows existing patterns
- **No performance concern:** callers first check `paragraph.GetAllDrawingObjects().length > 0` (already exists) to skip paragraphs without drawings entirely, then only inspect relevant runs

**Why not modify `GetElement(i)` / `GetElementsCount()`?**

- Would break backwards compatibility — existing plugins rely on the current index mapping
- Would change the semantics of the return type (currently always `ApiRun | ApiHyperlink`)

## Implementation details

### Source files to modify

| File | Change |
|------|--------|
| `word/apiBuilder.js` | Add `ApiRun.prototype.GetInlineDrawings` implementation (~25 lines) |
| `word/apiBuilder.js` (exports) | Add `ApiRun.prototype["GetInlineDrawings"] = ApiRun.prototype.GetInlineDrawings;` |
| `tests/word/api/` | Add test case |
| `office-js-api/Examples/{Editor}/ApiRun/Methods/GetInlineDrawings.js` | Add example |

### Internal types referenced

| Type | Constant | Value | File |
|------|----------|-------|------|
| `ParaDrawing` | `para_Drawing` | 0x0016 | `word/Editor/Paragraph/RunContent/Types.js:47` |
| `CRunText` | `para_Text` | 0x0001 | `word/Editor/Paragraph/RunContent/Types.js:37` |
| `CRunSpace` | `para_Space` | 0x0002 | `word/Editor/Paragraph/RunContent/Types.js:38` |
| `CRunTab` | `para_Tab` | 0x0015 | `word/Editor/Paragraph/RunContent/Types.js:46` |
| `CRunNewLine` | `para_NewLine` | 0x0010 | `word/Editor/Paragraph/RunContent/Types.js:41` |
| `ParaRun` | `para_Run` | 0x0027 | `word/Editor/Paragraph/RunContent/Types.js:58` |

### Drawing wrapping

In v9.3.0, drawings must be wrapped using the `GetApiDrawing()` factory (`word/apiBuilder.js:31071`), NOT `new ApiDrawing()` directly. The factory dispatches to the correct subclass:

| Object type | Wrapper class |
|-------------|---------------|
| `historyitem_type_ImageShape` | `ApiImage` |
| `historyitem_type_Shape` | `ApiShape` |
| `historyitem_type_GroupShape` | `ApiGroup` |
| `historyitem_type_SmartArt` | `ApiSmartArt` |
| `historyitem_type_OleObject` | `ApiOleObject` |
| `historyitem_type_GraphicFrame` | `ApiTable` |
| `historyitem_type_ChartSpace` | `ApiChart` |

Using `new ApiDrawing()` directly produces an object where type-specific methods like `GetName()` return `undefined`.

### Character position calculation

The `position` value matches the character index in the string returned by `ApiRun.GetText()`. Verified against `ParaRun.prototype.Get_Text()` (`word/Editor/Run.js:444`), the following content types contribute one character each to the text output:

| Type | Constant | Character produced |
|------|----------|--------------------|
| `para_Text` | 0x0001 | `String.fromCharCode(item.Value)` |
| `para_Space` | 0x0002 | `" "` |
| `para_Tab` | 0x0015 | `" "` (or `TabSymbol` option) |
| `para_NewLine` | 0x0010 | `" "` (or `NewLineSeparator` option) |

`para_Drawing` (0x0016) produces **no character** in `GetText()` output — it is silently skipped. This is why position tracking is needed: drawings are invisible in the text string.

### Edge cases

1. **Run with no drawings** → returns `[]` (common case, fast path)
2. **Run with only a drawing, no text** → returns `[{drawing, position: 0}]`
3. **Run with multiple drawings** → returns multiple entries, positions increase monotonically
4. **Drawing at start of run** → `position: 0`
5. **Drawing at end of run** → `position` equals text length

## Impact assessment

- **Scope:** ~25 lines of new code in one file
- **Risk:** None — purely additive, no changes to existing methods
- **Backwards compatibility:** 100% — new method only, existing behavior unchanged
- **Performance:** Negligible — iterates run content (typically < 20 elements), only called on runs known to contain drawings

## Context

- **OnlyOffice version tested:** 9.3.0-138
- **Use context:** Plugin `callCommand` (Document Builder API)
- **Project:** [Cozy Drive](https://github.com/cozy/cozy-drive) — AI writing assistant (Scribe)
- **Related existing API methods:**
  - `ApiParagraph.GetAllDrawingObjects()` — [docs](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/Methods/GetAllDrawingObjects/)
  - `ApiParagraph.GetElement(i)` — [docs](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/Methods/GetElement/)
  - `ApiRun.AddDrawing()` — [docs](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRun/Methods/AddDrawing/)
  - `ApiDrawing.GetParentParagraph()` — [docs](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDrawing/Methods/GetParentParagraph/)
