# Project Research Summary

**Project:** Scribe v2.3 — Responsive Drawer Menu
**Domain:** Responsive UI refactor — fullscreen mobile drawer with push navigation for AI writing assistant
**Researched:** 2026-03-12
**Confidence:** HIGH

## Executive Summary

Scribe v2.3 is a focused responsive layout refactor of an existing, working AI writing assistant menu. The current implementation uses a MUI Popover with absolute-positioned flyout submenus — a pattern that works well on desktop but fails entirely on mobile: flyout submenus clip outside the viewport, the 500px fixed prompt input overflows narrow screens, and drag/resize affordances are unusable with touch. The recommended approach is a clean conditional split at the `ScribePopover` level: desktop keeps the existing Popover path 100% intact, while mobile renders a fullscreen MUI Drawer with a new `ScribeDrawerMenu` component implementing push navigation.

No new npm dependencies are required. Every building block — `Drawer`, `Slide`, `useBreakpoints`, `IconButton` — is already installed via `@material-ui/core` 4.12.3 and `cozy-ui` 135.8.0. The implementation strategy is to add one new component file (`ScribeDrawerMenu.jsx`), modify four existing files (`ScribePopover`, `ScribeActionMenu`, `ScribePromptInput`, `View.jsx`), and leave all other Scribe files untouched. The view stack for push navigation is a single `useState` — no router, no animation library needed for MVP.

The primary risks are architectural decisions that must be made in Phase 1 before any navigation behavior is built. The most important: MUI Drawer requires `ModalProps={{ disableScrollLock: true, disableEnforceFocus: true, disableAutoFocus: true }}` from the start to prevent scroll lock layout shifts (Cozy Drive is already an iframe) and to avoid MUI's built-in focus trap fighting the custom keyboard navigation system. The conditional render must be a strict either/or (`isMobile ? <Drawer> : <Popover>`) — not both mounted simultaneously. Get these three foundational decisions right in Phase 1 and the remaining implementation is straightforward.

## Key Findings

### Recommended Stack

The entire v2.3 milestone requires zero new npm dependencies. All components exist at the correct versions in the installed packages. `cozy-ui/transpiled/react/Drawer` is a thin re-export of `@material-ui/core/Drawer` v4.12.3 — use the cozy-ui import path for consistency with the rest of the codebase. `useBreakpoints` from `cozy-ui/transpiled/react/providers/Breakpoints` is already imported in 78 files and defines `isMobile` as `window.innerWidth <= 768px`. Read `isMobile` once in `View.jsx` (where it already exists on line 37) and thread it down as a prop — do not call the hook again in child components.

**Core technologies:**
- `cozy-ui/transpiled/react/Drawer` (MUI v4 Drawer): fullscreen mobile container — already installed, re-exported by cozy-ui, no new install needed
- `useBreakpoints().isMobile` (cozy-ui 135.8.0): breakpoint detection — established pattern in 78 files, single call in View.jsx
- `useState` (React 18.2.0): push navigation view stack — no router needed, depth is exactly root + one submenu level
- `@material-ui/core/Slide` (installed): optional push animation — available but not required for MVP

**What NOT to add:** `react-router-dom` (overkill for one-level depth), `SwipeableDrawer` (gesture complexity without payoff), `framer-motion`/`react-spring` (bundle size for a non-required polish item), MUI v5 (project is on v4 — mixing v4 and v5 import paths causes style conflicts).

### Expected Features

The MVP is 8 table-stakes features. All 8 must ship for v2.3 to be considered complete. Desktop regression is a blocking failure.

**Must have (table stakes):**
- Fullscreen drawer on mobile (`isMobile`) with standard slide animation and backdrop close
- Push navigation: tapping a parent item replaces the list with the submenu content in-place
- Back button/header in submenu view (left-arrow icon + parent label)
- Prompt input fills drawer width (remove 500px hardcoded Paper wrapper, replace with `width: '100%'`)
- All three steps (menu / loading / result) render inside the drawer on mobile
- Result panel static inside drawer — no drag/resize on mobile (omit drag/resize props)
- Desktop Popover path 100% unchanged
- Push navigation state resets to root on drawer close

