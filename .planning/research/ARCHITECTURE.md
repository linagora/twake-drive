# Architecture Research

**Domain:** OnlyOffice plugin + cross-iframe AI assistant integration in Cozy Drive
**Researched:** 2026-02-26
**Confidence:** MEDIUM (OnlyOffice plugin API verified against official docs; cross-iframe patterns well-established; exact Cozy OnlyOffice server version unconfirmed)

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Browser Window (Cozy Drive)                       │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  Cozy Drive React App                          │  │
│  │  ┌──────────────────────────────┐  ┌────────────────────────┐ │  │
│  │  │  OnlyOffice Editor iframe    │  │  Scribe Panel          │ │  │
│  │  │  (Document Server origin)    │  │  (Cozy Drive origin)   │ │  │
│  │  │                              │  │                        │ │  │
│  │  │  ┌────────────────────────┐  │  │  ┌──────────────────┐  │ │  │
│  │  │  │  Scribe Plugin         │  │  │  │  Action Menu     │  │ │  │
│  │  │  │  (inside OO iframe)    │  │  │  │  (AI actions)    │  │ │  │
│  │  │  │                        │  │  │  ├──────────────────┤  │ │  │
│  │  │  │  - Selection detect    │──┼──┼──│  Preview Panel   │  │ │  │
│  │  │  │  - Context button      │  │  │  │  (AI result)     │  │ │  │
│  │  │  │  - Text extraction     │  │  │  ├──────────────────┤  │ │  │
│  │  │  │  - Text replacement    │←─┼──┼──│  Editor (edit    │  │ │  │
│  │  │  │                        │  │  │  │   AI result)     │  │ │  │
│  │  │  └────────────────────────┘  │  │  └──────────────────┘  │ │  │
│  │  └──────────────────────────────┘  └────────────────────────┘ │  │
│  │                                           │                    │  │
│  │                                           ▼                    │  │
│  │                                 ┌──────────────────┐           │  │
│  │                                 │  Scribe AI API   │           │  │
│  │                                 │  (backend)       │           │  │
│  │                                 └──────────────────┘           │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **Cozy Drive (host)** | Orchestrates iframe lifecycle, renders Scribe panel, manages state, routes messages | OnlyOffice iframe (via DocsAPI), Scribe Panel (direct React), Scribe AI API (HTTP) |
| **OnlyOffice Editor iframe** | Renders document, manages editing state, hosts plugins | Cozy Drive (via DocsAPI callbacks + postMessage), Plugin (internal OO plugin API) |
| **Scribe Plugin** | Detects selection, shows context button, extracts text, replaces text | OnlyOffice Editor (via `callCommand`/`executeMethod`), Cozy Drive host (via `postMessage`) |
| **Scribe Panel** | Displays AI action menu, shows preview, allows editing before apply | Cozy Drive host (direct React parent), Scribe AI API (HTTP via cozy-client) |
| **Scribe AI API** | Processes text + instruction, returns modified text | Scribe Panel (HTTP response) |

## Recommended Architecture

### Architecture Decision: Plugin + Host Panel (not Plugin-Only)

Use a **hybrid architecture** where the OnlyOffice plugin handles only document-level operations (selection detection, text extraction, text replacement) while the Scribe UI lives as a React component in Cozy Drive's own DOM, displayed alongside the editor.

**Why this split:**
- OnlyOffice plugins run inside the editor's iframe with severe UI constraints (limited HTML/CSS, no access to Cozy ecosystem libraries like cozy-ui, cozy-client)
- The Scribe AI API call needs Cozy authentication (cozy-client tokens) which the plugin iframe cannot access
- The Scribe panel UI needs cozy-ui components, theming, and i18n from the host app
- A precedent already exists: the `OnlyOfficeAIAssistantPanel` component in the codebase renders a panel alongside the editor div, proving the pattern works

**Confidence:** HIGH -- this pattern is already validated in the codebase with the existing `AIAssistantPanel` integration.

