---
phase: 22-extraction-pipeline-contrat-marqueurs
verified: 2026-03-20T14:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 22: Extraction Pipeline et Contrat Marqueurs — Verification Report

**Phase Goal:** Le plugin OO scanne proactivement la selection et envoie a Scribe du markdown enrichi contenant des marqueurs normalises pour les images et cellules de tableaux
**Verified:** 2026-03-20
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                             | Status     | Evidence                                                                                                         |
|----|-------------------------------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------------------------------|
| 1  | Quand l'utilisateur selectionne du texte avec une image, enrichedMd contient ![IMG:id](placeholder) ou {{IMG:id}} | VERIFIED   | `getDrawingMarker()` in callCommand (line 1055); block branch produces `"![IMG:" + name + "](placeholder)"`, inline produces `"{{IMG:" + name + "}}"` |
| 2  | Quand l'utilisateur selectionne un tableau, enrichedMd contient [CELL:r,c]...[/CELL] pour chaque cellule          | VERIFIED   | `extractTableCells()` in callCommand (line 1092); produces `"[CELL:" + r + "," + c + "]" + cellText + "[/CELL]"` |
| 3  | Le pre-scan s'execute a chaque changement de selection (proactivement via callCommand dans init())                 | VERIFIED   | `window.Asc.plugin.init` calls `window.Asc.plugin.callCommand(...)` unconditionally (after pasteInProgress guard) at line 1006 |
| 4  | Du texte simple (sans images ni tableaux) produit un markdown equivalent sans regression                           | VERIFIED   | `paragraphToMarkdown()` walks runs/hyperlinks; `escapeMarkdown()` protects special chars; performance guard at line 1125 for >100 paragraphs falls back to plain text |
| 5  | Le champ enrichedMd est utilise par les prompts LLM au lieu de htmlToMarkdown(html)                                | VERIFIED   | `scribeAI.js` line 82: `const textForPrompt = extra?.enrichedMd \|\| (extra?.html ? htmlToMarkdown(extra.html) : selectedText)` — enrichedMd takes priority |
| 6  | Les cellules de tableau ne sont pas dupliquees en tant que paragraphes independants                                | VERIFIED   | Paragraph loop checks position overlap against `tableRanges[]` (lines 1157-1171); paragraphs inside table ranges skip mdParts and continue |
| 7  | Les marqueurs image et cellule traversent le pipeline complet (plugin -> View -> ScribePopover -> scribeAI)        | VERIFIED   | `buildEditIntentData()` sets `data.enrichedMd`; View.jsx line 156 passes `enrichedMd={pendingIntent?.data?.enrichedMd \|\| ''}`; ScribePopover lines 111-112 set `extra.enrichedMd = enrichedMd`; scribeAI.js uses it in textForPrompt |
| 8  | Tout le code dans callCommand est ES5-conforme (pas de const/let/arrow functions/template literals)                | VERIFIED   | Grep for `=>` and `const /let ` inside code.js returns no results; all vars use `var`, all functions use `function` keyword |

**Score:** 8/8 truths verified

---

## Required Artifacts

| Artifact                                                          | Expected                                                              | Status   | Details                                                                                                               |
|-------------------------------------------------------------------|-----------------------------------------------------------------------|----------|-----------------------------------------------------------------------------------------------------------------------|
| `plugins/onlyoffice-scribe/scripts/code.js`                       | selectionToMarkdown via callCommand, updated init() flow              | VERIFIED | Contains `var lastEnrichedMd = ""`, `var imageCounter = 0`, `function escapeMarkdown`, `function paragraphToMarkdown`, `function getDrawingMarker`, `function extractTableCells`, all inside callCommand body at lines 1006-1226 |
| `src/modules/views/OnlyOffice/View.jsx`                           | Reads enrichedMd from intent data, passes to ScribePopover            | VERIFIED | Line 156: `enrichedMd={pendingIntent?.data?.enrichedMd \|\| ''}` |
| `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx`           | Destructures enrichedMd, passes to buildMessages                      | VERIFIED | Line 27 destructures `enrichedMd`; lines 111-112 set `extra.enrichedMd`; line 71 computes `inputMd`; line 231 PropTypes |
| `src/modules/views/OnlyOffice/Scribe/scribeAI.js`                 | buildMessages prefers enrichedMd over htmlToMarkdown(html)            | VERIFIED | Line 82: `extra?.enrichedMd \|\| (extra?.html ? htmlToMarkdown(extra.html) : selectedText)` |

---

## Key Link Verification

| From                                          | To                                                        | Via                                                     | Status   | Details                                                                                              |
|-----------------------------------------------|-----------------------------------------------------------|---------------------------------------------------------|----------|------------------------------------------------------------------------------------------------------|
| `plugins/onlyoffice-scribe/scripts/code.js`   | `src/modules/views/OnlyOffice/View.jsx`                   | castIntent AI_TEXT_ASSISTANT with enrichedMd in data    | WIRED    | `buildEditIntentData()` sets `data.enrichedMd = lastEnrichedMd` (lines 77-83); called when AI_TEXT_ASSISTANT is cast |
| `src/modules/views/OnlyOffice/View.jsx`       | `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx`   | enrichedMd prop from pendingIntent.data                 | WIRED    | Line 156: `enrichedMd={pendingIntent?.data?.enrichedMd \|\| ''}` |
| `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` | `src/modules/views/OnlyOffice/Scribe/scribeAI.js` | extra.enrichedMd passed to buildMessages                | WIRED    | Lines 111-114: `extra.enrichedMd = enrichedMd` then `buildMessages(actionId, selectedText, label, extra)` |
| `plugins/onlyoffice-scribe/scripts/code.js`   | LLM prompt via enrichedMd                                 | Image and cell markers embedded in markdown string      | WIRED    | `![IMG:` at line 1078, `{{IMG:` at line 1085, `[CELL:` at line 1111 — all produced by callCommand, carried through enrichedMd |

