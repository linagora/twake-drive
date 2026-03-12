# Pitfalls Research

**Domain:** Responsive drawer with push navigation added to existing desktop Popover menu in nested iframe environment (Scribe v2.3)
**Researched:** 2026-03-12
**Confidence:** HIGH — based on direct source analysis of existing Scribe code, cozy-ui Drawer/BottomSheet/BreakpointsProvider internals, and MUI Popover/Drawer behavior patterns.

---

## Critical Pitfalls

Mistakes that cause rewrites, broken scroll isolation, or fundamental UX failures.

---

### Pitfall 1: `useBreakpoints()` Reports Cozy Drive Iframe Width, Not Device Width — Mobile Drawer Never Triggers

**What goes wrong:**
`useBreakpoints()` returns `{ isMobile: false }` even on a phone or narrow viewport, because it reads `window.innerWidth` of the Cozy Drive iframe — which is the full page width on desktop. The mobile drawer branch (`isMobile && <Drawer>`) never activates.

**Why it happens:**
`BreakpointsProvider` (in `DriveProvider.jsx`) measures the width of the window it runs in: the Cozy Drive iframe. On desktop, Cozy Drive always occupies the full browser window width (1200px+), so `isMobile` is always `false` regardless of the actual device or outer window.

The `parentBasedIframe` prop exists to relay breakpoints from the parent window down into child iframes, but it relies on a `postMessage` handshake (`UI-breakpoints-needParentBreakpoints`). In the current setup, `BreakpointsProvider` is NOT configured with `parentBasedIframe: true`. The Cozy Drive app sits inside a Cozy Stack iframe, and the OO editor is yet another level deeper — the chain is: Cozy Stack window > Cozy Drive iframe > OO Editor iframe > Plugin iframe. The Scribe components render in Cozy Drive, which already is an iframe.

In practice, this means: on a phone using Cozy Drive web, the Cozy Drive iframe is the full phone screen width (< 768px), so `isMobile` WILL correctly be `true` at that level. This is the intended behavior. However, if the design assumption is that the OO editor fills the screen and Scribe sits inside it, the breakpoint must reflect the OO editor iframe's width, not Cozy Drive's.

**How to avoid:**
Verify at which DOM level the Scribe components render. `ScribePopover` is mounted in `View.jsx` inside the Cozy Drive iframe — and the breakpoint from `useBreakpoints()` will reflect the Cozy Drive window width. Since Cozy Drive IS the user-facing window on mobile, this is correct and will work. But explicitly test with a real narrow viewport (devtools device emulation at < 768px) before building the drawer branch. Do not assume it works — verify with a console log of `isMobile` at render time.

**Warning signs:**
- `isMobile` is always `false` regardless of viewport size during testing
- Drawer never appears even after narrowing the browser window
- Breakpoint logs show width > 768 when browser is clearly narrow

**Phase to address:** Phase 1 (initial drawer scaffold) — add a diagnostic `console.log('[Scribe] isMobile:', isMobile, window.innerWidth)` on first render and verify the breakpoint triggers correctly before building any behavior on top of it.

---

### Pitfall 2: MUI Drawer `document.body` Scroll Lock Fights the OO Editor Iframe

**What goes wrong:**
When `<Drawer open={true}>` renders, MUI applies `overflow: hidden` to `document.body` (the Cozy Drive document body) to prevent background scroll. This removes the scrollbar from Cozy Drive's layout, causing a layout shift (the page jumps right by the scrollbar width, ~15px). More critically, if Cozy Drive has other scrollable elements, they stop scrolling while the drawer is open.

The existing `BottomSheet` component in cozy-ui has the same issue: it explicitly sets `document.body.style.overflow = 'hidden'` and restores it on unmount. MUI Drawer applies `overflow: hidden` on `<body>` via its `Modal` base component.

**Why it happens:**
MUI Modal/Drawer uses `disableScrollLock={false}` by default — it manages body scroll lock automatically. Since Cozy Drive runs inside an iframe, the "document body" is already not the root scrollable element from the user's perspective. But MUI doesn't know this and applies the lock anyway.

**How to avoid:**
Pass `ModalProps={{ disableScrollLock: true }}` to the MUI Drawer. This disables the automatic scroll lock. Since the OO editor iframe occupies most of the screen and has its own scroll management, the Cozy Drive body scroll lock is unnecessary anyway.

