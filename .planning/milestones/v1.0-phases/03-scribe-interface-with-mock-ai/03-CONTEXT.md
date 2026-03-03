# Phase 3: Scribe Interface with Mock AI - Context

**Gathered:** 2026-03-01
**Updated:** 2026-03-01 (UX mockups integrated)
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Scribe popover UI that offers AI action presets (with nested submenus), a free prompt input, applies a mock transformation, and shows a result panel with Replace/Insert actions. The existing communication bridge (useCozyBridge, postMessage protocol) from Phase 2 is the foundation — this phase replaces the Phase 2 placeholder ScribeModal with the real UI.

Not in scope: real AI backend integration, production i18n, editable result text, floating button redesign.

</domain>

<decisions>
## Implementation Decisions

### Panel placement and form factor
- **Floating contextual popover** positioned near the Scribe button/selection — NOT a centered modal
- No dimmed backdrop — the editor remains visible and unblocked behind the popover
- Close (X button) dismisses without modifying the document
- Click outside dismisses (standard popover behavior)

### Action menu structure (Step 1)
- Popover menu with 4 top-level actions, each with an icon:
  1. **Correct grammar** — direct action (no submenu, no chevron)
  2. **Translate >** — submenu with language choices: Francais, Anglais, Russe, Vietnamien
  3. **Change tone >** — submenu with 3 options: More professional, More casual, More polite (each with icon)
  4. **Improve >** — submenu with 4 options: Make it shorter, Expand context, Emojify, Transform to bullets (each with icon)
- Chevron (>) on items 2, 3, 4 indicates submenu availability
- Submenus open to the right of the main menu
- **Free prompt input** below the menu: placeholder "Help me write" with a send button (arrow icon)
- Labels in English for actions (matching the mockups)
- Language names in French in Translate submenu (Francais, Anglais, Russe, Vietnamien)

### Result panel (Step 2)
- After selecting an action, the menu is **replaced** by a result panel (same floating position)
- **Header**: action breadcrumb showing the path taken (e.g. "Translate > Anglais") + close button (X)
- **Result text**: displayed as plain read-only text (not an editable textarea)
- **2 action buttons** at bottom-right:
  - "Replace" — text/link style, blue
  - "Inserer" — primary button, blue background/pill shape
- Clicking Replace or Insert closes Scribe and sends the result to the editor
- X closes without modifying the document

### Two-step flow
- Step 1: Action selection (menu with submenus + free prompt)
- Step 2: Result display (breadcrumb + result text + Replace/Insert)
- No back arrow in step 2 — user closes (X) and re-triggers if they want a different action
- No "before/after" comparison — only the result is shown

### Mock AI behavior
- Claude's discretion: mock transformation strategy (should produce visibly different text per action type)
- Claude's discretion: instant vs simulated delay with loading state

</decisions>

<specifics>
## Specific Ideas

- The popover should feel lightweight and contextual — not a heavy modal experience
- Action breadcrumb in result panel (e.g. "Translate > Anglais") gives the user context about what was applied
- Each action and sub-action has its own icon (design details in mockups)
- The "Help me write" free prompt is always visible below the action menu, acting as a fallback for custom instructions
- Result text is read-only for this phase — editable textarea is a future enhancement
- After Replace/Insert, Scribe closes completely and the document is updated

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScribeModal.jsx`: Phase 2 placeholder using cozy-ui ConfirmDialog — will be **replaced** with the new popover component (not evolved, since the UX is fundamentally different)
- `useCozyBridge.js`: Hook managing intent/response lifecycle — pendingIntent triggers popover, respond() sends action back. Unchanged.
- `CozyBridge` class (`src/lib/cozy-bridge/index.js`): Host-side protocol handler with origin validation. Unchanged.
- Plugin `code.js`: Handles Replace/Insert/Cancel responses, postToAncestors for nested iframe communication. Unchanged.

### Established Patterns
- React + cozy-ui component model — popover may use cozy-ui Popover/Menu components or custom implementation
- Stylus (.styl) files for component-level styles
- useCallback/useMemo for memoized handlers in View.jsx
- cozy-ui utility classes: `u-flex`, `u-flex-grow-1`, etc.

### Integration Points
- `View.jsx` renders ScribeModal and wires useCozyBridge — will render the new Scribe popover component instead
- `handleReplace`, `handleInsert`, `handleCancel` callbacks already exist — Phase 3 adds mock transformation before calling respond()
- Protocol response format: `{ status: 'ok', action: 'replace'|'insert'|'cancel', data: { text } }` — unchanged
- Plugin's `handleIntentResponse` applies document changes — unchanged
- Popover positioning: needs to be anchored near the Scribe button or selection area within the OO editor iframe context

</code_context>

<deferred>
## Deferred Ideas

- Editable result textarea (user modifies AI proposition before applying) — future phase
- Back arrow in result panel to try a different action without closing — future enhancement
- Regenerate button (re-run same action for different result) — future enhancement
- Button disable on text deselection (deferred from Phase 2 — requires floating button redesign)
- OO dark theme CSS fix for "Selected Text" display (cosmetic, Phase 2 pending todo)
- Real AI backend integration (Phase 4 or separate milestone)
- Production i18n with Cozy Drive's locales system (post-MVP)

</deferred>

---

*Phase: 03-scribe-interface-with-mock-ai*
*Context gathered: 2026-03-01*
*Updated: 2026-03-01 (UX mockups from user)*
