# Phase 23: Image Round-Trip - Research

**Researched:** 2026-03-20
**Domain:** OnlyOffice Document Builder API -- image serialization, marker parsing, preview rendering, image reinjection
**Confidence:** HIGH

## Summary

Phase 23 completes the image round-trip: images extracted in Phase 22 as markers (`![IMG:scribe-img-N](placeholder)` / `{{IMG:scribe-img-N}}`) must (1) appear as visual placeholders in the Scribe preview panel so the user knows where images will land, and (2) be reinjected as original images at the correct positions in the document after LLM processing.

The extraction side is already done (Phase 22). Images in the selection are named via `SetName("scribe-img-N")` and emitted as markers in the enrichedMd. The LLM sees these markers and preserves or moves them. Phase 23 handles the two missing pieces: preview-side rendering of markers as visual indicators, and injection-side replacement of markers with the original OO images.

**Primary recommendation:** In Plan 23-01, add a custom `img` component to `react-markdown` that renders `![IMG:scribe-img-N](placeholder)` as a styled badge/chip, and pre-process inline markers `{{IMG:scribe-img-N}}` into markdown image syntax before passing to react-markdown. In Plan 23-02, modify `flattenTokens` to emit a new `image_placeholder` block type when it encounters image markers, then in `buildAndInject`'s callCommand, look up the original image by name via `doc.GetDrawingsByName(["scribe-img-N"])`, call `.Copy()` on it, and add the copy to the target paragraph via `AddDrawing()`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXTR-02 | Les images dans la selection sont detectees, nommees (SetName), et remplacees par des marqueurs dans le markdown | Phase 22 already implemented image detection and SetName in extraction. Phase 23 completes the round-trip by consuming these markers. |
| MARK-05 | Scribe affiche un placeholder visuel dans le markdown pour indiquer l'emplacement d'une image | Plan 23-01: custom react-markdown `img` component renders `![IMG:scribe-img-N](placeholder)` as a visual badge. Inline `{{IMG:scribe-img-N}}` pre-processed to image syntax. |
| REINJ-01 | Les marqueurs image dans le markdown retour sont remplaces par les images originales (Copy + AddDrawing) | Plan 23-02: `flattenTokens` emits `image_placeholder` token; `buildAndInject` callCommand uses `GetDrawingsByName` + `Copy()` + `AddDrawing()` to reinject originals. |
</phase_requirements>

## Architecture Patterns

### Data Flow Overview

```
Phase 22 (done):
  OO document → callCommand pre-scan → enrichedMd with ![IMG:scribe-img-0](placeholder)
  → sent to Scribe React via intent

Phase 23 Plan 23-01 (preview):
  LLM response markdown (with image markers)
  → MarkdownPreview (react-markdown)
  → custom `img` component detects src="placeholder" + alt="IMG:scribe-img-N"
  → renders visual badge instead of broken image

Phase 23 Plan 23-02 (reinjection):
  LLM response markdown (with image markers)
  → flattenTokens (in code.js) recognizes image marker patterns
  → emits { type: "image_placeholder", name: "scribe-img-0" } token
  → buildAndInject callCommand:
     GetDrawingsByName(["scribe-img-0"]) → original image
     → .Copy() → cloned image (identical quality)
     → paragraph.AddDrawing(clone)
```

### Plan 23-01: Preview Placeholder

react-markdown v10 allows custom component renderers. When markdown contains `![IMG:scribe-img-0](placeholder)`, react-markdown parses it as an `<img>` element with `alt="IMG:scribe-img-0"` and `src="placeholder"`.

**Strategy:** Add a custom `img` component to MarkdownPreview that:
1. Detects image markers via alt text pattern `/^IMG:scribe-img-\d+$/`
2. Renders a styled inline badge (chip) instead of an `<img>` tag
3. Shows an image icon + the marker ID for user clarity

For inline markers `{{IMG:scribe-img-N}}`, these are NOT markdown image syntax -- react-markdown will render them as plain text. Two approaches:

**Option A (recommended):** Pre-process the markdown string before passing to react-markdown: replace `{{IMG:scribe-img-N}}` with `![IMG:scribe-img-N](placeholder)`. This converts inline markers to the same format as block markers, so the single `img` component handler covers both cases.

**Option B:** Use a custom remark plugin to detect `{{...}}` patterns. More complex, less maintainable.

