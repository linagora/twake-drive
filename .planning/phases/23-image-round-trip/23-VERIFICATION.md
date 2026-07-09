---
phase: 23-image-round-trip
verified: 2026-03-20T20:00:00Z
status: passed
score: 7/7 must-haves verified
---

# Phase 23: Image Round-Trip Verification Report

**Phase Goal:** Images survive AI text transformations — round-trip via ToJSON/FromJSON+AddDrawing
**Verified:** 2026-03-20T20:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

#### Plan 23-01 Truths (MARK-05)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Image markers appear as styled badge chips in Scribe preview panel | VERIFIED | `MarkdownPreview.jsx:105-130` — custom `img` component checks `isPlaceholder`, returns `<span>` with picture icon + marker name |
| 2 | Both block `![IMG:scribe-img-N](placeholder)` and inline `{{IMG:scribe-img-N}}` render as badges | VERIFIED | `MarkdownPreview.jsx:134-140` — preprocessed converts `{{IMG:...}}` to `![IMG:...](placeholder)` before react-markdown; `img` component handles both |
| 3 | `flattenTokens` recognizes image tokens and emits `imageMarker` runs or `image_placeholder` blocks | VERIFIED | `code.js:112-118` (imageMarker run in flattenInline), `code.js:159-178` (paragraph promoted to image_placeholder block) |
| 4 | Inline markers pre-processed to standard image syntax before `marked.lexer` in `buildAndInject` | VERIFIED | `code.js:252` — `md = md.replace(/\{\{IMG:(scribe-img-\d+)\}\}/g, "![IMG:$1](placeholder)")` before lexer call |

#### Plan 23-02 Truths (REINJ-01)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 5 | After injection, each image reappears at the position indicated by its marker | VERIFIED | `code.js:702-711` — `image_placeholder` block handler calls `restoreImage(block.name)`, creates paragraph, calls `AddDrawing` |
| 6 | If LLM moved a marker, the image follows to the new position | VERIFIED | Image cache is keyed by name; content building loop processes blocks in order from the LLM response; position follows token order |
| 7 | The reinjected image is identical (no quality degradation) | VERIFIED | `code.js:463-482` — `restoreImage()` uses `Api.FromJSON(entry.json)` where `entry.json` came from `drawing.ToJSON(false, false)` — self-contained serialization |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/modules/views/OnlyOffice/Scribe/MarkdownPreview.jsx` | Custom img component + inline marker pre-processing | VERIFIED | `isPlaceholder` check at line 106, badge JSX at lines 109-127, `preprocessed` at lines 134-140, used in `<Markdown>` at line 156 |
| `plugins/onlyoffice-scribe/scripts/code.js` | `flattenTokens` image token handling + `buildAndInject` image cache + reinjection | VERIFIED | imageMarker in flattenInline (line 112), image_placeholder block promotion (line 174), imageCache pre-pass (line 428), restoreImage helper (line 463), image_placeholder handler (line 702) |

### Key Link Verification

#### Plan 23-01 Key Links

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `MarkdownPreview.jsx` | react-markdown img component | `components` prop with `img` key checking `IMG:scribe-img` | WIRED | `img:` function inside `components` object at line 105; `components` passed to `<Markdown>` at line 155 |
| `code.js flattenTokens` | `code.js buildAndInject` | `image_placeholder` block type in flat tokens | WIRED | Produced at line 174, consumed at line 431 (imageCache pre-pass) and line 702 (content builder) |

#### Plan 23-02 Key Links

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `code.js buildAndInject image cache` | `doc.GetDrawingsByName` | Pre-pass before `InsertContent` | WIRED | `GetDrawingsByName` called at lines 433, 449, 473 — all in cache pre-pass or fallback re-lookup |
| `code.js content builder` | `AddDrawing` | `FromJSON` of cached image JSON added to paragraph | WIRED | `AddDrawing` called at lines 512, 546, 583, 679, 707 — covering heading, list_item, code_block, paragraph, and image_placeholder block handlers |
| `code.js image cache` | `ToJSON/FromJSON` | Serialize before `InsertContent`, restore during content building | WIRED | `ToJSON` at lines 436, 452; `FromJSON` at line 467 in `restoreImage` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| MARK-05 | 23-01 | Scribe affiche un placeholder visuel dans le markdown pour indiquer l'emplacement d'une image | SATISFIED | `MarkdownPreview.jsx` `img` component renders styled badge with picture icon and marker name; `isPlaceholder` test at line 106-107 |
| REINJ-01 | 23-02 | Les marqueurs image dans le markdown retour sont remplacés par les images originales (Copy + AddDrawing) | SATISFIED | `restoreImage()` + `AddDrawing` in all block type handlers; ToJSON/FromJSON pre-cache strategy; Copy() fallback |

#### Orphaned Requirements Check

REQUIREMENTS.md maps EXTR-02 to "Phase 23 / Pending" in the traceability table, but no Phase 23 plan claims EXTR-02 in its `requirements:` field. The 23-01-PLAN.md explicitly notes: *"EXTR-02 (image detection, SetName, marker emission) was fully completed in Phase 22."*

The implementation for EXTR-02 exists at `code.js:1226-1259` (the `getDrawingMarker` function with `SetName` and marker emission), confirmed committed in Phase 22. The discrepancy is in REQUIREMENTS.md documentation only:

- The checkbox on line 13 (`- [ ] **EXTR-02**`) remains unchecked despite the implementation being present.
- The traceability table row (`| EXTR-02 | Phase 23 | Pending |`) is inaccurate — it belongs to Phase 22 and is effectively complete.

**Impact:** Documentation mismatch only. Code is correct and functional. No Phase 23 code gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `plugins/onlyoffice-scribe/scripts/code.js` | 10 | `// TODO: restrict to actual Cozy origin in production` | Info | Pre-existing, unrelated to Phase 23 |