### Architecture Decision: Communication via postMessage (not Automation API / Connector)

Use `postMessage` between Cozy Drive and the Scribe plugin for cross-iframe communication. Do NOT use the OnlyOffice Connector/Automation API.

**Why postMessage:**
- The Automation API's `createConnector()` is a premium feature requiring developer edition licensing -- the Cozy integration may not have access to it
- `postMessage` is a standard Web API that works regardless of OnlyOffice edition
- The `onExternalPluginMessage` pattern (host sends postMessage to editor iframe, plugin receives via `window.Asc.plugin.onExternalPluginMessage`) is documented in community examples, though reliability varies across OO versions
- `postMessage` allows bidirectional communication without special licensing

**Risk:** `onExternalPluginMessage` was reportedly moved to Automation API in OO 7.2+. The POC must validate whether the deployed Cozy OnlyOffice version supports this pattern. If not, an alternative is to use `window.addEventListener('message', ...)` directly in the plugin code.

**Confidence:** MEDIUM -- the pattern is well-documented but version-dependent. POC required.

## Component Boundaries

### 1. Scribe OnlyOffice Plugin

**Lives in:** OnlyOffice Document Server plugin directory (deployed separately from Cozy Drive)
**Origin:** OnlyOffice Document Server domain
**Technology:** Vanilla JavaScript (no React, no bundler -- OO plugin constraints)

**Files:**
```
scribe-plugin/
├── config.json          # Plugin manifest (guid, type, events, editors)
├── index.html           # Plugin entry point (loads plugin SDK + scribe.js)
├── scripts/
│   └── scribe.js        # Plugin logic
└── resources/
    └── img/             # Plugin icons
```

**config.json key settings:**
```json
{
  "name": "Scribe",
  "guid": "asc.{unique-guid-here}",
  "variations": [
    {
      "url": "index.html",
      "type": "background",
      "EditorsSupport": ["word"],
      "initDataType": "text",
      "initOnSelectionChanged": true,
      "events": ["onContextMenuShow"]
    }
  ]
}
```

**Key design choices:**
- `type: "background"` -- the plugin runs silently, no visible panel inside OO. All UI lives in Cozy Drive.
- `initOnSelectionChanged: true` -- the plugin is notified on every selection change, enabling real-time detection.
- `initDataType: "text"` -- receives selected text as plain text on each selection change. For HTML-formatted selections, use `"html"` instead (but see Pitfalls).
- `events: ["onContextMenuShow"]` -- allows adding a "Scribe" item to the right-click context menu as an alternative trigger.

**API surface used by plugin:**

| Method | Direction | Purpose |
|--------|-----------|---------|
| `window.Asc.plugin.init(data)` | OO -> Plugin | Called on selection change (receives selected text) |
| `window.Asc.plugin.executeMethod("InputText", [...])` | Plugin -> OO | Replaces selection or inserts text at cursor |
| `window.Asc.plugin.executeMethod("GetSelectedText", [...], callback)` | Plugin -> OO | Gets current selected text on demand |
| `window.Asc.plugin.callCommand(fn)` | Plugin -> OO | Executes Document Builder API commands (for formatting-aware operations) |
| `window.Asc.plugin.executeMethod("AddContextMenuItem", [...])` | Plugin -> OO | Adds "Scribe" to right-click menu |
| `window.Asc.plugin.onExternalPluginMessage` | Host -> Plugin | Receives commands from Cozy Drive (e.g., "replace text with AI result") |
| `window.parent.postMessage(...)` | Plugin -> Host | Sends data to Cozy Drive (e.g., "selection changed", "text extracted") |

### 2. Scribe Panel (Cozy Drive React Component)

**Lives in:** `src/modules/views/OnlyOffice/Scribe/`
**Origin:** Cozy Drive domain (same-origin with host app)
**Technology:** React + TypeScript + cozy-ui + cozy-client

