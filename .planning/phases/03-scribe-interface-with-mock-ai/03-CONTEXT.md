# Phase 3: Scribe Interface with Mock AI - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Scribe panel UI that displays selected text, offers AI action presets and free prompt input, applies a mock transformation, and shows a preview with editable result. The existing communication bridge (useCozyBridge, postMessage protocol) from Phase 2 is the foundation — this phase adds the user-facing interface on top of it.

Not in scope: real AI backend integration, production i18n, floating button redesign.

</domain>

<decisions>
## Implementation Decisions

### Panel placement and form factor
- Centered modal dialog with dimmed backdrop (blocks interaction with editor)
- All close actions (Escape, click outside, Cancel) behave identically: close without modifying document
- Claude's discretion: modal sizing (fixed vs responsive), exact dimensions

### Action menu and flow
- Two-step flow inside the modal:
  - Step 1: Display selected text + action menu (presets + free prompt)
  - Step 2: Display preview with original and proposition, plus Replace/Insert/Cancel buttons
- Core 4 preset actions: Ameliorer, Reformuler, Traduire, Corriger
- Free prompt text input below the presets for custom instructions
- Back arrow in the preview step to return to action selection and try a different action

### Preview and editing experience
- Before/after stacked layout: original text on top (read-only), proposition below (editable textarea)
- User can edit the proposition text before applying Replace or Insert
- Claude's discretion: regenerate button (refresh icon to re-run same action), mock transformation strategy per action

### Mock AI behavior
- Claude's discretion: mock transformation strategy (simple prefix vs action-specific markers)
- Claude's discretion: instant vs simulated delay with loading state

</decisions>

<specifics>
## Specific Ideas

- Labels in PROJECT.md are French: Ameliorer, Reformuler, Traduire, Corriger — use these as the action names
- The two-step flow should feel like a focused wizard: choose action -> review result -> apply or go back
- Editable textarea is a key requirement from PROJECT.md: "L'utilisateur peut modifier le texte propose avant de l'appliquer"

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScribeModal.jsx`: Phase 2 placeholder using cozy-ui ConfirmDialog — evolve into the full two-step interface
- `useCozyBridge.js`: Hook managing intent/response lifecycle — pendingIntent triggers modal, respond() sends action back
- `CozyBridge` class (`src/lib/cozy-bridge/index.js`): Host-side protocol handler with origin validation
- Plugin `code.js`: Handles Replace/Insert/Cancel responses, postToAncestors for nested iframe communication

### Established Patterns
- React + cozy-ui component model (ConfirmDialog, Buttons, Typography)
- Stylus (.styl) files for component-level styles
- useCallback/useMemo for memoized handlers in View.jsx
- cozy-ui utility classes: `u-flex`, `u-flex-grow-1`, etc.

### Integration Points
- `View.jsx` renders ScribeModal and wires useCozyBridge — the only file that needs updating for new props
- `handleReplace`, `handleInsert`, `handleCancel` callbacks already exist — Phase 3 adds the text transformation in between
- Protocol response format: `{ status: 'ok', action: 'replace'|'insert'|'cancel', data: { text } }` — unchanged
- Plugin's `handleIntentResponse` applies document changes — unchanged

</code_context>

<deferred>
## Deferred Ideas

- Button disable on text deselection (deferred from Phase 2 — requires floating button redesign)
- OO dark theme CSS fix for "Selected Text" display (cosmetic, Phase 2 pending todo)
- Real AI backend integration (Phase 4 or separate milestone)
- Production i18n with Cozy Drive's locales system (post-MVP)
- Language picker for Traduire action (when real AI is connected)

</deferred>

---

*Phase: 03-scribe-interface-with-mock-ai*
*Context gathered: 2026-03-01*