**Should have (polish, post-validation):**
- Slide push animation: CSS translateX on list swap — D1, deferred to v2.3.x
- Drawer header with Scribe title and close button on all steps — D2, quick win once drawer works

**Defer (v3.0+):**
- `SwipeableDrawer` with swipe-to-close — D3, warranted only after user feedback confirms demand

### Architecture Approach

The architecture is a clean conditional split: `ScribePopover` chooses its container based on `isMobile` (`<Drawer>` vs `<Popover>`), then renders the same three-step state machine (menu / loading / result) inside either shell. The step machine, AI call logic, `AbortController`, and retry handling all remain in `ScribePopover` — they are not duplicated. A single new component `ScribeDrawerMenu.jsx` handles the push-navigation layout; it is purely presentational, receiving `actions`, `onSelect`, `onClose`, and `t` as props with all navigation state managed internally via `viewStack`.

**Modified files:**
1. `View.jsx` — add `isMobile` prop to `<ScribePopover>` (one line, `isMobile` already destructured on line 37)
2. `ScribePopover.jsx` — conditional container (`isMobile ? <Drawer ...> : <Popover ...>`), pass `isMobile` down
3. `ScribeActionMenu.jsx` — receive `isMobile` prop, delegate to `ScribeDrawerMenu` on mobile
4. `ScribePromptInput.jsx` — change Paper wrapper width from `500` to `isMobile ? '100%' : 500`

**New file:**
5. `ScribeDrawerMenu.jsx` — push navigation with `viewStack` state (`[{ type:'root' }]` pushed to `{ type:'submenu', actionId }`)

**Unchanged:** `ScribeResultPanel`, `MarkdownPreview`, `scribeActions.js`, `scribeAI.js`, all other Scribe files.

### Critical Pitfalls

1. **MUI Drawer scroll lock shifts the iframe layout** — Pass `ModalProps={{ disableScrollLock: true }}` from day one. Cozy Drive is already an iframe; the body scroll lock is unnecessary and causes a ~15px layout jump when the drawer opens.

2. **MUI focus trap conflicts with custom keyboard navigation** — Pass `ModalProps={{ disableEnforceFocus: true, disableAutoFocus: true }}` to Drawer, matching how the existing `ScribePopover` already opts out of MUI focus management. Without this, MUI overrides the custom `tabIndex={-1}` Paper focus system.

3. **Absolute-positioned submenu (`left: 100%`) is invisible inside a Drawer** — This is not recoverable without a rewrite. The `position: absolute; left: 100%` flyout overflows a full-screen drawer and is clipped. Push navigation must be planned from the start — do not attempt to reuse the flyout submenu inside the drawer.

4. **Both Drawer and Popover mounted simultaneously** — The conditional render must be `isMobile ? <Drawer> : <Popover>`, not both mounted with `open={false}`. Both MUI components create Portal elements in `document.body`; having both mounted causes DOM duplication and animation glitches on orientation change.

5. **Push navigation state persists across drawer close** — Add a `useEffect` on `open` to reset `viewStack` to `[{ type: 'root' }]` when the drawer closes. Without this, reopening the drawer after navigating into a submenu shows the submenu instead of the root list.

6. **Hover event handlers (`onMouseEnter`/`onMouseLeave`) fire on touch and interfere with push navigation** — The mobile branch must bypass all hover interaction logic and use only click/tap handlers. The `mouseMoveEnabledRef` gating is a desktop-only concern; in drawer mode only `onClick` is relevant.

## Implications for Roadmap

Based on research, the milestone splits naturally into two sequential phases. Phase 1 establishes all architectural foundations (decisions that are hard to change later). Phase 2 implements push navigation behavior on top of a correct scaffold.

### Phase 1: Drawer Scaffold + Breakpoint Split

**Rationale:** The three most critical pitfalls (scroll lock, focus conflict, simultaneous render) must all be addressed in the drawer scaffold before any navigation behavior is built on top. Getting the `ModalProps` and conditional render pattern correct from the start avoids medium-to-high cost rework later.

