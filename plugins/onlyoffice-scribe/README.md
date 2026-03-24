# Scribe - OnlyOffice Plugin

Scribe is an AI writing assistant plugin for OnlyOffice, integrated into Cozy Drive. It detects text selection in the editor, sends structured intents to Cozy Drive via the cozy-bridge protocol, and receives responses to modify the document.

## Architecture

```
Cozy Stack (window.top)
  └─ Cozy Drive iframe          ← CozyBridge listener (useCozyBridge hook)
      └─ OO Editor iframe       ← DocsAPI.DocEditor
          └─ Plugin iframe      ← Scribe plugin (code.js)
              └─ postToAncestors() sends intents up the frame tree
```

**Communication flow:**
1. User selects text → plugin detects via `initOnSelectionChanged`
2. User triggers Scribe (toolbar button, Ctrl+I, or context menu) → plugin sends `AI_TEXT_EDIT` intent via `postMessage`
3. CozyBridge in Cozy Drive receives intent → opens ScribePopover
4. User clicks Replace/Insert/Cancel → response sent back to plugin
5. Plugin modifies document (see [Rich Text Reinjection Pipeline](#rich-text-reinjection-pipeline))

## Rich Text Reinjection Pipeline

When the user clicks **Replace** or **Insert** in the Scribe panel, the LLM response (markdown) is converted to HTML and pasted into the document with smart spacing.

```
Markdown (LLM response)
    │
    ▼
markdownToHtml()              ← View.jsx — marked.parse()
    │
    ▼
unwrapSingleParagraph()       ← View.jsx — strips <p> wrapper on single-paragraph
    │                            HTML to avoid extra line breaks on inline paste
    ▼
postMessage {text, html}      ← cozy-bridge response → plugin iframe
    │
    ▼
callCommand (read-only)       ← code.js — reads adjacent chars around selection
    │                            Insert mode: collapses cursor to end of selection
    ▼
" " + html + " "             ← smart spacing: adds spaces if adjacent chars
    │                            are non-whitespace (including \u00A0 nbsp)
    ▼
PasteHtml                    ← executeMethod — single undo point
                               Replace: replaces selection
                               Insert: inserts at cursor (after selection)
```

**Fallback:** If no HTML is available, plain text is used via `PasteText` (replace) or `InsertContent` with `Api.CreateParagraph()` (insert).

### Enriched Markdown Format Contract

The enriched markdown (`enrichedMd`) sent to the LLM follows a **self-contained segment** strategy. This is a contract that editors must conform to when producing markdown for Scribe.

**Problem:** Document editors (OO, etc.) support overlapping formatting spans (e.g. bold crossing an underline boundary). Markdown requires strict nesting. Adjacent `*` and `**` markers create ambiguous sequences like `***` that parsers resolve inconsistently.

**Solution:** Each text segment (= run with a constant set of formatting flags) is fully self-contained. All markers open and close within the segment. No marker ever crosses a segment boundary.

**Nesting order** (outermost → innermost):
```
<u> → [link](url) → ~~ → ** → * → `
```

**Whitespace rule:** Leading/trailing whitespace is placed outside emphasis markers (`**`, `*`, `~~`, `` ` ``) but inside `<u>` and `[link]`. This satisfies CommonMark's flanking rules (opening `**` must not be followed by whitespace).

**Example** — text with overlapping underline, bold, italic, and hyperlink:

| Segment | Text | Formats | Markdown |
|---------|------|---------|----------|
| 1 | `Texte ` | — | `Texte ` |
| 2 | `souli` | u | `<u>souli</u>` |
| 3 | `gné` | u, b | `<u>**gné**</u>` |
| 4 | ` avec du ` | u, b, link | `<u>[ **avec du**](url)</u>` |
| 5 | `gras` | u, b, i, link | `<u>[***gras***](url)</u>` |
| 6 | `, un lien ` | u, i, link | `<u>[*, un lien*](url)</u>` |
| 7 | `et du non` | i | `*et du non*` |
| 8 | ` souligné` | — | ` souligné` |

**Accepted trade-offs:**
- **Adjacent `</u><u>`** — two separate underline tokens, but OO renders them as contiguous underline
- **Adjacent same-URL links** — `[a](url)[b](url)` produces separate hyperlink tokens, merged back into single hyperlink runs during reinjection (`mergeAdjacentRuns`)
- **More verbose** — but unambiguous and preserves round-trip fidelity

**LLM preservation:** The system prompt instructs the LLM to preserve this structure (don't merge adjacent `<u>` tags, don't merge adjacent same-URL links, replicate marker structure when rewriting text).

**Current limitations:**
- Post-paste selection of inserted content is not implemented (OO returns inconsistent cursor positions after PasteHtml)
- Colored text is not preserved through the round-trip (bold, italic, strikethrough, code, links are preserved)
- Nested tables (table inside a table cell) are not supported
- Multiple tables in a single selection: supported but limited testing

### Key technical details

- `callCommand` runs in OO's document sandbox — all operations in one call = one undo point
- `executeMethod` (PasteHtml, etc.) runs in the plugin context — each call = separate undo point
- Data passes between plugin and `callCommand` via `Asc.scope` (JSON-serializable only)
- OO uses charCode 160 (nbsp `\u00A0`) not 32 for spaces — whitespace detection must include it
- Plugin code.js must use ES5 syntax (no const/let/arrow functions)

## Prerequisites

- **Docker** installed and running
- **Port 80** available (for OO Document Server)
- **Cozy stack** installed (`cozy-stack` CLI)
- **Node.js/Yarn** for building Cozy Drive

## Dev Environment Setup

### 1. Start OnlyOffice Document Server

```bash
./scripts/oo-dev-setup.sh
```

This creates a Docker container with:
- The Scribe plugin volume-mounted
- Browser JWT validation disabled (required — see [JWT Notes](#jwt-notes))
- Host entry for `alice.localhost` → Docker gateway
- Example service at http://localhost/example/

### 2. Configure Cozy Stack

Edit `~/.cozy/cozy.yml`:

```yaml
host: 0.0.0.0    # Required: Docker containers must reach the stack

office:
  default:
    onlyoffice_url: http://localhost
    onlyoffice_inbox_secret: 1Ji0VcWaWi7CPslwPtYLDf9yDDkNcF62
    onlyoffice_outbox_secret: 1Ji0VcWaWi7CPslwPtYLDf9yDDkNcF62
```

> The secret is hardcoded in `scripts/oo-dev-setup.sh`. The script re-applies it on every run.

### 3. Enable the Scribe feature flag

Scribe is gated behind a feature flag. Enable it for your dev instance:

```bash
cozy-stack features flags '{"drive.scribe.enabled": true}' --domain alice.localhost:8080
```

Or enable it for all instances on the stack:

```bash
cozy-stack features defaults '{"drive.scribe.enabled": true}'
```

### 4. Build and Start

```bash
yarn build
cozy-stack serve --appdir drive:./build/ --disable-csp
```

### 5. Test

1. Open http://alice.localhost:8080/
2. Open a `.docx` file
3. Select text in the document
4. Trigger Scribe via one of:
   - **Toolbar button**: click "Scribe" in the Plugins tab
   - **Keyboard shortcut**: Ctrl+I (or Cmd+I on Mac)
   - **Context menu**: right-click → "Scribe"
5. The Scribe popover should appear with action choices, then Replace / Insert After / Cancel buttons

> **Note:** A floating button positioned near the text selection was considered but abandoned — the OO API does not expose selection coordinates (the editor renders on canvas, not DOM).

## Dev Iteration

```bash
# Plugin changes (code.js, index.html):
# Delete .gz cache then hard-refresh:
rm -f plugins/onlyoffice-scribe/**/*.gz plugins/onlyoffice-scribe/*.gz
# Then Ctrl+Shift+R in the browser

# Plugin config changes (config.json):
# Re-run setup (restarts OO + re-applies JWT config):
./scripts/oo-dev-setup.sh

# React changes (useCozyBridge, ScribeModal, View.jsx):
yarn build  # then refresh browser

# Container rebuild (nuclear option):
docker rm -f oo-dev && ./scripts/oo-dev-setup.sh
```

> **Never use `docker restart oo-dev` directly.** OO regenerates its JWT config on restart, breaking Cozy Stack authentication. Always use `./scripts/oo-dev-setup.sh` — it re-applies the JWT secret automatically.

## Plugin Structure

```
plugins/onlyoffice-scribe/
  config.json          # Plugin manifest (v0.2.0, background type, selection events)
  index.html           # Minimal shell (loads plugin SDK and code.js)
  scripts/
    code.js            # Intent casting, response handling, document modification
  resources/
    light/icon.png     # Plugin icon for light theme
    dark/icon.png      # Plugin icon for dark theme
```

## cozy-bridge Protocol

The protocol is defined in `src/lib/cozy-bridge/`:

- **`types.js`** — JSDoc typedefs for `IntentMessage` and `ResponseMessage`
- **`protocol.js`** — Constants, factory functions, validators (1MB size limit)
- **`index.js`** — `CozyBridge` class with origin validation and intent routing

### Message Format

**Intent (plugin → Cozy Drive):**
```json
{
  "type": "cozy-bridge:intent",
  "version": 1,
  "intentId": "<uuid>",
  "action": "AI_TEXT_EDIT",
  "source": "onlyoffice-plugin",
  "data": { "text": "selected text", "html": "<b>selected</b> text", "format": "html" }
}
```

**Response (Cozy Drive → plugin):**
```json
{
  "type": "cozy-bridge:response",
  "version": 1,
  "intentId": "<uuid>",
  "status": "ok",
  "action": "replace|insert|cancel",
  "data": { "text": "markdown text", "html": "<p><strong>rich</strong> text</p>" }
}
```

## JWT Notes

OO 9.x introduced client-side JWT validation: the OO JS API checks that the JWT payload matches the config passed to `DocsAPI.DocEditor()`. Cozy Drive modifies the editor config after the Cozy stack generates the token (customization override, user name), causing a payload mismatch.

The setup script disables **browser-side** JWT validation only. Server-to-server JWT (inbox/outbox) remains enabled — the Cozy stack and OO container must share the same secret (configured in `~/.cozy/cozy.yml` and auto-generated in OO's `local.json`).

## Known Constraints

### postMessage and Iframe Nesting

The plugin is 2 iframes deep (OO editor + plugin). `window.top.postMessage()` reaches the Cozy Stack window, not Cozy Drive. The plugin uses `postToAncestors()` to post to all ancestor frames.

### callCommand Isolation

`callCommand` runs in OO's internal JS sandbox, not the plugin's iframe. Only JSON-serializable data passes through `Asc.scope`. No async operations inside `callCommand`.

### ES5 Syntax Requirement

All plugin code (`code.js`) must use ES5 syntax (`var`, `function`, no arrow functions). The only ES6 feature used is `Promise` (a runtime API, not syntax), guarded by `typeof Promise !== "undefined"`.

## Production Deployment

### 1. Build and deploy the plugin

```bash
yarn build:scribe-plugin
scp -r build-scribe-OO-plugin/ user@oo-server:/var/www/onlyoffice/documentserver/sdkjs-plugins/scribe/
```

Then restart the docservice on the OO server so it picks up the new plugin:

```bash
supervisorctl restart ds:docservice
```

### 2. Enable the feature flag on cozy-stack

The plugin is installed but invisible until the flag is enabled:

```bash
# For all instances
cozy-stack features defaults '{"drive.scribe.enabled": true}'

# Or for a specific instance
cozy-stack features flags '{"drive.scribe.enabled": true}' --domain myinstance.example.com
```

### 3. Verify the AI backend

The cozy-stack must have a RAG/AI backend configured in `cozy.yml`:

```yaml
rag:
  default:
    url: https://your-rag-server.example.com
    api_key: your_api_key
```

Without this, Scribe API calls (`POST /ai/v1/chat/completions`) will fail.

## Common Commands

```bash
./scripts/oo-dev-setup.sh              # Start or restart OO (always use this)
docker logs oo-dev                     # View OO server logs
docker rm -f oo-dev                    # Remove container
docker exec -it oo-dev bash            # Shell into container
docker exec oo-dev supervisorctl restart ds:docservice  # Restart docservice only
```

> Do NOT use `docker restart oo-dev` — see [Dev Iteration](#dev-iteration).
