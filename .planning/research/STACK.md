# Stack Research

**Domain:** OnlyOffice plugin development + cross-iframe AI assistant integration within Cozy Drive
**Researched:** 2026-02-26
**Confidence:** MEDIUM (OnlyOffice plugin APIs verified against official docs and source code; Cozy-deployed Document Server version unknown -- a critical variable)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| OnlyOffice Plugin SDK v1 | v1 (CDN: `sdkjs-plugins/v1/plugins.js`) | Plugin runtime inside OnlyOffice editor iframe | Only supported SDK version. All plugins including the official AI plugin use this. The `v1` in the CDN path is the SDK generation, not a semver -- it has been stable across Document Server 7.x-9.x. | HIGH |
| OnlyOffice Office JS API | Aligns with Document Server version | Document content manipulation (`Api.GetDocument()`, `Api.CreateParagraph()`, etc.) | The Office JS API is what `callCommand` executes. It is the only way to create and insert content into documents from plugins. | HIGH |
| `executeMethod` API | Aligns with Document Server version | Read data from documents (`GetSelectedText`, `GetCurrentWord`) and perform editor operations (`PasteText`, `InputText`, `AddContextMenuItem`) | `executeMethod` is the counterpart to `callCommand` -- it reads from the document and invokes editor-level operations. Combined, they cover the full read/write cycle. | HIGH |
| React 18.2.0 | 18.2.0 (existing) | Scribe iframe UI | Already in the Cozy Drive stack. The Scribe iframe is served from Cozy Drive's codebase (PROJECT.md decision), so it shares the existing React runtime. No reason to introduce a second framework. | HIGH |
| TypeScript 4.9.5 | 4.9.5 (existing) | Type safety for Scribe iframe and postMessage protocol | Already in the Cozy Drive stack. Critical for defining typed postMessage message schemas. | HIGH |
| `window.postMessage` / `MessageEvent` | Web API (no library) | Cross-iframe communication between OnlyOffice plugin, Cozy Drive, and Scribe iframe | The only standard mechanism for cross-origin iframe communication. No library needed -- raw `postMessage` with typed message schemas is simpler and more debuggable than any abstraction. | HIGH |

### OnlyOffice Plugin Structure (Required Files)

| File | Purpose | Notes |
|------|---------|-------|
| `config.json` | Plugin metadata, GUID, supported editors, events, variations | Must declare `"events": ["onContextMenuShow", "onContextMenuClick"]` for context menu integration. Set `"type": "background"` for persistent operation. |
| `index.html` | Plugin entry point HTML | Loads SDK scripts from CDN and plugin code. Minimal HTML -- logic lives in JS. |
| `scripts/code.js` | Plugin logic | Contains `window.Asc.plugin.init`, event handlers, `executeMethod`/`callCommand` calls. |
| `resources/` | Icons (icon.png, icon@2x.png) | Required for plugin manager display. |

### Key OnlyOffice Plugin API Methods

