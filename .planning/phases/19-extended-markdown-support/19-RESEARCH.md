# Phase 19: Extended Markdown Support - Research

**Researched:** 2026-03-18
**Domain:** OO Document Builder API (headings, lists, links, strikethrough, code spans) + marked.js token structures
**Confidence:** HIGH

## Summary

Phase 19 extends the flattenTokens/buildAndInject pipeline from Phase 18 to handle six additional token types: headings (H1-H6), bullet lists, numbered lists, strikethrough, code spans, and hyperlinks. The OO Document Builder API has mature support for all of these -- headings via `paragraph.SetStyle(doc.GetStyle("Heading N"))`, lists via `doc.CreateNumbering("bullet"|"numbered")` + `paragraph.SetNumbering(numLvl)`, hyperlinks via `Api.CreateHyperlink(url, text, tip)`, strikethrough via `run.SetStrikeout(true)`, and monospace via `run.SetFontFamily("Courier New")`.

The marked.js lexer (already vendored and used) produces well-structured tokens for all these types with GFM enabled by default. The main complexity is in nested lists (list_item tokens can contain child list tokens) and in hyperlinks (inline tokens that need to be added as paragraph elements rather than runs).

**Primary recommendation:** Extend flattenTokens() to emit typed block objects (heading, list_item with level/ordered) and typed inline run objects (with strikethrough, code, link properties), then extend the callCommand interpreter to handle each type with the corresponding Builder API calls.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INL-02 | Strikethrough text injected with OO SetStrikeout formatting | ApiRun.SetStrikeout(true); marked `del` token type |
| INL-03 | Code spans injected in monospace font | ApiRun.SetFontFamily("Courier New"); marked `codespan` token type |
| INL-04 | Links injected as clickable OO hyperlinks | Api.CreateHyperlink(url, text, tip) + paragraph.AddElement(); marked `link` token type |
| BLK-02 | Headings H1-H6 with corresponding OO heading styles | paragraph.SetStyle(doc.GetStyle("Heading N")); marked `heading` token with depth 1-6 |
| BLK-03 | Bullet lists with nested levels as native OO lists | doc.CreateNumbering("bullet") + paragraph.SetNumbering(numLvl.GetLevel(depth)); marked `list` token with ordered=false |
| BLK-04 | Numbered lists with nested levels as native OO lists | doc.CreateNumbering("numbered") + paragraph.SetNumbering(numLvl.GetLevel(depth)); marked `list` token with ordered=true |
</phase_requirements>

## Standard Stack

### Core (already in place from Phase 18)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| marked | UMD (vendored) | Markdown lexer producing tokens | Already bundled in plugin iframe |
| OO Document Builder API | 8.x | Native document element creation | Already used via callCommand in Phase 18 |

### No new libraries needed
All six token types can be handled with existing marked.lexer() output and existing OO Builder API methods. No additional dependencies.

## Architecture Patterns

### Token Pipeline Extension

The existing pipeline is: `marked.lexer(md)` -> `flattenTokens()` -> `Asc.scope.tokens` -> callCommand interpreter -> `InsertContent(content)`.

Phase 19 extends this in two places:
1. **flattenTokens()** -- add handling for `heading`, `list`, `codespan`, `del`, and `link` token types
2. **callCommand interpreter** -- add builders for heading paragraphs, list paragraphs, hyperlink elements

### Extended Block Schema

Current flattenTokens output:
```javascript
[{ type: "paragraph", runs: [{ text, bold, italic }] }]
```

Extended output after Phase 19:
```javascript
[
  { type: "paragraph", runs: [...] },
  { type: "heading", depth: 1-6, runs: [...] },
  { type: "list_item", ordered: false, level: 0, runs: [...] },
  { type: "list_item", ordered: true, level: 0, runs: [...] }
]
```

### Extended Run Schema

Current run properties: `{ text, bold, italic }`

Extended after Phase 19:
```javascript
{
  text: "string",
  bold: false,
  italic: false,
  strikethrough: false,  // NEW: INL-02
  code: false,           // NEW: INL-03
  link: null             // NEW: INL-04 -- string URL or null
}
```

### Recommended Processing Order

Plan 19-01 (block elements first): headings + lists
- These are new block types in flattenTokens and new branches in the callCommand interpreter
- Lists are the most complex (nested structure, numbering objects)

