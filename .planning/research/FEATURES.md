# Feature Landscape: v2.3 Responsive Drawer Menu

**Domain:** Responsive mobile navigation — drawer with push navigation for AI writing assistant
**Milestone:** v2.3 — replacing Popover-based menu with a drawer that works on mobile
**Researched:** 2026-03-12
**Confidence:** HIGH — drawer patterns are well-established; cozy-ui Drawer and useBreakpoints are confirmed present in the codebase; behavior expectations come from Material Design standards and real React implementations.

---

## Existing Foundation (Already Shipped, Must Not Break)

These components are working on desktop and must continue to function after v2.3.

| Component | Status | Notes |
|-----------|--------|-------|
| `ScribePopover` — centered Popover with backdrop | Shipped | Wraps `ScribeActionMenu` + `ScribeResultPanel` |
| `ScribeActionMenu` — list + absolute-positioned submenus on hover/click/keyboard | Shipped | 500px prompt input, hover gating, full keyboard nav |
| `ScribeResultPanel` — draggable/resizable result panel | Shipped | Drag on header/background, resize grip |
| `ScribeFloatingButton` — portal-rendered bottom-right button | Shipped | z-index 100000, portal on document.body |
| `useBreakpoints` from `cozy-ui/transpiled/react/providers/Breakpoints` | Available | `isMobile` = width ≤ 768px |
| `Drawer` from `cozy-ui/transpiled/react` (passes through to MUI) | Available | `temporary` variant for mobile overlay |

---

## Table Stakes

Features that must be present for the responsive milestone to be considered complete. Missing any of these means the mobile experience is broken or the desktop regression has occurred.

| # | Feature | Why Expected | Complexity | Dependencies | Notes |
|---|---------|--------------|------------|--------------|-------|
| 1 | **Drawer opens full-width on mobile** | On narrow screens the existing centered Popover clips or overflows. A full-width bottom-anchored or left-anchored drawer is the standard mobile pattern. | LOW | `useBreakpoints().isMobile`, `Drawer` with `anchor="bottom"` or `anchor="left"`, `variant="temporary"` | Full-width (100vw) or full-height is the correct treatment. Bottom-anchor is most thumb-friendly on phones. |
| 2 | **Drawer slides in with standard animation** | All established mobile UI (iOS, Android, MUI) slides drawers in. Instant appearance feels broken. | LOW | MUI Drawer transitions are built-in | No custom animation code needed — MUI `temporary` variant handles slide + backdrop. |
| 3 | **Backdrop closes drawer on tap outside** | Standard modal dismissal behavior. Tapping outside the drawer must close it. | LOW | MUI Drawer `onClose` prop | Already how `ScribePopover` works with Popover `onClose`. Reuse `handleClose`. |
| 4 | **Submenus replace main list via push navigation** | On mobile, absolute-positioned side-fly submenus are unusable (no hover, no screen width). The standard mobile pattern is push: tapping a parent item replaces the list in place with the submenu content, with a back affordance. | MEDIUM | New navigation state `{ view: 'root' \| 'submenu', activeAction }` in `ScribeActionMenu` or in `ScribePopover` | This replaces the `activeSubmenu` hover-flyout pattern only in mobile mode. Desktop behavior unchanged. |
| 5 | **Back button / back header in submenu view** | Without a back affordance the user is stuck in the submenu. Standard pattern: a header row with a left-arrow icon + parent label, tapping it returns to the root list. | LOW | Left arrow icon from cozy-ui, click handler resetting navigation state | Should visually match the submenu title (e.g. "Translate", "Change Tone") with back arrow prepended. |
| 6 | **Prompt input fills drawer width** | The current 500px fixed-width prompt input is narrower than a 390px phone screen. It must adapt to the drawer width. | LOW | Remove `width: 500` from `ScribePromptInput`'s Paper wrapper, replace with `width: '100%'` | Already `fullWidth` on the InputBase; only the Paper wrapper is constrained. |
| 7 | **Desktop behavior unchanged** | The popover + flyout submenu must work exactly as before for `!isMobile`. | LOW | Conditional rendering based on `isMobile` | Keep both paths in code. Desktop = Popover + ScribeActionMenu as-is. Mobile = Drawer + push-nav variant. |
| 8 | **Loading and result steps display in drawer on mobile** | The three-step state machine (menu → loading → result) must all render inside the drawer on mobile, not in a floating panel. | MEDIUM | `ScribeResultPanel` inside Drawer must not use drag/resize (no space, no pointer constraints on mobile) | Result panel inside a full-screen drawer is static. Disable drag + resize on mobile. |

