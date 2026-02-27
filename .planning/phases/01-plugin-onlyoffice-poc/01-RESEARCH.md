# Phase 1: Plugin OnlyOffice POC - Research

**Researched:** 2026-02-27
**Domain:** OnlyOffice plugin development, Docker plugin deployment, document selection/manipulation API
**Confidence:** MEDIUM-HIGH (plugin API verified against official docs + AI plugin reference implementation; Docker mounting verified against official docs + community; some methods lack recent docs due to URL migration)

## Summary

OnlyOffice plugins are vanilla JavaScript packages consisting of three required files (`config.json`, `index.html`, `scripts/code.js`) that run inside the editor's iframe. The plugin API provides `executeMethod` for reading/writing document content (e.g., `GetSelectedText`, `PasteText`, `InputText`) and `callCommand` for executing Document Builder API operations in an isolated sandbox. Plugins are installed by placing their folder in `/var/www/onlyoffice/documentserver/sdkjs-plugins/` inside the Docker container.

For Phase 1 POC, the fastest development iteration path is a **two-pronged approach**: (1) volume-mount the plugin folder into the Docker container for persistent availability, and (2) use `installDeveloperPlugin` from the browser console for quick testing during active development. The plugin should use `type: "background"` with `initOnSelectionChanged: true` (safe on OO >= 8.2.1) and `events: ["onContextMenuShow", "onContextMenuClick"]` for context menu integration.

**Primary recommendation:** Build a minimal background plugin that demonstrates selection detection via `initOnSelectionChanged`, text reading via `GetSelectedText`, text replacement via `PasteText`, and text insertion via `callCommand` with `InsertContent`. Use volume mounting into the Docker container for the dev loop. Determine the OO version first using `dpkg -l` inside the container.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENV-01 | Plugin install in OO Docker documented & reproducible | Three installation methods documented: folder placement in `sdkjs-plugins/`, `pluginsmanager.sh`, and `pluginsData` in editor config. Exact paths and commands provided. |
| ENV-02 | Plugin source volume-mounted into Docker (no rebuild) | Docker `-v` flag mounting host dir to `/var/www/onlyoffice/documentserver/sdkjs-plugins/{plugin-name}` inside container. Must also update `plugin-list-default.json`. |
| ENV-03 | Fast iteration cycle (hot-reload or reload script) | No native hot-reload exists. Best approach: volume mount + browser hard refresh (Ctrl+Shift+R). Alternative: `installDeveloperPlugin` from console with http-server. |
| PLUG-01 | Plugin loads and executes code in OO editor | Plugin structure documented: `config.json` + `index.html` + `scripts/code.js`. Verified against official getting-started guide and AI plugin reference. |
| PLUG-02 | Plugin detects text selection | `initOnSelectionChanged: true` in config.json triggers `plugin.init(data)` on every selection change. `initDataType: "text"` passes selected text as the `data` parameter. Safe on OO >= 8.2.1. |
| PLUG-03 | Plugin reads selected text | `executeMethod("GetSelectedText", [{Numbering: false, Math: false, ParaSeparator: "\n", TabSymbol: "\t"}], callback)` returns selected text string. |
| PLUG-04 | Plugin replaces selected text | `executeMethod("PasteText", ["replacement text"])` replaces current selection with new text. Alternative: `ReplaceTextSmart` for formatting-preserving replacement. |
| PLUG-05 | Plugin inserts text after selection with line break | `callCommand` with Document Builder API: move cursor to end of selection, create new paragraph, insert text via `InsertContent`. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| OnlyOffice Plugin SDK v1 | v1 (stable across OO 7.x-9.x) | Plugin runtime in editor iframe | Only supported SDK version. CDN: `https://onlyoffice.github.io/sdkjs-plugins/v1/plugins.js` |
| OnlyOffice executeMethod API | Aligns with Document Server version | Read data from documents, perform editor operations | Standard plugin-to-editor communication for GetSelectedText, PasteText, InputText, PasteHtml, AddContextMenuItem |
| OnlyOffice callCommand API | Aligns with Document Server version | Execute Document Builder API in isolated sandbox | Only way to create/insert structured content (paragraphs, formatted text) |
| Vanilla JavaScript (no framework) | ES2015+ | Plugin logic | OO plugins run in a constrained iframe. No bundler, no React, no TypeScript. Plain JS only. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| http-server (npm) | latest | Serve plugin files locally for `installDeveloperPlugin` | During active development iteration |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Volume mount + hard refresh | `installDeveloperPlugin` only | Faster iteration but plugin does not persist across container restarts |
| `PasteText` for replacement | `ReplaceTextSmart` | Preserves paragraph formatting but has known bug with Track Changes; use PasteText for POC |
| `initOnSelectionChanged` | Context menu only (`onContextMenuShow`) | Context menu is simpler but loses real-time selection detection; use both |

