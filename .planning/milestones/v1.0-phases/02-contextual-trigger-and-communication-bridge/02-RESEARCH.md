# Phase 2: Contextual Trigger and Communication Bridge - Research

**Researched:** 2026-02-28
**Domain:** Cross-iframe communication (postMessage), OnlyOffice plugin UI, React modal/overlay integration
**Confidence:** HIGH

## Summary

Phase 2 connects the OnlyOffice plugin (built in Phase 1) to Cozy Drive via a bidirectional postMessage bridge called `cozy-bridge`. The plugin needs a contextual floating button that triggers an intent (`AI_TEXT_EDIT`), which sends selected text to Cozy Drive. Cozy Drive opens a placeholder modal, and the user can send commands (replace, insert, cancel) back through the bridge to modify the document.

The technical domain splits into three areas: (1) a floating trigger button in the OO plugin, (2) a standalone `cozy-bridge` SDK implementing an intent-based postMessage protocol with origin validation, and (3) a React modal/overlay in Cozy Drive that receives intents and sends responses. The key constraint is the iframe nesting structure: `Cozy Drive (top) > OO Editor iframe > Plugin iframe`. The plugin must use `window.top.postMessage()` to reach Cozy Drive, and Cozy Drive listens on `window.addEventListener('message', ...)` with origin validation.

**Primary recommendation:** Build cozy-bridge as a standalone ES module in `src/lib/cozy-bridge/` with separate plugin-side and host-side entry points. Use `window.top.postMessage(msg, targetOrigin)` from the plugin and `window.addEventListener('message', handler)` in Cozy Drive. The floating trigger button should be implemented as a DOM element injected by the plugin into its own iframe context (not the editor), positioned near the selection -- or more practically, use a compact fixed-position button within the plugin panel that activates on selection.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Trigger Placement & Behavior
- Floating button that appears below the text selection, immediately on selection (no delay)
- Small icon button (compact, no label) -- e.g. sparkle/wand icon
- Disappears when selection is cleared
- Positioned below the selected text to keep reading flow clear above

#### Intent Protocol (cozy-bridge)
- SDK named `cozy-bridge` -- standalone module, not embedded in Cozy Drive code
- Intent-based protocol inspired by Android intents and Cozy's existing intent system (https://docs.cozy.io/en/cozy-stack/intents/)
- Adapted for OO plugin-in-iframe context (not a direct reuse of cozy-stack intents, but same terminology and concepts)
- Generic intent system from day one -- `AI_TEXT_EDIT` is the first intent, but the protocol supports future intents
- Action verb: `AI_TEXT_EDIT`
- Message structure: Claude decides the exact format, aligned with Cozy/Android conventions
- Plugin initiates: plugin detects selection + button click, casts intent with selected text
- Promise-based API: `castIntent('AI_TEXT_EDIT', { text }) -> Promise<{ action, result }>`
- Acknowledgment: simple success/fail (`{ status: 'ok' }` or `{ status: 'error' }`), no detailed error payloads
- Intent ID for correlation: each intent gets a unique ID, responses are correlated by ID
- cozy-bridge validates message schema (required fields, types, size limits) before routing

#### Security Model
- Origin validation via allowlist: only known origins (Cozy domain, OO server domain) accepted
- Origin determined by iframe URL, not by message payload
- Messages from unrecognized origins: ignored silently + console warning logged
- No token/nonce exchange for Phase 2 -- origin check is sufficient

#### Cozy Drive Integration
- cozy-bridge lives as a dedicated service/module (e.g. `src/services/cozy-bridge/`), initialized at editor page load
- Decoupled from the OnlyOffice viewer component
- When intent `AI_TEXT_EDIT` is received: Cozy Drive opens a centered modal/overlay
- Modal placeholder content: displays the selected text received from plugin + Replace/Insert/Cancel buttons
- Full round-trip validated in Phase 2: buttons send commands back via cozy-bridge, plugin receives and modifies document (replace/insert text as-is, no transformation)
- Cancel closes modal without document modification