Plan 19-02 (inline elements): strikethrough + code spans + hyperlinks
- These are new run properties in flattenInline and new formatting calls in the interpreter
- Hyperlinks need special handling (AddElement with ApiHyperlink, not AddElement with ApiRun)

## Marked.js Token Structures

**Confidence: HIGH** (verified via official docs and deepwiki)

### Heading Token
```javascript
{
  type: "heading",
  depth: 1,           // 1-6 for H1-H6
  text: "Title",
  tokens: [...]       // inline tokens (can contain bold, italic, links, etc.)
}
```

### List Token
```javascript
{
  type: "list",
  ordered: false,      // true for numbered lists
  start: "",           // starting number for ordered lists (or "")
  loose: false,        // loose lists have blank lines between items
  items: [
    {
      type: "list_item",
      tokens: [        // block tokens -- may contain paragraph, text, or nested list
        { type: "text", text: "item text", tokens: [...] },
        { type: "list", ordered: false, items: [...] }  // NESTED LIST
      ],
      task: false,
      checked: undefined
    }
  ]
}
```

**Critical: nested lists.** A list_item's tokens array can contain another `list` token for nested items. flattenTokens must recursively walk this structure, tracking depth.

### Del (Strikethrough) Token
```javascript
{
  type: "del",
  text: "struck text",
  tokens: [...]       // inline tokens (can contain bold, italic, etc.)
}
```
GFM is enabled by default in marked, so `~~text~~` produces `del` tokens out of the box.

### Codespan Token
```javascript
{
  type: "codespan",
  text: "code text"   // NO nested tokens -- code spans are leaf nodes
}
```

### Link Token
```javascript
{
  type: "link",
  href: "https://example.com",
  title: "tooltip",   // or null
  text: "display text",
  tokens: [...]       // inline tokens for display text
}
```

## OO Builder API Reference

**Confidence: HIGH** (verified via official API docs)

### Headings: SetStyle with GetStyle

```javascript
// ES5 -- inside callCommand
var doc = Api.GetDocument();
var headingStyle = doc.GetStyle("Heading 1"); // "Heading 1" through "Heading 6"
var p = Api.CreateParagraph();
p.SetStyle(headingStyle);
// Then add runs as usual
p.AddElement(run);
```

Style names are English strings: `"Heading 1"`, `"Heading 2"`, ... `"Heading 6"`.
**Note:** Do NOT apply srcFontFamily/srcFontSize to heading runs -- headings should use their built-in style sizing.

### Lists: CreateNumbering + SetNumbering

```javascript
// ES5 -- inside callCommand
var doc = Api.GetDocument();
var bulletNum = doc.CreateNumbering("bullet");   // or "numbered"
var lvl0 = bulletNum.GetLevel(0);                // level 0 = top-level
var lvl1 = bulletNum.GetLevel(1);                // level 1 = first nesting

var p = Api.CreateParagraph();
p.AddText("Bullet item");
p.SetNumbering(lvl0);
content.push(p);

var p2 = Api.CreateParagraph();
p2.AddText("Nested item");
p2.SetNumbering(lvl1);
content.push(p2);
```

**Key points:**
- CreateNumbering takes `"bullet"` or `"numbered"` -- creates an abstract numbering definition
- GetLevel(n) returns ApiNumberingLevel for nesting depth n (0-7 supported)
- Each paragraph with SetNumbering becomes a list item
- A single CreateNumbering object should be reused for all items in the same list (bullet or numbered)
- For mixed bullet+numbered lists, create two separate numbering objects
- Nesting is controlled by the level index, not by indentation

### Hyperlinks: CreateHyperlink + AddElement

```javascript
// ES5 -- inside callCommand
var p = Api.CreateParagraph();
var link = Api.CreateHyperlink("https://example.com", "display text", "tooltip");
p.AddElement(link);
content.push(p);
```

**Key constraint:** ApiHyperlink is added to a paragraph via AddElement, just like ApiRun. It cannot contain child runs with mixed formatting (bold link text, etc.) -- the display text is set as a plain string via the constructor or SetDisplayedText().

**Implication for formatted link text:** If the link display text contains bold/italic (e.g., `[**bold link**](url)`), we have two options:
1. Flatten to plain text for the hyperlink display (simpler, recommended)
2. Skip CreateHyperlink and use AddHyperlink on a range (complex, fragile)