```jsx
<Drawer
  open={open}
  anchor="bottom"
  ModalProps={{ disableScrollLock: true }}
>
```

**Warning signs:**
- Page content shifts right by ~15px when drawer opens
- OO editor iframe content appears to "jump"
- Existing scroll positions reset when drawer opens

**Phase to address:** Phase 1 (drawer scaffold) — add `disableScrollLock` from the start, not as a later fix.

---

### Pitfall 3: Absolute-Positioned Submenu (left: 100%) Breaks Entirely Inside a Drawer

**What goes wrong:**
The current submenu renders as a `<Paper>` with `position: absolute; left: 100%` relative to its parent menu item. Inside a drawer (which is typically `position: fixed; width: 100vw`), the submenu flies off the right edge of the drawer and is clipped by `overflow: hidden` on the drawer container — becoming invisible or partially visible.

**Why it happens:**
The absolute positioning assumes the submenu has enough horizontal space to the right of the parent menu item. On desktop, the Popover has no width constraint and the submenu flows naturally to the right. In a full-screen drawer on mobile:
- The drawer width is `100vw`
- The parent menu items are full-width
- `left: 100%` places the submenu at `100vw` — completely outside the viewport
- The drawer's `overflow: hidden` (or `overflow: auto`) clips the submenu entirely

This is why the milestone requirement specifies "push navigation" instead of side-by-side submenus: side-by-side is impossible inside a full-screen drawer.

**How to avoid:**
The drawer and the Popover must use completely different submenu strategies:
- **Popover (desktop):** keep existing absolute-positioned submenu as-is
- **Drawer (mobile):** push navigation — clicking a parent item replaces the menu list with the submenu list. A back button navigates up. No `position: absolute` needed.

Implement as a conditional render at the `ScribeActionMenu` level based on `isMobile`:
- If `isMobile`: maintain a `currentView` state (`'root'` or `'submenu'`), render only one list at a time, animate between them
- If not `isMobile`: keep existing absolute submenu rendering unchanged

The key is that `ScribeActionMenu` must be refactored to support both modes without breaking the desktop path.

**Warning signs:**
- Submenu is invisible when drawer is open
- Browser inspector shows submenu element exists in DOM but is positioned outside viewport
- Clicking a parent item with children does nothing visible on mobile

**Phase to address:** Phase 1 — this is the core architectural decision. Attempting to reuse the absolute positioning inside a drawer is not recoverable without a rewrite.

---

### Pitfall 4: `width: 500px` Hardcoded on Prompt Input Overflows the Drawer

**What goes wrong:**
`ScribeActionMenu` renders the prompt input `<Paper>` with `width: 500`. On mobile (320-768px viewport), this causes horizontal overflow inside the drawer, creating a horizontal scrollbar or causing the prompt input to be partially cut off.

**Why it happens:**
The 500px width was chosen to match a desktop Popover context where the menu floats freely in a 1200px+ viewport. The Popover has `overflow: visible`, so the 500px prompt input extends beyond the menu card without issues. Inside a drawer with `overflow: hidden`, a 500px element on a 375px iPhone screen overflows the container.

**How to avoid:**
Make the prompt input width responsive. Inside a drawer context, it should be `width: '100%'` (filling the drawer). The desktop Popover can keep the fixed `500px` width.

Pass a `fullWidth` prop or `variant="drawer"` prop to `ScribeActionMenu` to toggle between fixed and fluid widths:
```jsx
// In ScribeActionMenu:
<Paper style={{ width: isMobile ? '100%' : 500, ... }}>
```

Or use `useBreakpoints()` directly inside `ScribeActionMenu` to set the width. Since `ScribeActionMenu` is always rendered inside a component that already uses `useBreakpoints()`, the context is available.

**Warning signs:**
- Horizontal scrollbar appears in drawer on mobile
- Prompt input is cut off at the right edge of the drawer
- Inspector shows `overflow-x: scroll` on the drawer container

**Phase to address:** Phase 2 (prompt input adaptation) — straightforward fix, but must be done before testing on real mobile dimensions.

---