**Installation:**
```bash
# No npm packages for the plugin itself (vanilla JS)
# For local dev server:
npm install -g http-server
```

## Architecture Patterns

### Recommended Plugin Structure
```
scribe-plugin/
  config.json          # Plugin manifest
  index.html           # Entry point (loads SDK + code.js)
  scripts/
    code.js            # All plugin logic
  resources/
    light/
      icon.png         # Plugin icon (light theme)
      icon@2x.png      # Plugin icon 2x (light theme)
    dark/
      icon.png         # Plugin icon (dark theme)
      icon@2x.png      # Plugin icon 2x (dark theme)
```

### Pattern 1: Background Plugin with Selection Events
**What:** A `type: "background"` plugin that silently monitors selection changes and provides context menu items. No visible UI inside OO -- all UI lives in Cozy Drive.
**When to use:** When the plugin is a bridge between the editor and an external UI.
**Example:**
```json
// config.json
{
  "name": "Scribe",
  "guid": "asc.{C36B0B33-0C65-4E88-9EE0-C1D6A40434EC}",
  "baseUrl": "",
  "version": "0.1.0",
  "minVersion": "8.2.0",
  "variations": [
    {
      "description": "Scribe AI writing assistant",
      "url": "index.html",
      "icons": "resources/%theme-type%(light|dark)/icon%scale%(default).%extension%(png)",
      "isViewer": false,
      "EditorsSupport": ["word"],
      "type": "background",
      "initDataType": "text",
      "initOnSelectionChanged": true,
      "buttons": [],
      "events": ["onContextMenuShow", "onContextMenuClick"]
    }
  ]
}
```
Source: [OnlyOffice Plugin Configuration](https://api.onlyoffice.com/docs/plugin-and-macros/structure/configuration/) + [AI Plugin config.json](https://github.com/ONLYOFFICE/onlyoffice.github.io/blob/master/sdkjs-plugins/content/ai/config.json)

### Pattern 2: Selection Detection via init()
**What:** When `initOnSelectionChanged: true` and `initDataType: "text"`, the `plugin.init(data)` function is called on every selection change with the selected text as the `data` parameter.
**When to use:** For real-time selection monitoring.
**Example:**
```javascript
// scripts/code.js
(function(window, undefined) {

  window.Asc.plugin.init = function(data) {
    // `data` contains the selected text (string) when initDataType is "text"
    // Empty string when no selection
    if (data && data.length > 0) {
      console.log("[Scribe] Selection detected:", data.substring(0, 50));
      // Store selection for later use
      window._scribeSelectedText = data;
    } else {
      console.log("[Scribe] Selection cleared");
      window._scribeSelectedText = "";
    }
  };

  window.Asc.plugin.button = function(id) {
    this.executeCommand("close", "");
  };

})(window, undefined);
```
Source: [OnlyOffice Plugin Getting Started](https://api.onlyoffice.com/docs/plugin-and-macros/structure/getting-started/)

### Pattern 3: Context Menu Integration
**What:** Add a "Scribe" item to the right-click context menu that appears only when text is selected.
**When to use:** For triggering Scribe on user demand.
**Example:**
```javascript
// Detect context menu and add Scribe item when text is selected
window.Asc.plugin.event_onContextMenuShow = function(options) {
  if (options.type === "Selection") {
    this.executeMethod("AddContextMenuItem", [{
      guid: this.guid,
      items: [{
        id: "onClickScribe",
        text: {
          en: "Scribe - AI Assistant",
          fr: "Scribe - Assistant IA"
        }
      }]
    }]);
  }
};

// Handle Scribe context menu click
window.Asc.plugin.attachContextMenuClickEvent("onClickScribe", function() {
  // Read selected text explicitly
  window.Asc.plugin.executeMethod("GetSelectedText", [{
    Numbering: false,
    Math: false,
    TableCellSeparator: "\n",
    ParaSeparator: "\n",
    TabSymbol: String.fromCharCode(9)
  }], function(selectedText) {
    console.log("[Scribe] Text for AI:", selectedText);
    // For POC: send to host via postMessage
    window.top.postMessage({
      type: "scribe:selection-ready",
      source: "scribe-plugin",
      payload: { text: selectedText }
    }, "*"); // TODO: restrict origin in production
  });
});
```
Source: [OnlyOffice Context Menu and Events Sample](https://api.onlyoffice.com/docs/plugin-and-macros/samples/plugin-samples/context-menu-and-events/)

### Pattern 4: Text Replacement via PasteText
**What:** Replace the current selection with new text using `PasteText`.
**When to use:** For the "Replace" action after AI processing.
**Example:**
```javascript
function replaceSelection(newText) {
  window.Asc.plugin.executeMethod("PasteText", [newText]);
}
```
Source: [OnlyOffice PasteText Documentation](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/PasteText/)

### Pattern 5: Text Insertion via callCommand + InsertContent
**What:** Insert new text after the current selection using Document Builder API.
**When to use:** For the "Insert after" action -- append AI text below the selection without replacing it.
**Example:**
```javascript
function insertAfterSelection(textToInsert) {
  Asc.scope.textToInsert = textToInsert;
  window.Asc.plugin.callCommand(function() {
    var oDocument = Api.GetDocument();
    var oParagraph = Api.CreateParagraph();
    oParagraph.AddText(Asc.scope.textToInsert);
    oDocument.InsertContent([oParagraph]);
  }, false, false, function(result) {
    console.log("[Scribe] InsertContent result:", result);
  });
}
```
Source: [OnlyOffice How to Call Commands](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/)

### Anti-Patterns to Avoid
- **Building UI inside the plugin:** Keep plugin as background bridge. All UI lives in Cozy Drive.
- **Using `window.parent.postMessage()` from plugin:** From inside a plugin iframe, `window.parent` is the OO editor iframe, NOT Cozy Drive. Use `window.top.postMessage()` to reach the host app.
- **Passing functions through `Asc.scope`:** Only JSON-serializable data survives. No functions, no prototypes, no circular references.
- **Async operations inside `callCommand`:** No fetch, no setTimeout, no Promises inside `callCommand`. Do all async work before calling it.
- **Using deprecated config fields:** Do NOT use `isVisual`, `isModal`, `isInsideMode`, `isSystem`. Use `type: "background"` instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plugin SDK bootstrapping | Custom script loader | `plugins.js` from OnlyOffice CDN | SDK handles all internal wiring between plugin and editor |
| Text replacement in document | Manual DOM manipulation | `executeMethod("PasteText", [...])` | PasteText handles selection context, undo stack, collaboration |
| Search and replace | Custom text scanner | `executeMethod("SearchAndReplace", [{searchString, replaceString, matchCase}])` | Handles all document types, formatting, edge cases |
| Context menu items | Custom right-click handler | `executeMethod("AddContextMenuItem", [...])` | Integrates with OO's native context menu system |
| Plugin GUID generation | Sequential ID or timestamp | UUID v4 in `asc.{UUID}` format | Must be globally unique, stable across deployments |

**Key insight:** The OnlyOffice plugin API is comprehensive but specific. Every document operation MUST go through `executeMethod` or `callCommand`. There is no way to directly access the document DOM or canvas from plugin code.

## Common Pitfalls

### Pitfall 1: initOnSelectionChanged Infinite Loop (OO < 8.2.1)
**What goes wrong:** On OO versions before 8.2.1, combining `initOnSelectionChanged: true` with `executeMethod` and `callCommand` inside `init()` causes an infinite execution loop.
**Why it happens:** The executeMethod/callCommand calls trigger internal selection change events, which re-trigger `init()`, creating a cycle.
**How to avoid:** Ensure OO Document Server version >= 8.2.1 (bug was fixed in that release). If running older version, use context menu approach only (no `initOnSelectionChanged`). Feature detection: test in isolation before building on top.
**Warning signs:** Plugin `init()` fires continuously in console. Editor becomes unresponsive. CPU spikes.
Source: [OnlyOffice Community: initOnSelectionChanged loop](https://community.onlyoffice.com/t/when-the-plugin-enables-the-initonselectionchanged-configuration-executing-both-executemethod-and-callcommand-causes-an-infinite-loop-of-execution/11536)

### Pitfall 2: callCommand Execution Context Isolation
**What goes wrong:** Variables from plugin scope are `undefined` inside `callCommand`. Functions passed via `Asc.scope` become `undefined`. Async operations freeze the editor.
**Why it happens:** `callCommand` runs in a completely separate JavaScript sandbox (the editor's internal engine), NOT the plugin's iframe context. Only JSON-serializable data passes through `Asc.scope`.
**How to avoid:** Treat `callCommand` as a pure synchronous function. Put ALL data into `Asc.scope` before the call. Only pass primitives and plain objects. Do ALL async work (API calls, text processing) in plugin context BEFORE calling `callCommand`.
**Warning signs:** `callCommand` callback receives `undefined`. Editor freezes. "Works in console but not in plugin."
Source: [OnlyOffice How to Call Commands](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/)

### Pitfall 3: Selection Lost When External Element Receives Focus
**What goes wrong:** When focus moves away from the OO editor (e.g., user clicks in an external panel), the internal selection is cleared. When sending replacement text back, the plugin cannot determine where to insert.
**Why it happens:** OO uses a canvas-based editor with its own selection model tied to focus state. iframe focus change = selection gone.
**How to avoid:** Capture selected text AND store it BEFORE any focus change occurs. For POC: use `initOnSelectionChanged` to continuously cache the latest selection text. For replacement: `PasteText` replaces AT THE CURSOR POSITION, so if the user clicks back into the editor, the cursor may have moved. Mitigation: use `SearchAndReplace` with the stored original text as `searchString` and AI text as `replaceString`.
**Warning signs:** Text replaces at wrong position. "Replace" works only when testing without clicking elsewhere first.

### Pitfall 4: Docker Volume Mount Obscures Default Plugins
**What goes wrong:** Mounting a host directory to `/var/www/onlyoffice/documentserver/sdkjs-plugins/` hides ALL default plugins that ship with the container image.
**Why it happens:** Docker bind mounts replace the container directory contents entirely.
**How to avoid:** Mount ONLY the specific plugin subfolder, not the entire `sdkjs-plugins/` directory: `-v /host/path/scribe-plugin:/var/www/onlyoffice/documentserver/sdkjs-plugins/scribe`. This adds the Scribe folder alongside existing plugins without hiding them.
**Warning signs:** All default plugins disappear from the Plugins tab.

### Pitfall 5: Plugin Not Appearing After Mount
**What goes wrong:** Plugin folder is correctly mounted in `sdkjs-plugins/` but does not appear in the editor's Plugins tab.
**Why it happens:** OO Document Server reads plugin list at startup from `plugin-list-default.json`. A new plugin folder alone is not enough -- it must be registered.
**How to avoid:** After mounting, either: (a) restart the container, (b) use `documentserver-pluginsmanager.sh` to update the plugin list, or (c) use `pluginsData` in the editor config to load the plugin by URL. For dev: `installDeveloperPlugin` from browser console is fastest.
**Warning signs:** Plugin folder exists in container but editor does not show it.

### Pitfall 6: Using `"*"` as postMessage targetOrigin
**What goes wrong:** Any page or iframe can intercept document content sent via postMessage.
**Why it happens:** Developers use `"*"` during local development for convenience and forget to restrict it.
**How to avoid:** For POC, every `postMessage("*")` call MUST have a `// TODO: restrict origin` comment. In Phase 2, replace with exact origin strings.
**Warning signs:** Code review shows wildcard origins with no TODO markers.

## Code Examples

### Complete Minimal Plugin (POC)

#### config.json
```json
{
  "name": "Scribe",
  "guid": "asc.{C36B0B33-0C65-4E88-9EE0-C1D6A40434EC}",
  "baseUrl": "",
  "version": "0.1.0",
  "minVersion": "8.2.0",
  "variations": [
    {
      "description": "Scribe AI writing assistant for Cozy Drive",
      "url": "index.html",
      "icons": "resources/%theme-type%(light|dark)/icon%scale%(default).%extension%(png)",
      "isViewer": false,
      "EditorsSupport": ["word"],
      "type": "background",
      "initDataType": "text",
      "initOnSelectionChanged": true,
      "buttons": [],
      "events": ["onContextMenuShow", "onContextMenuClick"]
    }
  ]
}
```

#### index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Scribe Plugin</title>
  <script type="text/javascript"
    src="https://onlyoffice.github.io/sdkjs-plugins/v1/plugins.js">
  </script>
  <script type="text/javascript" src="scripts/code.js"></script>
</head>
<body></body>
</html>
```

#### scripts/code.js (POC)
```javascript
(function(window, undefined) {
  "use strict";

  // Cache the latest selection
  var lastSelectedText = "";

  // ---- PLUG-01: Plugin loads and executes ----
  // ---- PLUG-02: Detect selection ----
  // ---- PLUG-03: Read selected text ----
  // Called on every selection change (initOnSelectionChanged: true)
  window.Asc.plugin.init = function(data) {
    // data = selected text string (initDataType: "text")
    lastSelectedText = data || "";
    if (lastSelectedText.length > 0) {
      console.log("[Scribe] Selection:", lastSelectedText.substring(0, 80));
    }
  };

  // Required: handle button clicks (empty for background plugin)
  window.Asc.plugin.button = function(id) {
    this.executeCommand("close", "");
  };

  // ---- Context menu: show "Scribe" when text selected ----
  window.Asc.plugin.event_onContextMenuShow = function(options) {
    if (options.type === "Selection") {
      this.executeMethod("AddContextMenuItem", [{
        guid: this.guid,
        items: [{
          id: "onClickScribe",
          text: { en: "Scribe", fr: "Scribe" }
        }]
      }]);
    }
  };

  // ---- Context menu click handler ----
  window.Asc.plugin.attachContextMenuClickEvent("onClickScribe", function() {
    // Read selected text explicitly on click
    window.Asc.plugin.executeMethod("GetSelectedText", [{
      Numbering: false,
      Math: false,
      TableCellSeparator: "\n",
      ParaSeparator: "\n",
      TabSymbol: String.fromCharCode(9)
    }], function(selectedText) {
      console.log("[Scribe] Context menu click, text:", selectedText);
      // Send to Cozy Drive host
      window.top.postMessage({
        type: "scribe:selection-ready",
        source: "scribe-plugin",
        payload: { text: selectedText || lastSelectedText }
      }, "*"); // TODO: restrict origin
    });
  });

  // ---- PLUG-04: Replace selected text ----
  // Listen for replace commands from host
  window.addEventListener("message", function(event) {
    // TODO: validate event.origin
    if (!event.data || event.data.type !== "scribe:apply-text") return;
    if (event.data.source !== "cozy-drive") return;

    var payload = event.data.payload;
    if (payload.action === "replace") {
      // Replace current selection
      window.Asc.plugin.executeMethod("PasteText", [payload.text]);
    } else if (payload.action === "insert") {
      // ---- PLUG-05: Insert after selection with line break ----
      Asc.scope.textToInsert = payload.text;
      window.Asc.plugin.callCommand(function() {
        var oDocument = Api.GetDocument();
        var oParagraph = Api.CreateParagraph();
        oParagraph.AddText(Asc.scope.textToInsert);
        oDocument.InsertContent([oParagraph]);
      }, false, false);
    }
  });

})(window, undefined);
```
Source: Composite from [Getting Started Guide](https://api.onlyoffice.com/docs/plugin-and-macros/structure/getting-started/), [Context Menu Sample](https://api.onlyoffice.com/docs/plugin-and-macros/samples/plugin-samples/context-menu-and-events/), [AI Plugin](https://github.com/ONLYOFFICE/onlyoffice.github.io/tree/master/sdkjs-plugins/content/ai)

### Docker Volume Mount for Plugin Development
```bash
# Mount only the scribe plugin folder (preserves default plugins)
docker run -itd -p 80:80 \
  -v /absolute/path/to/scribe-plugin:/var/www/onlyoffice/documentserver/sdkjs-plugins/scribe \
  onlyoffice/documentserver

# If using an already-running container, use docker cp + exec:
docker cp ./scribe-plugin <container>:/var/www/onlyoffice/documentserver/sdkjs-plugins/scribe

# Register the new plugin (restart container OR run pluginsmanager):
docker exec <container> /usr/bin/documentserver-pluginsmanager.sh \
  --directory="/var/www/onlyoffice/documentserver/sdkjs-plugins" \
  --update="/var/www/onlyoffice/documentserver/sdkjs-plugins/plugin-list-default.json"
```

### Alternative: installDeveloperPlugin (Fastest Iteration)
```bash
# 1. In your plugin folder, start a local HTTP server:
cd /path/to/scribe-plugin
http-server -p 3500 --cors

# 2. In the OO editor, open DevTools, select "frameEditor" in console scope
# 3. Run:
#    Asc.editor.installDeveloperPlugin("http://localhost:3500/config.json")

# 4. Plugin appears in Plugins tab. To reload after code changes:
#    Right-click browser refresh > "Empty Cache and Hard Reload"
```
Source: [OnlyOffice Plugin Dev for Web Editors](https://api.onlyoffice.com/docs/plugin-and-macros/tutorials/developing/for-web-editors/)

### Version Detection
```bash
# Method 1: Inside Docker container (most reliable)
docker exec <container> dpkg -l onlyoffice-documentserver

# Method 2: Check the Docker image tag
docker inspect <container> --format='{{.Config.Image}}'

# Method 3: API POST request (c=version)
curl -X POST http://localhost/coauthoring/CommandService.ashx \
  -H "Content-Type: application/json" \
  -d '{"c":"version"}'
```

### pluginsData Approach (Load Plugin via Editor Config)
```javascript
// In Cozy Drive's useConfig.jsx, add to docEditorConfig:
const docEditorConfig = {
  // ...existing config...
  editorConfig: {
    // ...existing editorConfig...
    plugins: {
      autostart: ["asc.{C36B0B33-0C65-4E88-9EE0-C1D6A40434EC}"],
      pluginsData: [
        "http://localhost:3500/config.json"  // Dev: local http-server
        // Production: plugin deployed on OO Document Server
      ]
    }
  }
};
```
Source: [OnlyOffice Editor Plugins Config](https://api.onlyoffice.com/docs/docs-api/usage-api/config/editor/plugins/)

### GetSelectedText with Full Options
```javascript
window.Asc.plugin.executeMethod("GetSelectedText", [{
  Numbering: false,        // Don't include list numbering
  Math: false,             // Don't include math expressions
  TableCellSeparator: "\n",// Newline between table cells
  TableRowSeparator: "\r\n",// CRLF between table rows
  ParaSeparator: "\n",     // Newline between paragraphs
  TabSymbol: "\t",         // Tab character
  NewLineSeparator: "\r"   // Line break within paragraph
}], function(text) {
  console.log("Selected text:", text);
});
```
Source: [OnlyOffice GetSelectedText](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/GetSelectedText/)

### SearchAndReplace (Selection-Loss Workaround)
```javascript
// When selection may be lost (focus change), use SearchAndReplace
// to find and replace the original text by content matching
window.Asc.plugin.executeMethod("SearchAndReplace", [{
  searchString: originalText,
  replaceString: aiModifiedText,
  matchCase: true
}]);
```
Source: [OnlyOffice SearchAndReplace](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/SearchAndReplace/)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `isVisual`, `isModal`, `isInsideMode`, `isSystem` config fields | `type: "background"`, `"panel"`, `"panelRight"`, `"window"`, `"system"` | OO 8.x | Old fields still work but are deprecated; use `type` |
| Polling for selection (`setInterval` + `GetSelectedText`) | `initOnSelectionChanged: true` in config.json | OO 6.x+ | Push-based, no polling needed |
| `initOnSelectionChanged` infinite loop bug | Fixed in OO 8.2.1 | OO 8.2.1 | Safe to use `initOnSelectionChanged` with `executeMethod` in same init() |
| Manual plugin folder placement only | `installDeveloperPlugin()` for web editor dev | OO 7.x+ | Fast dev cycle without container restarts |
| `onExternalPluginMessage` for host-to-plugin communication | `window.addEventListener("message", ...)` in plugin | OO 7.2+ (onExternalPluginMessage moved to Automation API) | Use raw postMessage listener instead |

**Deprecated/outdated:**
- `isVisual`, `isModal`, `isInsideMode`, `isSystem` in config.json: replaced by `type` field
- `onExternalPluginMessage`: moved to paid Automation API in OO 7.2+. Use `window.addEventListener("message")` directly.

## Open Questions

1. **OO Document Server version on Cozy instances**
   - What we know: Minimum 8.2.0 is needed for context menu API and `attachEditorEvent`. The `initOnSelectionChanged` loop bug is fixed in 8.2.1+.
   - What's unclear: The exact version running on Cozy production instances.
   - Recommendation: First task in Phase 1 is to run `docker exec <container> dpkg -l onlyoffice-documentserver` or check the Docker image tag. Block all other work on this.

2. **InsertContent behavior with active selection**
   - What we know: `InsertContent` inserts content at the current cursor position or replaces selection.
   - What's unclear: Does `InsertContent` insert AFTER the selection (appending) or does it replace it? The behavior of "insert after" may require first deselecting/moving cursor to end of selection, then inserting.
   - Recommendation: POC must test this exact behavior. If `InsertContent` replaces selection, the "insert after" flow needs: (1) store text, (2) deselect, (3) move cursor to end, (4) insert new paragraph.

3. **Plugin persistence across container restarts with volume mount**
   - What we know: Volume mount with `-v` persists files. But `plugin-list-default.json` may be regenerated on container restart.
   - What's unclear: Whether the plugin auto-registers on restart or needs manual re-registration each time.
   - Recommendation: Test during env setup. If registration does not persist, add a startup script or use `pluginsData` in Cozy Drive's editor config instead.

4. **`window.top.postMessage` accessibility from plugin iframe**
   - What we know: Plugin iframe is nested inside OO editor iframe. `window.parent` = OO editor. `window.top` should = Cozy Drive.
   - What's unclear: Whether `window.top` is accessible (same-origin policy) or blocked. If OO sets `X-Frame-Options` or `frame-ancestors` that prevent access to `window.top`, postMessage may fail silently.
   - Recommendation: POC must validate this communication path immediately. If `window.top` is blocked, fallback: relay messages through the OO editor iframe via `window.parent.postMessage` chain.

## Sources

### Primary (HIGH confidence)
- [OnlyOffice Plugin Getting Started Guide](https://api.onlyoffice.com/docs/plugin-and-macros/structure/getting-started/) - Plugin structure, file requirements, installation
- [OnlyOffice Plugin Configuration Reference](https://api.onlyoffice.com/docs/plugin-and-macros/structure/configuration/) - config.json schema, all field definitions
- [OnlyOffice How to Call Commands](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/) - callCommand API, Asc.scope usage
- [OnlyOffice How to Call Methods](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-methods/) - executeMethod API
- [OnlyOffice Context Menu and Events Sample](https://api.onlyoffice.com/docs/plugin-and-macros/samples/plugin-samples/context-menu-and-events/) - Complete working example
- [OnlyOffice GetSelectedText Documentation](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/GetSelectedText/) - Full parameter spec
- [OnlyOffice PasteText Documentation](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/PasteText/) - Signature and usage
- [OnlyOffice InputText Documentation](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/InputText/) - Signature and parameters
- [OnlyOffice SearchAndReplace Documentation](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Methods/SearchAndReplace/) - Selection-loss workaround
- [OnlyOffice ReplaceTextSmart Documentation](https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/Api/Methods/ReplaceTextSmart/) - Format-preserving replacement
- [OnlyOffice Plugin Installation On-Premises](https://api.onlyoffice.com/docs/plugin-and-macros/tutorials/installing/onlyoffice-docs-on-premises/) - Three installation methods
- [OnlyOffice Plugin Dev for Web Editors](https://api.onlyoffice.com/docs/plugin-and-macros/tutorials/developing/for-web-editors/) - installDeveloperPlugin workflow
- [OnlyOffice Editor Plugins Config](https://api.onlyoffice.com/docs/docs-api/usage-api/config/editor/plugins/) - pluginsData, autostart
- [OnlyOffice AI Plugin Source Code](https://github.com/ONLYOFFICE/onlyoffice.github.io/tree/master/sdkjs-plugins/content/ai) - Reference implementation
- [Docker-DocumentServer README](https://github.com/ONLYOFFICE/Docker-DocumentServer/blob/master/README.md) - Volume mounts, PLUGINS_ENABLED

### Secondary (MEDIUM confidence)
- [OnlyOffice Debugging Plugins Guide](https://www.onlyoffice.com/blog/2025/11/debugging-onlyoffice-plugins-practical-guide) - DevTools setup, Asc.scope debugging
- [OnlyOffice Community: initOnSelectionChanged loop (resolved)](https://community.onlyoffice.com/t/when-the-plugin-enables-the-initonselectionchanged-configuration-executing-both-executemethod-and-callcommand-causes-an-infinite-loop-of-execution/11536) - Bug confirmed fixed in 8.2.1
- [OnlyOffice Community: Installing Plugins in Docker](https://community.onlyoffice.com/t/installing-plugins-in-docker/848) - Volume mount challenges
- [OnlyOffice Community: Live Reload Plugin](https://community.onlyoffice.com/t/live-reload-plugin/2159/1) - No native hot-reload, workarounds
- [Cozy Drive codebase: useConfig.jsx](src/modules/views/OnlyOffice/useConfig.jsx) - OO server URL from Cozy stack API

### Tertiary (LOW confidence)
- [OnlyOffice Community: onExternalPluginMessage deprecation](https://community.onlyoffice.com/t/oo-docs-7-2-onexternalpluginmessage-does-not-work/3317/8) - Needs version-specific validation in POC

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Plugin SDK, executeMethod, callCommand are well-documented official APIs
- Architecture: MEDIUM-HIGH - Background plugin pattern verified against AI plugin reference; Docker mounting verified against official docs
- Pitfalls: MEDIUM - Selection loss and callCommand isolation documented in multiple sources; Docker mount behavior needs POC validation
- Dev iteration: MEDIUM - installDeveloperPlugin documented but reload mechanism is primitive (hard refresh); no hot-reload

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (OnlyOffice API is stable; Docker patterns unlikely to change)