**Delivers:** A working fullscreen drawer that opens on mobile when Scribe is triggered, renders the existing `ScribeActionMenu` inside it (desktop submenus broken inside drawer — acceptable at this phase), and keeps the desktop Popover completely unchanged. Drawer closes on backdrop tap. No layout shift, no focus conflict.

**Addresses features:** Table stakes 1 (fullscreen drawer), 2 (slide animation — built-in), 3 (backdrop close), 7 (desktop unchanged)

**Implements:** `ScribePopover` conditional container, `View.jsx` prop addition, Drawer `ModalProps` configuration (`disableScrollLock`, `disableEnforceFocus`, `disableAutoFocus`), either/or conditional render pattern, `anchor="bottom"` with `PaperProps={{ style: { height: '100%' } }}`

**Avoids pitfalls:** Pitfall 1 (breakpoint diagnostic — add console log, verify triggers at < 768px), Pitfall 2 (scroll lock), Pitfall 5 (focus conflict), Pitfall 7 (simultaneous render), Pitfall 11 (drawer anchor + PaperProps for fullscreen)

**Build order within phase:**
1. Add `isMobile` prop to `ScribePopover` (from `View.jsx`)
2. Add conditional container in `ScribePopover` with correct `ModalProps`
3. Add diagnostic: `console.log('[Scribe] isMobile:', isMobile, window.innerWidth)` on first render
4. Verify drawer covers 100% screen height, no layout shift on open, focus visible

### Phase 2: Push Navigation + Prompt Width + Mobile Polish

**Rationale:** Push navigation depends on the scaffold being correct. Building `ScribeDrawerMenu` in isolation first (no drawer dependency, just mock actions) lets it be validated before integration. Prompt width is a one-line change but belongs here since it requires testing in a real mobile viewport context.

**Delivers:** Complete mobile Scribe experience — fullscreen drawer with push navigation submenus, back button, full-width prompt input, static result panel. All three steps work correctly in the drawer. Keyboard navigation adapted for push navigation semantics (Escape navigates back from submenu, Enter pushes into submenu).

**Addresses features:** Table stakes 4 (push navigation), 5 (back button), 6 (prompt width), 8 (static result panel), plus state reset on close

**Implements:** `ScribeDrawerMenu.jsx` (new, push navigation with `viewStack`), `ScribeActionMenu.jsx` mobile delegation, prompt input width fix (`isMobile ? '100%' : 500`), keyboard handler third mode for push navigation, `useEffect` state reset on drawer close, hover handler removal for mobile branch

**Avoids pitfalls:** Pitfall 3 (absolute submenu never used in drawer — push nav replaces it), Pitfall 4 (500px overflow fixed), Pitfall 6 (hover handlers removed for mobile branch), Pitfall 8 (state reset via useEffect on `open`), Pitfall 10 (keyboard nav adapted for push nav)

**Build order within phase:**
1. Build `ScribeDrawerMenu.jsx` in isolation with mock actions (no Drawer dependency)
2. Modify `ScribeActionMenu.jsx` to delegate to `ScribeDrawerMenu` when `isMobile`
3. Fix prompt input width (`isMobile ? '100%' : 500`)
4. Add keyboard handler push navigation mode
5. Add `useEffect` state reset on `open`
6. Verify complete mobile flow: open > navigate > submit > result > close > reopen (confirm state reset)

### Phase Ordering Rationale

- Phase 1 before Phase 2 because all navigation behavior must be built on top of a correct architectural scaffold. Attempting push navigation inside a drawer with wrong `ModalProps` means debugging focus and scroll issues while also debugging navigation state simultaneously.
- Push navigation is built as a new isolated component (`ScribeDrawerMenu`) before being integrated into the existing component tree. This reduces integration risk on the most complex change.
- Desktop path is never touched (only the `isMobile` branch changes at each step). Each phase ends with desktop behavior verifiably unchanged.
- The two-phase structure matches the pitfall-to-phase mapping in PITFALLS.md: critical architectural pitfalls (1, 2, 3, 5, 7, 11) all land in Phase 1; behavioral pitfalls (4, 6, 8, 10) land in Phase 2.