### Pitfall 5: Focus Management Breaks When Transitioning Between Drawer and Popover Modes

**What goes wrong:**
The existing keyboard navigation system in `ScribeActionMenu` uses a custom focus management model: `tabIndex={-1}` on a `<Paper>`, `imperativeHandle` exposing `focus()`, and keyboard events captured at the Paper level. When the menu is inside a Drawer, MUI Drawer has its own focus trap (`enforceFocus`). The two focus management systems conflict: MUI tries to trap focus inside the drawer, while the custom `onKeyDown` handler intercepts arrows/Enter/Escape before MUI can act on them. The Escape key may close the MUI Drawer OR navigate back from a submenu — not both.

**Why it happens:**
MUI Drawer wraps content in a `Modal` with `enforceFocus` enabled by default. `enforceFocus` calls `focus()` on the first focusable element inside the modal on every interaction. When `ScribeActionMenu` manages focus itself (focusing a `<Paper tabIndex={-1}>`), MUI may override this with its own focus management, causing visible focus loss or the wrong element being focused.

Additionally, the existing `ScribePopover` uses `disableAutoFocus` and `disableEnforceFocus` to opt out of MUI's focus management. A new `<Drawer>` component requires the same explicit opt-outs.

**How to avoid:**
Add `disableEnforceFocus` and `disableAutoFocus` to the Drawer's `ModalProps`, matching the existing Popover configuration:
```jsx
<Drawer
  open={open}
  ModalProps={{
    disableScrollLock: true,
    disableEnforceFocus: true,
    disableAutoFocus: true,
  }}
>
```

For the Escape key conflict: in drawer mode, Escape from the root list should close the drawer; Escape from a submenu should navigate back to the root list. Implement this as a priority check in the keyboard handler:
```jsx
case 'Escape':
  if (isMobile && currentView !== 'root') {
    setCurrentView('root') // back navigation
  } else {
    onClose() // close drawer
  }
```

**Warning signs:**
- Focus visually disappears after clicking a list item in the drawer
- Tab key moves focus outside the drawer while it is open
- Escape key closes the drawer when the user intended to navigate back from a submenu

**Phase to address:** Phase 1 (drawer scaffold) — set the correct ModalProps from the start. Phase 2 (push navigation) — address Escape key semantics.

---

### Pitfall 6: Hover Events Trigger on Touch — Mouse-Move Gating is Irrelevant on Mobile but Active `onMouseLeave` Closes Submenu on Tap

**What goes wrong:**
The existing menu uses `onMouseEnter` and `onMouseLeave` on the wrapping `<div>` around each list item to show/hide the side submenu. On mobile (where hover does not exist but touch events fire synthetic mouse events), tapping a list item fires `onMouseLeave` on the previous item, which calls `setActiveSubmenu(null)` — potentially hiding a submenu that was just navigated into.

More critically, the `mouseMoveEnabledRef` gating (`mouseMoveEnabledRef.current = false` on mount, enabled by `mousemove`) was designed for desktop cursor hovering. On touch devices, there is no physical `mousemove` event from finger movement (though synthetic events may differ by browser). If `mouseMoveEnabledRef` stays `false` forever on mobile, hover-based submenu reveal is completely disabled — which is fine for push navigation, but the code must not also disable click-based submenu navigation.

**How to avoid:**
In mobile (drawer) mode, bypass all hover-based interaction entirely:
- Do not attach `onMouseEnter`/`onMouseLeave` handlers when `isMobile`
- The push navigation approach replaces hover submenus with click-to-navigate — clicks on parent items call `setCurrentView('submenu')`, not `setActiveSubmenu()`
- The `mouseMoveEnabledRef` gating is desktop-only; in drawer mode, `onClick` is the only interaction mechanism

Since the existing code will still render `onMouseLeave={() => { if (action.children) setActiveSubmenu(null) }}` on every item, passing `isMobile` into `ScribeActionMenu` and conditionally removing these handlers is the safest approach. Do not rely on `mouseMoveEnabledRef.current` being false to suppress them — that is an implementation detail that could change.

**Warning signs:**
- On mobile (or Chrome DevTools touch emulation), tapping an item with children briefly shows a submenu then immediately hides it
- `activeSubmenu` state flickers between a value and `null` on touch tap
- Push navigation state advances and then resets to root on the same tap

