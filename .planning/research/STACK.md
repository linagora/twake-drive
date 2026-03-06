# Technology Stack: v2.1 Rich Text Formatting

**Project:** Scribe pour OnlyOffice -- Rich text extraction, Markdown conversion, and formatted reinsertion
**Researched:** 2026-03-06
**Scope:** NEW stack additions only for the rich text formatting pipeline. Existing v2.0 stack (React 18, MUI, cozy-ui, OO plugin ES5, postMessage protocol, cozy-stack AI proxy) is validated and not re-researched.

## Recommended Stack Additions

### OO Document Builder API (no new dependencies -- already available in plugin context)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `Api.GetDocument().GetRangeBySelect()` | OO 9.3.0 | Get current selection as an ApiRange object | Returns an ApiRange representing the user's selection. This is the entry point for rich text extraction. Available via `callCommand`. Confirmed in OO API docs. HIGH confidence. |
| `ApiRange.GetAllParagraphs()` | OO 9.3.0 | Get all paragraphs in the selection | Returns `ApiParagraph[]` from a range. Each paragraph can be iterated for its child elements (runs). HIGH confidence. |
| `ApiParagraph.GetElement(i)` / `GetElementsCount()` | OO 9.3.0 | Iterate text runs within a paragraph | Each element is an ApiRun. `GetElementsCount()` returns the count, `GetElement(i)` returns run at index i. HIGH confidence. |
| `ApiRun.GetText()` + formatting getters | OO 9.3.0 | Read text content and formatting of each run | `GetText()`, `GetBold()`, `GetItalic()`, `GetUnderline()`, `GetStrikeout()`, `GetFontFamily()`, `GetFontSize()`. All confirmed in API docs. HIGH confidence. |
| `ApiParagraph.GetStyle()` | OO 9.3.0 | Detect heading level, list type | Returns the paragraph style name (e.g., "Heading 1", "List Paragraph"). Used to identify structural elements. HIGH confidence. |
| `ApiParagraph.GetNumbering()` | OO 9.3.0 | Detect numbered/bulleted list membership | Returns numbering definition for the paragraph. Combined with GetStyle to distinguish bullet from numbered lists. HIGH confidence. |
| `ApiParagraph.GetParentTable()` / `GetParentTableCell()` | OO 9.3.0 | Detect if paragraph is inside a table cell | Returns the parent table/cell or null. Essential for table extraction. HIGH confidence. |
| `Api.CreateParagraph()` + `Api.CreateRun()` | OO 9.3.0 | Reconstruct formatted content for reinsertion | Create paragraphs with individually formatted runs. `oRun.SetBold(true)`, `oRun.SetItalic(true)` etc. Already used in `insertAfterWithText`. HIGH confidence. |
| `Api.CreateTable(cols, rows)` | OO 9.3.0 | Insert tables from Markdown table syntax | Creates a table element that can be populated cell-by-cell and inserted via `InsertContent`. HIGH confidence. |
| `ApiDocument.CreateNumbering("bullet"/"numbered")` | OO 9.3.0 | Create numbered/bulleted lists for reinsertion | Returns a numbering definition that can be applied to paragraphs via `SetNumbering`. HIGH confidence. |

**Key constraint:** All OO API code runs inside `callCommand` which executes in the OO editor context (NOT the plugin iframe). Data must be serialized via `Asc.scope` (simple objects/arrays only, no functions or DOM refs). Code inside `callCommand` must be ES5.

### Frontend: Markdown Rendering (React side)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-markdown` | ^10.1.0 | Render Markdown in ScribeResultPanel | The standard React component for safe Markdown rendering. Builds a virtual DOM (no `dangerouslySetInnerHTML`). Supports custom components for MUI styling integration. 100% CommonMark compliant. Peer dep: React >= 18 (we have 18.2.0). HIGH confidence. |
| `remark-gfm` | ^4.0.1 | GFM extensions: tables, strikethrough, task lists | Required plugin for `react-markdown` to render tables (which the LLM frequently returns as Markdown tables), strikethrough (`~~text~~`), and task lists. Without it, table syntax renders as plain text. HIGH confidence. |

**Why `react-markdown` and NOT an editable Markdown editor:**
The result panel is read-only preview. The user views the AI output and clicks Insert/Replace. There is no need for the user to edit Markdown. An editable Markdown editor (MDXEditor, @uiw/react-md-editor) would add 100-400KB of bundle weight for functionality we do not need. `react-markdown` is ~12KB gzipped and renders beautifully.

### Frontend: No Markdown Conversion Library Needed

**Why no `turndown`, `unified`, or `remark-stringify`:**

The conversion pipeline does NOT involve HTML at any point:

```
OO Document Model → custom serializer (ES5, in callCommand) → Markdown string
                                                                    ↓
                                                              sent to LLM
                                                                    ↓
                                                          Markdown string back
                                                                    ↓
Markdown string → custom deserializer (ES5, in callCommand) → OO Document Model
```

- **Extraction (OO -> Markdown):** We traverse the OO document model (ApiParagraph/ApiRun) and build a Markdown string manually. This is ~80 lines of ES5 code. The OO API gives us structured data (bold, italic, heading style), not HTML. There is no HTML to convert.
- **Reinsertion (Markdown -> OO):** We parse the LLM's Markdown output and create OO API objects (CreateParagraph, CreateRun, SetBold, etc.). This is a simple line-by-line Markdown parser (~120 lines of ES5). We do NOT need a full AST parser because our Markdown subset is bounded (bold, italic, headings, lists, links, tables).
- **LLM display:** `react-markdown` handles rendering the Markdown string in the result panel. No intermediate conversion needed.

Adding `turndown` (HTML->MD) or `unified/remark` (MD AST) would be over-engineering. We never have HTML. Our Markdown subset is small and predictable.

## Integration Points with Existing Architecture

### Modified postMessage Protocol

Currently, the plugin sends plain text via the intent:
```javascript
// Current (v2.0)
castIntent("AI_TEXT_EDIT", { text: lastSelectedText });
```

For v2.1, the plugin extracts rich text as Markdown and sends it:
```javascript
// New (v2.1)
castIntent("AI_TEXT_EDIT", { text: lastSelectedText, markdown: markdownText });
```

The `markdown` field contains the Markdown-formatted version of the selection. The `text` field remains as fallback for actions that do not need formatting (e.g., translation). The intent protocol (postMessage) is unchanged -- we just add a field to the data payload.

### Modified callCommand for Extraction

Currently, `GetSelectedText` returns plain text. For v2.1, we add a new extraction function using `callCommand`:

```javascript
// In code.js (ES5) -- extract formatted text as Markdown
function extractFormattedSelection(callback) {
  window.Asc.plugin.callCommand(function() {
    var oDocument = Api.GetDocument();
    var oRange = oDocument.GetRangeBySelect();
    if (!oRange) return "";

    var paragraphs = oRange.GetAllParagraphs();
    var lines = [];

    for (var p = 0; p < paragraphs.length; p++) {
      var para = paragraphs[p];
      var style = para.GetStyle() ? para.GetStyle().GetName() : "";
      var elemCount = para.GetElementsCount();
      var lineText = "";

      // Build inline-formatted text from runs
      for (var r = 0; r < elemCount; r++) {
        var run = para.GetElement(r);
        var text = run.GetText();
        if (!text) continue;

        var isBold = run.GetBold();
        var isItalic = run.GetItalic();
        var isStrike = run.GetStrikeout();

        if (isBold && isItalic) text = "***" + text + "***";
        else if (isBold) text = "**" + text + "**";
        else if (isItalic) text = "*" + text + "*";
        if (isStrike) text = "~~" + text + "~~";

        lineText += text;
      }

      // Apply paragraph-level formatting
      if (style.indexOf("Heading 1") !== -1) lineText = "# " + lineText;
      else if (style.indexOf("Heading 2") !== -1) lineText = "## " + lineText;
      else if (style.indexOf("Heading 3") !== -1) lineText = "### " + lineText;

      lines.push(lineText);
    }

    return lines.join("\n");
  }, false, false, function(markdown) {
    callback(markdown);
  });
}
```

### Modified callCommand for Reinsertion

Currently, `handleIntentResponse` uses `PasteText` (plain text) or `InsertContent` with plain paragraphs. For v2.1, we parse Markdown and create formatted OO elements:

```javascript
// In code.js (ES5) -- insert Markdown as formatted OO content
function insertMarkdownContent(markdown) {
  Asc.scope.markdownText = markdown;
  window.Asc.plugin.callCommand(function() {
    var md = Asc.scope.markdownText;
    var oDocument = Api.GetDocument();
    var content = [];
    var lines = md.split("\n");

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var para = Api.CreateParagraph();

      // Heading detection
      var headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        para.SetStyle(oDocument.GetStyle("Heading " + headingMatch[1].length));
        addFormattedRuns(para, headingMatch[2]);
      }
      // Bullet list
      else if (line.match(/^[-*+]\s+/)) {
        addFormattedRuns(para, line.replace(/^[-*+]\s+/, ""));
        // Apply bullet numbering
        var numbering = oDocument.CreateNumbering("bullet");
        para.SetNumbering(numbering.GetLevel(0));
      }
      // Normal paragraph
      else {
        addFormattedRuns(para, line);
      }

      content.push(para);
    }

    oDocument.InsertContent(content);
  }, false, false);
}

// Parse inline Markdown formatting into OO runs (simplified)
function addFormattedRuns(para, text) {
  // Regex-based inline parsing for **bold**, *italic*, ~~strike~~
  // Creates ApiRun objects with appropriate SetBold/SetItalic/SetStrikeout
}
```