---

## Requirements Coverage

| Requirement | Source Plan | Description                                                                                           | Status    | Evidence                                                                                             |
|-------------|-------------|-------------------------------------------------------------------------------------------------------|-----------|------------------------------------------------------------------------------------------------------|
| EXTR-01     | 22-01       | Plugin scanne la selection via callCommand et produit du markdown enrichi avec marqueurs              | SATISFIED | `selectionToMarkdown` in callCommand inside `init()`, `lastEnrichedMd` stored, sent via `buildEditIntentData()` |
| EXTR-04     | 22-01       | Pre-scan s'execute a chaque selection (proactivement) et envoie le markdown enrichi a Scribe          | SATISFIED | `init()` triggers callCommand on every OO selection event; `SHOW_SCRIBE_BUTTON` debounce sends markdown; `callCommand` at line 1006 is unconditional |
| MARK-01     | 22-02       | Syntaxe definie pour images bloc (![IMG:id](placeholder)) et inline ({{IMG:id}})                      | SATISFIED | `getDrawingMarker()` lines 1055-1089; block: `"![IMG:" + name + "](placeholder)"`, inline: `"{{IMG:" + name + "}}"` |
| MARK-02     | 22-02       | Syntaxe definie pour cellules tableau ([CELL:r,c]texte[/CELL])                                        | SATISFIED | `extractTableCells()` lines 1092-1115; produces `"[CELL:" + r + "," + c + "]" + cellText + "[/CELL]"` |

No orphaned requirements: REQUIREMENTS.md traceability table maps only EXTR-01, EXTR-04, MARK-01, MARK-02 to Phase 22. EXTR-02, EXTR-03 are mapped to phases 23/24 as expected — not claimed by any Phase 22 plan.

---

## Anti-Patterns Found

| File                                                    | Line | Pattern                                    | Severity | Impact                                                                 |
|---------------------------------------------------------|------|--------------------------------------------|----------|------------------------------------------------------------------------|
| `plugins/onlyoffice-scribe/scripts/code.js`             | 10   | `cozyOrigin = "*"` with TODO comment       | Info     | Documented known issue; non-blocking for phase goal                   |
| `plugins/onlyoffice-scribe/scripts/code.js`             | 944  | `function stripOoClasses` still defined    | Info     | Dead code — no longer called from init(); harmless, could be cleaned later |

No blockers or warnings found.

---

## Human Verification Required

### 1. Formatted text selection produces correct inline markdown

**Test:** Open OO editor. Type a sentence with bold, italic, and a hyperlink. Select all three. Open Scribe (Ctrl+I or floating button). Use "test-markdown" dev action.
**Expected:** The dev panel shows enrichedMd with `**bold**`, `*italic*`, and `[link text](url)` markers for the respective spans.
**Why human:** OO document model traversal behavior can only be confirmed at runtime.

### 2. Block image marker placement

**Test:** Insert an image on its own line in OO. Select just that image paragraph. Open Scribe.
**Expected:** enrichedMd contains `![IMG:scribe-img-0](placeholder)` on a line by itself.
**Why human:** `GetAllDrawingObjects()` behavior and the block vs inline detection heuristic require runtime confirmation.

### 3. Inline image marker placement

**Test:** Insert an image inline within a sentence in OO. Select the sentence including the image. Open Scribe.
**Expected:** enrichedMd contains the sentence text plus `{{IMG:scribe-img-N}}` marker embedded inline.
**Why human:** Requires OO document with mixed text+image paragraph to verify heuristic.

### 4. Table cell markers with no paragraph duplication

**Test:** Select a table (or part of one) in OO. Open Scribe dev panel.
**Expected:** enrichedMd shows `[CELL:0,0]...[/CELL][CELL:0,1]...[/CELL]` etc. for each cell. No cell text appears again as a standalone paragraph.
**Why human:** Table position overlap detection (`GetStartPos`/`GetEndPos`) can only be confirmed against live OO document state.

### 5. No regression for plain text

**Test:** Select a paragraph of plain text. Run any Scribe action (e.g. "Make professional").
**Expected:** LLM receives the plain text, returns a modified version, and the result is inserted/replaced correctly. No errors in browser console.
**Why human:** End-to-end LLM call quality requires runtime verification.

---

## Gaps Summary

No gaps. All automated checks pass. All 8 observable truths are verified. All 4 requirement IDs (EXTR-01, EXTR-04, MARK-01, MARK-02) are satisfied with concrete implementation evidence. The enrichedMd data flow is fully wired from plugin callCommand through intent -> View.jsx -> ScribePopover -> scribeAI.buildMessages. Commits 6cdeea846, 1cd0a7c49, and 2c89086a6 exist in git history and correspond to the documented work.

Human verification items are runtime-behavior checks that cannot be confirmed programmatically — all automated indicators are positive.

---

_Verified: 2026-03-20_
_Verifier: Claude (gsd-verifier)_
