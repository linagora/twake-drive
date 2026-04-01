# Phase 27: References Documentaires - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning
**Source:** Discussion with user + auto-selected defaults

<domain>
## Phase Boundary

This phase adds detection and preservation of footnotes (notes de bas de page) and cross-references (renvois internes) during the Scribe round-trip. The LLM can modify surrounding text, but reference links remain intact after injection. This phase does NOT handle endnotes (notes de fin) — only footnotes and cross-references within the selection.

</domain>

<decisions>
## Implementation Decisions

### Footnote markers
- Footnote calls (superscript numbers in text) are extracted as `[^N]` markers in the markdown sent to the LLM. Standard markdown footnote syntax — LLMs know and preserve it naturally.
- Each footnote gets a unique N (like `scribe-img-N` for images).
- The **content** of the footnote (text at bottom of page) is NOT extracted — it's outside the selection scope. Only the call marker is preserved.
- If the LLM removes a `[^N]` marker from its response, the footnote call is dropped (same principle as images — user chose to modify the text).

### Cross-reference markers
- Cross-references (field-based references to headings, bookmarks, etc.) are extracted as `{{REF:unique-id}}` markers with the visible text preserved.
- Format: `{{REF:scribe-ref-N:visible text}}` — unique ID + original display text.
- The LLM sees the visible text and can modify surrounding content, but should preserve the marker.

### Injection strategy
- **Footnotes:** pre-cache via `Copy()` before InsertContent (same pattern as images). On injection, restore from cache via `AddElement`. This avoids recreating the footnote from scratch (which may not be possible via the API).
- **Cross-references:** attempt to recreate via OO API (field insertion). If the API doesn't support it, fall back to `Copy()` pre-cache like footnotes. Research needed to determine which OO API methods are available.
- Pattern follows the established image round-trip: extract → mark → cache → inject.

### Edge cases
- Multiple footnotes in the same selection: each has its own `[^N]` marker with unique N.
- Footnotes in table cells: same treatment as outside tables — marker is inline in the cell text. Uses `extractCellContent` which already handles inline elements via `paragraphToMarkdown`.
- Footnotes in partially-selected paragraphs: the marker is part of the paragraph text; clipping preserves or drops it based on the selection bounds.

### Claude's Discretion
- Exact OO API calls for footnote/cross-reference detection (GetClassType values, property access)
- Whether `Copy()` works on footnote/cross-reference elements (needs empirical testing)
- Cache key naming convention (e.g., `scribe-fn-N`, `scribe-ref-N`)
- System prompt additions to instruct LLM to preserve `[^N]` and `{{REF:...}}` markers

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing pipeline (extraction + injection)
- `plugins/onlyoffice-scribe/scripts/code.js` — `paragraphToMarkdown` (extraction, run iteration), `addRunsToParagraph` (injection), `addBlockToParagraph`, image cache pattern (`drawingIndex`, `imageCache`, `restoreImage`)
- `.planning/phases/26-selections-partielles-de-tableaux/26-IMPLEMENTATION.md` — latest architecture notes for extraction/injection flow

### OO API (footnotes and cross-references)
- https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRun/ — Run element API, check for footnote-related methods
- https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/ — Document-level API, check for GetFootnotesFirstParagraphs, AddFootnote, etc.
- https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ — Full text document API index

### Prior image round-trip (reference pattern)
- Phase 23 SUMMARYs — image extraction markers, cache pre-pass, `ToJSON`/`FromJSON`+`AddDrawing` pattern
- `getDrawingMarker` function in code.js — naming convention, block vs inline detection

### System prompt
- `src/modules/views/OnlyOffice/Scribe/scribeActions.js` or wherever the system prompt is defined — needs `[^N]` and `{{REF:...}}` preservation instructions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Image cache pattern:** `drawingIndex` → `imageCache` → `restoreImage()`. Can be replicated for footnotes/cross-refs with `footnoteCache`/`crossRefCache`.
- **`paragraphToMarkdown`:** already iterates elements by `GetClassType()`. Adding `"footnote"` or similar type detection is straightforward.
- **`addRunsToParagraph`:** already handles `imageMarker` runs. Adding `footnoteMarker`/`crossRefMarker` follows the same pattern.
- **`getDrawingMarker`:** assigns `scribe-img-N` names to unnamed drawings. Similar naming for `scribe-fn-N` / `scribe-ref-N`.

### Established Patterns
- **Marker → cache → restore:** extraction marks with a unique ID, pre-caches the original object via `Copy()`, injection restores from cache. This is the proven pattern for images.
- **ES5 constraint:** all code inside `callCommand` must use `var`, `function`, no arrow functions.
- **`flattenTokens` for parsing:** LLM response is parsed by `marked.lexer` + `flattenTokens`. Custom markers need to survive this pipeline (like `{{IMG:...}}` → `![IMG:...](placeholder)`).

### Integration Points
- **Extraction:** `paragraphToMarkdown` → detect footnote/cross-ref elements → emit markers
- **Pre-cache:** in injection callCommand, scan `allParas` + table cell paras for footnote/cross-ref objects → `Copy()` them
- **Injection:** `addRunsToParagraph` or `addBlockToParagraph` → detect markers in runs → restore from cache
- **System prompt:** add preservation instructions for `[^N]` and `{{REF:...}}`

</code_context>

<specifics>
## Specific Ideas

- Footnotes may not be recreatable via API — test `Copy()` on the footnote element first. If Copy works, use the same pattern as images. If not, explore alternatives (the user suggested duplicating the original).
- Cross-references should be recreatable via API (field insertion) — verify during research.
- The marker format `[^N]` for footnotes leverages markdown footnote syntax that LLMs already know.

</specifics>

<deferred>
## Deferred Ideas

- Endnotes (notes de fin) — not in scope, could be a future phase
- Footnote content editing — the content of the footnote itself is not in the selection scope
- Table of contents references — separate from cross-references

</deferred>

---

*Phase: 27-references-documentaires*
*Context gathered: 2026-04-01 via user discussion + auto-selected defaults*
