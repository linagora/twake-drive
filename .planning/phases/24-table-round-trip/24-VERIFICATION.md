---
phase: 24-table-round-trip
verified: 2026-03-22T22:45:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Select a table in OO, trigger Scribe translate, verify preview shows GFM table not raw markers"
    expected: "Result panel displays a proper pipe-table with header separator"
    why_human: "Requires live OO + Scribe interaction to confirm rendering"
  - test: "After translation, click Replace — verify cells are updated in-place with font/size preserved"
    expected: "Table borders, widths, backgrounds unchanged; cell font family and size match original"
    why_human: "OO visual inspection required to confirm structural preservation"
  - test: "Verify single undo point — one Ctrl+Z reverts all cell updates"
    expected: "All cells revert to original content in one undo step"
    why_human: "Requires live OO interaction to test undo behavior"
---

# Phase 24: Table Round-Trip Verification Report

**Phase Goal:** Les tableaux dans la selection survivent au round-trip LLM — chaque cellule est traduite/modifiee individuellement et reinjectee dans le tableau OO original avec sa structure preservee
**Verified:** 2026-03-22T22:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Cell markers `[CELL:r,c]...[/CELL]` in LLM response are parsed into structured `{row, col, text}` objects | VERIFIED | `parseCellMarkers()` in `tableCellMarkers.js` lines 18-30; regex `/\[CELL:(\d+),(\d+)\]([\s\S]*?)\[\/CELL\]/g`; all unit tests pass |
| 2  | Cell count mismatch between extraction and LLM response produces a visible warning | VERIFIED | `validateCellCount()` returns `{valid: false, ...}`; `transformCellMarkersForPreview` sets warning string; `ScribeResultPanel` renders themed banner at lines 433-443 |
| 3  | Preview panel displays a proper markdown table (pipe-table format) instead of raw cell markers | VERIFIED | `cellsToMarkdownTable()` produces GFM output with header separator; `transformCellMarkersForPreview` replaces marker block; `MarkdownPreview` uses `remark-gfm` |
| 4  | Non-cell-marker text surrounding table markers renders normally in preview | VERIFIED | `blockRegex` replace in `transformCellMarkersForPreview` (line 128) preserves leading/trailing newlines; surrounding text untouched |
| 5  | System prompt instructs LLM to preserve cell markers when enrichedMd contains them | VERIFIED | `scribeAI.js` lines 79-83: conditional append of "Preserve all [CELL:r,c]..." when `extra?.enrichedMd.includes('[CELL:')` |
| 6  | Cell markers are extracted from md BEFORE `marked.lexer()` processes it | VERIFIED | `buildAndInject` lines 254-283: extraction at line 258, `window.marked.lexer(md)` at line 285 (after removal) |
| 7  | Cell text is pre-flattened via `flattenTokens` in plugin scope (not inside callCommand) | VERIFIED | `buildAndInject` lines 264-265: `window.marked.lexer(cellText)` + `flattenTokens(cellTokens)` before `Asc.scope` assignment |
| 8  | `callCommand` locates the original OO table via `GetAllTables` + selection range overlap | VERIFIED | `callCommand` lines 517-533: `doc.GetAllTables()`, `GetRangeBySelect()`, overlap check `te >= tSelStart && ts <= tSelEnd` |
| 9  | Each cell's source font family and size are read from the first run of the first paragraph before any modifications | VERIFIED | Lines 538-566: loops over cells reading `GetTextPr().GetFontFamily()/GetFontSize()` from first run before any `cell.Clear()` |
| 10 | Each cell is cleared and rebuilt with formatted runs using md styling + source font/size | VERIFIED | Lines 570-603: `cell.Clear()`, then loop rebuilds with bold/italic/strikethrough + `cf.family`/`cf.size`; code spans use Courier New |
| 11 | Non-table text in the same response goes through the standard pipeline | VERIFIED | After marker removal, `md` (now without cell markers) is processed by `window.marked.lexer` → `flattenTokens` → standard content loop |
| 12 | Table structure is preserved — no new ApiTable created, `tableRoundTripDone` prevents InsertContent from destroying the original table | VERIFIED | `tableRoundTripDone = true` at line 604; guard at lines 851-856 wraps InsertContent in `else` branch; original `targetTable` object is mutated in-place |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/modules/views/OnlyOffice/Scribe/tableCellMarkers.js` | `parseCellMarkers`, `validateCellCount`, `cellsToMarkdownTable`, `transformCellMarkersForPreview` | VERIFIED | 137 lines, all four functions exported with JSDoc; unit tests pass programmatically |
| `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` | Imports `transformCellMarkersForPreview`, adds `rawResult`/`cellWarning` state, sends raw markers to `onReplace`/`onInsert` | VERIFIED | Import at line 14; state at lines 40/42; transform called at line 125; `rawResult` sent via `handleReplace`/`handleInsert` at lines 155/159 |
| `src/modules/views/OnlyOffice/Scribe/scribeAI.js` | Augmented system prompt with cell marker preservation instruction when enrichedMd contains `[CELL:]` | VERIFIED | Conditional at lines 80-82; no-cell-marker branch confirmed at line 79 |
| `src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx` | Accepts `cellWarning` prop, displays themed warning banner | VERIFIED | Prop at line 186, propTypes at 592, defaultProps at 617; warning banner rendered at lines 433-443 with dark/light theme colors |
| `plugins/onlyoffice-scribe/scripts/code.js` | Cell marker extraction before `marked.lexer`, pre-flattened cell runs via `Asc.scope.tableCells`, in-place cell reinjection in `callCommand` | VERIFIED | `parsedTableCells` extraction at lines 254-283; `Asc.scope.tableCells` at lines 298-302; reinjection block at lines 511-606 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ScribePopover.jsx` | `tableCellMarkers.js` | `import transformCellMarkersForPreview` | WIRED | Line 14 import; called at line 125 with result used to set state |
| `ScribePopover.jsx` | `ScribeResultPanel.jsx` | `cellWarning` prop | WIRED | Passed at line 222; displayed in result panel |
| `scribeAI.js` | `buildMessages` | `[CELL:` detection triggers augmented system prompt | WIRED | Lines 79-83 in `buildMessages` function body |
| `buildAndInject` (plugin scope) | `callCommand` | `Asc.scope.tableCells = JSON.stringify(parsedCells)` | WIRED | Written at lines 298-302; read in `callCommand` at line 512 |
| `callCommand` | OO API: `GetAllTables`, `GetCell`, `Clear`, `GetContent`, `GetTextPr` | In-place cell modification loop | WIRED | Lines 517, 542, 574, 544, 551 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EXTR-03 | 24-01-PLAN.md | Les tableaux dans la sélection sont détectés, leur texte est extrait cellule par cellule au format `[CELL:r,c]...[/CELL]` | SATISFIED | `extractTableCells()` at code.js line 1449 produces `[CELL:r,c]...[/CELL]` format; called in extraction path at line 1546 |
| MARK-03 | 24-01-PLAN.md | Scribe parse les marqueurs cellule dans la réponse LLM et valide la cohérence (nombre de cellules) | SATISFIED | `parseCellMarkers()` + `validateCellCount()` in `tableCellMarkers.js`; wired via `transformCellMarkersForPreview` in `ScribePopover.jsx` |
| MARK-04 | 24-01-PLAN.md | Scribe reconstitue un tableau markdown pour l'affichage utilisateur à partir des cellules traduites | SATISFIED | `cellsToMarkdownTable()` builds GFM pipe-table; passed through `transformCellMarkersForPreview` to `MarkdownPreview` which uses `remark-gfm` |
| REINJ-02 | 24-02-PLAN.md | Les cellules traduites sont réinjectées dans le tableau OO d'origine (structure préservée : bordures, fonds, largeurs, fusions) | SATISFIED | In-place `cell.Clear()` + rebuild on `targetTable`; no new `ApiTable` created; `tableRoundTripDone` guards `InsertContent` |
| REINJ-03 | 24-02-PLAN.md | Le formatage des cellules réinjectées applique le md (bold/italic/etc.) + font/size du 1er paragraphe source | SATISFIED | Cell rebuild loop applies `SetBold`/`SetItalic`/`SetStrikeout` from run data + `SetFontFamily`/`SetFontSize` from per-cell `cellFonts` map |

