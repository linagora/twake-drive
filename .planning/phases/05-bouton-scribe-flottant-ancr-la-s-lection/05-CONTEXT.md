# Phase 5: Bouton Scribe flottant ancré à la sélection - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the Scribe trigger from the plugin's side panel with a floating button rendered by Cozy Drive above the OnlyOffice iframe, positioned near the text selection. The plugin sends selection coordinates via postMessage and Cozy Drive renders a floating "Scribe" button. Clicking the button opens the existing Scribe popover (menu → result → Replace/Insert flow preserved). The side panel button is no longer the primary trigger.

</domain>

<decisions>
## Implementation Decisions

### Button appearance & placement
- Floating button appears near the text selection (above or below — Claude's discretion based on available space)
- Button content: icon + "Scribe" label for discoverability (sparkle/magic icon)
- Visual style: pill-shaped with subtle elevation/shadow, stands out above editor content
- Appears with a smooth fade-in transition (~150-200ms)

### Selection lifecycle
- Button appears after a short stabilization delay (~300ms after selection settles) to avoid flicker during drag-selection
- Button disappears when the selection is lost (user clicks elsewhere or selection collapses)
- Keyboard-driven selections (Shift+Arrow) should also trigger the button if the OO plugin API supports it
- On document scroll: button disappears (reappears on next selection) — simpler, avoids cross-iframe coordinate tracking jitter

### Popover anchoring
- Scribe popover opens anchored to the floating button position (near the selection), not fixed at viewport center
- Floating button disappears when popover opens — popover replaces it as the active UI element
- Smart overflow handling: if not enough space below, flip above (standard dropdown collision detection)
- Clicking outside the popover dismisses it (standard popover behavior — matches current MUI Popover defaults)

### Context menu & side panel fate
- Keep the OO context menu "Scribe" entry as an alternative trigger — power users may prefer right-click
- Remove the side panel button — it's no longer needed as the primary trigger
- Plugin still handles document modification (Replace/Insert) via existing postMessage response flow — proven pattern, no change needed

### Protocol extension
- New message type for selection coordinates (separate from AI_TEXT_EDIT intent) — clean separation between positioning data and action triggers
- Plugin sends selection viewport coordinates when selection changes/stabilizes
- Cozy Drive converts iframe-relative coordinates to host page coordinates for button positioning

### Claude's Discretion
- Exact coordinate calculation method within the OO plugin (DOM API, OO plugin API, or hybrid)
- Iframe-to-host coordinate conversion approach
- Exact button dimensions and spacing from selection
- Debounce/throttle strategy for selection change events
- Whether to use a React portal or absolute-positioned div for the floating button
- Z-index management above the OO iframe

</decisions>

<specifics>
## Specific Ideas

- The floating button should feel like Google Docs' inline toolbar that appears on text selection — contextual, unobtrusive, right where you need it
- The transition from floating button → Scribe popover should feel seamless — button disappears, popover appears at the same location
- The plugin should become mostly invisible to the user — no side panel UI, just the floating button rendered by Cozy Drive

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScribePopover.jsx`: MUI Popover component — needs `anchorPosition` updated from fixed to dynamic coordinates
- `useCozyBridge` hook: manages pendingIntent state — can be extended to track selection coordinates
- `protocol.js`: intent validation — needs new message type for selection coordinates
- `RightClickAddMenu.jsx`: shows pattern for coordinate-based Popover positioning (`anchorPosition: { top: mouseY, left: mouseX }`)
- Plugin `castIntent()` and `postToAncestors()`: postMessage sending infrastructure — reusable for coordinate messages

### Established Patterns
- PostMessage protocol v1 with type/version/intentId/action/source/data schema
- Origin validation via `CozyBridge` constructor's `allowedOrigins`
- Plugin walks up iframe hierarchy with `window.parent` to reach Cozy Drive
- MUI Popover with `anchorReference="anchorPosition"` for coordinate-based positioning

### Integration Points
- `plugins/onlyoffice-scribe/scripts/code.js`: Add selection coordinate detection + new message type
- `src/lib/cozy-bridge/protocol.js`: Add validation for new coordinate message type
- `src/lib/cozy-bridge/index.js`: Handle new coordinate messages in CozyBridge listener
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx`: Update anchorPosition from dynamic coordinates
- `src/modules/views/OnlyOffice/View.jsx`: New floating button component + coordinate state management
- `plugins/onlyoffice-scribe/index.html`: Remove or minimize side panel button UI

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-bouton-scribe-flottant-ancr-la-s-lection*
*Context gathered: 2026-03-01*