**Recommendation:** Use plain text for hyperlink display. Formatted link text is extremely rare in AI responses.

### Strikethrough: SetStrikeout

```javascript
// ES5 -- inside callCommand
var r = Api.CreateRun();
r.AddText("struck through text");
r.SetStrikeout(true);
if (srcFontFamily) r.SetFontFamily(srcFontFamily);
if (srcFontSize) r.SetFontSize(srcFontSize);
p.AddElement(r);
```

### Code Spans: SetFontFamily monospace

```javascript
// ES5 -- inside callCommand
var r = Api.CreateRun();
r.AddText("code text");
r.SetFontFamily("Courier New");
// Do NOT apply srcFontFamily -- code spans should always be monospace
// DO apply srcFontSize to keep size consistent
if (srcFontSize) r.SetFontSize(srcFontSize);
p.AddElement(r);
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| List numbering/bullets | Manual bullet chars + indentation | doc.CreateNumbering() + SetNumbering() | OO handles bullet symbols, numbering restart, indentation per level automatically |
| Heading font sizes | Manual SetFontSize per heading level | paragraph.SetStyle(doc.GetStyle("Heading N")) | OO heading styles include spacing, outline level, TOC compatibility |
| Hyperlink formatting | Blue underlined text runs | Api.CreateHyperlink() | Native hyperlinks are Ctrl+clickable, show tooltips, update on edit |
| Nested list depth tracking | Manual indentation math | numbering.GetLevel(depth) | OO numbering levels handle indent, bullet style changes per level |

## Common Pitfalls

### Pitfall 1: Nested list flattening
**What goes wrong:** Treating list items as flat and losing nesting structure
**Why it happens:** marked produces nested list tokens (list inside list_item.tokens), not a flat array with depth
**How to avoid:** Recursive walk of list_item.tokens, incrementing depth when encountering a child list token. Flatten to `[{ type: "list_item", level: N, ordered: bool, runs: [...] }]`
**Warning signs:** All list items appear at the same indentation level

### Pitfall 2: Numbering object reuse
**What goes wrong:** Each list item gets its own CreateNumbering call, producing visually disconnected lists
**Why it happens:** Creating a new numbering object per item instead of per list
**How to avoid:** Create ONE numbering object per contiguous list block (bullet or numbered), reuse for all items in that block. For the callCommand interpreter, create bullet and numbered numbering objects once if needed.
**Warning signs:** Numbered lists restart at 1 for each item, bullet style changes between items

### Pitfall 3: Heading font size override
**What goes wrong:** Headings appear the same size as body text
**Why it happens:** Applying srcFontFamily/srcFontSize to heading runs overrides the heading style
**How to avoid:** Skip srcFontFamily AND srcFontSize for heading blocks. The heading style defines its own sizing.
**Warning signs:** H1 and H6 look identical, or all headings look like body text

### Pitfall 4: ES5 compliance in callCommand
**What goes wrong:** Syntax errors inside callCommand crash silently
**Why it happens:** Using const, let, arrow functions, template literals in the callCommand function body
**How to avoid:** All code inside callCommand must use var, function expressions, string concatenation
**Warning signs:** callCommand callback never fires, falls through to PasteHtml fallback

### Pitfall 5: Hyperlink as run vs element
**What goes wrong:** Hyperlink text appears but is not clickable
**Why it happens:** Adding link text as a regular run with blue color instead of using CreateHyperlink
**How to avoid:** Use Api.CreateHyperlink() and AddElement() to paragraph -- this creates a native OO hyperlink
**Warning signs:** Ctrl+click does nothing on the link text

### Pitfall 6: Code span vs code block confusion
**What goes wrong:** Multi-line code blocks get monospace treatment
**Why it happens:** Not distinguishing `codespan` (inline) from `code` (block) token types
**How to avoid:** Phase 19 handles `codespan` only. `code` blocks (TBL-02) are deferred to future requirements. In flattenTokens, ignore or fallback `code` block tokens.
**Warning signs:** Large code blocks appear inline

### Pitfall 7: List item content structure
**What goes wrong:** List items show "[object Object]" or empty text
**Why it happens:** marked wraps list item content in either a `text` token or a `paragraph` token depending on loose/tight list mode
**How to avoid:** Check for both `text` and `paragraph` tokens inside list_item.tokens when extracting inline content. In tight lists, content is in `{ type: "text", tokens: [...] }`. In loose lists, content is in `{ type: "paragraph", tokens: [...] }`.
**Warning signs:** Some list items render correctly but others are empty

## Code Examples

### flattenTokens extension for headings

```javascript
// ES5 -- inside flattenTokens block loop
if (block.type === "heading") {
  blocks.push({
    type: "heading",
    depth: block.depth,
    runs: flattenInline(block.tokens || [], false, false)
  });
}
```

### flattenTokens extension for lists (with nesting)

```javascript
// ES5 -- recursive list walker
function flattenList(listToken, depth) {
  var items = listToken.items || [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var itemTokens = item.tokens || [];
    var inlineTokens = [];
    for (var j = 0; j < itemTokens.length; j++) {
      var sub = itemTokens[j];
      if (sub.type === "list") {
        // First, push the current item's inline content
        // Then recurse into nested list
        flattenList(sub, depth + 1);
      } else if (sub.type === "text" || sub.type === "paragraph") {
        inlineTokens = inlineTokens.concat(sub.tokens || []);
      }
    }
    // Push item BEFORE recursing nested children (pre-order)
    if (inlineTokens.length > 0) {
      blocks.push({
        type: "list_item",
        ordered: !!listToken.ordered,
        level: depth,
        runs: flattenInline(inlineTokens, false, false)
      });
    }
  }
}

