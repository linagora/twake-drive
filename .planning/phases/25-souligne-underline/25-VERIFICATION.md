---
phase: 25-souligne-underline
verified: 2026-03-24T12:00:00Z
status: human_needed
score: 4/4 must-haves verified
re_verification: false
human_verification:
  - test: "Select underlined text in OO, trigger Scribe, verify preview shows underlined text, then Replace — OO output must retain underline"
    expected: "Underlined text survives the full round-trip: extracted with <u> tags, displayed underlined in preview, reinjected with SetUnderline property in OO"
    why_human: "Requires running OO Editor + plugin interaction; cannot drive the OO iframe DOM programmatically"
  - test: "Select text that is both bold+underlined and italic+underlined, run Scribe, Replace — verify both properties survive"
    expected: "Bold+underlined stays bold+underlined; italic+underlined stays italic+underlined after reinjection"
    why_human: "Combined formatting verification requires visual inspection of live OO document"
---

# Phase 25: Souligne (Underline) Verification Report

**Phase Goal:** Le souligne dans la selection OO survit au round-trip LLM — extrait comme marqueur markdown, preserve par le LLM, reinjecte avec le formatage underline dans OO
**Verified:** 2026-03-24
**Status:** human_needed (all automated checks pass; 2 live OO integration tests pending)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Underlined text in OO selection appears as `<u>text</u>` in extracted markdown | VERIFIED | `GetUnderline()` read in `formatRun()` (line 1298) and `getRunFlags()` (line 1452); `buildMarkdownFromParts` wraps segment in `<u>...</u>` (lines 1392, 1422) using self-contained segment strategy |
| 2 | After LLM processing, underlined text is reinjected into OO with underline formatting via Builder API | VERIFIED | `flattenInline` handles `tok.type === "underline"` (line 170–171) propagating `true` as `parentUnderline`; `addRunsToParagraph` calls `r.SetUnderline(true)` (line 720); `makeHyperlink` calls `linkRun.SetUnderline(true)` (line 685) |
| 3 | Underline coexists with bold, italic, strikethrough — a bold+underlined run stays bold+underlined after round-trip | VERIFIED | `mergeAdjacentRuns` checks `prev.underline === cur.underline` (line 147); self-contained segment strategy emits `<u>**bold**</u>` nesting with proper whitespace extraction; all 4 fix commits (`d124b45`, `de26a17`, `e0ef76f`, `008183f`) address precisely this concern |
| 4 | The markdown preview panel renders `<u>` tags as underlined text | VERIFIED | `rehype-raw` imported and applied: `import rehypeRaw from 'rehype-raw'` (line 4 of MarkdownPreview.jsx); `rehypePlugins={[rehypeRaw]}` on `<Markdown>` (line 156); `"rehype-raw": "^7.0.0"` in package.json |

**Score:** 4/4 truths verified (automated)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `plugins/onlyoffice-scribe/scripts/code.js` | Underline extraction (GetUnderline) and injection (SetUnderline), marked extension for `<u>` token parsing | VERIFIED | `GetUnderline` appears 2 times; `SetUnderline` appears 2 times (addRunsToParagraph + makeHyperlink); marked extension `name: "underline"` at line 96; `parentUnderline` appears 9+ times in flattenInline |
| `src/modules/views/OnlyOffice/Scribe/MarkdownPreview.jsx` | rehype-raw plugin for rendering `<u>` tags in preview | VERIFIED | `rehypeRaw` imported from `rehype-raw` (line 4), applied as `rehypePlugins={[rehypeRaw]}` (line 156) |
| `src/modules/views/OnlyOffice/Scribe/scribeAI.js` | System prompt mentioning `<u>` tag preservation | VERIFIED | `<u>` appears 3 times in system prompt with explicit rules: nesting order, adjacent tag preservation, segment-structure instructions |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `code.js` extraction (`GetUnderline`) | `code.js` injection (`SetUnderline`) | `<u>text</u>` markdown markers round-trip through LLM | WIRED | `buildMarkdownFromParts` emits `<u>...</u>` (lines 1392, 1422); marked extension tokenizes back to `underline` type (line 96–110); `flattenInline` propagates flag (line 170–171); `SetUnderline(true)` applied (lines 685, 720) |
| `code.js` flattenTokens / `flattenInline` | `code.js` `addRunsToParagraph` | underline flag on run objects | WIRED | `flattenInline` returns runs with `underline: !!parentUnderline`; `mergeAdjacentRuns` preserves the flag (line 147); `addRunsToParagraph` reads `run.underline` (line 720) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FMT-01 | 25-01-PLAN.md | Le souligné (underline) dans la sélection OO est extrait comme markdown et réinjecté avec le formatage préservé | SATISFIED | Full pipeline implemented: extraction via `GetUnderline`, emission as `<u>` tags, marked extension for parsing, `SetUnderline` for injection; all automated checks pass; marked `requirements-completed: [FMT-01]` in SUMMARY frontmatter |