**Phase to address:** Phase 2 (push navigation) — when refactoring `ScribeActionMenu` to support drawer mode, remove hover handlers for the mobile branch rather than working around them.

---

## Moderate Pitfalls

Mistakes that cause significant bugs or rework but do not invalidate the architecture.

---

### Pitfall 7: Drawer Animation Conflicts with Popover Backdrop — Both Open Simultaneously

**What goes wrong:**
During rapid open/close cycling, or if a state update is missed, the Popover backdrop and the Drawer appear at the same time. The user sees two overlapping overlays, two click-to-close targets, and potentially two onClose callbacks firing.

**Why it happens:**
The v2.3 change makes `ScribePopover` conditionally render either a `<Popover>` or a `<Drawer>` based on `isMobile`. If the breakpoint changes while either is in the opening/closing animation (e.g., on screen rotation), the `open` prop for one variant is `true` while the other starts mounting. Both MUI components mount with `open={true}` briefly.

**How to avoid:**
The conditional rendering should be an either/or at the top level:
```jsx
return isMobile
  ? <Drawer open={open} ...>{menuContent}</Drawer>
  : <Popover open={open} ...>{menuContent}</Popover>
```

Not:
```jsx
<>
  <Drawer open={open && isMobile} ...>
  <Popover open={open && !isMobile} ...>
</>
```

The first form ensures only one is mounted in the DOM at any time. The second form has both mounted and both receiving the `open` prop transition, which can cause animation glitches on breakpoint change.

**Warning signs:**
- Rotating device while menu is open shows a visual flash
- Two backdrops are visible simultaneously
- `onClose` fires twice on a single dismiss action

**Phase to address:** Phase 1 (conditional render structure) — the either/or pattern must be the starting architecture.

---

### Pitfall 8: Push Navigation History Stack Not Reset on Drawer Close

**What goes wrong:**
The user opens the drawer, navigates into a submenu (e.g., Translate > [language submenu visible]), closes the drawer, then reopens it. The drawer reopens showing the submenu level instead of the root menu.

**Why it happens:**
Push navigation requires local state to track the current view (`'root'` or `{ view: 'submenu', parentId: 'translate' }`). If this state is stored as `useState` inside `ScribeActionMenu` and persists across drawer open/close cycles (because the component is not unmounted), the submenu state survives the close.

The existing `activeSubmenu` state has the same characteristic, but on desktop it is reset naturally because the mouse moves away. On mobile with push navigation, there is no equivalent reset trigger.

**How to avoid:**
Reset push navigation state when the drawer closes. The clean solution is to reset state in a `useEffect` on `open`:
```jsx
useEffect(() => {
  if (!open) {
    setCurrentView('root')
  }
}, [open])
```

The existing pattern in `ScribePopover` already does this for `step`, `result`, and `dragOffset` — follow the same pattern for push navigation state.

**Warning signs:**
- Opening the drawer after closing it shows the last visited submenu instead of the root
- Back button is visible when drawer is first opened (should only appear when in submenu)

**Phase to address:** Phase 2 (push navigation) — add the reset effect alongside push navigation state implementation.

---

### Pitfall 9: `useBreakpoints()` Not Available Inside `ScribeActionMenu` — Must Thread `isMobile` via Props

**What goes wrong:**
The developer calls `useBreakpoints()` inside `ScribeActionMenu` to control rendering. It throws: `"Cannot use useBreakpoints without BreakpointsProvider"`.

**Why it happens:**
`BreakpointsProvider` is mounted in `DriveProvider.jsx` which wraps the entire app. `ScribeActionMenu` is rendered inside `ScribePopover` which is rendered inside `View.jsx`. The provider chain is present. So `useBreakpoints()` should work inside `ScribeActionMenu` — it will NOT throw.

However, if tests (unit or Storybook) render `ScribeActionMenu` in isolation without `BreakpointsProvider`, they will throw. The `useBreakpoints` hook throws explicitly (not a graceful fallback) when context is null.

**How to avoid:**
Two valid approaches:
1. Call `useBreakpoints()` in `View.jsx` (already done there) and pass `isMobile` as a prop down to `ScribePopover` and then to `ScribeActionMenu`. This keeps the menu component testable in isolation.
2. Call `useBreakpoints()` directly inside `ScribeActionMenu` but wrap any test renders with `BreakpointsProvider`.