### Research Flags

Phases with standard, well-documented patterns (no further research needed):
- **Phase 1:** MUI Drawer configuration is standard. All `ModalProps` values confirmed in cozy-ui source and MUI docs. Breakpoint threshold confirmed in cozy-ui internals. Zero unknowns.
- **Phase 2:** Push navigation with `useState` and `viewStack` is a textbook mobile navigation pattern. `SCRIBE_ACTIONS` data structure is already declarative and passes through unchanged. No novel technical challenges.

No phases require deeper research during planning. All critical questions were resolved by direct source analysis of the codebase, cozy-ui internals, and MUI source files.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All components verified by direct file inspection of installed packages. Import paths confirmed. Zero new dependencies. No inference required. |
| Features | HIGH | Table stakes derived from Material Design standards plus direct analysis of what the current implementation lacks on mobile. MVP scope is unambiguous. |
| Architecture | HIGH | Based on direct reading of all Scribe component files plus cozy-ui internals. `isMobile` prop threading depth (2 levels) confirmed appropriate. Build order derived from actual dependency graph, not assumptions. |
| Pitfalls | HIGH | Most pitfalls discovered via direct source code analysis, not pattern matching. `ModalProps` values confirmed in cozy-ui BottomSheet source (`document.body.style.overflow`), Drawer source (MUI Modal base), and existing `ScribePopover` (`disableAutoFocus` already present on line 37). |

**Overall confidence:** HIGH

### Gaps to Address

- **`anchor="bottom"` vs `anchor="left"` final decision:** Research recommends `anchor="bottom"` for thumb reachability on phones, but the product spec does not specify. Both achieve fullscreen with the correct `PaperProps`. Decide before Phase 1 implementation — it affects the visual direction of the slide animation. Recommendation: `anchor="bottom"`.
- **Slide push animation scope:** Research flags this as optional polish (D1, v2.3.x deferred). If the product spec requires animation in v2.3, it adds roughly half a phase of work (CSS `translateX` on two panels with `transition` timing). Confirm before Phase 2 planning.
- **Keyboard navigation on mobile drawer:** Research documents the keyboard handler changes needed for push navigation (Pitfall 10). If the target is touch-only mobile with no external keyboard requirement, this can be simplified. Confirm whether external keyboard on iPad is in scope.

## Sources

### Primary (HIGH confidence)
- Codebase: `src/modules/views/OnlyOffice/Scribe/` — direct analysis of all component files
- Codebase: `src/modules/views/OnlyOffice/View.jsx` — `useBreakpoints()` confirmed present and already destructuring `isMobile`
- cozy-ui: `node_modules/cozy-ui/transpiled/react/Drawer/index.js` — confirmed thin re-export of MUI Drawer
- cozy-ui: `node_modules/cozy-ui/transpiled/react/helpers/breakpoints.js` — `isMobile: [0, 768]` confirmed
- cozy-ui: `node_modules/cozy-ui/transpiled/react/providers/Breakpoints/index.js` — hook implementation confirmed
- cozy-ui: `node_modules/cozy-ui/transpiled/react/BottomSheet/BottomSheet.js` — scroll lock pattern confirmed (`document.body.style.overflow = 'hidden'`)
- cozy-ui: `node_modules/cozy-ui/transpiled/react/ActionsMenu/ActionsMenuWrapper.js` — `isMobile ? BottomSheet : Menu` pattern confirmed
- Codebase: grep `useBreakpoints` — 78 files using established import pattern
- `.planning/PROJECT.md` — v2.3 requirements: drawer fullscreen, push submenus, adaptive prompt

### Secondary (MEDIUM confidence)
- MUI v4 Drawer API — `anchor`, `open`, `onClose`, `PaperProps`, `variant`, `ModalProps` options
- Material Design 3 Navigation Drawer guidelines — push navigation as standard mobile submenu pattern
- `node_modules/@material-ui/core/Drawer/Drawer.d.ts` — TypeScript definitions for ModalProps options

---
*Research completed: 2026-03-12*
*Ready for roadmap: yes*