| Method | Signature | Purpose | When to Use |
|--------|-----------|---------|-------------|
| `Asc.plugin.executeMethod` | `executeMethod("MethodName", [params], callback)` | Execute editor methods that return data or perform operations | Reading selected text, adding context menu items, pasting text |
| `GetSelectedText` | `executeMethod("GetSelectedText", [options])` | Get the currently selected text from the document | When user triggers Scribe -- extract the selection to send to AI |
| `PasteText` | `executeMethod("PasteText", [text])` | Paste plain text at current cursor/selection position | Replace selected text with AI-modified text |
| `InputText` | `executeMethod("InputText", [text, options])` | Input text at cursor position | Insert AI text after selection |
| `AddContextMenuItem` | `executeMethod("AddContextMenuItem", [itemsObj])` | Add items to the editor's right-click context menu | Show "Scribe" option when text is selected |
| `Asc.plugin.callCommand` | `callCommand(func, isClose, isCalc, callback)` | Execute Office JS API commands to create/insert structured content | Insert formatted paragraphs, preserve styling when replacing content |
| `Asc.plugin.attachEvent` | `attachEvent("eventName", handler)` | Listen for editor events | Listen for `onContextMenuShow`, `onContextMenuClick` |
| `Asc.plugin.attachEditorEvent` | `attachEditorEvent("eventName", handler)` | Listen for lower-level editor events (v8.2+) | Track selection changes, key events |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cozy-ui | 135.8.0 (existing) | Design system for Scribe iframe UI | All Scribe UI components (buttons, dialogs, text areas, action menus) |
| cozy-client | 60.20.0 (existing) | API communication with Cozy stack | Calling the Scribe AI backend API through Cozy's HTTP client |
| cozy-intent | 2.30.1 (existing) | Inter-app communication via intents | Alternative to raw postMessage if Scribe becomes a separate Cozy app later |
| cozy-realtime | 5.8.0 (existing) | WebSocket real-time updates | Streaming AI responses if the backend supports SSE/WebSocket |
| cozy-flags | 4.6.1 (existing) | Feature flags | Gate Scribe behind feature flag for gradual rollout |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| OnlyOffice Document Server (Docker) | Local development environment | Already running locally. Plugin development requires mounting the plugin folder into the container's `sdkjs-plugins` directory. |
| Browser DevTools | Debug cross-iframe postMessage | Use `monitorEvents(window, 'message')` or add temporary `addEventListener('message', console.log)` to debug message flow between frames. |
| OnlyOffice Plugin Debugger | Debug plugin code inside editor iframe | Chrome DevTools can attach to the plugin iframe. OnlyOffice published a debugging guide (Nov 2025). |

## Architecture Decision: Plugin vs. Connector (Automation API)

**Decision: Use Plugin API, NOT the Connector/Automation API.**

| Criterion | Plugin API | Connector (Automation API) |
|-----------|-----------|---------------------------|
| Licensing | Included in all OnlyOffice Docs editions | Paid add-on for ONLYOFFICE Docs Developer edition only |
| Access pattern | Runs inside editor iframe | Called from parent page via `docEditor.createConnector()` |
| API surface | `executeMethod`, `callCommand`, context menu, events | Same API surface (mirrors plugin interface) |
| Deployment | Drop plugin folder into `sdkjs-plugins/` | No deployment -- code runs in parent page |
| Cozy compatibility | Unknown if Cozy's OnlyOffice license includes Connector | Plugin works with any Document Server edition |

**Rationale:** The Connector API would be architecturally cleaner (call from Cozy Drive directly without a plugin), but it is a paid add-on that may not be available in Cozy's OnlyOffice deployment. The Plugin API provides the same capabilities and works universally. The official OnlyOffice AI plugin uses the Plugin API, confirming it is the standard approach.

## Cross-iframe Communication Protocol

### The iframe Nesting Problem

The architecture involves three nested iframe levels:

```
Cozy Drive (top window)
  └── OnlyOffice Editor iframe (frameEditor)
        └── OnlyOffice Plugin iframe (plugin's index.html)
```

**Critical implication:** From inside the plugin, `window.parent` points to the OnlyOffice editor, NOT to Cozy Drive. To reach Cozy Drive, the plugin must use `window.top.postMessage()`. This has been confirmed by OnlyOffice community members solving the same problem.

### Recommended postMessage Protocol

**Message schema (TypeScript):**

```typescript
// Shared types between plugin, Cozy Drive, and Scribe iframe
interface ScribeMessage {
  type: string;
  source: 'scribe-plugin' | 'cozy-drive' | 'scribe-iframe';
  payload: unknown;
}

// Plugin -> Cozy Drive
interface SelectionReadyMessage extends ScribeMessage {
  type: 'scribe:selection-ready';
  source: 'scribe-plugin';
  payload: { selectedText: string; hasFormatting: boolean };
}

// Cozy Drive -> Plugin
interface ReplaceTextMessage extends ScribeMessage {
  type: 'scribe:replace-text';
  source: 'cozy-drive';
  payload: { newText: string; mode: 'replace' | 'insert-after' };
}

// Scribe iframe -> Cozy Drive
interface AIRequestMessage extends ScribeMessage {
  type: 'scribe:ai-request';
  source: 'scribe-iframe';
  payload: { text: string; action: string; instruction?: string };
}

// Cozy Drive -> Scribe iframe
interface AIResponseMessage extends ScribeMessage {
  type: 'scribe:ai-response';
  source: 'cozy-drive';
  payload: { modifiedText: string; status: 'success' | 'error' };
}
```