```jsx
// In MarkdownPreview.jsx — custom img component
img: ({ node, alt, src, ...props }) => {
  const isPlaceholder = alt && /^IMG:scribe-img-\d+$/.test(alt) && src === 'placeholder'
  if (isPlaceholder) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 4,
        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        fontSize: '0.85em',
        verticalAlign: 'middle'
      }}>
        {/* inline SVG image icon or Unicode symbol */}
        <span style={{ opacity: 0.6 }}>&#128444;</span>
        <span style={{ opacity: 0.7 }}>{alt.replace('IMG:', '')}</span>
      </span>
    )
  }
  return <img alt={alt} src={src} {...props} />
}
```

**Pre-processing inline markers:**
```javascript
// Before passing to <Markdown>
const preprocessed = children.replace(
  /\{\{IMG:(scribe-img-\d+)\}\}/g,
  '![IMG:$1](placeholder)'
)
```

### Plan 23-02: Image Reinjection in buildAndInject

**Step 1: Token recognition in flattenTokens**

The `marked.lexer()` output for `![IMG:scribe-img-0](placeholder)` produces an `image` token inside a paragraph:

```javascript
// marked lexer output for a paragraph containing an image
{
  type: "paragraph",
  tokens: [
    { type: "image", href: "placeholder", text: "IMG:scribe-img-0" }
  ]
}
```

In `flattenTokens`, handle the `image` token type:
- If `tok.type === "image"` and `tok.text` matches `/^IMG:scribe-img-\d+$/`, emit a special marker
- For block images (paragraph contains only the image), emit `{ type: "image_placeholder", name: "scribe-img-0" }`
- For inline images (image mixed with text), include the marker in the runs array with a special flag

```javascript
// In flattenInline, add image token handling:
} else if (tok.type === "image" && tok.text && tok.text.indexOf("IMG:scribe-img-") === 0) {
  runs.push({
    text: "",
    bold: false, italic: false, strikethrough: false, code: false,
    link: null,
    imageMarker: tok.text.replace("IMG:", "")  // "scribe-img-0"
  });
}
```

At the block level in `flattenTokens`, detect if a paragraph consists of ONLY an image marker (no text runs with content), and if so, promote it to a standalone `image_placeholder` block:

```javascript
// After creating paragraph block, check if it's a pure image placeholder
if (block.type === "paragraph" && block.runs) {
  var imageOnlyRuns = [];
  var hasText = false;
  for (var ri = 0; ri < block.runs.length; ri++) {
    if (block.runs[ri].imageMarker) imageOnlyRuns.push(block.runs[ri]);
    else if (block.runs[ri].text.replace(/^\s+|\s+$/g, "").length > 0) hasText = true;
  }
  if (!hasText && imageOnlyRuns.length > 0) {
    // Replace paragraph block with image_placeholder blocks
    for (var ii = 0; ii < imageOnlyRuns.length; ii++) {
      blocks.push({ type: "image_placeholder", name: imageOnlyRuns[ii].imageMarker });
    }
    continue; // skip pushing the paragraph
  }
}
```

**Step 2: Image lookup and Copy in callCommand**

Inside `buildAndInject`'s callCommand, when encountering an `image_placeholder` block:

```javascript
// ES5 inside callCommand
} else if (block.type === "image_placeholder") {
  var imgName = block.name;  // "scribe-img-0"
  var found = doc.GetDrawingsByName([imgName]);
  if (found && found.length > 0) {
    var original = found[0];
    var clone = original.Copy();
    var imgPara = Api.CreateParagraph();
    if (isFirst && needSpaceBefore) imgPara.AddElement(makeSpaceRun());
    imgPara.AddDrawing(clone);
    if (isLast && needSpaceAfter) imgPara.AddElement(makeSpaceRun());
    content.push(imgPara);
  }
  // If not found, silently skip (image was deleted from document)
}
```

For inline images (runs with `imageMarker` property within a paragraph):

```javascript
// Inside the run-building loop for paragraphs:
if (run.imageMarker) {
  var inlineFound = doc.GetDrawingsByName([run.imageMarker]);
  if (inlineFound && inlineFound.length > 0) {
    var inlineClone = inlineFound[0].Copy();
    p.AddDrawing(inlineClone);
  }
} else if (run.link) {
  // ... existing link handling
} else {
  // ... existing text run handling
}
```

### Critical Constraint: Images Must Exist in Document

`GetDrawingsByName` looks up images in the CURRENT document. The images named `scribe-img-N` via `SetName()` during Phase 22 extraction are still in the document (they are in the original selection that is being replaced/inserted-after). However:

- In **replace mode**: the original selection is deleted by `InsertContent`. The named images in that selection are destroyed BEFORE the new content is inserted. This means `GetDrawingsByName` would NOT find them.
- In **insert mode**: the original selection is preserved, so the named images still exist.

