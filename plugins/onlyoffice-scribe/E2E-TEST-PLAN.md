# Scribe E2E Test Plan — v2.5

Test scenarios for the image and table round-trip features.
To be automated in a future milestone.

## Prerequisites

- OO container running with patched SDK (GetInlineDrawings)
- Cozy Drive dev server running
- Document with varied content (text, images, tables, links, formatting)

## Image Round-Trip

### IMG-01: Block image — Replace
1. Select a paragraph containing only an image
2. Trigger Scribe → choose an action (e.g. Rephrase)
3. Verify preview shows image badge (`scribe-img-N`)
4. Click Replace
5. **Expected**: Image reappears at same position, same dimensions, no quality loss

### IMG-02: Inline image — Replace
1. Select a paragraph with text + inline image + text
2. Trigger Scribe
3. Verify md contains `{{IMG:scribe-img-N}}` at correct position in text
4. Click Replace
5. **Expected**: Image at correct position in text, formatting preserved

### IMG-03: Inline image with space after — Replace
1. Select text containing an image followed by a space
2. Trigger Scribe
3. **Expected**: Marker at correct position (not at end of paragraph)

### IMG-04: Multiple images — Replace
1. Select text containing 2+ images at different positions
2. Trigger Scribe
3. **Expected**: Each image has its own marker, restored at correct position

### IMG-05: Image — Insert mode
1. Select text with image
2. Trigger Scribe → click Insert
3. **Expected**: Original stays, copy inserted after with image at correct position

## Table Round-Trip

### TBL-01: Table only — Replace
1. Select a table (no text around it)
2. Trigger Scribe → translate
3. Verify md contains `[TABLE:0]` + `[CELL:r,c]` markers
4. Click Replace
5. **Expected**: Table structure preserved (borders, widths, backgrounds), cell content translated

### TBL-02: Table only — Insert
1. Select a table
2. Trigger Scribe → translate → click Insert
3. **Expected**: Original table stays, translated copy inserted after

### TBL-03: Text + Table + Text — Replace
1. Select: paragraph P1, table T1, paragraph P2
2. Trigger Scribe → translate → click Replace
3. **Expected**: P1' T1' P2' — all translated, table structure preserved

### TBL-04: Text + Table + Text — Insert
1. Select: P1 - T1 - P2
2. Trigger Scribe → translate → click Insert
3. **Expected**: P1 - T1 - P2 - P1' - T1' - P2'

### TBL-05: Cell with link
1. Table cell contains a hyperlink
2. Trigger Scribe → translate
3. **Expected**: Link preserved in translated cell, with formatting if applicable

### TBL-06: Cell with formatting
1. Table cells with bold, italic, mixed formatting
2. Trigger Scribe → translate
3. **Expected**: Formatting preserved in translated cells

### TBL-07: Cell count mismatch
1. Select a table
2. Trigger Scribe with a prompt that might cause the LLM to drop cells
3. **Expected**: Warning banner displayed about cell count mismatch

### TBL-08: Empty cell
1. Table with some empty cells
2. Trigger Scribe → translate
3. **Expected**: Empty cells remain empty, other cells translated

## Formatting Round-Trip

### FMT-01: Italic text with bold word
1. Select: "*text with **bold** inside*"
2. Trigger Scribe → translate
3. **Expected**: Italic + bold preserved in output

### FMT-02: Italic text with link
1. Select: "*text [link](url)*"
2. Trigger Scribe → translate
3. **Expected**: Both italic and link preserved

### FMT-03: Partial formatting with link
1. Select: "*italic* [link](url)" (only first word italic)
2. Trigger Scribe → translate
3. **Expected**: Italic on first word only, link preserved

### FMT-04: Strikethrough + bold
1. Select: "~~**deleted bold**~~"
2. Trigger Scribe → translate
3. **Expected**: Both strikethrough and bold preserved

### FMT-05: Code inline
1. Select: "text with `code` inside"
2. Trigger Scribe → translate
3. **Expected**: Code span preserved in Courier New

## General

### GEN-01: Undo
1. Perform any Replace operation
2. Press Ctrl+Z
3. **Expected**: Single undo restores original content completely

### GEN-02: Large selection
1. Select 50+ paragraphs
2. Trigger Scribe
3. **Expected**: Extraction completes without timeout, or graceful fallback

---
*Created: 2026-03-23 — v2.5 milestone completion*