No orphaned requirements found. REQUIREMENTS.md maps FMT-01 to Phase 25 only, and 25-01-PLAN.md claims it.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

Scanned all 6 modified files. No TODO/FIXME/placeholder comments, no empty implementations, no stub return values related to underline.

---

## Verification Notes

### Self-contained segment strategy (deviation from plan — positive)

The PLAN specified a stateful `curUnderline` / `transitionTo` approach. The implementation pivoted to a **self-contained segment** strategy where each run opens and closes all its own markers. This was a correct architectural decision: the stateful approach produced ambiguous `***` sequences when OO spans overlapped underline boundaries. The new strategy is strictly better and more robust. The verification confirms this was fully implemented and the 4 fix commits address edge cases discovered during live testing.

### Marked v17 child tokenization

The PLAN specified `childTokens: ["tokens"]` for auto-population. The implementation correctly discovered this does not work in marked v17 and uses explicit `this.lexer.inlineTokens()` call instead (commit `9a6b041`). Verified present at line ~96–115 of code.js.

### Commits verified

All 8 commits from SUMMARY exist in git history:
- `db3bcf9` feat(25-01): add underline to full pipeline
- `0df8deb` feat(25-01): system prompt, preview, fallback path
- `9a6b041` fix(25-01): marked v17 child parsing
- `d124b45` fix(25-01): overlapping bold/underline boundaries
- `de26a17` fix(25-01): literal asterisks after underline boundary
- `e0ef76f` fix(25-01): empty bold markers after underline boundary
- `008183f` refactor(25): self-contained segment strategy
- `842e4f7` feat(25): mergeAdjacentRuns + README contract

### ES5 compliance

`code.js` has 0 `const`/`let` declarations and 0 arrow functions (excluding comments). ES5 constraint maintained.

### Test suite

All 21 tests in `scribeConversion.spec.js` pass, including 3 new underline-specific tests:
- `preserves underline tags through htmlToMarkdown`
- `preserves bold inside underline through htmlToMarkdown`
- `merges adjacent underline tags`

---

## Human Verification Required

### 1. Full underline round-trip in OO

**Test:** Open OO editor, type text, apply Ctrl+U to part of it, select it, trigger Scribe (Ctrl+I), choose "Corriger la grammaire" (or any action), observe preview, then click Replace.
**Expected:** Preview shows underlined text. After Replace, the text in OO has underline formatting (visible as underlined characters).
**Why human:** Requires running OO container and interacting with editor iframe; automated grep cannot verify OO rendering or Builder API effect.

### 2. Combined formatting (bold+underline, italic+underline) round-trip

**Test:** Apply bold+underline to one phrase and italic+underline to another in the same selection. Trigger Scribe and Replace.
**Expected:** Both phrases retain their combined formatting after reinjection. No regression on the non-underlined bold/italic text.
**Why human:** Requires visual inspection of live OO document output.

---

## Summary

All 4 observable truths are verified at all three levels (exists, substantive, wired). Requirement FMT-01 is satisfied by the implementation. The codebase evidence shows a complete and correct underline round-trip pipeline. 2 human integration tests remain to confirm the live OO behavior works end-to-end.

---

_Verified: 2026-03-24_
_Verifier: Claude (gsd-verifier)_
