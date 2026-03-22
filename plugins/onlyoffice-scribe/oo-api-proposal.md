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
| `GetElement(i)` checking `classType === "drawing"` | Never returned — drawings are inside runs |
| `para.GetElements()` (plural) | Does not exist |
| `drawing.GetParentRun()` | Does not exist |
| `drawing.GetRange()` / `drawing.GetPosition()` | Do not exist |
| Accessing `this.Paragraph` from plugin | Property name is minified, inaccessible |
| Empty-run heuristic | Unreliable — anchor run merges with adjacent whitespace |

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
                drawing: new ApiDrawing(item.GraphicObj),
                position: charIndex
            });
        }
        else if (para_Text === item.Type)
        {
            charIndex++;
        }
        // Other content types (para_Space, para_Tab, etc.) may also
        // increment charIndex if they contribute to GetText() output.
        // This needs verification against ParaRun.prototype.GetText().
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
| `ParaRun` | `para_Run` | 0x0027 | `word/Editor/Paragraph/RunContent/Types.js:58` |

### Character position calculation

The `position` value must match the character index in the string returned by `ApiRun.GetText()`. The implementation counts `para_Text` elements before each drawing. Other content types that contribute to `GetText()` output (spaces, tabs) must also be counted — this should be verified against `ParaRun.prototype.GetText()` to ensure consistency.

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
