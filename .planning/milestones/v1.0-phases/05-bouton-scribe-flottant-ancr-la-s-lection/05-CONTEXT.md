# Phase 5: Bouton Scribe flottant ancré à la sélection - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the Scribe trigger from the plugin's side panel with a floating button rendered by Cozy Drive above the OnlyOffice iframe. The button appears near the text selection when text is selected, using mouseup event coordinates captured by the plugin on the editor's parent document. Add a keyboard shortcut (Ctrl+K) as a fast alternative trigger. Clicking the button or pressing the shortcut opens the existing Scribe popover (menu -> result -> Replace/Insert flow preserved). The side panel button is no longer the primary trigger.

**Key constraint discovered during exploration:** OO renders documents on HTML5 Canvas -- no DOM selection API is available for coordinate retrieval. `window.getSelection()`, `Range.getBoundingClientRect()` are useless. OO team confirmed no API for paragraph/character position. InputHelper API only works with non-visual (`background`/`system`) plugins, not our `panel` type. **Solution:** The plugin captures `mouseup` event coordinates on `window.parent.document` (same-origin) and sends them as viewport coordinates in the selection-state message. Cozy Drive converts these iframe-relative coordinates to host-page coordinates using `iframe.getBoundingClientRect()`.

</domain>

<decisions>
## Implementation Decisions

### Button appearance & placement
- Floating button rendered by Cozy Drive above the OO iframe, positioned near the text selection
- Position: near the selection using mouseup coordinates from the plugin (iframe-relative coords converted to host-page coords)
- Button content: icon + "Scribe" label for discoverability (sparkle/magic icon)
- Visual style: pill-shaped with subtle elevation/shadow
- Appears with a smooth fade-in transition (~150-200ms)

### Triggers
- **Mouse:** Floating button appears near the selection when plugin reports text is selected
- **Keyboard:** Ctrl+K shortcut activates Scribe when text is selected (registered in OO plugin, triggers same flow)
- **Context menu:** Keep OO context menu "Scribe" entry as alternative trigger

### Selection lifecycle
- Button appears when plugin reports selection exists (existing `initOnSelectionChanged` mechanism) with viewport coordinates
- Button disappears when selection is lost
- Plugin captures mouseup coordinates on editor parent document and includes them in selection-state messages

### Popover anchoring
- Scribe popover opens anchored to the floating button position (near the selection)
- Floating button disappears when popover opens -- popover replaces it
- Clicking outside the popover dismisses it (standard MUI Popover behavior)

### Side panel fate
- Remove the side panel button -- replaced by near-selection floating button + Ctrl+K
- Plugin still handles document modification (Replace/Insert) via existing postMessage response flow — no change needed

### Protocol
- New message type for selection state notification (text selected / deselected) with viewport coordinates
- Plugin sends selection state change (including mouseup coordinates) via postMessage
- Cozy Drive converts iframe-relative coordinates to host-page coordinates and positions floating button near the selection
- Ctrl+K in plugin triggers the same intent as clicking the floating button

### Claude's Discretion
- Exact offset/spacing of the button relative to the mouse position
- Whether to use a React portal or absolute-positioned div
- Z-index management above the OO iframe
- Debounce strategy for selection state changes
- How to register Ctrl+K in the OO plugin (keyboard event listener approach)

</decisions>

<specifics>
## Specific Ideas

- The plugin should become mostly invisible to the user -- no side panel UI, just the floating button + Ctrl+K
- Ctrl+K is a familiar shortcut (used in Notion, Slack, VS Code for quick actions) -- good discoverability
- The transition from floating button -> Scribe popover should feel seamless
- Mouseup coordinate capture on the editor parent document provides reliable near-selection positioning despite OO's Canvas rendering

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScribePopover.jsx`: MUI Popover component — anchorPosition can reference the fixed button position
- `useCozyBridge` hook: manages pendingIntent state — extend to track selection state (has selection / no selection)
- `protocol.js`: intent validation — needs new message type for selection state
- Plugin `castIntent()` and `postToAncestors()`: postMessage sending infrastructure — reusable
- `initOnSelectionChanged`: already fires on selection changes — source of selection state events

### Established Patterns
- PostMessage protocol v1 with type/version/intentId/action/source/data schema
- Origin validation via `CozyBridge` constructor's `allowedOrigins`
- Plugin walks up iframe hierarchy with `window.parent` to reach Cozy Drive
- MUI Popover with `anchorReference="anchorPosition"` for coordinate-based positioning

### Integration Points
- `plugins/onlyoffice-scribe/scripts/code.js`: Add selection state notification + Ctrl+K handler
- `src/lib/cozy-bridge/protocol.js`: Add validation for selection state message type
- `src/lib/cozy-bridge/index.js`: Handle selection state messages in CozyBridge listener
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx`: Anchor to floating button position
- `src/modules/views/OnlyOffice/View.jsx`: New floating button component + selection state management
- `plugins/onlyoffice-scribe/index.html`: Remove side panel button UI

</code_context>

<deferred>
## Deferred Ideas

- Coordinate-based positioning if OO adds a position API in the future
- InputHelper approach if plugin is ever switched to background type

</deferred>

---

*Phase: 05-bouton-scribe-flottant-ancr-la-s-lection*
*Context gathered: 2026-03-01*