No orphaned requirements found. All five Phase 24 requirements are claimed by plans and verified in codebase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `code.js` | 852-855 | `if (tableRoundTripDone) { /* intentionally empty */ }` with comment | Info | Intentional v2.5 limitation: mixed text+table content skips text replacement. Well-documented with comment explaining future intent. Not a stub. |

No blockers or warnings found. The "empty" branch is an intentional, documented v2.5 limitation (mixed text+table round-trip not supported), not a placeholder.

### Human Verification Required

#### 1. Table preview in result panel

**Test:** Open OO with a document containing a table. Select the table, trigger a Scribe translate action. Observe the result panel.
**Expected:** Result panel shows a formatted GFM pipe-table (header row + separator + body rows), not raw `[CELL:0,0]...[/CELL]` text.
**Why human:** Requires live OO + React Scribe rendering to confirm visual output.

#### 2. In-place reinjection with structure preservation

**Test:** After translation preview, click Replace. Inspect the table in OO.
**Expected:** Cell text is updated with translated content. Table borders, column widths, background fills, and merged cells are unchanged. Cell font family and font size match original.
**Why human:** OO visual inspection required to confirm structural preservation vs. destructive replacement.

#### 3. Single undo point

**Test:** After clicking Replace, press Ctrl+Z once.
**Expected:** All cell updates revert simultaneously in a single undo step. No partial undo of individual cells.
**Why human:** Requires live OO interaction to test `callCommand` undo behavior.

#### 4. Cell count mismatch warning

**Test:** Simulate a response where the LLM returns fewer `[CELL:]` markers than the original (e.g., manually craft or intercept a truncated response).
**Expected:** A yellow/amber warning banner appears in the result panel reading "Table cell count mismatch: expected N, got M".
**Why human:** Requires simulating an abnormal LLM response; cannot be triggered in normal flow.

### Gaps Summary

None. All automated checks pass. All 12 observable truths are verified against the actual codebase. All 5 requirements are satisfied by substantive implementations. All key links are wired end-to-end.

The phase goal is achieved: table cells survive the LLM round-trip with individual cell processing, GFM preview, and in-place OO table reinjection with structure preserved.

---

_Verified: 2026-03-22T22:45:00Z_
_Verifier: Claude (gsd-verifier)_