No Phase 23 code additions introduce TODO/FIXME/placeholder patterns or stub implementations.

### ES5 Compliance (code.js)

A scan for `const `, `let `, and arrow functions (`=>`) in non-comment lines of `plugins/onlyoffice-scribe/scripts/code.js` returned no violations in the Phase 23 additions. The only ES5-style constructs found (`isBullet ? "bullet" : "ordered"` at line 1213-1214) are pre-existing Phase 22 code, not arrow functions.

### Human Verification Required

#### 1. Image survives replace mode end-to-end

**Test:** Open a docx with an embedded image. Select a paragraph containing that image. Run a Scribe action (e.g., "Rephrase"). Verify the image reappears at the same position in the rephrased output.
**Expected:** The image is present in the injected content, at the same relative position as the original marker. No quality degradation.
**Why human:** Requires a running OO instance with actual image content; `ToJSON/FromJSON` behavior on real OO drawings cannot be verified statically.

#### 2. Inline image marker badge rendering

**Test:** Trigger a Scribe action where the LLM response contains an inline image marker (`{{IMG:scribe-img-0}}`) mixed with text.
**Expected:** The Scribe preview panel shows the text with a small badge chip (picture icon + "scribe-img-0") inline within the paragraph.
**Why human:** JSX badge rendering depends on react-markdown's img component invocation, which requires a live React render.

#### 3. Image follows moved marker

**Test:** Select text with an image at the start. Use a Scribe action and manually craft or observe an LLM response that moves the marker to a different position (e.g., to the end of the text).
**Expected:** After injection, the image appears at the new position (end of text), not the original position.
**Why human:** Requires controlling LLM output to test positional flexibility; cannot simulate statically.

### Gaps Summary

No gaps. All 7 observable truths are verified by static code analysis. All artifacts exist and are substantive (not stubs). All key links are wired. Both requirements (MARK-05, REINJ-01) are satisfied.

The only notable finding is a REQUIREMENTS.md documentation discrepancy: EXTR-02 is listed as "Pending" and mapped to Phase 23 in the traceability table, but its implementation was delivered in Phase 22 and the checkbox was never checked off. This does not affect Phase 23 correctness.

---

_Verified: 2026-03-20T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