**This is the critical problem to solve.** Two approaches:

**Approach A (recommended): Serialize images before replacement via ToJSON/FromJSON**

Before `InsertContent` replaces the selection, serialize all referenced images:

```javascript
// Before InsertContent, inside the same callCommand
var imageCache = {};  // name -> JSON
for (var bi = 0; bi < blocks.length; bi++) {
  var bk = blocks[bi];
  if (bk.type === "image_placeholder" || bk.imageMarker) {
    var lookupName = bk.name || bk.imageMarker;
    if (lookupName && !imageCache[lookupName]) {
      var imgs = doc.GetDrawingsByName([lookupName]);
      if (imgs && imgs.length > 0) {
        imageCache[lookupName] = imgs[0].ToJSON(false, false);
      }
    }
  }
  // Also scan runs for inline imageMarkers
  if (bk.runs) {
    for (var rj = 0; rj < bk.runs.length; rj++) {
      var runMarker = bk.runs[rj].imageMarker;
      if (runMarker && !imageCache[runMarker]) {
        var rImgs = doc.GetDrawingsByName([runMarker]);
        if (rImgs && rImgs.length > 0) {
          imageCache[runMarker] = rImgs[0].ToJSON(false, false);
        }
      }
    }
  }
}
```

Then when building content, use `Api.FromJSON()` instead of `Copy()`:

```javascript
} else if (block.type === "image_placeholder") {
  var cachedJson = imageCache[block.name];
  if (cachedJson) {
    var restored = Api.FromJSON(cachedJson);
    var imgPara = Api.CreateParagraph();
    imgPara.AddDrawing(restored);
    content.push(imgPara);
  }
}
```

**Approach B: Copy before InsertContent**

Pre-copy all referenced images before they are destroyed:

```javascript
var imageCopies = {};  // name -> ApiDrawing (copy)
// ... collect all image names from blocks ...
for (var name in imageNames) {
  var found = doc.GetDrawingsByName([name]);
  if (found && found.length > 0) {
    imageCopies[name] = found[0].Copy();
  }
}
// Then use imageCopies[name] directly in AddDrawing
```

**Recommendation:** Approach A (ToJSON/FromJSON) is safer because `Copy()` may hold internal references that become invalid after `InsertContent` destroys the original paragraph structure. `ToJSON` creates a self-contained serialization that survives document mutations.

### Passing Image Names Through Asc.scope

The image marker names need to flow from `flattenTokens` (which runs in the plugin iframe) through `Asc.scope` to the callCommand sandbox. This already works because `flattenTokens` output is serialized to JSON via `Asc.scope.tokens = JSON.stringify(flat)` and parsed inside callCommand. The `imageMarker` and `name` fields will be included in the serialization automatically.

No additional Asc.scope setup is needed beyond what exists.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image cloning | Manual pixel-by-pixel copy | `ToJSON()` + `Api.FromJSON()` on ApiDrawing | Preserves all image properties (size, position, wrapping, data) without degradation |
| Marker pattern matching in preview | Custom regex-based component | react-markdown custom `img` component + simple pre-processing | react-markdown already parses `![alt](src)` into img elements with accessible props |
| Image lookup by name | Manual iteration over all drawings | `doc.GetDrawingsByName([name])` | Built-in API method, efficient, returns array |
| Markdown pre-processing | Complex AST manipulation | Simple string `.replace()` for `{{IMG:...}}` to `![IMG:...](placeholder)` | Inline markers are a simple, predictable pattern; no need for AST-level work |

## Common Pitfalls

### Pitfall 1: Images Destroyed Before Lookup in Replace Mode
**What goes wrong:** `InsertContent` in replace mode deletes the selection (which contains the named images) before the new content (which references them) is added. `GetDrawingsByName` returns empty.
**Why it happens:** `InsertContent` is atomic -- it deletes the old content and inserts new content in one operation. The lookup happens after deletion.
**How to avoid:** Cache all referenced images (via `ToJSON` or `Copy`) BEFORE calling `InsertContent`. Build the image cache as a pre-pass over the token blocks, then use cached data when constructing content paragraphs.
**Warning signs:** Images not appearing after injection, `GetDrawingsByName` returning empty arrays.