Approach 1 is preferred — it keeps `ScribeActionMenu` a pure component that does not depend on a provider, which is consistent with how it currently receives all other behavioral props.

**Warning signs:**
- Tests for `ScribeActionMenu` throw `"Cannot use useBreakpoints without BreakpointsProvider"`
- Storybook stories for the menu fail

**Phase to address:** Phase 1 (architecture decision) — decide prop-threading vs. hook at the start. Do not mix both.

---

### Pitfall 10: Keyboard Navigation Bindings Are Inverted for Push Navigation (ArrowRight Opens, ArrowLeft Goes Back)

**What goes wrong:**
On desktop, `ArrowRight` opens a submenu and `ArrowLeft` closes it. In push navigation (mobile drawer), the user navigates "forward" into a submenu by pressing Enter (or tapping), and "back" by pressing a Back button (or Android hardware back). If the existing keyboard handler still intercepts `ArrowLeft` in push navigation mode and calls `setCurrentView('root')`, it works — but `ArrowRight` from the root list now has nothing to do (there is no floating submenu to open), and pressing it does nothing while the user expects Enter to navigate into the submenu.

**Why it happens:**
The keyboard handler in `ScribeActionMenu` has two modes: `activeSubmenu` (desktop) and root list. In push navigation mode, `activeSubmenu` is always `null` (the submenu is shown by replacing the whole list, not by floating a `<Paper>`). The keyboard handler's submenu branch therefore never activates. All navigation relies on the root list branch, which does not know about push navigation state.

**How to avoid:**
Add a third mode to the keyboard handler for push navigation. When `isMobile && currentView !== 'root'`:
- `ArrowLeft` or `Escape` → navigate back to root
- `ArrowUp/Down` → navigate within the submenu items
- `Enter` → select the focused submenu item

When `isMobile && currentView === 'root'`:
- `Enter` on an item with children → push to submenu view (same as tap)
- `ArrowRight` → same as Enter for items with children (optional, for consistency)

Keep the desktop (`!isMobile`) keyboard handler unchanged.

**Warning signs:**
- Keyboard navigation stops working after refactoring for push navigation
- Enter key on a parent item with children has no effect on mobile
- Escape closes the entire drawer instead of navigating back from submenu

**Phase to address:** Phase 2 (push navigation) — keyboard handler is the most complex part of the push navigation implementation.

---

### Pitfall 11: Drawer `anchor="bottom"` vs `anchor="left"` — Wrong Anchor Breaks Full-Screen Intent

**What goes wrong:**
The milestone specifies "drawer plein écran sur mobile" (fullscreen drawer on mobile). Using `anchor="bottom"` gives a bottom sheet that slides up — not a fullscreen takeover. Using `anchor="left"` gives a side panel that only covers part of the screen. Neither gives true fullscreen by default.

**Why it happens:**
MUI Drawer does not have a "fullscreen" option. Fullscreen must be achieved by setting the drawer width/height to 100% via `PaperProps`:
```jsx
<Drawer
  anchor="bottom"
  PaperProps={{ style: { height: '100%', borderRadius: 0 } }}
>
```
or:
```jsx
<Drawer
  anchor="left"
  PaperProps={{ style: { width: '100%' } }}
>
```

Alternatively, cozy-ui's `BottomSheet` component (used by `ActionsMenu` for mobile) is NOT the right choice here — it has drag-to-dismiss, snap points, and complex height management. It is designed for action sheets, not for multi-level navigation menus with text input.

**How to avoid:**
Use MUI Drawer (re-exported as `cozy-ui/transpiled/react/Drawer`) with `anchor="bottom"` and `PaperProps={{ style: { height: '100%' } }}` for the fullscreen experience. Add a header with a title and a close button (X) at the top of the drawer to match cozy-ui design patterns. Do NOT use `BottomSheet` — it will fight against the push navigation content height changes.

**Warning signs:**
- Drawer slides up to 75% screen height and stops (default BottomSheet/Drawer behavior)
- Drawer has a drag handle at the top (BottomSheet indicator)
- Content below the drawer is still visible and tappable