**Proposed structure:**
```
src/modules/views/OnlyOffice/Scribe/
├── ScribePanel.tsx              # Main panel container (open/close, positioning)
├── ScribeActionMenu.tsx         # List of AI actions (improve, rewrite, translate, etc.)
├── ScribePreview.tsx            # Preview of AI-modified text + edit capability
├── ScribeProvider.tsx           # Context provider for Scribe state
├── useScribePlugin.ts           # Hook: postMessage bridge to OO plugin
├── useScribeAI.ts               # Hook: API calls to Scribe AI backend
├── scribeProtocol.ts            # Shared message type definitions
└── scribe.styl                  # Styles
```

**Responsibilities:**
- Display the action menu when triggered by plugin selection event
- Call the Scribe AI API with selected text + action
- Display the AI result preview
- Allow user to edit the result before applying
- Send "replace" or "insert" command back to the plugin via postMessage

### 3. PostMessage Bridge (Protocol Layer)

**Lives in:** Shared type definitions between plugin and panel
**Concern:** The plugin (OO origin) and the panel (Cozy Drive origin) are cross-origin. All communication must go through `window.postMessage` with strict origin validation.

## Data Flow

### Primary Flow: Selection to AI to Replacement

```
1. USER selects text in OnlyOffice editor
          │
          ▼
2. PLUGIN receives selection via init(data)
   [initOnSelectionChanged: true triggers plugin.init with selected text]
          │
          ▼
3. PLUGIN sends message to Cozy Drive host
   window.parent.postMessage({
     type: 'scribe:selection-changed',
     payload: { text, hasSelection: true }
   }, cozyDriveOrigin)
          │
          ▼
4. COZY DRIVE (useScribePlugin hook) receives message
   Updates ScribeProvider state: { selectedText, hasSelection }
   Shows "Scribe" trigger button in toolbar or floating near selection
          │
          ▼
5. USER clicks Scribe button -> ScribePanel opens
   ScribeActionMenu displays available actions
          │
          ▼
6. USER selects an action (e.g., "Rewrite formally")
          │
          ▼
7. SCRIBE PANEL calls Scribe AI API via cozy-client
   useScribeAI.ts: POST /ai/scribe { text, instruction }
          │
          ▼
8. AI API returns modified text
          │
          ▼
9. SCRIBE PANEL displays preview in ScribePreview
   User can edit the result in a textarea
          │
          ▼
10. USER clicks "Replace" or "Insert"
          │
          ▼
11. SCRIBE PANEL sends command to plugin via postMessage
    editorIframe.contentWindow.postMessage({
      type: 'scribe:apply-text',
      payload: { text: modifiedText, action: 'replace' | 'insert' }
    }, onlyOfficeOrigin)
          │
          ▼
12. PLUGIN receives via onExternalPluginMessage (or message listener)
    Calls executeMethod("InputText", [modifiedText]) for replace
    OR callCommand() with InsertContent for insert-after
          │
          ▼
13. DOCUMENT UPDATED -- selection replaced/text inserted
```

### Alternative Trigger: Context Menu

```
1. USER right-clicks selected text
          │
          ▼
2. PLUGIN adds "Scribe" to context menu
   (via AddContextMenuItem during init)
          │
          ▼
3. USER clicks "Scribe" in context menu
          │
          ▼
4. PLUGIN extracts selected text via GetSelectedText
   Sends to host via postMessage
          │
          ▼
5. [continues from step 4 above]
```

### PostMessage Protocol

```typescript
// scribeProtocol.ts -- shared type definitions

// Plugin -> Host (Cozy Drive)
type PluginToHostMessage =
  | { type: 'scribe:selection-changed'; payload: { text: string; hasSelection: boolean } }
  | { type: 'scribe:plugin-ready'; payload: {} }
  | { type: 'scribe:text-replaced'; payload: { success: boolean } }
  | { type: 'scribe:error'; payload: { message: string } }

// Host (Cozy Drive) -> Plugin
type HostToPluginMessage =
  | { type: 'scribe:apply-text'; payload: { text: string; action: 'replace' | 'insert' } }
  | { type: 'scribe:get-selection'; payload: {} }
  | { type: 'scribe:cancel'; payload: {} }
```