### ScribeResultPanel Changes

```jsx
// Before (v2.0): plain text display
<div className={styles['scribe-result-text']}>
  {error || resultText}
</div>

// After (v2.1): Markdown rendering
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

<div className={styles['scribe-result-text']}>
  {error || <Markdown remarkPlugins={[remarkGfm]}>{resultText}</Markdown>}
</div>
```

### System Prompt Changes

The system prompt must instruct the LLM to preserve and return Markdown formatting:

```javascript
// Updated SYSTEM_PROMPT in scribeAI.js
export const SYSTEM_PROMPT =
  'You are a writing assistant. Return only the transformed text using Markdown formatting. ' +
  'Preserve the original formatting structure (headings, bold, italic, lists, tables). ' +
  'Respond in the same language as the input text.'
```

## What NOT to Add

| Avoid | Why | What to Do Instead |
|-------|-----|---------------------|
| `turndown` (HTML->Markdown) | We never have HTML. OO API gives structured document model, not HTML. | Custom ES5 serializer that reads ApiRun formatting directly. |
| `unified` / `remark-parse` / `remark-stringify` | Full Markdown AST parsing is over-engineered for our bounded subset. We only handle: bold, italic, strikethrough, headings 1-6, bullet lists, numbered lists, tables, links. | Simple line-by-line ES5 parser (~120 lines). Regex for inline formatting. |
| MDXEditor / @uiw/react-md-editor | Editable Markdown editors. The result panel is read-only. 100-400KB bundle for unused functionality. | `react-markdown` (12KB gzipped) for read-only rendering. |
| `marked` / `markdown-it` | Full Markdown-to-HTML parsers. We need Markdown-to-OO-API-objects, not HTML. | Custom ES5 parser in `callCommand` context. |
| Clipboard API (`navigator.clipboard`) for rich text | Unreliable across iframe boundaries (Cozy Stack > Drive > OO > Plugin). Permission issues. | Direct OO Document Builder API via `callCommand`. |
| OO `PasteHtml` executeMethod | Exists but produces unreliable formatting. We control exact output via CreateRun/SetBold. | `InsertContent` with explicit ApiParagraph/ApiRun construction. |
| OOXML manipulation | Directly editing the document XML is fragile, undocumented for plugins, and breaks collaboration. | Use the public Document Builder API (ApiParagraph, ApiRun, etc.). |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Rich text extraction | `callCommand` + `GetRangeBySelect` + ApiParagraph/ApiRun traversal | `GetSelectedText` with custom separators | `GetSelectedText` returns plain text only. No formatting info. |
| Markdown rendering | `react-markdown` + `remark-gfm` | `dangerouslySetInnerHTML` with `marked` | XSS risk. `react-markdown` builds vDOM safely. |
| Markdown rendering | `react-markdown` + `remark-gfm` | Custom rendering with regex | Fragile. `react-markdown` is battle-tested for edge cases (nested formatting, code blocks, etc.). |
| Markdown-to-OO conversion | Custom ES5 parser in `callCommand` | External library loaded in plugin iframe | `callCommand` runs in OO editor context. Cannot import npm modules. Must be self-contained ES5. |
| Intermediate format | Markdown (text-based) | HTML or JSON AST | Markdown is what LLMs natively produce and understand. No conversion overhead. Human-readable in transit. |
| Table extraction | `GetParentTable` + cell-by-cell iteration | Skip tables entirely | Tables are common in documents. Users will expect formatting preservation. |
| List extraction | `GetNumbering` + `GetStyle` detection | Skip lists entirely | Lists are extremely common. Must-have for formatting preservation. |

## Installation

### cozy-drive (React frontend)

```bash
cd ~/Dev-local/cozy-drive

# Markdown rendering in result panel
npm install react-markdown@^10.1.0 remark-gfm@^4.0.1
```

### OO Plugin (no installation)

All rich text extraction/reinsertion code uses the OO Document Builder API available natively inside `callCommand`. No npm packages, no bundling. Pure ES5 code added to `plugins/onlyoffice-scribe/scripts/code.js`.

## Files to Create/Modify

### Plugin (ES5, in OO context)

- `plugins/onlyoffice-scribe/scripts/code.js` -- Add `extractFormattedSelection()` and `insertMarkdownContent()` functions. Modify `handleIntentResponse` to use Markdown-aware insertion. Modify selection handlers to extract formatted text.

### Frontend (React, in Cozy Drive context)

- `src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx` -- Replace plain text display with `<Markdown>` component. Style Markdown elements to match MUI theme.
- `src/modules/views/OnlyOffice/Scribe/scribeAI.js` -- Update SYSTEM_PROMPT to instruct LLM to preserve/return Markdown. Update `buildMessages` to include Markdown-formatted input.
- `src/modules/views/OnlyOffice/Scribe/scribe.styl` -- Add styles for rendered Markdown elements (headings, lists, tables, code blocks) within the result panel.

