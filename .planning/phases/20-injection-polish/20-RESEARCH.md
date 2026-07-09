# Phase 20: Injection Polish - Research

**Researched:** 2026-03-18
**Domain:** OO Builder API post-injection selection, smart spacing at injection boundaries, ApiRange/Search/Select within callCommand
**Confidence:** MEDIUM

## Summary

Phase 20 addresses two remaining injection requirements: (1) post-injection selection so the user sees what was injected, and (2) smart spacing at boundaries for both replace and insert modes. The current `buildAndInject()` uses `InsertContent` inside a single `callCommand` but does not select the result or handle spacing.

The core challenge for selection is that `InsertContent` returns only a boolean -- it does not return references to inserted elements or position information. The OO community confirms this limitation. However, the existing `code.js` already proves that `GetRangeBySelect()`, `GetRange()`, `GetText()`, and `Select()` all work inside callCommand in our OO 9.3.0-138 online instance, despite documentation claiming callCommand is limited to content creation. This means a sentinel marker approach is viable: insert unique marker strings at the start and end of injected content, then use `doc.Search()` to locate them, expand the range between them, select it, and remove the markers via `SearchAndReplace`.

For smart spacing, the existing `pasteHtml()` function already has a working pattern (lines 378-431 of code.js) that reads adjacent characters via `GetRange`/`GetText` and prepends/appends `&nbsp;`. The Builder API path needs the same logic but implemented differently: instead of HTML entities, spacing can be added as text runs prepended/appended to the content array.

**Primary recommendation:** Use a two-phase approach within a single callCommand: (1) read adjacent chars + insert content with sentinel markers, (2) in a second callCommand, search for sentinels, select the range between them, then remove sentinels. This requires two callCommands (one for insert, one for select+cleanup), which means the selection step is a separate undo point. Accept this tradeoff -- the user only cares that content appears selected; they will never undo just the selection.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INJ-02 | Apres injection, le contenu injecte est entierement selectionne dans OO | Sentinel marker strategy: insert unique markers flanking content, Search to find them, ExpandTo to span the range, Select to highlight, SearchAndReplace to remove markers. Requires second callCommand after InsertContent. |
| INJ-03 | Des espaces sont ajoutes intelligemment en debut/fin pour le remplacement, et des retours a la ligne pour l'insertion, selon le contexte adjacent | Read adjacent chars via GetRange/GetText before InsertContent (same callCommand). For replace: add space runs at boundaries. For insert: add empty paragraph separator. Pattern proven in existing pasteHtml() function. |
</phase_requirements>

## Standard Stack

### Core (already available -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| OO Document Builder API | OO 9.3.0-138 | InsertContent, Search, SearchAndReplace, GetRange, Select, ExpandTo | Native API, already used in buildAndInject |
| marked | 17.0.4 | Markdown tokenization (unchanged) | Already bundled in plugin |

### OO APIs Used for This Phase

| API | Purpose | Confidence |
|-----|---------|------------|
| `doc.Search(text, matchCase)` | Find sentinel markers after insertion | MEDIUM -- documented, not yet tested in our callCommand |
| `doc.SearchAndReplace({searchString, replaceString})` | Remove sentinel markers (replace with empty string) | MEDIUM -- documented, official plugin examples exist |
| `range.ExpandTo(otherRange)` | Create range spanning from start sentinel to end sentinel | HIGH -- documented with clear examples |
| `range.Select()` | Highlight the injected content | HIGH -- already used in buildAndInject for cursor collapse |
| `range.GetRange(start, end)` | Sub-range extraction for precise marker targeting | HIGH -- already used in pasteHtml |
| `doc.GetRange(start, end)` | Read adjacent characters for spacing detection | HIGH -- already working in pasteHtml |
| `range.GetText()` | Read adjacent text for spacing analysis | HIGH -- already working in pasteHtml |
| `range.GetStartPos()` / `range.GetEndPos()` | Position tracking for range construction | HIGH -- already used |
| `range.Delete()` | Alternative to SearchAndReplace for marker removal | MEDIUM -- documented, untested in callCommand |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sentinel markers + Search | Position tracking (save pos before insert, compute end after) | InsertContent doesn't report how many chars it inserted; position arithmetic is fragile across block types |
| SearchAndReplace to remove markers | range.Delete() on search results | Delete is simpler but SearchAndReplace is proven in plugin examples |
| Two callCommands (insert + select) | Single callCommand with all operations | Risk: Search may not find content that was just inserted in the same callCommand execution (content not yet committed to document model). Two callCommands is safer. |
| Unicode sentinel markers | ASCII sentinel markers | Unicode ZWSP/ZWJ characters risk being normalized or stripped by OO text engine; visible ASCII markers are more reliable for Search, removed immediately after |