### Claude's Discretion
- Exact message format structure (aligned with Cozy/Android intent conventions)
- Whether to integrate with or build alongside existing Cozy postMessage mechanisms (evaluate during research)
- Icon choice for the floating trigger button
- Exact positioning logic for the floating button within OO editor constraints
- Modal styling and layout details

### Deferred Ideas (OUT OF SCOPE)
- Intent capability directory in cozy-stack: services declare intents they call, capabilities they expose, stack maintains an annuaire -- belongs in a cozy-bridge generalization project
- Nonce/token handshake authentication for inter-service trust -- future security hardening
- Multiple capabilities per intent with user choice (like Android's app chooser) -- future cozy-bridge feature
- Promise wrapper as syntactic sugar over postMessage -- could be added to cozy-bridge later if many intents exist
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLUG-06 | Un bouton contextuel "Scribe" apparait quand du texte est selectionne | Floating button implementation strategy (see Architecture Pattern 1), OO plugin type "background" with window API for overlay, or fixed-position button within panel |
| COMM-01 | Le plugin OnlyOffice communique avec Cozy Drive via postMessage | cozy-bridge SDK design (see Architecture Pattern 2), `window.top.postMessage()` from plugin, origin validation, intent-based message protocol |
| COMM-02 | Cozy Drive gere l'ouverture/fermeture de l'interface Scribe | React modal in Cozy Drive triggered by intent receipt (see Architecture Pattern 3), integration with OnlyOffice View component |
| COMM-03 | L'interface Scribe recoit le texte selectionne depuis le plugin | Intent payload carries selected text, cozy-bridge routes `AI_TEXT_EDIT` intent data to modal component |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.2.0 | Cozy Drive UI framework | Already in project, all UI must use React |
| cozy-ui | ^135.8.0 | Dialog, Button, Typography components | Project's design system; ConfirmDialog pattern used in existing modals |
| cozy-client | ^60.20.0 | Cozy stack communication | Already in project, provides `useClient()` for instance URI |
| OnlyOffice Plugin SDK | plugins.js (CDN) | Plugin API (executeMethod, callCommand, events) | Already loaded in Phase 1 plugin |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cozy-ui/CozyDialogs | ^135.8.0 | ConfirmDialog for Scribe modal | Existing pattern in FileDeletedModal, FileDivergedModal |
| crypto.randomUUID() | Web API | Generate intent correlation IDs | Built into browsers, no library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom postMessage protocol | cozy-interapp/cozy-intent | cozy-interapp is designed for cozy-stack intents (server-mediated), NOT for cross-iframe postMessage between OO plugin and Cozy Drive. Different use case -- build alongside, not integrate with |
| ConfirmDialog (cozy-ui) | Custom React portal overlay | ConfirmDialog matches existing patterns; custom portal adds complexity without benefit |
| crypto.randomUUID() | uuid library | No dependency needed; browser API sufficient for correlation IDs |

**Installation:**
No new npm packages needed. All dependencies already exist in the project.

## Architecture Patterns

### Recommended Project Structure
```
plugins/onlyoffice-scribe/
  config.json              # Updated: type "background" + events
  index.html               # Updated: minimal (no visible panel needed)
  scripts/
    code.js                # Updated: floating button, intent casting via postMessage

src/lib/cozy-bridge/
  index.js                 # Main entry: CozyBridge class
  protocol.js              # Message format constants, validators
  types.js                 # TypeScript-style JSDoc types for intent messages

src/modules/views/OnlyOffice/
  View.jsx                 # Updated: initialize cozy-bridge, render ScribeModal
  ScribeModal.jsx          # NEW: placeholder modal for AI_TEXT_EDIT intent
  useCozyBridge.js         # NEW: React hook wrapping cozy-bridge lifecycle
```

### Pattern 1: Floating Trigger Button in OO Plugin

**What:** A contextual button that appears when text is selected in the OO editor.

**Architecture challenge:** The plugin runs inside its own iframe, nested inside the OO editor iframe. The plugin CANNOT inject DOM elements into the editor's document area. There are three viable approaches:

**Option A: Context menu item (already implemented in Phase 1)**
- Already working: right-click shows "Scribe - AI Assistant"
- Limitation: requires right-click, not as discoverable as a floating button

**Option B: OO InputHelper API (cursor-positioned popup)**
- `window.Asc.plugin.createInputHelper()` + `ShowInputHelper` method
- Designed for autocomplete-style dropdowns tied to cursor position
- Appears near cursor/selection automatically
- Limitation: designed for text input suggestions, not buttons; visual style may not match

**Option C (RECOMMENDED): Change plugin type to "background" + use ShowWindow for a floating overlay**
- Set plugin `type: "background"` so it runs without a panel
- Keep `initOnSelectionChanged: true` to detect selections
- When selection detected, use `window.Asc.plugin.executeMethod("ShowWindow", ...)` to display a small custom window with the Scribe button
- The window appears as a floating overlay within the editor
- When selection cleared, close the window

**Recommendation:** Use Option C (background plugin + ShowWindow) for the floating button. This gives us a proper overlay window that can contain a button icon, positioned by the OO framework. The context menu (Option A) remains as a secondary trigger path.

**Important consideration about "below selection" positioning:** The OO plugin window API does NOT support arbitrary positioning relative to text selection. The window appears as a modal/overlay managed by OO's framework. For a truly floating button below the selection, we would need to use the InputHelper approach or inject DOM elements at the editor level -- both have limitations. A pragmatic approach: use a small OO plugin window that appears as a floating toolbar-like element when selection is active. The user decision says "below the text selection" -- this may need to be adapted to "visible overlay triggered by selection" given OO's API constraints. Flag this to the planner as a constraint.

**When to use:** Always -- this is the primary trigger for Scribe.

### Pattern 2: cozy-bridge Intent Protocol

**What:** A standalone message protocol module implementing intent-based communication over postMessage.

**Design aligned with Cozy intent conventions:**

The Cozy stack intent system uses: action (verb), type (data type), data (payload), and a lifecycle of create -> resolve -> ready -> data -> completed/error. Our protocol adapts this for direct postMessage (no server mediation):

```javascript
// Intent message format (plugin -> Cozy Drive)
{
  type: 'cozy-bridge:intent',        // Message namespace
  version: 1,                         // Protocol version
  intentId: 'uuid-here',             // Correlation ID
  action: 'AI_TEXT_EDIT',            // Intent action verb
  source: 'onlyoffice-plugin',      // Sender identity
  data: {                             // Intent payload
    text: 'selected text here'
  }
}

// Response message format (Cozy Drive -> plugin)
{
  type: 'cozy-bridge:response',      // Response namespace
  version: 1,
  intentId: 'uuid-here',            // Correlation (same ID)
  status: 'ok',                      // 'ok' or 'error'
  action: 'replace',                 // What to do: 'replace', 'insert', 'cancel'
  data: {                            // Response payload
    text: 'modified text here'       // Text to apply (for replace/insert)
  }
}
```

**Plugin-side API:**
```javascript
// In plugin code.js - casting an intent
function castIntent(action, data) {
  var intentId = generateId();
  var message = {
    type: 'cozy-bridge:intent',
    version: 1,
    intentId: intentId,
    action: action,
    source: 'onlyoffice-plugin',
    data: data
  };
  window.top.postMessage(message, cozyOrigin);
  // Store pending intent for response correlation
  pendingIntents[intentId] = { resolve: null, reject: null };
  return new Promise(function(resolve, reject) {
    pendingIntents[intentId].resolve = resolve;
    pendingIntents[intentId].reject = reject;
  });
}
```

**Host-side API (Cozy Drive):**
```javascript
// In src/lib/cozy-bridge/index.js
class CozyBridge {
  constructor(allowedOrigins) {
    this.allowedOrigins = allowedOrigins;
    this.handlers = new Map();
    this._listener = this._onMessage.bind(this);
    window.addEventListener('message', this._listener);
  }

  onIntent(action, handler) {
    this.handlers.set(action, handler);
  }

  _onMessage(event) {
    if (!this.allowedOrigins.includes(event.origin)) {
      console.warn('[cozy-bridge] Ignored message from unknown origin:', event.origin);
      return;
    }
    const msg = event.data;
    if (!msg || msg.type !== 'cozy-bridge:intent' || msg.version !== 1) return;
    if (!this._validateSchema(msg)) return;

    const handler = this.handlers.get(msg.action);
    if (handler) {
      handler(msg, (response) => {
        event.source.postMessage({
          type: 'cozy-bridge:response',
          version: 1,
          intentId: msg.intentId,
          ...response
        }, event.origin);
      });
    }
  }

  _validateSchema(msg) {
    return msg.intentId && msg.action && msg.source && typeof msg.data === 'object';
  }

  destroy() {
    window.removeEventListener('message', this._listener);
  }
}
```

**When to use:** All plugin-to-host and host-to-plugin communication.

### Pattern 3: React Modal in Cozy Drive

**What:** A centered overlay/modal that displays when `AI_TEXT_EDIT` intent is received.

**Using existing pattern from FileDeletedModal / FileDivergedModal:**

```jsx
// ScribeModal.jsx
import React from 'react'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import Typography from 'cozy-ui/transpiled/react/Typography'

const ScribeModal = ({ open, selectedText, onReplace, onInsert, onCancel }) => {
  if (!open) return null

  return (
    <ConfirmDialog
      open={open}
      onClose={onCancel}
      title="Scribe"
      content={
        <Typography style={{ whiteSpace: 'pre-wrap' }}>
          {selectedText}
        </Typography>
      }
      actions={
        <>
          <Buttons variant="secondary" label="Cancel" onClick={onCancel} />
          <Buttons variant="secondary" label="Insert After" onClick={() => onInsert(selectedText)} />
          <Buttons label="Replace" onClick={() => onReplace(selectedText)} />
        </>
      }
    />
  )
}
```

**Integration point:** The ScribeModal is rendered inside the `View.jsx` component (alongside `OnlyOfficeAIAssistantPanel`), controlled by state from `useCozyBridge` hook.

**When to use:** Displaying received intent data and collecting user action choice.

### Anti-Patterns to Avoid

- **Direct DOM injection into OO editor:** The plugin cannot access the editor's DOM; it lives in a separate iframe. Never try to `document.createElement` in the editor frame from plugin code.
- **Using `window.parent.postMessage()`:** This sends to the OO editor iframe, NOT to Cozy Drive. Always use `window.top.postMessage()`.
- **Using `'*'` as targetOrigin in production:** Always specify the exact expected origin for security.
- **Reusing cozy-interapp for this:** cozy-interapp is for cozy-stack mediated intents (server creates intent, apps resolve via stack API). Our use case is direct cross-iframe messaging -- different mechanism, same terminology.
- **Blocking on promise in plugin code.js:** The plugin runs in ES5-compatible OO sandbox. Use callback-based Promise polyfill pattern or simple callback approach for async operations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom random ID function | `crypto.randomUUID()` or simple counter+timestamp | Browser API is cryptographically random |
| Modal/Dialog UI | Custom positioned overlay | `ConfirmDialog` from cozy-ui | Consistent with Cozy design system, handles backdrop, close, accessibility |
| Message event listener management | Raw addEventListener/removeEventListener | CozyBridge class with `destroy()` | Prevents memory leaks, centralizes origin validation |
| Origin URL parsing | String matching on origins | `new URL(origin).origin` comparison | Handles edge cases (trailing slashes, ports) |

**Key insight:** The postMessage protocol is simple enough to hand-roll (it's just JSON messages with a namespace), but the lifecycle management (listener cleanup, pending intent timeout, schema validation) warrants a small module.

## Common Pitfalls

### Pitfall 1: window.top Access Blocked by X-Frame-Options
**What goes wrong:** If the OO editor sets `X-Frame-Options: DENY` or a restrictive CSP, `window.top.postMessage()` may be blocked.
**Why it happens:** The plugin iframe is cross-origin to the Cozy Drive top-level page.
**How to avoid:** `postMessage()` itself is NOT blocked by same-origin policy -- it is the designed mechanism for cross-origin communication. However, accessing `window.top` properties (other than `postMessage`) IS blocked. Only use `window.top.postMessage()`, never try to read `window.top.location` or other properties.
**Warning signs:** `SecurityError: Blocked a frame` in console -- but this should not occur for postMessage calls.

### Pitfall 2: Origin Mismatch in Local Dev vs Production
**What goes wrong:** Origin validation rejects messages because local dev uses `http://localhost` while production uses `https://instance.cozy.cloud`.
**Why it happens:** The allowed origins list is hardcoded or misconfigured.
**How to avoid:** Make allowed origins configurable. In dev, allow `http://localhost` (any port). In production, derive from the Cozy instance URL and the OO server URL (available from the config endpoint response).
**Warning signs:** Messages silently dropped with console warning.

### Pitfall 3: Plugin Type Change Breaks Selection Detection
**What goes wrong:** Changing plugin type from "panel" to "background" may affect how `initOnSelectionChanged` works.
**Why it happens:** The `initOnSelectionChanged` + `initDataType: "text"` combination was tested with type "panel" in Phase 1. Background plugins may behave differently.
**How to avoid:** Test selection detection with the new plugin type immediately. If background type breaks `initOnSelectionChanged`, keep type "panel" but use a minimal/hidden panel UI.
**Warning signs:** `init()` stops being called when text is selected.

### Pitfall 4: postMessage Listener Not Cleaned Up
**What goes wrong:** Multiple message listeners accumulate when navigating away and back to the editor page, causing duplicate intent handling.
**Why it happens:** React component mounts, adds listener, unmounts without removing, remounts.
**How to avoid:** Use `useEffect` cleanup to call `bridge.destroy()`. The `useCozyBridge` hook must return a cleanup function.
**Warning signs:** Modal opens multiple times for a single intent, or stale handlers fire.

### Pitfall 5: Intent Response Not Reaching Plugin
**What goes wrong:** Cozy Drive sends response via `event.source.postMessage()` but the plugin never receives it.
**Why it happens:** `event.source` may be null if the plugin iframe was destroyed/recreated, or the plugin does not have a message listener.
**How to avoid:** The plugin must also set up a `window.addEventListener('message', ...)` listener to receive responses. `event.source` is the `Window` object of the sender -- verify it's not null before responding.
**Warning signs:** Promise never resolves on the plugin side; modal closes but document is not modified.

### Pitfall 6: Plugin ES5 Sandbox Constraints
**What goes wrong:** Using ES6+ features (arrow functions, const/let, template literals, async/await, Promise) in `code.js` causes syntax errors.
**Why it happens:** The OO plugin sandbox may enforce ES5 strict mode depending on the execution context (`callCommand` is definitely ES5-only; the plugin iframe context may support ES6 in modern OO versions).
**How to avoid:** Phase 1 code.js already uses ES5 (var, function declarations). Continue this pattern. For Promise-based castIntent API, use a simple callback pattern or verify that the plugin iframe supports Promises (OO 9.3.0 should support ES6 in the plugin iframe, but callCommand remains ES5-only).
**Warning signs:** `Unexpected token` errors in console.

## Code Examples

Verified patterns from official sources and existing codebase:

### postMessage From Plugin to Cozy Drive (Cross-Origin)
```javascript
// Source: MDN Web Docs (https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
// + OO community forum confirmation of window.top pattern

// In plugin code.js (inside plugin iframe)
// cozyOrigin should be the Cozy Drive origin, e.g. "https://drive.cozy.localhost"
var cozyOrigin = "*"; // TODO: restrict in production

window.top.postMessage({
  type: "cozy-bridge:intent",
  version: 1,
  intentId: "unique-id",
  action: "AI_TEXT_EDIT",
  source: "onlyoffice-plugin",
  data: { text: selectedText }
}, cozyOrigin);
```

### Listening for Messages in Cozy Drive (React Hook Pattern)
```javascript
// Source: Existing Cozy Drive patterns (useEffect + event listener)

import { useEffect, useState, useCallback, useRef } from 'react'

const useCozyBridge = (allowedOrigins) => {
  const [pendingIntent, setPendingIntent] = useState(null)
  const sourceRef = useRef(null)
  const originRef = useRef(null)

  const handleMessage = useCallback((event) => {
    if (!allowedOrigins.includes(event.origin)) {
      console.warn('[cozy-bridge] Unknown origin:', event.origin)
      return
    }
    const msg = event.data
    if (!msg || msg.type !== 'cozy-bridge:intent' || msg.version !== 1) return
    if (!msg.intentId || !msg.action || !msg.data) return

    sourceRef.current = event.source
    originRef.current = event.origin
    setPendingIntent(msg)
  }, [allowedOrigins])

  const respond = useCallback((response) => {
    if (sourceRef.current && originRef.current) {
      sourceRef.current.postMessage({
        type: 'cozy-bridge:response',
        version: 1,
        intentId: pendingIntent?.intentId,
        ...response
      }, originRef.current)
    }
    setPendingIntent(null)
  }, [pendingIntent])

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  return { pendingIntent, respond }
}
```

### Responding to Intent From Cozy Drive Modal
```javascript
// Source: Derived from Cozy Drive ConfirmDialog pattern (FileDeletedModal.jsx)

const ScribeModal = ({ intent, onRespond }) => {
  const handleReplace = () => {
    onRespond({ status: 'ok', action: 'replace', data: { text: intent.data.text } })
  }
  const handleInsert = () => {
    onRespond({ status: 'ok', action: 'insert', data: { text: intent.data.text } })
  }
  const handleCancel = () => {
    onRespond({ status: 'ok', action: 'cancel', data: {} })
  }
  // ... render ConfirmDialog with these handlers
}
```

### Plugin-Side Response Handler
```javascript
// Source: MDN postMessage docs + Phase 1 plugin patterns

// In plugin code.js
var pendingIntents = {};

window.addEventListener("message", function(event) {
  // TODO: validate event.origin against known Cozy Drive origin
  var msg = event.data;
  if (!msg || msg.type !== "cozy-bridge:response" || msg.version !== 1) return;

  var pending = pendingIntents[msg.intentId];
  if (!pending) return;

  delete pendingIntents[msg.intentId];

  if (msg.status === "ok") {
    if (msg.action === "replace") {
      // Use PasteText to replace selection
      window.Asc.plugin.executeMethod("PasteText", [msg.data.text]);
    } else if (msg.action === "insert") {
      // Use InsertContent to insert after selection (Phase 1 pattern)
      insertAfterWithText(msg.data.text);
    }
    // "cancel" - do nothing
  }
  log("Intent response: " + msg.action + " / " + msg.status);
});
```

### OO Plugin Background + ShowWindow Pattern
```javascript
// Source: OO API docs (https://api.onlyoffice.com/docs/plugin-and-macros/customization/windows-and-panels/)

// Show a small floating window when selection is active
function showScribeButton() {
  var windowSettings = {
    url: "scribe-button.html",   // Minimal HTML with just the button icon
    type: "window",
    size: [48, 48],              // Small window for icon button
    isCustomWindow: true         // No standard borders
  };
  var newWindow = new window.Asc.PluginWindow();
  newWindow.show(windowSettings);
}

// Alternative: use executeMethod
window.Asc.plugin.executeMethod("ShowWindow", [frameId, windowSettings]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| cozy-interapp for all inter-app comms | cozy-intent + cozy-interapp (different use cases) | cozy-intent ^2.30.1 | cozy-intent handles flagship/webview, cozy-interapp handles stack intents; neither handles our OO plugin case |
| Plugin type "panel" for always-visible UI | Plugin type "background"/"unvisible" for conditional UI | OO 8.x | Background plugins can show windows on demand via ShowWindow API |
| Manual DOM overlay for floating elements | OO Plugin Window API (ShowWindow, PluginWindow) | OO 8.1+ | OO manages window lifecycle and positioning |

**Deprecated/outdated:**
- The old `plugin.button` handler approach: still works but modern plugins prefer event-based (context menu, toolbar) triggers
- `type: "panelRight"` for test panel: useful in Phase 1 POC, should switch to `type: "background"` for Phase 2 production behavior

## Open Questions

1. **Floating button positioning below selection**
   - What we know: OO Plugin Window API can show floating windows, but positioning is controlled by OO framework, not by the plugin. InputHelper positions at cursor but is designed for autocomplete.
   - What's unclear: Whether ShowWindow/PluginWindow supports positioning relative to text selection coordinates. The user decision says "below the text selection" but OO may not expose selection coordinates to plugins.
   - Recommendation: Start with a centered small floating window that appears/disappears with selection. If OO's PluginWindow doesn't support positioning, fall back to a fixed-position trigger (e.g., small floating action button in corner of editor, or keep context menu as primary trigger). Flag to user if "below selection" is not achievable with OO API.

2. **Plugin type change impact on initOnSelectionChanged**
   - What we know: Phase 1 used `type: "panel"` with `initOnSelectionChanged: true` and it worked.
   - What's unclear: Whether `type: "background"` preserves `initOnSelectionChanged` behavior.
   - Recommendation: Test this immediately in first task. If it breaks, keep `type: "panel"` but make the panel minimal/hidden.

3. **OO server origin for validation**
   - What we know: The OO server URL is returned by `/office/:fileId/open` API call and stored in `config.serverUrl`. In local dev it's `http://localhost`.
   - What's unclear: The exact origin of postMessage events from the plugin iframe (is it the OO server origin, or the sdkjs CDN origin?).
   - Recommendation: During development, log `event.origin` for all received messages to determine the actual origins involved. Build allowlist from observed origins.

4. **event.source reliability for response routing**
   - What we know: `event.source` in the message event gives the Window object of the sender, which can be used to postMessage back.
   - What's unclear: Whether `event.source` remains valid after the plugin iframe navigates or is recreated by OO.
   - Recommendation: Store `event.source` when intent is received, use it to respond. If it becomes null, log error and close modal.

## Sources

### Primary (HIGH confidence)
- MDN Web Docs - postMessage API: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage - Core postMessage mechanics, security model, targetOrigin
- OO Plugin Types: https://api.onlyoffice.com/docs/plugin-and-macros/structure/configuration/types/ - Plugin type options (background, panel, window, unvisible)
- OO Windows and Panels: https://api.onlyoffice.com/docs/plugin-and-macros/customization/windows-and-panels/ - ShowWindow, PluginWindow, SendToWindow APIs
- OO Context Menu: https://api.onlyoffice.com/docs/plugin-and-macros/customization/context-menu/ - AddContextMenuItem, ContextMenuType, click handlers
- OO InputHelper: https://api.onlyoffice.com/docs/plugin-and-macros/customization/input-helper/ - createInputHelper, ShowInputHelper, cursor-positioned UI
- OO Toolbar: https://api.onlyoffice.com/docs/plugin-and-macros/customization/toolbar/ - AddToolbarMenuItem for custom toolbar buttons
- Cozy intents documentation: https://docs.cozy.io/en/cozy-stack/intents/ - Intent model (action, type, data, lifecycle)
- Existing Cozy Drive codebase: `src/modules/views/OnlyOffice/` - Editor, View, OnlyOfficeProvider, FileDeletedModal patterns
- Phase 1 plugin code: `plugins/onlyoffice-scribe/scripts/code.js` - Working postMessage to window.top, selection detection, replace/insert patterns

### Secondary (MEDIUM confidence)
- OO Community Forum: https://community.onlyoffice.com/t/how-to-send-message-from-the-plugin-to-react-app-using-iframe/14454/ - Confirmed window.top.postMessage pattern for cross-iframe
- OO AI Plugin Blog: https://www.onlyoffice.com/blog/2025/12/how-to-add-custom-features-to-the-onlyoffice-ai-plugin - Plugin architecture patterns

### Tertiary (LOW confidence)
- OO PluginWindow positioning: No documentation found on custom positioning; assumed to be framework-managed. Needs validation during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified against existing codebase (React 18, cozy-ui, OO Plugin SDK)
- Architecture (cozy-bridge protocol): HIGH - postMessage is well-documented standard, Cozy intent model documented
- Architecture (floating button): MEDIUM - OO Plugin Window API exists but positioning constraints unclear
- Pitfalls: HIGH - derived from Phase 1 experience and cross-origin communication standards

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (30 days -- stable technologies, no fast-moving APIs)