### Protocol

- `src/lib/cozy-bridge.js` -- No changes needed. The `markdown` field is just additional data in the existing intent payload.
- `src/modules/views/OnlyOffice/useCozyBridge.js` -- No changes needed. Already passes through `intentMessage.data`.

## Supported Markdown Subset

The custom ES5 serializer/parser handles this bounded set:

| Format | Markdown Syntax | OO API Read | OO API Write |
|--------|----------------|-------------|--------------|
| Bold | `**text**` | `ApiRun.GetBold()` | `ApiRun.SetBold(true)` |
| Italic | `*text*` | `ApiRun.GetItalic()` | `ApiRun.SetItalic(true)` |
| Bold+Italic | `***text***` | `GetBold() && GetItalic()` | `SetBold(true) + SetItalic(true)` |
| Strikethrough | `~~text~~` | `ApiRun.GetStrikeout()` | `ApiRun.SetStrikeout(true)` |
| Heading 1-6 | `# text` | `ApiParagraph.GetStyle().GetName()` | `ApiParagraph.SetStyle("Heading N")` |
| Bullet list | `- text` | `ApiParagraph.GetNumbering()` type=bullet | `CreateNumbering("bullet")` + `SetNumbering` |
| Numbered list | `1. text` | `ApiParagraph.GetNumbering()` type=numbered | `CreateNumbering("numbered")` + `SetNumbering` |
| Link | `[text](url)` | `ApiHyperlink.GetText()` + `.GetLink()` | `ApiParagraph.AddHyperlink(url, text)` |
| Table | `\| a \| b \|` | `GetParentTable()` + cell iteration | `Api.CreateTable(cols, rows)` + populate |

**Explicitly out of scope (v2.1):** Images, code blocks, blockquotes, horizontal rules, footnotes. These can be added incrementally in later versions.

## Version Compatibility

| Component | Required | Current | Notes |
|-----------|----------|---------|-------|
| OnlyOffice | >= 8.2.1 | 9.3.0-138 | All Document Builder APIs used are available. Confirmed. |
| React | >= 18 | 18.2.0 | Peer dep for react-markdown 10.x. Met. |
| react-markdown | ^10.1.0 | (new) | Latest stable. ~12KB gzipped. |
| remark-gfm | ^4.0.1 | (new) | Compatible with react-markdown 10.x. |

## Sources

- [OO GetSelectedText API](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/GetSelectedText/) -- Returns plain text only, confirms we need callCommand for rich text (HIGH confidence)
- [OO ApiParagraph class](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiParagraph/) -- GetElement, GetElementsCount, GetText, GetStyle, GetNumbering, GetParentTable (HIGH confidence)
- [OO ApiRun class](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRun/) -- GetText, GetBold, GetItalic, GetUnderline, GetStrikeout, GetFontFamily, GetFontSize (HIGH confidence)
- [OO ApiDocument class](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/) -- GetRangeBySelect, InsertContent, CreateNumbering, GetElement, GetElementsCount (HIGH confidence)
- [OO ApiRange.GetAllParagraphs](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiRange/Methods/GetAllParagraphs/) -- Returns ApiParagraph[] from a range (HIGH confidence)
- [OO callCommand documentation](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/) -- How to execute code in editor context, data passing via Asc.scope (HIGH confidence)
- [OO CreateTable API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/Api/Methods/CreateTable/) -- Table creation for Markdown table reinsertion (HIGH confidence)
- [OO CreateNumbering API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/CreateNumbering/) -- Bullet and numbered list creation (HIGH confidence)
- [OO InsertContent API](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/InsertContent/) -- Insert formatted paragraphs and tables at current position (HIGH confidence)
- [react-markdown on GitHub](https://github.com/remarkjs/react-markdown) -- v10.1.0, React component for safe Markdown rendering, custom components support (HIGH confidence)
- [remark-gfm on GitHub](https://github.com/remarkjs/remark-gfm) -- v4.0.1, GFM extension for tables, strikethrough, task lists (HIGH confidence)
- [OO community: GetSelectedText HTML format request](https://community.onlyoffice.com/t/getselectedtext-html-format-paste-via-context-menu/8733) -- Confirms GetSelectedText does not support rich text output (MEDIUM confidence)
- [OO API updates December 2025](https://www.onlyoffice.com/blog/2025/12/api-updates-december-2025) -- Confirms expanded ApiRun getter methods (MEDIUM confidence)

---
*Stack research for: v2.1 Rich Text Formatting -- OO extraction, Markdown conversion, formatted reinsertion*
*Researched: 2026-03-06*