## Architecture Patterns

### Recommended Approach: Two-Phase callCommand

```
Phase A: callCommand #1 (content injection -- existing single undo point)
  1. Read adjacent chars (spacing detection)
  2. If replace mode: add space runs at boundaries
  3. If insert mode: collapse cursor to end, add paragraph separator
  4. Prepend start sentinel marker run to first paragraph
  5. Append end sentinel marker run to last paragraph
  6. InsertContent(content)

Phase B: callCommand #2 (selection + cleanup -- separate, no undo impact)
  1. doc.Search(startSentinel) -> get start range
  2. doc.Search(endSentinel) -> get end range
  3. startRange.ExpandTo(endRange) -> full injected content range
  4. fullRange.Select() -> user sees selection
  5. doc.SearchAndReplace(startSentinel, "") -> remove start marker
  6. doc.SearchAndReplace(endSentinel, "") -> remove end marker
```

**Why two callCommands:**
- InsertContent modifies the document model. Search in the same callCommand may not see the newly inserted content (content may be batched/deferred).
- The callback of callCommand #1 fires after content is committed. Launching callCommand #2 from the callback ensures content is searchable.
- The second callCommand is effectively read-only + cosmetic (selection + marker cleanup). Even if it fails, the content is already injected correctly.

**Undo behavior:**
- Ctrl+Z after injection will undo the marker removal (callCommand #2) first, then the content injection (callCommand #1). This is acceptable -- the user sees their content removed on undo, which is the expected behavior. The marker removal is invisible.
- Actually, if callCommand #2 only does SearchAndReplace with empty string, it produces a second undo point that removes the selection. But since SearchAndReplace replaces invisible sentinel text with nothing, this undo step is effectively invisible to the user (they would see sentinel characters appear briefly, then the previous undo removes all content). This is a minor UX concern.
- **Mitigation:** Use `callCommand(fn, false, true, callback)` for the second call -- the third parameter `true` means "don't add to undo stack" (isNoCalc). VERIFY THIS: the `isNoCalc` parameter might serve a different purpose. If not available, accept the double undo point as a minor tradeoff.

### Sentinel Marker Design

```javascript
// Use unique strings that won't appear in natural text or LLM output
var SENTINEL_START = "\u200B\u200BSCRIBE_START\u200B\u200B";
var SENTINEL_END = "\u200B\u200BSCRIBE_END\u200B\u200B";
```

**Wait -- ZWSP risk.** OO may strip zero-width space characters. Safer approach:

```javascript
// Use ASCII markers that are extremely unlikely in LLM output
// Include timestamp for uniqueness in case of rapid successive injections
var SENTINEL_START = "[[SCRIBE_S_" + Date.now() + "]]";
var SENTINEL_END = "[[SCRIBE_E_" + Date.now() + "]]";
```

**Even better -- generate once per injection, pass via Asc.scope:**
```javascript
// In plugin iframe before callCommand:
var ts = Date.now();
Asc.scope._sentinelStart = "SCBS" + ts;
Asc.scope._sentinelEnd = "SCBE" + ts;
```

Short markers reduce visual flash risk. The markers exist in the document only between callCommand #1 completing and callCommand #2 executing -- typically <50ms.

### Smart Spacing Pattern

The existing `pasteHtml()` function (code.js lines 378-431) has a proven pattern:

```javascript
// Inside callCommand: read adjacent characters
var selRange = doc.GetRangeBySelect();
var selStart = selRange.GetStartPos();
var selEnd = selRange.GetEndPos();
var WS = /[\s\n\r\t\u00A0]/;

// Check char before selection
var beforeRange = doc.GetRange(selStart - 5 >= 0 ? selStart - 5 : 0, selStart);
var beforeText = beforeRange ? beforeRange.GetText() : "";
var beforeChar = beforeText.length > 0 ? beforeText.charAt(beforeText.length - 1) : "";
var needSpaceBefore = beforeChar && !WS.test(beforeChar);

// Check char after selection
var afterRange = doc.GetRange(selEnd, selEnd + 5);
var afterText = afterRange ? afterRange.GetText() : "";
var afterChar = afterText.length > 0 ? afterText.charAt(0) : "";
var needSpaceAfter = afterChar && !WS.test(afterChar);
```

For the Builder API path, instead of HTML `&nbsp;`, add space as a text run:

```javascript
// Prepend space run to first paragraph if needed
if (needSpaceBefore && content.length > 0) {
  var spaceRun = Api.CreateRun();
  spaceRun.AddText(" ");
  if (srcFontFamily) spaceRun.SetFontFamily(srcFontFamily);
  if (srcFontSize) spaceRun.SetFontSize(srcFontSize);
  // Insert at position 0 of first paragraph
  // Note: AddElement appends. Need to prepend.
  // Strategy: create new array with space run first, then existing runs
  // Actually: paragraphs are built from runs added via AddElement in order.
  // So add the space run BEFORE other runs when building the paragraph.
}
```

**Key insight for spacing implementation:** The spacing logic must be integrated into the content array BEFORE calling InsertContent. This means the spacing detection (read adjacent chars) and the content building (paragraphs + runs) happen in the same callCommand, with spacing runs prepended/appended to the content array.

### Insert Mode: Paragraph Separator

For insert mode (insert after selection), the current code collapses cursor to end of selection. The injected content needs a paragraph separator from the existing text:

```javascript
// For insert mode: add an empty paragraph as first element of content array
if (mode === "insert") {
  var separator = Api.CreateParagraph();
  // Empty paragraph acts as line break between existing and new content
  content.unshift(separator);
}
```

**Alternative:** Don't add a separator paragraph. Instead, rely on InsertContent creating proper paragraph breaks. Test whether InsertContent at end-of-selection naturally creates a new paragraph or merges with the existing one.

### Files to Modify

| File | Change | LOC Estimate |
|------|--------|-------------|
| `plugins/onlyoffice-scribe/scripts/code.js` | Add sentinel markers to buildAndInject, add second callCommand for selection, add spacing detection logic | ~80-100 |

### Anti-Patterns to Avoid

- **Don't try to select content in the same callCommand as InsertContent.** The inserted content may not be searchable until the callCommand completes and the document model updates.
- **Don't use invisible Unicode characters (ZWSP, ZWJ) as sentinels.** OO may normalize or strip them during content insertion. Use short visible ASCII markers that are immediately removed.
- **Don't add spacing by modifying the first/last run's text.** This would merge the space with the formatted text. Use a separate unformatted run for the space character.
- **Don't skip spacing detection for heading or list blocks.** Even headings injected mid-sentence need boundary spacing (though this case is rare with LLM output).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding injected content position | Manual character counting / position arithmetic | `doc.Search()` with sentinel markers | InsertContent doesn't return position info; counting chars across block types is fragile |
| Selecting a range across paragraphs | Individual paragraph selection + merging | `range.ExpandTo(otherRange)` + `Select()` | ExpandTo handles cross-paragraph ranges natively |
| Removing sentinel markers | Manual GetRange + Delete on computed positions | `doc.SearchAndReplace(marker, "")` | SearchAndReplace handles all occurrences, proven in OO plugin examples |
| Adjacent character detection | Custom paragraph boundary walking | `doc.GetRange(pos-5, pos).GetText()` | Already proven in existing pasteHtml() code |

## Common Pitfalls

### Pitfall 1: Search Doesn't Find Sentinels After InsertContent in Same callCommand
**What goes wrong:** `doc.Search(sentinel)` returns empty array because the document model hasn't committed the InsertContent changes yet.
**Why it happens:** callCommand may batch document modifications. Content inserted via InsertContent may not be visible to Search until the callCommand completes.
**How to avoid:** Use two separate callCommands: #1 for insertion (with sentinels), #2 for search+select+cleanup. Launch #2 from #1's callback.
**Warning signs:** Search returns empty array; no selection visible after injection.

### Pitfall 2: Sentinel Marker Visible to User as Flash
**What goes wrong:** User briefly sees "SCBS1710793200000" text in the document before it's removed.
**Why it happens:** There's a time gap between callCommand #1 completing (sentinels inserted) and callCommand #2 executing (sentinels removed).
**How to avoid:** Keep sentinel strings very short (e.g., 8-12 chars). Launch callCommand #2 immediately in #1's callback with no setTimeout. The gap should be <50ms -- imperceptible. Alternatively, use zero-width characters IF testing proves OO preserves them through InsertContent.
**Warning signs:** Brief text flash on injection.

### Pitfall 3: SearchAndReplace Removes Wrong Text
**What goes wrong:** If sentinel string appears in the actual document content, SearchAndReplace removes it.
**Why it happens:** Poor sentinel design -- too generic.
**How to avoid:** Include timestamp in sentinel string. The probability of "SCBS1710793200000" appearing in document text is effectively zero. Also, sentinels are only present for <50ms.
**Warning signs:** Document content unexpectedly modified after injection.

### Pitfall 4: Double Undo Point (Insert + Select/Cleanup)
**What goes wrong:** User presses Ctrl+Z expecting to undo the injection but first undo only removes the sentinel cleanup, second undo removes content.
**Why it happens:** Two separate callCommands create two undo points.
**How to avoid:** Test whether `callCommand(fn, false, true, cb)` (third param = true) prevents the second callCommand from creating an undo point. The OO docs describe the third param as "isNoCalc" but its exact behavior needs verification. If it doesn't help, accept the double undo -- the first undo (re-adding invisible sentinels) is effectively invisible to the user.
**Warning signs:** First Ctrl+Z doesn't remove content; second Ctrl+Z does.

### Pitfall 5: Spacing Detection Fails at Document Start/End
**What goes wrong:** `doc.GetRange(-5, 0)` or `GetRange(docEnd, docEnd+5)` returns invalid range or throws.
**Why it happens:** Position underflow/overflow.
**How to avoid:** Guard with `Math.max(0, selStart - 5)` (already done in existing pasteHtml code). For after-selection range, if GetText returns empty string, assume no space needed (end of document).
**Warning signs:** Error in callCommand, no content injected.

### Pitfall 6: ExpandTo Returns Null for Cross-Paragraph Ranges
**What goes wrong:** `startRange.ExpandTo(endRange)` returns null when sentinels are in different paragraphs.
**Why it happens:** ExpandTo might not support cross-paragraph expansion (untested).
**How to avoid:** Test with multi-paragraph content. Fallback approach: use `doc.GetRange(startRange.GetStartPos(), endRange.GetEndPos())` to construct the range by absolute positions instead of ExpandTo.
**Warning signs:** Selection doesn't work for multi-paragraph injections.

### Pitfall 7: ES5 Syntax in callCommand
**What goes wrong:** New code uses const, let, arrow functions, or template literals.
**Why it happens:** Easy to slip into ES6 when writing new logic.
**How to avoid:** Review all callCommand function bodies for ES5 compliance. Use var, function expressions, string concatenation.
**Warning signs:** Works locally but fails in production OO.

## Code Examples

### Sentinel Injection in buildAndInject (Phase A)

```javascript
// ES5 -- inside the callCommand function body of buildAndInject
// After building content array, before InsertContent:

var sentinelStart = Asc.scope._sentinelStart;
var sentinelEnd = Asc.scope._sentinelEnd;

// Add start sentinel as first run of first paragraph
if (content.length > 0 && sentinelStart) {
  var startRun = Api.CreateRun();
  startRun.AddText(sentinelStart);
  startRun.SetFontSize(1); // Tiny font to minimize visual flash
  // AddElement appends -- so we need it BEFORE other elements
  // Strategy: build a new first paragraph with sentinel + original runs
  // Actually: just add sentinel run, then add original runs. Order matters.
  // The existing loop adds runs via AddElement. Add sentinel FIRST.
}

// Add end sentinel as last run of last paragraph
if (content.length > 0 && sentinelEnd) {
  var lastPara = content[content.length - 1];
  var endRun = Api.CreateRun();
  endRun.AddText(sentinelEnd);
  endRun.SetFontSize(1);
  lastPara.AddElement(endRun);
}
```

**Implementation note:** Adding the start sentinel to the first paragraph requires restructuring the paragraph-building loop. The sentinel run must be the FIRST element added to the first paragraph. Refactor: build sentinel run first, then add content runs.

### Post-Injection Selection (Phase B)

```javascript
// ES5 -- new function called from buildAndInject's callback
function selectInjectedContent() {
  Asc.scope._sentinelStart = sentinelStart; // Already in scope from Phase A
  Asc.scope._sentinelEnd = sentinelEnd;

  window.Asc.plugin.callCommand(function() {
    var doc = Api.GetDocument();
    var sStart = Asc.scope._sentinelStart;
    var sEnd = Asc.scope._sentinelEnd;

    // Find sentinel markers
    var startResults = doc.Search(sStart, true);
    var endResults = doc.Search(sEnd, true);

    if (startResults.length > 0 && endResults.length > 0) {
      var startRange = startResults[0];
      var endRange = endResults[0];

      // Get positions for range construction
      var selStartPos = startRange.GetStartPos();
      var selEndPos = endRange.GetEndPos();

      // Remove sentinels first
      doc.SearchAndReplace({ "searchString": sStart, "replaceString": "" });
      doc.SearchAndReplace({ "searchString": sEnd, "replaceString": "" });

      // Recalculate positions after sentinel removal
      // Start sentinel removed: all positions shift left by sentinel length
      var startLen = sStart.length;
      var endLen = sEnd.length;
      var adjStart = selStartPos;
      var adjEnd = selEndPos - startLen - endLen;

      // Select the range
      var finalRange = doc.GetRange(adjStart, adjEnd);
      if (finalRange) {
        finalRange.Select();
      }
    } else {
      // Sentinels not found -- skip selection (content still injected)
    }
  }, false, false, function() {
    pasteInProgress = false;
  });
}
```

**CRITICAL NOTE:** The position adjustment after sentinel removal is fragile. Sentinel removal shifts character positions, and the math depends on sentinels being at exact paragraph boundaries. **Safer alternative:** Remove sentinels AFTER selecting (select including sentinels, then remove them). But this would deselect the range.

**Actually, better approach:** Reverse the order -- select first, then remove sentinels in a third step. But this adds a third callCommand.

**Best approach (revised):**
1. callCommand #1: InsertContent with sentinels
2. callCommand #2: Search sentinels, compute positions, remove sentinels, select clean range

```javascript
// Revised Phase B -- search, remove, then select
window.Asc.plugin.callCommand(function() {
  var doc = Api.GetDocument();
  var sStart = Asc.scope._sentinelStart;
  var sEnd = Asc.scope._sentinelEnd;

  var startResults = doc.Search(sStart, true);
  var endResults = doc.Search(sEnd, true);

  if (startResults.length > 0 && endResults.length > 0) {
    // Get positions of content BETWEEN sentinels
    var contentStart = startResults[0].GetEndPos();
    var contentEnd = endResults[0].GetStartPos();

    // Remove sentinels
    doc.SearchAndReplace({ "searchString": sStart, "replaceString": "" });
    doc.SearchAndReplace({ "searchString": sEnd, "replaceString": "" });

    // Adjust positions: start sentinel removed shifts everything left
    var startLen = sStart.length;
    var adjContentStart = contentStart - startLen;
    var adjContentEnd = contentEnd - startLen;

    // Select the injected content (without sentinels)
    var selectRange = doc.GetRange(adjContentStart, adjContentEnd);
    if (selectRange) selectRange.Select();
  }
}, false, false, function() {
  pasteInProgress = false;
});
```

### Smart Spacing Integration in buildAndInject

```javascript
// ES5 -- inside callCommand, BEFORE building content array
// Read adjacent characters for spacing detection

var needSpaceBefore = false;
var needSpaceAfter = false;
var WS = /[\s\n\r\t\u00A0]/;

if (mode === "replace") {
  var selRange = doc.GetRangeBySelect();
  if (selRange) {
    var selStart = selRange.GetStartPos();
    var selEnd = selRange.GetEndPos();

    if (selStart > 0) {
      var beforeRange = doc.GetRange(selStart - 5 >= 0 ? selStart - 5 : 0, selStart);
      var beforeText = beforeRange ? beforeRange.GetText() : "";
      var beforeChar = beforeText.length > 0 ? beforeText.charAt(beforeText.length - 1) : "";
      if (beforeChar && !WS.test(beforeChar)) needSpaceBefore = true;
    }

    var afterRange = doc.GetRange(selEnd, selEnd + 5);
    var afterText = afterRange ? afterRange.GetText() : "";
    var afterChar = afterText.length > 0 ? afterText.charAt(0) : "";
    if (afterChar && !WS.test(afterChar)) needSpaceAfter = true;
  }
}

// After building content array, add space runs:
if (needSpaceBefore && content.length > 0) {
  var spaceRun = Api.CreateRun();
  spaceRun.AddText(" ");
  if (srcFontFamily) spaceRun.SetFontFamily(srcFontFamily);
  if (srcFontSize) spaceRun.SetFontSize(srcFontSize);
  // Prepend: we need this run BEFORE other runs in first paragraph
  // Solution: build first paragraph with space run first during construction
}

if (needSpaceAfter && content.length > 0) {
  var spaceRunAfter = Api.CreateRun();
  spaceRunAfter.AddText(" ");
  if (srcFontFamily) spaceRunAfter.SetFontFamily(srcFontFamily);
  if (srcFontSize) spaceRunAfter.SetFontSize(srcFontSize);
  content[content.length - 1].AddElement(spaceRunAfter);
}
```

## State of the Art

| Old Approach (Phase 18-19) | New Approach (Phase 20) | Impact |
|----------------------------|-------------------------|--------|
| InsertContent with no selection | Sentinel markers + Search + Select | User sees injected content highlighted |
| No spacing in Builder path | Adjacent char detection + space runs | No word merging at boundaries |
| pasteHtml has spacing, Builder doesn't | Both paths have spacing | Consistent UX regardless of injection path |
| Insert mode: just collapse cursor | Insert mode: add paragraph separator | Visual separation between original and injected |

## Open Questions

1. **Does doc.Search() work inside callCommand in our OO 9.3.0-138?**
   - What we know: GetRange, GetText, Select all work inside callCommand (proven in existing code). SearchAndReplace is shown in official plugin examples inside callCommand.
   - What's unclear: Whether doc.Search() specifically works inside a callCommand in online editor mode. It should, given that SearchAndReplace works.
   - Recommendation: Test Search inside callCommand as first task. If it fails, fall back to position-based approach (record document length before insert, calculate range after).

2. **Does SearchAndReplace with empty replaceString actually delete text in callCommand?**
   - What we know: Official examples show SearchAndReplace inside callCommand. API docs show replaceString accepts string.
   - What's unclear: Whether empty string replacement works (vs. being treated as no-op).
   - Recommendation: Test during spike. If empty string fails, use a single space as replacement, then Search for that space and Delete the range.

3. **Position arithmetic after sentinel removal**
   - What we know: Removing N characters shifts all subsequent positions left by N.
   - What's unclear: Whether OO positions account for paragraph boundaries (do paragraph breaks count as characters in the position index?). Whether removing text via SearchAndReplace shifts positions predictably.
   - Recommendation: This is the riskiest part. The spike (plan 20-01) must validate position math with multi-paragraph content. If positions are unreliable, consider alternative: select the range INCLUDING sentinels, then in a third callCommand remove sentinels and re-select.

4. **callCommand third parameter (isNoCalc) for undo suppression**
   - What we know: callCommand signature is `callCommand(fn, isCalc, isNoCalc, callback)`. The third param is documented as "isNoCalc" in some sources.
   - What's unclear: Whether setting `isNoCalc: true` prevents the callCommand from creating an undo point. The parameter may only control recalculation, not undo history.
   - Recommendation: Test during spike. If it doesn't suppress undo, accept double undo point.

5. **Alternative: Select Including Sentinels, Then Remove**
   - Could select the full range (sentinels included), then remove sentinels. But SearchAndReplace would deselect the range.
   - Alternative: Use three callCommands: (1) insert with sentinels, (2) find sentinels + select full range, (3) remove sentinels + re-select without them.
   - This adds complexity but avoids position arithmetic. Evaluate if position math proves unreliable.

## Sources

### Primary (HIGH confidence)
- [InsertContent API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/InsertContent/) -- returns boolean, no position info
- [ApiRange methods](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRange/) -- Select, GetRange, ExpandTo, GetStartPos, GetEndPos, Delete, AddBookmark
- [ApiRange.Select()](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRange/Methods/Select/) -- sets selection to range, returns boolean
- [ApiRange.ExpandTo()](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRange/Methods/ExpandTo/) -- expands range to include another range
- [ApiDocument.Search()](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/Search/) -- returns ApiRange[] for found text
- [ApiDocument.SearchAndReplace()](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/SearchAndReplace/) -- find and replace text
- [ApiDocument.GetRange()](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/GetRange/) -- character-indexed range
- [ApiRange.Delete()](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRange/Methods/Delete/) -- removes range content
- [Community: Issue retrieving paragraph after InsertContent](https://community.onlyoffice.com/t/issue-in-retrieving-newly-created-paragraph-element/10415) -- confirms InsertContent doesn't return refs, recommends Search-based approach
- [callCommand docs](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/) -- ES5 sandbox, Asc.scope bridge, "only content creation" note (but proven wrong by existing code)
- Existing `code.js` lines 204-361 (buildAndInject) and 372-431 (pasteHtml) -- proven patterns for GetRange, GetText, Select inside callCommand

### Secondary (MEDIUM confidence)
- [Search and Replace plugin example](https://api.onlyoffice.com/docs/plugin-and-macros/samples/plugin-samples/search-and-replace/) -- SearchAndReplace inside callCommand
- [ApiRange.AddBookmark()](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRange/Methods/AddBookmark/) -- alternative marker approach (not recommended over Search)

## Metadata

**Confidence breakdown:**
- Smart spacing: HIGH -- pattern copied from proven pasteHtml() code, only adapting to use text runs instead of HTML entities
- Sentinel marker concept: MEDIUM -- individual APIs (Search, Select, SearchAndReplace) are documented, but the combined pattern (insert markers, search, select, remove) is untested. Requires spike validation.
- Position arithmetic after removal: LOW -- no documentation on how positions shift after SearchAndReplace; cross-paragraph position counting is undocumented. This is the highest risk area.
- Two-callCommand approach: MEDIUM -- callback chaining is proven (existing pasteHtml uses it), but timing between commands and document model state consistency is untested.

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable -- OO version pinned, all APIs are stable)