**Origin validation is mandatory.** Every `message` event handler must check `event.origin` against the expected origin before processing.

## Architectural Patterns

### Pattern 1: Background Plugin as Bridge

**What:** The OO plugin acts as a thin bridge between the document and the host application, not as a UI component.
**When to use:** When the real UI lives outside the editor iframe (in the host app).
**Trade-offs:**
- Pro: Full access to host app ecosystem (React, cozy-ui, cozy-client, auth tokens)
- Pro: Plugin code stays minimal and maintainable (vanilla JS, no build step)
- Con: Requires postMessage bridge with origin validation overhead
- Con: Two codebases to maintain (plugin JS + React components)

### Pattern 2: Selection-Driven State Machine

**What:** The Scribe feature state is driven by selection events from the plugin.
**When to use:** When the UI depends on document context (what's selected).
**Trade-offs:**
- Pro: Natural UX -- panel appears when there's something to act on
- Pro: Avoids stale state by re-syncing on each selection change
- Con: Frequent postMessage traffic on selection change -- debounce needed

**Example state machine:**
```
IDLE → (selection detected) → READY
READY → (user clicks Scribe) → ACTION_SELECT
ACTION_SELECT → (user picks action) → PROCESSING
PROCESSING → (AI returns) → PREVIEW
PREVIEW → (user clicks Replace) → APPLYING
APPLYING → (plugin confirms) → IDLE
PREVIEW → (user clicks Cancel) → IDLE
```

### Pattern 3: Existing AI Assistant Panel Pattern

**What:** Render the Scribe panel as a sibling div to the `#onlyOfficeEditor` div, inside the flex container, following the existing `OnlyOfficeAIAssistantPanel` pattern.
**When to use:** For any panel that needs to appear alongside the editor.

**Current code (`View.jsx` lines 72-75):**
```jsx
<div className="u-flex u-flex-grow-1">
  <div id="onlyOfficeEditor" />
  <OnlyOfficeAIAssistantPanel />
</div>
```

**Scribe integration would be:**
```jsx
<div className="u-flex u-flex-grow-1">
  <div id="onlyOfficeEditor" />
  <OnlyOfficeAIAssistantPanel />
  <ScribePanel />
</div>
```

The flex container handles layout -- the panel takes a fixed width and the editor fills the remaining space.

## Anti-Patterns

### Anti-Pattern 1: Plugin UI Inside OnlyOffice

**What people do:** Build the entire Scribe UI (action menu, preview, editor) as an OnlyOffice plugin panel (`type: "panelRight"`).
**Why it's wrong:**
- No access to cozy-ui components (requires separate bundling into plugin)
- No access to cozy-client auth tokens (plugin runs on OO Document Server origin)
- Cannot share state with Cozy Drive React components
- Plugin HTML/CSS is sandboxed with limited styling control
- Updates require redeploying to the OnlyOffice Document Server, not just Cozy Drive
**Do this instead:** Keep the plugin as a minimal bridge (background type) and build all UI in Cozy Drive.

### Anti-Pattern 2: Polling for Selection

**What people do:** Set up a timer to repeatedly call `GetSelectedText` to detect selection changes.
**Why it's wrong:** Wasteful, laggy, and the `initOnSelectionChanged` config option exists precisely for this purpose.
**Do this instead:** Set `initOnSelectionChanged: true` in config.json. The plugin's `init()` function is called automatically when the selection changes.

### Anti-Pattern 3: Unvalidated postMessage

**What people do:** Accept all postMessage events without checking `event.origin`.
**Why it's wrong:** Any iframe or window on any origin can send postMessage events. Without origin validation, a malicious page could inject text into the document.
**Do this instead:** Always check `event.origin` against the expected Cozy Drive or OnlyOffice Document Server origin before processing messages.

### Anti-Pattern 4: Passing Formatted Text as Plain Text

**What people do:** Extract text with `GetSelectedText` (plain text only), send to AI, then replace -- losing all formatting (bold, italic, links, etc.).
**Why it's wrong:** Users expect formatting to be preserved (or at least not destroyed).
**Do this instead:** For v1, use `InputText` which replaces the selection but preserves surrounding formatting. For formatting-aware operations, use `callCommand` with the Document Builder API to read/write structured content. The `initDataType: "html"` option can also provide HTML-formatted selections, but note that `GetSelectedText` itself only returns plain text.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OnlyOffice Document Server | Script injection (`DocsAPI.DocEditor`), plugin deployment | Plugin files must be served from OO server or a CORS-enabled URL |
| Scribe AI API (backend) | HTTP via cozy-client | Auth handled by Cozy tokens; API contract not yet stabilized |
| Cozy Stack | File metadata via cozy-client queries | Already integrated in `OnlyOfficeProvider` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Cozy Drive <-> OO iframe | DocsAPI events (`onAppReady`, etc.) + postMessage | Already established in `useConfig.jsx` |
| Cozy Drive <-> Scribe Plugin | postMessage (cross-origin) | New boundary; requires protocol definition |
| Scribe Panel <-> Scribe AI API | HTTP (cozy-client fetch) | Same-origin with Cozy Drive |
| Scribe Panel <-> OnlyOffice context | React context (`OnlyOfficeProvider`, `ScribeProvider`) | Same React tree |

## Build Order (Dependencies Between Components)

The components have strict dependency ordering due to the layered communication chain:

### Phase 1: Plugin POC (Critical Path -- Highest Risk)

**Build first because:** The OnlyOffice plugin is the most uncertain component. If the plugin API doesn't work as expected with the deployed OO version, the entire architecture needs rethinking.

**Deliverables:**
1. Minimal plugin (`config.json` + `index.html` + `scribe.js`) deployed to OO server
2. Validate `initOnSelectionChanged` fires on selection
3. Validate `GetSelectedText` returns text
4. Validate `InputText` can replace selection
5. Validate `postMessage` to/from host works (or identify fallback)

**Dependencies:** None -- can start immediately.

### Phase 2: PostMessage Bridge

**Build second because:** The bridge connects the plugin (Phase 1) to the host UI (Phase 3). Without it, the panel cannot receive selection data or send replacement commands.

**Deliverables:**
1. `scribeProtocol.ts` -- message type definitions
2. `useScribePlugin.ts` -- hook that listens for plugin messages and dispatches commands
3. Origin validation logic
4. Debouncing for selection-changed messages

**Dependencies:** Phase 1 (must know message format from working plugin).

### Phase 3: Scribe Panel UI

**Build third because:** The panel depends on the bridge (Phase 2) for receiving text and sending commands. It also depends on confirming the AI API contract.

**Deliverables:**
1. `ScribeProvider.tsx` -- state management context
2. `ScribePanel.tsx` -- panel container with open/close
3. `ScribeActionMenu.tsx` -- action selection UI
4. `ScribePreview.tsx` -- result preview + editing
5. Integration into `View.jsx` (alongside existing `OnlyOfficeAIAssistantPanel`)

**Dependencies:** Phase 2 (bridge must be functional to receive text and send commands).

### Phase 4: AI API Integration

**Build fourth (or parallel with Phase 3 using mocks):** The AI API integration connects the panel to the backend.

**Deliverables:**
1. `useScribeAI.ts` -- hook for AI API calls via cozy-client
2. Streaming or polling for AI response
3. Error handling for API failures

**Dependencies:** AI API contract finalized (external dependency). Can be mocked during Phase 3 development.

### Phase 5: End-to-End Integration

**Build last because:** Requires all previous phases to be functional.

**Deliverables:**
1. Full flow: select text -> choose action -> AI processes -> preview -> replace in document
2. Context menu integration
3. Formatting preservation validation
4. Error recovery (network failure, plugin disconnect, AI API errors)

**Dependencies:** All previous phases.

### Dependency Graph

```
Phase 1 (Plugin POC)
    │
    ▼
Phase 2 (PostMessage Bridge)
    │
    ▼
Phase 3 (Panel UI) ←─── Phase 4 (AI API) [parallel, mock-first]
    │                        │
    ▼                        ▼
Phase 5 (End-to-End Integration)
```

## Scaling Considerations

| Concern | Current Scale | Future Consideration |
|---------|---------------|----------------------|
| Plugin deployment | Manual install on OO server | Automate via Docker config or OO marketplace |
| AI API latency | Acceptable for single requests | Consider streaming for long text; show loading state |
| Multiple documents open | Single editor instance at a time | Scribe state must be per-document; current `OnlyOfficeProvider` already scopes by fileId |
| Scribe as separate app | Panel in Cozy Drive repo | PROJECT.md notes future migration to separate Cozy app -- architecture supports this since communication is already message-based |

## Sources

- [OnlyOffice Plugin Getting Started](https://api.onlyoffice.com/docs/plugin-and-macros/structure/getting-started/) -- HIGH confidence (official docs)
- [OnlyOffice Plugin Configuration](https://api.onlyoffice.com/docs/plugin-and-macros/structure/configuration/) -- HIGH confidence (official docs)
- [OnlyOffice Plugin Coding Guide](https://api.onlyoffice.com/plugin/code) -- HIGH confidence (official docs)
- [OnlyOffice How to Add a Plugin on Right Panel](https://www.onlyoffice.com/blog/2024/10/how-to-add-a-plugin-on-the-right-panel-of-onlyoffice-docs) -- HIGH confidence (official blog)
- [OnlyOffice Windows and Panels](https://api.onlyoffice.com/docs/plugin-and-macros/customization/windows-and-panels/) -- HIGH confidence (official docs)
- [OnlyOffice Automation API](https://api.onlyoffice.com/docs/docs-api/usage-api/automation-api/) -- HIGH confidence (official docs)
- [OnlyOffice Context Menu and Events](https://api.onlyoffice.com/docs/plugin-and-macros/samples/plugin-samples/context-menu-and-events/) -- HIGH confidence (official docs)
- [OnlyOffice AI Agent](https://api.onlyoffice.com/docs/plugin-and-macros/ai/ai-agent/) -- MEDIUM confidence (beta feature, may change)
- [OnlyOffice Community: External Plugin Message](https://community.onlyoffice.com/t/interacting-from-editor-client-side-to-plugin/15734) -- MEDIUM confidence (community forum)
- [OnlyOffice Community: onExternalPluginMessage deprecation](https://community.onlyoffice.com/t/oo-docs-7-2-onexternalpluginmessage-does-not-work/3317/8) -- MEDIUM confidence (community forum)
- [OnlyOffice Community: GetSelectedText HTML format](https://community.onlyoffice.com/t/getselectedtext-html-format-paste-via-context-menu/8733) -- MEDIUM confidence (community forum)
- [MDN: Window.postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) -- HIGH confidence (web standard)
- [OnlyOffice Plugin Translator (archived)](https://github.com/ONLYOFFICE/plugin-translator) -- HIGH confidence (official example)
- [OnlyOffice AI Prompt for Selected Text (Issue #449)](https://github.com/ONLYOFFICE/onlyoffice.github.io/issues/449) -- MEDIUM confidence (GitHub issue)
- Existing codebase: `src/modules/views/OnlyOffice/` -- HIGH confidence (direct code analysis)

---
*Architecture research for: OnlyOffice plugin + cross-iframe AI assistant in Cozy Drive*
*Researched: 2026-02-26*