**Phase to address:** Phase 1 (drawer scaffold) — anchor and height are foundational to the drawer UX.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Duplicate `isMobile` conditional rendering inside `ScribeActionMenu` | Avoids prop threading | Two separate render paths diverge over time, bugs fixed in one not the other | Never — keep a single `isMobile` prop threaded from `View.jsx` |
| Reuse `activeSubmenu` state for push navigation | No new state variable | Absolute submenu and push nav have different semantics; collisions cause bugs | Never — add a separate `currentView` state for push navigation |
| BottomSheet for mobile menu | Reuses existing cozy-ui component | Drag gestures, snap points, and height management fight multi-level navigation | Never for this use case |
| Skip keyboard navigation for mobile | Saves implementation time | Keyboard users (external keyboards on iPad) cannot use the menu | Only acceptable if explicitly out of scope |
| `width: '100%'` hardcoded for mobile prompt input | Simple fix | No longer accurate if drawer adds horizontal padding | Acceptable if using `flexGrow: 1` or box-model-aware width |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| MUI Drawer + custom focus management | Letting MUI's `enforceFocus` fight custom `tabIndex={-1}` Paper focus | Add `ModalProps={{ disableEnforceFocus: true, disableAutoFocus: true }}` to Drawer |
| MUI Drawer + nested iframe | Default scroll lock shifts layout in iframe context | Add `ModalProps={{ disableScrollLock: true }}` to Drawer |
| `useBreakpoints()` in tests | Hook throws without provider | Thread `isMobile` as a prop OR wrap test renders with `BreakpointsProvider` |
| Push nav state + drawer open/close | Submenu state persists across close | Reset push nav state via `useEffect` on `open` prop change |
| Drawer + ScribePopover 3-step state machine | Drawer wraps only the menu step but not loading/result | Keep the `step` state at `ScribePopover` level; only the `menu` step renders the Drawer |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No back button in push navigation | User is trapped in submenu with no way back | Always show a back arrow in the drawer header when `currentView !== 'root'` |
| Drawer header shows action title but not parent breadcrumb | User loses context of where they are in the menu | Show parent item label (e.g., "Translate") in the drawer header when in submenu |
| Drawer closes on outside tap without any close button | Power users expect an explicit close affordance | Add an X button in the drawer header AND keep outside-tap-to-close behavior |
| Prompt input loses submitted text on mobile (auto-clear) | User cannot see what they submitted before result appears | Same behavior as desktop — clear input after submit, breadcrumb shows the submitted text in result step |
| Drawer animation is slow on low-end Android | Menu feels unresponsive | Test with `transitionDuration={{ enter: 200, exit: 150 }}` on Drawer — reduce from MUI default 225ms/195ms |

---

## "Looks Done But Isn't" Checklist