**Security rules:**
1. Always specify `targetOrigin` -- never use `"*"` in production
2. Always validate `event.origin` in message handlers
3. Namespace all message types with `scribe:` prefix to avoid conflicts with OnlyOffice's own postMessage traffic
4. Validate `event.data.source` to distinguish Scribe messages from other postMessage traffic

### Communication Flow

```
1. User right-clicks selected text in OnlyOffice
2. Plugin receives onContextMenuShow event (type: "Selection")
3. Plugin adds "Scribe" context menu item via AddContextMenuItem
4. User clicks "Scribe"
5. Plugin receives onContextMenuClick event
6. Plugin calls GetSelectedText via executeMethod
7. Plugin sends selection to Cozy Drive via window.top.postMessage
8. Cozy Drive opens Scribe iframe overlay
9. Cozy Drive forwards selected text to Scribe iframe via postMessage
10. User chooses AI action in Scribe iframe
11. Scribe iframe sends action request to Cozy Drive via window.parent.postMessage
12. Cozy Drive calls AI backend API via cozy-client
13. Cozy Drive forwards AI response to Scribe iframe
14. User reviews/edits, clicks "Replace" or "Insert"
15. Scribe iframe sends confirmed text to Cozy Drive
16. Cozy Drive forwards to plugin via postMessage into OnlyOffice iframe
17. Plugin calls PasteText or callCommand to update document
```

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| OnlyOffice Plugin SDK v1 | Connector (Automation) API | Paid add-on; licensing status with Cozy unknown; Plugin API has identical capabilities |
| Raw `window.postMessage` | comlink / post-robot / penpal | These libraries add abstraction over postMessage with RPC patterns, but they are unnecessary for our protocol (simple request-response messages). They also complicate debugging and add bundle size. The message count is small (< 10 types). |
| Raw `window.postMessage` | BroadcastChannel API | BroadcastChannel only works same-origin. OnlyOffice editor iframe is cross-origin (different host). |
| Raw `window.postMessage` | cozy-intent | cozy-intent is designed for inter-Cozy-app communication. Scribe is not a separate Cozy app (it lives in the same repo). Using intents would be over-engineering. When/if Scribe migrates to a separate app, revisit. |
| Context menu trigger | `initOnSelectionChanged` + floating button | `initOnSelectionChanged` fires on every selection change, triggering `init()` repeatedly. An OnlyOffice community report confirmed this causes infinite loops when combined with `executeMethod`+`callCommand`. Context menu is safer, more predictable, and matches user expectations for text actions. |
| Plugin type: `background` | Plugin type: `panel` or `window` | The Scribe UI lives in Cozy Drive's iframe, not inside the plugin. The plugin should be invisible (`background` type) -- it only bridges selection data and text replacement between OnlyOffice and Cozy Drive. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `initOnSelectionChanged: true` in config.json | Causes the plugin's `init()` to fire on every selection change. Combined with `executeMethod`/`callCommand` calls, this creates infinite execution loops (confirmed OnlyOffice community bug report). | Use `onContextMenuShow` event to detect selection and offer Scribe only on right-click. |
| `window.parent.postMessage()` from the plugin | `window.parent` from a plugin iframe points to the OnlyOffice editor iframe, NOT to Cozy Drive. Messages never reach the host app. | Use `window.top.postMessage()` to reach Cozy Drive (the topmost window). |
| `"*"` as targetOrigin in postMessage | Security vulnerability. Any page could intercept messages containing document text. | Specify the exact origin of the target window. |
| Connector/Automation API (`docEditor.createConnector()`) | Paid add-on for ONLYOFFICE Docs Developer only. Not confirmed available in Cozy's deployment. | Use Plugin API which works with all editions. |
| comlink, post-robot, or other postMessage wrapper libraries | Over-engineering for ~8 message types. Adds bundle size, debugging opacity, and a dependency that may conflict with OnlyOffice's own postMessage handling. | Raw `window.postMessage` with typed TypeScript interfaces. |
| BroadcastChannel API | Same-origin only. OnlyOffice editor runs on a different origin than Cozy Drive. | `window.postMessage` which works cross-origin. |
| Building Scribe UI inside the OnlyOffice plugin | Plugin UI is constrained to OnlyOffice's plugin panel/window system. Limited styling control, no access to Cozy UI components, no cozy-client access. | Build Scribe UI as a Cozy Drive component rendered in its own iframe overlay, communicating with the plugin via postMessage. |
| `isSystem: true` in plugin config | Deprecated field. | Use `"type": "background"` instead. |
| `isVisual: true/false` in plugin config | Deprecated field. | Use `"type": "background"` for invisible plugins, `"type": "panel"` for visible ones. |