### Pitfall 2: marked.lexer Does Not Emit Image Tokens for `{{IMG:...}}`
**What goes wrong:** The inline marker syntax `{{IMG:scribe-img-N}}` is not valid markdown image syntax. `marked.lexer()` treats it as plain text, not as an image token.
**Why it happens:** Only `![alt](src)` is parsed as an image by marked. Double-brace syntax is custom.
**How to avoid:** Pre-process the markdown BEFORE passing to `marked.lexer()` in `buildAndInject`: convert `{{IMG:scribe-img-N}}` to `![IMG:scribe-img-N](placeholder)`. This ensures both block and inline markers produce `image` tokens.
**Warning signs:** Inline images showing as literal text `{{IMG:scribe-img-0}}` in the document instead of actual images.

### Pitfall 3: ES5 Constraint in callCommand
**What goes wrong:** Using `Object.keys()`, arrow functions, `const`/`let`, template literals, or `for...of` inside callCommand.
**Why it happens:** The image caching and lookup code is new logic that is tempting to write in modern JS.
**How to avoid:** All code inside callCommand must use `var`, `function`, string concatenation, `for` loops, and `hasOwnProperty` checks.
**Warning signs:** Silent failures or SyntaxError in OO console.

### Pitfall 4: ToJSON May Not Serialize Image Pixel Data
**What goes wrong:** `ToJSON()` serializes the drawing object's properties but might reference an internal image URL/ID rather than embedding the actual pixel data. If the original image is deleted, the reference breaks.
**Why it happens:** OO may store images in an internal media cache referenced by ID, not inline in the drawing JSON.
**How to avoid:** Test empirically. If ToJSON does not preserve image data after the original is deleted, fall back to Approach B (Copy before InsertContent, keep copies as live objects, then AddDrawing each copy during content building -- all within the same callCommand so the copies remain valid).
**Warning signs:** Reinjected images showing as broken/empty placeholders.

### Pitfall 5: Image Size Not Preserved
**What goes wrong:** `Copy()` or `FromJSON()` may reset image dimensions to defaults.
**Why it happens:** Some serialization methods may not include size information, or the size may be relative to the paragraph context.
**How to avoid:** After restoring an image, verify width/height match the original. If not, read `GetWidth()`/`GetHeight()` from the original before serialization and re-apply via `SetSize()` after restoration.
**Warning signs:** Images appearing much larger or smaller than the originals.

### Pitfall 6: LLM Strips or Corrupts Image Markers
**What goes wrong:** The LLM modifies `![IMG:scribe-img-0](placeholder)` -- e.g., changing the alt text, removing the placeholder URL, or stripping the marker entirely.
**Why it happens:** LLMs may interpret markdown image syntax as something to "fix" or "improve."
**How to avoid:** Include clear instructions in the system prompt that image markers must be preserved verbatim. The extraction prompt should say: "Preserve all `![IMG:...]` markers exactly as they appear. Do not modify, remove, or add image markers."
**Warning signs:** Image markers not found in LLM response.

## Code Examples

### react-markdown Custom Image Component (Verified: react-markdown v10.1.0)
```jsx
// Source: react-markdown docs — custom components prop
// react-markdown v10 passes node, alt, src to img component
img: ({ node, alt, src, ...props }) => {
  if (alt && /^IMG:scribe-img-\d+$/.test(alt) && src === 'placeholder') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 4,
        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        fontSize: '0.85em', verticalAlign: 'middle'
      }}>
        <span style={{ opacity: 0.6 }}>&#128444;</span>
        <span style={{ opacity: 0.7 }}>{alt.replace('IMG:', '')}</span>
      </span>
    )
  }
  return <img alt={alt} src={src} {...props} />
}
```

### GetDrawingsByName (Verified: OO API docs)
```javascript
// Source: https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/GetDrawingsByName/
// Parameter: string array of drawing names
// Returns: ApiDrawing[] matching those names
var found = doc.GetDrawingsByName(["scribe-img-0"]);
if (found && found.length > 0) {
  var original = found[0];
  var clone = original.Copy();
  // or: var json = original.ToJSON(false, false);
}
```

### ApiDrawing.ToJSON / Api.FromJSON (Verified: OO API docs)
```javascript
// Source: https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDrawing/Methods/ToJSON/
// ToJSON(bWriteNumberings, bWriteStyles) -> JSON object
var json = drawing.ToJSON(false, false);

// Source: https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/Api/Methods/FromJSON/
// FromJSON(jsonObject) -> ApiDrawing (or other Builder object)
var restored = Api.FromJSON(json);
```

### AddDrawing to Paragraph (Verified: OO API docs)
```javascript
// Source: https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/Methods/AddDrawing/
// AddDrawing(oDrawing) -> ApiRun
var para = Api.CreateParagraph();
para.AddDrawing(clonedImage);
content.push(para);
```