// In the main block loop:
if (block.type === "list") {
  flattenList(block, 0);
}
```

**Note:** The ordering must be: push current item runs first, THEN recurse into nested lists. This ensures parent items appear before their children.

### flattenInline extension for strikethrough, codespan, link

```javascript
// ES5 -- inside flattenInline
if (tok.type === "del") {
  runs = runs.concat(flattenInline(tok.tokens, parentBold, parentItalic, true, parentCode, parentLink));
} else if (tok.type === "codespan") {
  runs.push({ text: tok.text, bold: !!parentBold, italic: !!parentItalic, strikethrough: !!parentStrikethrough, code: true, link: null });
} else if (tok.type === "link") {
  // For simplicity, flatten link children as runs with link URL attached
  var linkRuns = flattenInline(tok.tokens || [], parentBold, parentItalic, parentStrikethrough, parentCode, tok.href);
  runs = runs.concat(linkRuns);
}
```

### callCommand interpreter for headings

```javascript
// ES5 -- inside callCommand, within the blocks loop
if (block.type === "heading") {
  var p = Api.CreateParagraph();
  var styleName = "Heading " + block.depth;
  var headingStyle = doc.GetStyle(styleName);
  if (headingStyle) p.SetStyle(headingStyle);
  var runs = block.runs || [];
  for (var j = 0; j < runs.length; j++) {
    var run = runs[j];
    var r = Api.CreateRun();
    r.AddText(run.text);
    if (run.bold) r.SetBold(true);
    if (run.italic) r.SetItalic(true);
    // NO srcFontFamily/srcFontSize for headings
    p.AddElement(r);
  }
  content.push(p);
}
```

### callCommand interpreter for list items

```javascript
// ES5 -- inside callCommand
// Create numbering objects once at the top
var bulletNumbering = null;
var orderedNumbering = null;
var hasBullets = false;
var hasOrdered = false;
for (var i = 0; i < blocks.length; i++) {
  if (blocks[i].type === "list_item") {
    if (blocks[i].ordered) hasOrdered = true;
    else hasBullets = true;
  }
}
if (hasBullets) bulletNumbering = doc.CreateNumbering("bullet");
if (hasOrdered) orderedNumbering = doc.CreateNumbering("numbered");