- [ ] **isMobile trigger**: Open Scribe on a 375px-wide viewport (Chrome DevTools). Verify the drawer appears — NOT the Popover.
- [ ] **Desktop unaffected**: Open Scribe on a 1200px-wide viewport. Verify the existing Popover with floating submenus still works exactly as before.
- [ ] **Push navigation state reset**: Navigate into Translate submenu, close the drawer, reopen it. Verify the root menu shows — not the Translate submenu.
- [ ] **Back button visible only in submenu**: In the root list, no back button is visible. After tapping "Translate", a back arrow appears in the drawer header.
- [ ] **Prompt input fills drawer width**: On 375px viewport, the prompt input fills the drawer width with no horizontal overflow.
- [ ] **Submenu on desktop is unchanged**: Hover over "Translate" on desktop, the floating submenu still appears to the right of the menu.
- [ ] **Escape key semantics**: In submenu view (drawer, mobile), pressing Escape goes back to root. In root view, Escape closes the drawer.
- [ ] **Scroll lock absent**: Opening the drawer does NOT cause a layout shift in the OO editor or any horizontal jump.
- [ ] **Focus visible in drawer**: After drawer opens, keyboard focus is visible on the first menu item (or the drawer Paper).
- [ ] **Free prompt submit works in drawer**: Type a prompt in the drawer, tap the send button. The drawer should close and the loading step should appear.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Absolute submenu inside drawer (Pitfall 3) | HIGH | Remove absolute submenu render path, implement push navigation — essentially a rewrite of the submenu mechanism |
| Wrong breakpoint source (Pitfall 1) | MEDIUM | Add diagnostic log, verify breakpoint fires at correct threshold, adjust `BreakpointsProvider` config if needed |
| MUI focus conflict (Pitfall 5) | LOW | Add `disableEnforceFocus` to Drawer ModalProps — one-line fix |
| 500px hardcoded width overflow (Pitfall 4) | LOW | Replace `width: 500` with `width: isMobile ? '100%' : 500` |
| Push nav state not reset on close (Pitfall 8) | LOW | Add `useEffect` with `open` dependency to reset `currentView` |
| Both Drawer and Popover mounted simultaneously (Pitfall 7) | MEDIUM | Refactor conditional render to either/or pattern, unmount unused variant |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Breakpoint diagnostic (Pitfall 1) | Phase 1 — drawer scaffold | Console log confirms `isMobile: true` at < 768px |
| Scroll lock layout shift (Pitfall 2) | Phase 1 — drawer scaffold | Open drawer, verify no horizontal layout jump |
| Absolute submenu cannot go inside drawer (Pitfall 3) | Phase 1 — architectural decision | Do not attempt to reuse absolute submenu; plan push navigation from day one |
| 500px prompt input overflow (Pitfall 4) | Phase 2 — prompt input adaptation | Verify no overflow on 375px viewport in devtools |
| Focus management conflict (Pitfall 5) | Phase 1 — drawer scaffold | Verify keyboard focus visible after drawer opens |
| Hover handlers break touch interaction (Pitfall 6) | Phase 2 — push navigation | Test tap behavior with devtools touch emulation |
| Drawer/Popover simultaneous render (Pitfall 7) | Phase 1 — conditional render structure | Use either/or render pattern from the start |
| Push nav state not reset on close (Pitfall 8) | Phase 2 — push navigation state | Test close + reopen cycle in submenu |
| `useBreakpoints` in isolation tests (Pitfall 9) | Phase 1 — architecture | Thread `isMobile` as prop, avoid hook in menu component |
| Keyboard nav for push navigation (Pitfall 10) | Phase 2 — push navigation | Test ArrowDown/Enter/Escape in both root and submenu views on mobile |
| Wrong Drawer anchor (Pitfall 11) | Phase 1 — drawer scaffold | Verify drawer covers 100% of screen height |

---

## Sources

- cozy-drive source: `src/modules/views/OnlyOffice/Scribe/ScribeActionMenu.jsx` — direct analysis, HIGH confidence
- cozy-drive source: `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` — direct analysis, HIGH confidence
- cozy-drive source: `src/lib/DriveProvider.jsx` — BreakpointsProvider setup, HIGH confidence
- cozy-ui source: `node_modules/cozy-ui/transpiled/react/providers/Breakpoints/index.js` — useBreakpoints, HIGH confidence
- cozy-ui source: `node_modules/cozy-ui/transpiled/react/providers/Breakpoints/useIframeConnection.js` — iframe postMessage breakpoint protocol, HIGH confidence
- cozy-ui source: `node_modules/cozy-ui/transpiled/react/helpers/breakpoints.js` — isMobile threshold (0–768px), HIGH confidence
- cozy-ui source: `node_modules/cozy-ui/transpiled/react/ActionsMenu/ActionsMenuWrapper.js` — cozy-ui's own pattern for isMobile ? BottomSheet : Menu, HIGH confidence
- cozy-ui source: `node_modules/cozy-ui/transpiled/react/BottomSheet/BottomSheet.js` — `document.body.style.overflow = 'hidden'` scroll lock behavior, HIGH confidence
- cozy-ui source: `node_modules/cozy-ui/transpiled/react/Drawer/index.js` — re-exports MUI Drawer directly, HIGH confidence
- MUI Drawer docs — `disableScrollLock`, `ModalProps`, `PaperProps`, `anchor` — MEDIUM confidence (based on MUI v4/v5 knowledge, version used in cozy-ui not explicitly verified)

---
*Pitfalls research for: Responsive drawer with push navigation in Scribe v2.3 (Cozy Drive + OnlyOffice)*
*Researched: 2026-03-12*