### Pre-processing Inline Markers
```javascript
// Convert {{IMG:scribe-img-N}} to ![IMG:scribe-img-N](placeholder)
// before passing to marked.lexer() or react-markdown
var processed = md.replace(
  /\{\{IMG:(scribe-img-\d+)\}\}/g,
  '![IMG:$1](placeholder)'
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Images stripped during extraction | Images preserved as markers (Phase 22) | Phase 22 | Images no longer lost during LLM round-trip |
| No image preview in Scribe panel | Visual placeholder badges in preview | Phase 23 (this phase) | User sees where images will be reinjected |
| No image reinjection | Copy/ToJSON + AddDrawing reinjection | Phase 23 (this phase) | Images survive the full edit round-trip |

## Open Questions

1. **ToJSON image data persistence after original deletion**
   - What we know: `ToJSON()` serializes drawing properties. `FromJSON()` recreates the drawing.
   - What's unclear: Whether the serialized JSON contains the actual image data (base64/blob) or just a reference to OO's internal media cache. If it is a reference, deleting the original selection may invalidate it.
   - Recommendation: Test empirically in Plan 23-02. If ToJSON does not survive deletion, use `Copy()` approach (pre-copy all images into local variables before `InsertContent`, then `AddDrawing` the copies). Both Copy and the content building happen within the same callCommand, so the copies should remain valid.

2. **AddDrawing return value and paragraph structure**
   - What we know: `AddDrawing()` returns an `ApiRun`. The STATE.md notes "Drawing objects (images) must be wrapped in paragraph via AddDrawing, not directly in InsertContent."
   - What's unclear: Whether adding a drawing to a paragraph that also contains text runs works correctly for inline images.
   - Recommendation: Test inline image injection. If problematic, inline image markers can be silently promoted to block images (separate paragraph).

3. **Post-injection selection with images**
   - What we know: The current `selectByRefs` / `selectByPositions` strategies work for text-only content.
   - What's unclear: Whether paragraphs containing drawings are correctly included in the selection range.
   - Recommendation: Verify during implementation. Image paragraphs are in the `content[]` array, so `selectByRefs` should include them. If selection is broken, accept it as a minor degradation (content is still injected correctly).

## Sources

### Primary (HIGH confidence)
- [ApiDrawing.Copy()](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDrawing/Methods/Copy/) - copies drawing, returns ApiDrawing, no parameters
- [ApiDrawing.ToJSON()](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDrawing/Methods/ToJSON/) - serializes to JSON, params: bWriteNumberings, bWriteStyles
- [Api.FromJSON()](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/Api/Methods/FromJSON/) - recreates Builder object from JSON
- [ApiDocument.GetDrawingsByName()](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/GetDrawingsByName/) - lookup by name array, returns ApiDrawing[]
- [ApiParagraph.AddDrawing()](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/Methods/AddDrawing/) - adds drawing to paragraph, returns ApiRun
- [Api.CreateImage()](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/Api/Methods/CreateImage/) - creates image from URL or base64 + width/height in EMU
- Existing codebase: `plugins/onlyoffice-scribe/scripts/code.js` -- Phase 22 extraction (lines 1104-1139), buildAndInject (lines 224-769), flattenTokens (lines 88-217)
- Existing codebase: `src/modules/views/OnlyOffice/Scribe/MarkdownPreview.jsx` -- react-markdown v10.1.0 with custom components
- Existing codebase: `src/modules/views/OnlyOffice/View.jsx` -- respond() sends `{ md: text }` back to plugin

### Secondary (MEDIUM confidence)
- react-markdown v10 custom component rendering -- verified via codebase usage pattern in MarkdownPreview.jsx
- marked.lexer() image token output -- inferred from marked syntax spec (standard markdown image syntax)

### Tertiary (LOW confidence)
- ToJSON image data persistence after original deletion -- needs empirical validation
- AddDrawing behavior for inline images mixed with text runs -- needs empirical validation

## Metadata

**Confidence breakdown:**
- Preview placeholder (Plan 23-01): HIGH - react-markdown custom components are well-understood and already used in the codebase
- Token recognition (Plan 23-02 part 1): HIGH - marked.lexer image token structure is standard markdown
- Image reinjection (Plan 23-02 part 2): MEDIUM - GetDrawingsByName and Copy/ToJSON are documented, but the replace-mode deletion timing and ToJSON data persistence need validation
- Overall architecture: HIGH - builds directly on Phase 22 patterns and existing buildAndInject infrastructure

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- OO API changes infrequently)
