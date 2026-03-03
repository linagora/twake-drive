# Phase 5: Bouton Scribe flottant ancre a la selection - Research

**Researched:** 2026-03-01
**Domain:** Cross-iframe floating UI positioning, OnlyOffice plugin coordinate extraction, postMessage protocol extension
**Confidence:** MEDIUM (OO plugin API has no viewport coordinate method -- approach requires workaround validated via POC)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Floating button appears near the text selection (above or below -- Claude's discretion based on available space)
- Button content: icon + "Scribe" label for discoverability (sparkle/magic icon)
- Visual style: pill-shaped with subtle elevation/shadow, stands out above editor content
- Appears with a smooth fade-in transition (~150-200ms)
- Button appears after a short stabilization delay (~300ms after selection settles) to avoid flicker during drag-selection
- Button disappears when the selection is lost (user clicks elsewhere or selection collapses)
- Keyboard-driven selections (Shift+Arrow) should also trigger the button if the OO plugin API supports it
- On document scroll: button disappears (reappears on next selection) -- simpler, avoids cross-iframe coordinate tracking jitter
- Scribe popover opens anchored to the floating button position (near the selection), not fixed at viewport center
- Floating button disappears when popover opens -- popover replaces it as the active UI element
- Smart overflow handling: if not enough space below, flip above (standard dropdown collision detection)
- Clicking outside the popover dismisses it (standard popover behavior -- matches current MUI Popover defaults)
- Keep the OO context menu "Scribe" entry as an alternative trigger -- power users may prefer right-click
- Remove the side panel button -- it's no longer needed as the primary trigger
- Plugin still handles document modification (Replace/Insert) via existing postMessage response flow -- proven pattern, no change needed
- New message type for selection coordinates (separate from AI_TEXT_EDIT intent) -- clean separation between positioning data and action triggers
- Plugin sends selection viewport coordinates when selection changes/stabilizes
- Cozy Drive converts iframe-relative coordinates to host page coordinates for button positioning

### Claude's Discretion
- Exact coordinate calculation method within the OO plugin (DOM API, OO plugin API, or hybrid)
- Iframe-to-host coordinate conversion approach
- Exact button dimensions and spacing from selection
- Debounce/throttle strategy for selection change events
- Whether to use a React portal or absolute-positioned div for the floating button
- Z-index management above the OO iframe

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-FLOAT-01 | Le plugin detecte la position (coordonnees viewport) de la selection de texte et l'envoie via postMessage en plus du texte selectionne | See "Selection Coordinate Extraction Strategy" -- OO plugin API has NO native method for viewport coordinates; the plugin must use mouseup event capture or OO's internal cursor DOM element as workaround |
| UI-FLOAT-02 | Cozy Drive recoit les coordonnees et affiche un bouton flottant "Scribe" positionne au-dessus de l'iframe OO, a proximite de la selection (conversion repere iframe -> page hote) | See "Iframe-to-Host Coordinate Conversion" and "Floating Button Rendering" -- use iframe.getBoundingClientRect() + relative coordinates from plugin |
| COMM-04 | Nouveau type de message pour les coordonnees de la selection (separe de l'intent AI_TEXT_EDIT) -- separation propre entre donnees de positionnement et declencheurs d'action | See "Protocol Extension" -- new `SELECTION_POSITION` message type with {top, left, width, height, text} data alongside existing intent messages |
</phase_requirements>

## Summary

This phase replaces the side panel trigger with a floating "Scribe" button that appears near the user's text selection in the OnlyOffice editor. The core technical challenge is **cross-iframe coordinate extraction**: OnlyOffice renders documents on an HTML5 Canvas element, which means `window.getSelection()` and `Range.getBoundingClientRect()` are NOT available inside the editor. The OnlyOffice plugin API provides NO method to get viewport coordinates of the current selection -- confirmed via official docs (`onTargetPositionChanged` fires with no parameters, `GetSelectedText` returns text only, and the community response from OO team states "we do not have methods that would allow to return current paragraph index nor character number").

The recommended approach uses **mouse event capture** inside the OO plugin iframe: listen for `mouseup` events on the plugin's parent `document` (the OO editor frame), capture `event.clientX/clientY`, and send these coordinates to Cozy Drive via a new `SELECTION_POSITION` postMessage type. Cozy Drive then converts these iframe-relative coordinates to host-page absolute coordinates using `iframe.getBoundingClientRect()` and renders a floating button using a React portal with absolute positioning. The existing `ScribePopover` is updated to use dynamic `anchorPosition` from these coordinates instead of the current hardcoded viewport center.

**Primary recommendation:** Use mouseup event coordinates from the OO editor iframe as the primary positioning mechanism. This is the most reliable cross-iframe coordinate strategy when the inner content is canvas-rendered and DOM selection APIs are unavailable.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (existing) | 18.x | Floating button component + state management | Already in project |
| cozy-ui Popover (MUI) | existing | Popover positioning with anchorPosition | Already used by ScribePopover, RightClickFileMenu |
| postMessage API | Web standard | Cross-iframe coordinate communication | Already the project's established pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React Portal | Built-in | Render floating button outside normal DOM tree | To overlay button above OO iframe without z-index issues |
| requestAnimationFrame | Web standard | Smooth coordinate updates and debouncing | For throttling selection change → position updates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| mouseup event coords | OO InputHelper API (`getInputHelper().show()`) | InputHelper is OO-internal UI, cannot be styled or positioned by Cozy Drive -- rejected |
| mouseup event coords | DOM inspection of OO cursor element (e.g., cursor div inside iframe) | Cross-origin iframe access blocked; fragile internal API dependency -- rejected |
| mouseup event coords | `onContextMenuShow` options with coordinates | options only contains `type` field, no coordinates -- not viable |
| Absolute positioning | Floating UI library (`@floating-ui/dom`) | Adds dependency; MUI Popover already supports anchorPosition with overflow detection -- unnecessary |

**Installation:**
No new dependencies needed. All functionality uses existing project libraries and Web APIs.

## Architecture Patterns

### Recommended Project Structure
```
plugins/onlyoffice-scribe/scripts/
  code.js                         # Extended: add mouseup listener + SELECTION_POSITION messages

src/lib/cozy-bridge/
  protocol.js                     # Extended: add SELECTION_POSITION message type + validator
  index.js                        # Extended: handle SELECTION_POSITION messages in CozyBridge

src/modules/views/OnlyOffice/
  useCozyBridge.js                # Extended: track selectionPosition state alongside pendingIntent
  View.jsx                        # Extended: render ScribeFloatingButton, pass coords to ScribePopover

src/modules/views/OnlyOffice/Scribe/
  ScribeFloatingButton.jsx        # NEW: pill-shaped floating button component
  ScribePopover.jsx               # Modified: accept dynamic anchorPosition instead of hardcoded center
  scribe.styl                     # Extended: floating button styles
```

### Pattern 1: Mouse Event Coordinate Capture (Plugin Side)
**What:** Capture `mouseup` event coordinates inside the OO editor iframe and post them to the host via postMessage
**When to use:** When the inner iframe renders on canvas and standard selection APIs are unavailable
**Confidence:** HIGH -- standard DOM event, works regardless of canvas rendering

```javascript
// In plugin code.js -- inside the OO editor iframe
// The plugin's init() fires on selection change, but has no coordinates.
// We capture mouseup on the EDITOR frame's document (not the plugin iframe).
// The plugin iframe is nested inside the OO editor iframe.

// CRITICAL: The plugin iframe does NOT have direct access to the OO editor's
// top-level document due to same-origin policy. However, the plugin runs inside
// the OO iframe domain. We need to capture mouseup in the plugin's own context
// and rely on the fact that OO propagates the event or use an alternative.

// APPROACH A: Capture mouseup on the plugin's own window
// The plugin iframe receives mouse events when the user interacts with its panel.
// But for the EDITOR canvas area, mouse events fire on the OO editor's document,
// not the plugin iframe.

// APPROACH B (RECOMMENDED): Use onTargetPositionChanged as a TRIGGER only,
// then estimate position using the last known mouse position from the host page.
// The HOST PAGE (Cozy Drive) can listen for mousemove/mouseup on the OO iframe
// element and track the mouse position relative to the iframe.

// APPROACH C (SIMPLEST): Send selection coordinates as the CENTER of the OO
// iframe visible area, plus an offset based on approximate line position.
// This is a fallback if mouse tracking proves unreliable.
```

### Pattern 2: Host-Side Mouse Tracking on OO Iframe
**What:** Cozy Drive listens for `mousemove`/`mouseup` events on the OO iframe element to track mouse position
**When to use:** When the plugin cannot provide coordinates but the host needs to position UI near the selection
**Confidence:** MEDIUM -- mouse events on iframe elements fire for the iframe boundary, not for canvas interactions inside

**IMPORTANT LIMITATION:** Mouse events on an `<iframe>` element in the host page do NOT fire when the mouse is over the iframe content. The iframe captures all mouse events. This means the host CANNOT track mouse position while the user interacts with the editor.

**WORKAROUND:** The plugin CAN listen for `mouseup` on its own `document` or `window` -- but the plugin iframe is a SEPARATE iframe from the editor canvas. The frame hierarchy is:
```
Cozy Stack (window.top)
  > Cozy Drive iframe
    > OO Editor iframe (name="frameEditor")
      > Editor Canvas (renders the document)
      > Plugin iframe (runs plugin code.js)
```

The plugin iframe and the editor canvas share the same origin (OO Document Server). This means the plugin CAN access `window.parent.document` (the OO editor's document) to attach event listeners!

### Pattern 3: Plugin Accesses Parent Editor Document (KEY INSIGHT)
**What:** The plugin iframe and OO editor iframe share the same origin, so the plugin can attach event listeners on `window.parent.document` to capture mouseup coordinates on the editor canvas
**When to use:** When you need viewport coordinates from the editor area
**Confidence:** MEDIUM -- depends on same-origin between plugin iframe and editor iframe (confirmed for self-hosted OO Docker setup)

```javascript
// In plugin code.js
// The plugin runs inside an iframe within the OO editor iframe.
// Same origin means we can access window.parent.document.

var lastMousePosition = { x: 0, y: 0 };

// Attach mouseup listener to the OO editor document (parent of plugin iframe)
try {
  window.parent.document.addEventListener("mouseup", function(e) {
    lastMousePosition.x = e.clientX;
    lastMousePosition.y = e.clientY;
  });
} catch (err) {
  // Cross-origin fallback: cannot access parent document
  log("Cannot access parent document for mouse tracking: " + err.message);
}

// When init() fires (selection changed), use lastMousePosition
window.Asc.plugin.init = function(data) {
  var text = (data || "").replace(/^\s+|\s+$/g, "");
  if (text.length > 0) {
    postToAncestors({
      type: "cozy-bridge:selection-position",
      version: 1,
      source: "onlyoffice-plugin",
      data: {
        text: text,
        // Coordinates relative to the OO editor iframe viewport
        top: lastMousePosition.y,
        left: lastMousePosition.x
      }
    });
  }
};
```

### Pattern 4: Iframe-to-Host Coordinate Conversion (Host Side)
**What:** Convert iframe-relative coordinates to host-page absolute coordinates
**When to use:** Always -- the coordinates from the plugin are relative to the OO iframe viewport, but the floating button renders in Cozy Drive's DOM
**Confidence:** HIGH -- standard getBoundingClientRect() calculation

```javascript
// In Cozy Drive (View.jsx or useCozyBridge.js)
function convertIframeToHostCoords(iframeRelativeCoords) {
  const iframe = document.getElementsByName('frameEditor')[0]
  if (!iframe) return null

  const iframeRect = iframe.getBoundingClientRect()

  return {
    top: iframeRect.top + iframeRelativeCoords.top,
    left: iframeRect.left + iframeRelativeCoords.left
  }
}
```

### Pattern 5: React Portal for Floating Button
**What:** Render the floating button via a React portal attached to document.body
**When to use:** When the button must visually overlay the OO iframe without being clipped by parent containers
**Confidence:** HIGH -- standard React pattern for overlays

```jsx
// ScribeFloatingButton.jsx
import { createPortal } from 'react-dom'

const ScribeFloatingButton = ({ position, onTrigger, visible }) => {
  if (!visible || !position) return null

  return createPortal(
    <button
      style={{
        position: 'fixed',
        top: position.top - BUTTON_HEIGHT - OFFSET,
        left: position.left,
        zIndex: 9999,
        // pill shape, shadow, fade-in transition
      }}
      onClick={onTrigger}
    >
      <SparkleIcon /> Scribe
    </button>,
    document.body
  )
}
```

### Anti-Patterns to Avoid
- **Using `window.getSelection()` in the OO plugin:** OO uses canvas rendering; `window.getSelection()` returns nothing useful inside the editor.
- **Polling for mouse position:** Wasteful; use event-driven mouseup capture instead.
- **Accessing OO internal DOM elements (cursor div, selection overlay):** These are internal implementation details that change across OO versions. Fragile and not documented.
- **Trying to inject CSS/DOM into the OO editor iframe from the host:** Cross-origin restriction prevents this (OO iframe is on a different origin from Cozy Drive).
- **Using `position: absolute` without a portal:** The floating button would be clipped by the flex container holding the editor div.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Popover overflow/flip detection | Custom viewport boundary checks | MUI Popover's built-in `anchorPosition` + transformation origin | MUI handles edge cases (viewport overflow, flip logic) automatically |
| Debouncing selection events | Custom setTimeout/clearTimeout | A simple debounce helper (or lodash.debounce if available) | Selection change can fire rapidly during drag-select; debouncing prevents jitter |
| Cross-iframe message routing | Custom event bus | Existing `CozyBridge` class with `onIntent()` pattern | Already validated, handles origin checking, response correlation |
| Z-index layering | Manual z-index values | React Portal to `document.body` + MUI's built-in z-index management | MUI Popover already manages z-index for overlays |

**Key insight:** The hardest problem in this phase is getting reliable coordinates from inside the OO canvas editor. Everything else (floating button UI, popover anchoring, message protocol) uses existing patterns. Focus engineering effort on the coordinate extraction approach, and validate it in the first plan before building the UI.

## Common Pitfalls

### Pitfall 1: Cross-Origin Access Between Plugin and Editor Iframes
**What goes wrong:** The plugin tries `window.parent.document.addEventListener(...)` and gets a cross-origin error.
**Why it happens:** In some deployments, the plugin iframe and OO editor iframe may be on different subdomains or use different protocols.
**How to avoid:** Wrap parent document access in a try/catch. If it fails, fall back to a simpler positioning strategy (e.g., center of iframe, or use the context menu click position which the host can capture).
**Warning signs:** `SecurityError: Blocked a frame with origin...` in the console.

### Pitfall 2: Stale Mouse Coordinates After Keyboard Selection
**What goes wrong:** User selects text with Shift+Arrow keys. mouseup never fires. `lastMousePosition` contains the old click position, which may be far from the current selection.
**Why it happens:** Keyboard-driven selection doesn't generate mouse events.
**How to avoid:** For keyboard selections, use a fallback position: place the button at a default offset within the iframe (e.g., near the center-top of the visible editor area). Or disable floating button for keyboard selections and rely on context menu as the trigger. The user decision says "Keyboard-driven selections should also trigger the button IF the OO plugin API supports it" -- the "if" provides an escape hatch.
**Warning signs:** Button appears far from the actual selection when using keyboard.

### Pitfall 3: Iframe Not Found or Not Yet Mounted
**What goes wrong:** `document.getElementsByName('frameEditor')[0]` returns `undefined` and coordinate conversion fails.
**Why it happens:** The OO editor iframe is created dynamically by `DocsAPI.DocEditor()`. If the selection message arrives before the iframe is fully mounted, the lookup fails.
**How to avoid:** Check for iframe existence before converting coordinates. If iframe is not found, skip rendering the floating button. The `isEditorReady` state from `OnlyOfficeProvider` indicates when the editor is ready.
**Warning signs:** Floating button doesn't appear even though selection messages are being received.

### Pitfall 4: Z-Index War with OO Iframe
**What goes wrong:** The floating button renders but is hidden behind the OO iframe.
**Why it happens:** Iframes create a stacking context. A `position: fixed` element in the host page can still appear behind an iframe if the iframe's container has a higher stacking context.
**How to avoid:** Use a React Portal to render the button in `document.body`. Use `position: fixed` with a high `z-index` (9999+). MUI Popover already does this correctly.
**Warning signs:** Button click events don't fire even though the button is technically rendered at the correct position.

### Pitfall 5: Selection Message Floods
**What goes wrong:** The `init()` function fires on every selection change (including during drag-selection), causing dozens of postMessage calls per second and making the button flicker.
**Why it happens:** `initOnSelectionChanged: true` triggers `init()` very frequently.
**How to avoid:** The user decision already specifies a 300ms stabilization delay. Implement a debounce in the plugin's `init()` function: only send the `SELECTION_POSITION` message after 300ms of no further `init()` calls. This prevents flicker during drag-selection.
**Warning signs:** Console shows rapid-fire `[Scribe] Posted to N ancestor frame(s)` messages during text selection.

### Pitfall 6: Button Visible After Popover Opens
**What goes wrong:** User clicks the floating button, popover opens, but the button stays visible under/beside the popover.
**Why it happens:** State update race condition: button visibility depends on `pendingIntent` but there's no explicit "hide button" state.
**How to avoid:** Introduce a `scribeStep` state machine: `idle` -> `button-visible` -> `popover-open` -> `idle`. Button renders only in `button-visible` state. When popover opens, transition to `popover-open` which hides the button.
**Warning signs:** Visual glitch where both button and popover are momentarily visible.

### Pitfall 7: Scroll Invalidates Coordinates
**What goes wrong:** User selects text, button appears, then scrolls the document. The button stays at the old position while the selection moves or disappears.
**Why it happens:** The mouseup coordinates are captured once and become stale on scroll.
**How to avoid:** Per user decision: "On document scroll: button disappears." Listen for scroll events on the OO iframe (or use `onTargetPositionChanged` as a scroll proxy) and hide the button. The button reappears on the next selection.
**Warning signs:** Button floating at wrong position after scroll.

## Code Examples

### Example 1: Plugin Selection Position Message (code.js extension)
```javascript
// New state for mouse tracking
var lastMousePosition = { x: 0, y: 0 };
var selectionDebounceTimer = null;
var SELECTION_DEBOUNCE_MS = 300;

// Try to capture mouseup on the editor parent document (same origin)
try {
  window.parent.document.addEventListener("mouseup", function(e) {
    lastMousePosition.x = e.clientX;
    lastMousePosition.y = e.clientY;
  });
  log("Mouse tracking attached to parent document");
} catch (e) {
  log("Cannot attach to parent document (cross-origin): " + e.message);
}

// Modified init() with debounced position messages
window.Asc.plugin.init = function(data) {
  var text = (data || "").replace(/^\s+|\s+$/g, "");
  lastSelectedText = text;
  updateUI();

  // Clear previous debounce
  if (selectionDebounceTimer) {
    clearTimeout(selectionDebounceTimer);
  }

  if (text.length > 0) {
    // Debounce: wait 300ms for selection to stabilize
    selectionDebounceTimer = setTimeout(function() {
      postToAncestors({
        type: "cozy-bridge:selection-position",
        version: 1,
        source: "onlyoffice-plugin",
        data: {
          text: text,
          top: lastMousePosition.y,
          left: lastMousePosition.x
        }
      });
    }, SELECTION_DEBOUNCE_MS);
  } else {
    // Selection cleared: notify host to hide button
    postToAncestors({
      type: "cozy-bridge:selection-position",
      version: 1,
      source: "onlyoffice-plugin",
      data: {
        text: "",
        top: 0,
        left: 0
      }
    });
  }
};
```

### Example 2: Protocol Extension (protocol.js)
```javascript
/** @type {string} Message type for selection position (plugin -> host) */
export const MSG_TYPE_SELECTION_POSITION = 'cozy-bridge:selection-position'

/**
 * Validate a selection position message.
 * @param {*} msg - Message to validate
 * @returns {boolean} True if valid
 */
export function validateSelectionPosition(msg) {
  if (!msg || typeof msg !== 'object') return false
  if (msg.type !== MSG_TYPE_SELECTION_POSITION) return false
  if (msg.version !== PROTOCOL_VERSION) return false
  if (typeof msg.source !== 'string' || !msg.source) return false
  if (!msg.data || typeof msg.data !== 'object') return false
  if (typeof msg.data.top !== 'number' || typeof msg.data.left !== 'number') return false
  return true
}
```

### Example 3: Extended useCozyBridge Hook
```javascript
export function useCozyBridge(allowedOrigins) {
  const [pendingIntent, setPendingIntent] = useState(null)
  const [selectionPosition, setSelectionPosition] = useState(null)
  const bridgeRef = useRef(null)
  const respondRef = useRef(null)

  useEffect(() => {
    const bridge = new CozyBridge(allowedOrigins)
    bridgeRef.current = bridge

    bridge.onIntent('AI_TEXT_EDIT', (intentMessage, respondFn) => {
      setPendingIntent(intentMessage)
      respondRef.current = respondFn
    })

    // New: listen for selection position updates
    bridge.onSelectionPosition((positionData) => {
      if (positionData.text) {
        setSelectionPosition(positionData)
      } else {
        setSelectionPosition(null) // Selection cleared
      }
    })

    return () => {
      bridge.destroy()
    }
  }, [allowedOrigins])

  // ... respond callback unchanged ...

  return { pendingIntent, selectionPosition, respond }
}
```

### Example 4: Coordinate Conversion in View.jsx
```javascript
// Convert iframe-relative coords to page coords
const hostPosition = useMemo(() => {
  if (!selectionPosition) return null

  const iframe = document.getElementsByName(FRAME_EDITOR_NAME)[0]
  if (!iframe) return null

  const rect = iframe.getBoundingClientRect()
  return {
    top: rect.top + selectionPosition.top,
    left: rect.left + selectionPosition.left
  }
}, [selectionPosition])
```

### Example 5: Floating Button Component
```jsx
const ScribeFloatingButton = ({ position, onClick, visible }) => {
  if (!visible || !position) return null

  return createPortal(
    <div
      className="scribe-floating-button"
      style={{
        position: 'fixed',
        top: position.top - 44, // above selection
        left: position.left,
        opacity: 1,
        transition: 'opacity 150ms ease-in',
        zIndex: 99999,
        pointerEvents: 'auto'
      }}
    >
      <button onClick={onClick} className="scribe-floating-trigger">
        <SparkleIcon />
        <span>Scribe</span>
      </button>
    </div>,
    document.body
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plugin side panel with trigger button | Floating button near selection | This phase | User sees Scribe contextually at selection point |
| Hardcoded `anchorPosition` at viewport center | Dynamic `anchorPosition` from selection coords | This phase | Popover appears near selection, not at arbitrary position |
| Single `AI_TEXT_EDIT` message type | Two message types: `SELECTION_POSITION` (coords) + `AI_TEXT_EDIT` (action) | This phase | Clean separation of positioning data and action triggers |

**Deprecated/outdated:**
- Plugin side panel UI (`index.html` button + hint) -- replaced by floating button in host page
- Hardcoded ScribePopover `anchorPosition: { top: 200, left: window.innerWidth / 2 }` -- replaced by dynamic coordinates

## Open Questions

1. **Can the plugin access `window.parent.document` in the Cozy Docker setup?**
   - What we know: The plugin iframe and OO editor share the same origin in self-hosted setups (both served from the OO Document Server). The plugin code already calls `window.parent.postMessage()` successfully.
   - What's unclear: Whether `window.parent.document` access (beyond postMessage) works in the Cozy Docker configuration. PostMessage works cross-origin, but DOM access requires same-origin.
   - Recommendation: Test this in the first plan task. If blocked, fall back to Approach B below.
   - **Fallback (Approach B):** If the plugin CANNOT access `window.parent.document`, capture mouseup coordinates in the plugin's own window (its panel iframe). This only works when the user clicks the plugin panel, which is less useful. In that case, use the context menu click coordinates from the HOST page (Cozy Drive listens for the right-click event on the iframe element, or we approximate the position from the iframe center).

2. **Does `onTargetPositionChanged` fire on scroll?**
   - What we know: The event fires when "the target position in the editor is changed" but documentation is vague.
   - What's unclear: Whether document scroll triggers this event.
   - Recommendation: If it does, use it as a signal to hide the floating button (per user decision: button disappears on scroll). If not, the host can listen for wheel/scroll events on the iframe element as a proxy.

3. **Plugin type change: "panel" to "background"?**
   - What we know: The plugin is currently `type: "panel"` which renders a visible panel in OO. The user decision says "Remove the side panel button."
   - What's unclear: Whether switching to `type: "background"` (no visible panel) would break `initOnSelectionChanged` behavior or other plugin APIs.
   - Recommendation: Keep `type: "panel"` but minimize the panel HTML to essentially nothing visible. Or test `type: "background"` in the first plan task. The architecture research recommended "background" type originally, but the Phase 1 POC chose "panel" to have a test UI. Now that the test UI is no longer needed, "background" may be the right choice.

## Sources

### Primary (HIGH confidence)
- OnlyOffice Plugin API - `onTargetPositionChanged` fires with NO parameters: https://legacy-api.onlyoffice.com/plugin/events/onTargetPositionChanged
- OnlyOffice Plugin Events (legacy docs) - 24 events listed, none provide viewport coordinates: https://legacy-api.onlyoffice.com/plugin/events
- OnlyOffice Community - "we do not have methods that would allow to return current paragraph index nor character number": https://community.onlyoffice.com/t/how-can-i-find-the-current-cursor-position/8755
- OnlyOffice Plugin Autocomplete - `getInputHelper().show(w, h)` auto-positions at cursor, no explicit coords API: https://github.com/ONLYOFFICE/plugin-autocomplete
- MDN `getBoundingClientRect()` for iframe coordinate conversion: https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect
- Existing codebase analysis (`code.js`, `protocol.js`, `CozyBridge`, `useCozyBridge`, `ScribePopover`, `View.jsx`, `RightClickAddMenu.jsx`): direct code inspection -- HIGH confidence

### Secondary (MEDIUM confidence)
- OnlyOffice uses HTML5 Canvas for document rendering -- standard `window.getSelection()` not available: confirmed via multiple web sources
- Cross-iframe coordinate translation pattern (iframe.getBoundingClientRect + event.clientX/Y): https://blog.crimx.com/2017/04/06/position-and-drag-iframe-en/
- Plugin iframe same-origin with OO editor in self-hosted Docker setup: inferred from existing `window.parent.postMessage()` working in code.js

### Tertiary (LOW confidence)
- Whether `window.parent.document` DOM access works from plugin to OO editor (same-origin but not tested): needs POC validation
- Whether `onTargetPositionChanged` fires on scroll: not documented, needs testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies needed
- Architecture: MEDIUM - coordinate extraction approach is novel and needs POC validation (mouseup on parent document)
- Pitfalls: HIGH - well-understood cross-iframe challenges with documented mitigations

**Research date:** 2026-03-01
**Valid until:** 2026-03-15 (stable domain, but OO iframe access needs early validation)