## Stack Patterns by Variant

**If Cozy has ONLYOFFICE Docs Developer with Connector API:**
- Could skip the plugin entirely and use `docEditor.createConnector()` from Cozy Drive
- Simpler architecture (no plugin deployment, no triple-iframe nesting)
- Verify with Cozy Cloud team before pursuing this path

**If OnlyOffice Document Server version is < 8.2:**
- `attachEditorEvent` method not available (added in 8.2)
- Context menu API may behave differently
- Must verify `GetSelectedText`, `PasteText`, `AddContextMenuItem` availability
- The AI plugin requires minVersion 8.2.0, which is a useful baseline

**If text formatting preservation is required:**
- `GetSelectedText` returns plain text only
- For formatted content, use `callCommand` with `Api.GetDocument().GetRangeBySelect().GetAllParagraphs()` to access paragraph-level formatting
- Reinsertion with formatting requires `callCommand` with `Api.CreateParagraph()` and styled runs
- This is significantly more complex -- recommend starting with plain text for POC

## Version Compatibility

| Component | Minimum Version | Recommended | Notes |
|-----------|-----------------|-------------|-------|
| OnlyOffice Document Server | 8.2.0 | 9.x (latest) | 8.2.0 is the minimum for `attachEditorEvent`, context menu API improvements, and is the minVersion for the official AI plugin |
| OnlyOffice Plugin SDK | v1 | v1 | Only version available. CDN: `https://onlyoffice.github.io/sdkjs-plugins/v1/plugins.js` |
| React (Scribe iframe) | 18.2.0 | 18.2.0 | Match existing Cozy Drive version |
| TypeScript | 4.9.5 | 4.9.5 | Match existing Cozy Drive version |
| Node.js | 20 | 20 | Match existing Cozy Drive `.nvmrc` |
| cozy-client | 60.20.0 | 60.20.0 | Match existing for API calls to AI backend |

## Installation

```bash
# No new npm packages needed for Cozy Drive side.
# The Scribe iframe UI uses existing React/cozy-ui/cozy-client.
# The OnlyOffice plugin is pure vanilla JS (no npm dependencies).

# Plugin deployment (Docker dev environment):
# Mount plugin folder into OnlyOffice Document Server container:
# docker cp ./scribe-plugin <container>:/var/www/onlyoffice/documentserver/sdkjs-plugins/scribe/

# OR pack as .plugin file:
# cd scribe-plugin && zip -r ../scribe.plugin . && cd ..
# Install via OnlyOffice Plugin Manager
```

## Reference: OnlyOffice AI Plugin Architecture

The official OnlyOffice AI plugin (v3.0.8, minVersion 8.2.0) serves as the primary reference implementation. Key patterns observed from its source code at `github.com/ONLYOFFICE/onlyoffice.github.io/tree/master/sdkjs-plugins/content/ai`:

| Pattern | How AI Plugin Does It | Relevance to Scribe |
|---------|----------------------|---------------------|
| Get selected text | `await Asc.Library.GetSelectedText()` (wrapper around `executeMethod("GetSelectedText")`) | Direct pattern to follow |
| Insert text | `await Asc.Library.PasteText(data)` | Use for "Replace" action |
| Context menu | Listens to `onContextMenuShow`, `onContextMenuClick` events | Exact same pattern needed |
| Plugin type | `background` with panel UI | Scribe plugin should be `background` only (UI in Cozy Drive) |
| Data passing | `Asc.scope` for passing data into `callCommand` | Use for formatted text operations |
| Block operations | `Asc.Editor.callMethod("StartAction", ["Block"])` / `EndAction` | Group undo operations for text replacement |

## Sources

- [OnlyOffice Plugin & Macros Documentation](https://api.onlyoffice.com/docs/plugin-and-macros/get-started/) -- Plugin structure, configuration, API overview (HIGH confidence)
- [OnlyOffice Plugin Configuration Reference](https://api.onlyoffice.com/docs/plugin-and-macros/structure/configuration/) -- config.json schema, field documentation (HIGH confidence)
- [OnlyOffice How to Call Methods](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-methods/) -- `executeMethod` syntax and usage (HIGH confidence)
- [OnlyOffice How to Call Commands](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/) -- `callCommand` syntax, `Asc.scope`, limitations (HIGH confidence)
- [OnlyOffice Context Menu API](https://api.onlyoffice.com/docs/plugin-and-macros/customization/context-menu/) -- `AddContextMenuItem`, `onContextMenuShow` events (HIGH confidence)
- [OnlyOffice Context Menu and Events Sample](https://api.onlyoffice.com/docs/plugin-and-macros/samples/plugin-samples/context-menu-and-events/) -- Working example with selection type detection (HIGH confidence)
- [OnlyOffice AI Plugin Source Code](https://github.com/ONLYOFFICE/onlyoffice.github.io/tree/master/sdkjs-plugins/content/ai) -- Reference implementation for text selection, replacement, context menu (HIGH confidence)
- [OnlyOffice AI Plugin Customization Guide](https://www.onlyoffice.com/blog/2025/12/how-to-add-custom-features-to-the-onlyoffice-ai-plugin) -- Architecture details, code patterns (MEDIUM confidence)
- [OnlyOffice Automation/Connector API](https://api.onlyoffice.com/docs/docs-api/usage-api/automation-api/) -- Connector alternative, paid licensing (MEDIUM confidence)
- [OnlyOffice Plugin Debugging Guide](https://www.onlyoffice.com/blog/2025/11/debugging-onlyoffice-plugins-practical-guide) -- Dev workflow (MEDIUM confidence)
- [OnlyOffice Community: Plugin-to-React postMessage](https://community.onlyoffice.com/t/how-to-send-message-from-the-plugin-to-react-app-using-iframe/14454) -- `window.top.postMessage` solution for triple-iframe nesting (MEDIUM confidence)
- [OnlyOffice Community: initOnSelectionChanged infinite loop](https://community.onlyoffice.com/t/when-the-plugin-enables-the-initonselectionchanged-configuration-executing-both-executemethod-and-callcommand-causes-an-infinite-loop-of-execution/11536) -- Known bug with selection events (MEDIUM confidence)
- [OnlyOffice DocumentServer GitHub Releases](https://github.com/ONLYOFFICE/DocumentServer/releases) -- Version history (v9.3.0 is latest as of Feb 2025) (HIGH confidence)
- [OnlyOffice API Updates December 2025](https://www.onlyoffice.com/blog/2025/12/api-updates-december-2025) -- Latest API additions in v9.2 (MEDIUM confidence)
- [OnlyOffice PostMessage / WOPI Protocol](https://api.onlyoffice.com/docs/docs-api/using-wopi/postmessage/) -- OnlyOffice's own postMessage protocol for host-editor communication (HIGH confidence)
- [MDN: Window.postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) -- Web API reference (HIGH confidence)
- [Cozy Cloud OnlyOffice Administration](https://docs.cozy.io/en/tutorials/selfhosting/administration/office/) -- Cozy's OnlyOffice deployment docs (HIGH confidence)

---
*Stack research for: OnlyOffice plugin + AI editor integration within Cozy Drive*
*Researched: 2026-02-26*