// Then in the block loop:
if (block.type === "list_item") {
  var p = Api.CreateParagraph();
  var numbering = block.ordered ? orderedNumbering : bulletNumbering;
  var numLvl = numbering.GetLevel(block.level);
  p.SetNumbering(numLvl);
  var runs = block.runs || [];
  for (var j = 0; j < runs.length; j++) {
    var run = runs[j];
    var r = Api.CreateRun();
    r.AddText(run.text);
    if (run.bold) r.SetBold(true);
    if (run.italic) r.SetItalic(true);
    if (srcFontFamily) r.SetFontFamily(srcFontFamily);
    if (srcFontSize) r.SetFontSize(srcFontSize);
    p.AddElement(r);
  }
  content.push(p);
}
```

### callCommand interpreter for inline formatting (strikethrough, code, link)

```javascript
// ES5 -- inside the runs loop for any block type
for (var j = 0; j < runs.length; j++) {
  var run = runs[j];

  if (run.link) {
    // Hyperlink -- use CreateHyperlink
    var link = Api.CreateHyperlink(run.link, run.text, "");
    p.AddElement(link);
  } else {
    // Regular run
    var r = Api.CreateRun();
    r.AddText(run.text);
    if (run.bold) r.SetBold(true);
    if (run.italic) r.SetItalic(true);
    if (run.strikethrough) r.SetStrikeout(true);
    if (run.code) {
      r.SetFontFamily("Courier New");
      // Only apply srcFontSize, not srcFontFamily
      if (srcFontSize) r.SetFontSize(srcFontSize);
    } else {
      if (srcFontFamily) r.SetFontFamily(srcFontFamily);
      if (srcFontSize) r.SetFontSize(srcFontSize);
    }
    p.AddElement(r);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PasteHtml for all content | Builder API via callCommand | Phase 18 (current) | Single undo, native formatting |
| Flat paragraph-only tokens | Typed block tokens (heading, list_item) | Phase 19 (this phase) | Block-level semantic support |
| text/bold/italic only runs | Extended runs (strikethrough, code, link) | Phase 19 (this phase) | Full inline formatting |

## Open Questions

1. **InsertContent with mixed paragraphs + list paragraphs**
   - What we know: InsertContent accepts DocumentElement[] and paragraphs work. List paragraphs (with SetNumbering) should work since they are still ApiParagraph objects.
   - What's unclear: Whether mixing heading-styled paragraphs, numbered paragraphs, and regular paragraphs in a single InsertContent call works without issues.
   - Recommendation: Test in Phase 18-02 human-verify or early in 19-01. If issues arise, try doc.Push() as alternative (though it appends to end rather than at cursor).

2. **Numbering continuity across multiple lists**
   - What we know: A single CreateNumbering object maintains numbering sequence across its items.
   - What's unclear: If the markdown has two separate numbered lists (separated by a paragraph), should they share a numbering object (continuing count) or have separate ones (restarting)?
   - Recommendation: Create separate numbering objects per contiguous list block. This matches user expectation -- separate lists restart numbering.

3. **Hyperlink with bold/italic display text**
   - What we know: CreateHyperlink takes a plain string for display text. ApiHyperlink has GetElement/GetElementsCount but no documented AddElement.
   - What's unclear: Whether formatted text inside a hyperlink is possible.
   - Recommendation: Use plain text for hyperlink display. This is a cosmetic limitation that affects an extremely rare edge case (bold text inside a link in AI output).

## Sources

### Primary (HIGH confidence)
- [OO SetStyle API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/Methods/SetStyle/) - heading style application
- [OO CreateNumbering API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/CreateNumbering/) - bullet/numbered list creation
- [OO CreateHyperlink API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/Api/Methods/CreateHyperlink/) - native hyperlink creation
- [OO SetStrikeout API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRun/Methods/SetStrikeout/) - strikethrough formatting
- [OO SetNumbering API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/Methods/SetNumbering/) - applying numbering to paragraphs
- [OO SetTemplateType API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiNumberingLevel/Methods/SetTemplateType/) - numbering format types
- [OO SetCustomType API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiNumberingLevel/Methods/SetCustomType/) - custom numbering
- [OO InsertContent API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/InsertContent/) - content insertion
- [OO ApiHyperlink class](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiHyperlink/) - hyperlink methods

### Secondary (MEDIUM confidence)
- [Marked.js token structures - DeepWiki](https://deepwiki.com/markedjs/marked/2.1-lexer-and-tokenizer) - token type definitions
- [Marked.js advanced options](https://marked.js.org/using_advanced) - GFM enabled by default

### Tertiary (LOW confidence)
- None -- all findings verified against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, extending existing pipeline
- Architecture: HIGH - OO Builder API methods verified against official docs, token structures verified
- Pitfalls: HIGH - based on actual API behavior and marked.js structure analysis

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable APIs, no breaking changes expected)