---

## Differentiators

Features that go beyond the minimum but are low-cost and meaningfully improve the mobile experience.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| D1 | **Smooth push animation on submenu transition** | A CSS `translateX` slide-in/out between root and submenu views makes the push navigation feel native rather than an abrupt list swap. | LOW-MEDIUM | CSS transition on a container div. State: `sliding` flag during transition. The list container slides left when entering a submenu, slides right when going back. Two divs (root list + submenu list) with `translateX(0)` / `translateX(-100%)`. | Not required, but standard in iOS-style drawers. |
| D2 | **Drawer header with action title when loading/result** | The Scribe icon + "Scribe" label in a drawer header gives context on all three steps (menu/loading/result), especially on mobile where the full page isn't visible. | LOW | Static header row inside the Drawer above the step content. Close button (X) in header right corner. | Replaces the current Popover backdrop + no-header treatment. |
| D3 | **Touch-swipe to close drawer** | On mobile, swipe-down (bottom drawer) or swipe-left (left drawer) to dismiss is ergonomic. | MEDIUM | MUI `SwipeableDrawer` instead of `Drawer`. Already available as `cozy-ui/transpiled/react/SwipeableDrawer`. | SwipeableDrawer has performance cost on iOS (needs `disableBackdropTransition` + `disableDiscovery` on iOS to avoid jank). Only worth it if bottom-anchor is chosen. |

---

## Anti-Features

Features that seem like improvements but should be explicitly avoided for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Redesigning the desktop menu** | The desktop menu (Popover + flyout submenus) is working well with hover gating, keyboard nav, and all focus management. Touching it to "unify" with the mobile path risks regressions across all the v2.2 work (hover gating, focus order, drag/resize). | Keep desktop path 100% intact. `isMobile` branches cleanly at the `ScribePopover` level. |
| **Animated transitions in desktop mode** | The desktop popover has no animation today, and users aren't expecting slide animations in a Popover context. Adding them creates complexity without user value. | Animations only in the mobile drawer path. |
| **Full component rewrite for mobile** | Rewriting `ScribeActionMenu` as a single unified responsive component risks breaking the working desktop implementation. | Create a separate `ScribeDrawer` (or a `ScribeActionMenu` with a `mobile` prop) that renders the push-nav pattern independently. Share only the data (`SCRIBE_ACTIONS`, event handlers) with the desktop menu, not the rendering logic. |
| **Custom breakpoint logic** | Defining mobile thresholds manually (e.g. `window.innerWidth < 600`) when `cozy-ui` already provides `useBreakpoints().isMobile` (≤768px) creates inconsistency with the rest of Cozy Drive's responsive behavior. | Use `useBreakpoints().isMobile` exclusively. |
| **Drag and resize in mobile drawer** | The result panel's drag/resize affordances are pointer-device features. On mobile, they are unusable (touch drag conflicts with scroll, resize grip is too small). Enabling them on mobile creates confusion. | Disable `onDragMove` and `onResize` (pass null) when `isMobile` is true. Result panel fills its drawer container statically. |
| **Bottom sheet instead of drawer** | The existing cozy-ui `BottomSheet` component (used by `ActionsMenuWrapper` for mobile) is designed for action sheets with ~3-6 short items. The Scribe menu has 4 top-level items with deep submenus + prompt input. A bottom sheet would need custom height management and scroll. | Use `Drawer` with `anchor="bottom"` (full height, scrollable content) rather than `BottomSheet`. |

---

## Feature Dependencies

```
useBreakpoints().isMobile
    └──controls──> drawer vs popover rendering in ScribePopover

Drawer (mobile path)
    ├──requires──> Push navigation state (view: 'root'|'submenu', activeAction)
    │                  └──required by──> Back button / header
    ├──requires──> Prompt input width: '100%' (remove 500px fixed)
    └──requires──> Result panel static mode (no drag/resize on mobile)

SCRIBE_ACTIONS data structure
    └──shared by──> Desktop ScribeActionMenu (hover flyout, unchanged)
                    Mobile push navigation (new rendering)

ScribePopover step machine (menu → loading → result)
    └──unchanged──> Same logic, different container (Popover vs Drawer)
```

### Dependency Notes

- **Push navigation requires `isMobile`:** The push-nav state only activates when in drawer mode. Desktop retains the `activeSubmenu` hover flyout state already in `ScribeActionMenu`.
- **Back button requires push navigation state:** The back affordance is meaningless without a navigation stack. They are built together.
- **Width fix is independent:** The 500px prompt input fix is a one-line change that benefits mobile. It can be shipped alone but logically belongs with the drawer work.
- **Result panel static mode depends on `isMobile`:** The drag/resize props are simply not passed when in mobile mode. `ScribeResultPanel` already handles null `onDragMove`/`onResize` gracefully (the features are optional).

---

## MVP Definition

### Must Have for v2.3 (Table Stakes 1–8)

- [ ] **Drawer opens full-width on mobile** (`isMobile`) with standard MUI slide animation and backdrop close
- [ ] **Push navigation for submenus** — tap parent item, list is replaced in-place by submenu items
- [ ] **Back button/header in submenu view** — returns to root list
- [ ] **Prompt input fills drawer width** — remove 500px fixed width on mobile
- [ ] **All three steps (menu/loading/result) inside the drawer** on mobile
- [ ] **Result panel static** (no drag/resize) inside the drawer on mobile
- [ ] **Desktop Popover path completely unchanged**

### Add After Validation (v2.3.x)

- [ ] **Slide push animation (D1)** — CSS translateX transition on list swap — only if initial implementation without animation feels jarring
- [ ] **Drawer header with title (D2)** — context header on all steps — quick win once drawer is working

### Future Consideration (v3.0)

- [ ] **SwipeableDrawer (D3)** — swipe-to-close — adds complexity, only warranted if bottom-anchor is chosen and user testing confirms demand

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Drawer fullscreen on mobile | HIGH | LOW | P1 |
| Push navigation for submenus | HIGH | MEDIUM | P1 |
| Back button/header | HIGH | LOW | P1 |
| Prompt width fix | HIGH | LOW | P1 |
| Loading/result in drawer | HIGH | LOW | P1 |
| Static result panel on mobile | MEDIUM | LOW | P1 |
| Desktop unchanged | HIGH (regression prevention) | LOW (branch only) | P1 |
| Slide push animation | MEDIUM | LOW-MEDIUM | P2 |
| Drawer header with title | LOW | LOW | P2 |
| SwipeableDrawer | LOW | MEDIUM | P3 |

---

## Push Navigation — Behavior Specification

This pattern is the most novel feature in v2.3. Explicit specification prevents ambiguity during implementation.

### Root view
- Shows all top-level actions as a list (same as current desktop menu)
- Actions with children show a right-arrow icon at the end of the row
- Tapping a leaf action (no children) → triggers `onSelect`, closes drawer
- Tapping a parent action (has children) → transitions to submenu view for that action
- Prompt input below the list (full-width)

### Submenu view
- Header row: left-arrow icon + parent action label (e.g., "← Translate")
- Body: list of child items for the parent action
- Translate submenu includes the custom language input item at the bottom
- Tapping a child action → triggers `onSelect`, closes drawer
- Tapping the back header → returns to root view
- Hardware back button (Android) → returns to root view (standard browser history behavior not applicable here; use a keydown listener for `Escape` key on desktop equivalent)

### Transition
- Minimum: instant list swap (no animation) — acceptable for MVP
- Enhanced: CSS translateX slide (root slides left, submenu slides in from right; back reverses direction)

### State shape
```javascript
// New state in mobile path (separate from desktop activeSubmenu)
const [mobileView, setMobileView] = useState('root') // 'root' | 'submenu'
const [mobileSubmenuAction, setMobileSubmenuAction] = useState(null) // action.id
```

---

## Sources

- [MUI Drawer documentation](https://mui.com/material-ui/react-drawer/) — variants, anchor, temporary modal behavior — HIGH confidence
- [Material Design 3 Navigation Drawer guidelines](https://m3.material.io/components/navigation-drawer/guidelines) — standard behavior expectations — HIGH confidence
- [Mobile Navigation UX Best Practices 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/) — push navigation as standard mobile submenu pattern — MEDIUM confidence
- cozy-ui source (`/node_modules/cozy-ui/transpiled/react/helpers/breakpoints.js`) — `isMobile` = width ≤ 768px — HIGH confidence (confirmed in codebase)
- cozy-ui source (`ActionsMenuWrapper.js`) — confirms `useBreakpoints` usage pattern and `isMobile` destructuring — HIGH confidence (confirmed in codebase)
- cozy-ui module index — `Drawer` and `SwipeableDrawer` both present — HIGH confidence (confirmed in codebase)

---
*Feature research for: v2.3 Responsive Drawer Menu*
*Researched: 2026-03-12*
