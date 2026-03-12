# Architecture Research

**Domain:** Responsive drawer integration for Scribe AI assistant in OnlyOffice/Cozy Drive
**Researched:** 2026-03-12
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         View.jsx (entry point)                       │
│  useBreakpoints() → isMobile  (already present, unused for Scribe)  │
│  useCozyBridge() → { pendingIntent, showScribeButton, respond }      │
├─────────────────────────────────────────────────────────────────────┤
│                    ScribePopover.jsx  (MODIFIED)                     │
│                                                                      │
│  isMobile=false → MUI Popover (center viewport, existing)           │
│  isMobile=true  → MUI Drawer  (anchor=bottom, fullscreen)           │
│                                                                      │
│  Owns: step machine (menu / loading / result)                        │
│  Owns: abortRef, result, loadingMessage, lastAction                  │
│  Owns: dragOffset, panelSize (desktop only — not passed on mobile)   │
├──────────────────────────┬──────────────────────────────────────────┤
│  ScribeActionMenu.jsx    │  ScribeResultPanel.jsx                    │
│  (MODIFIED)              │  (NO STRUCTURAL CHANGE)                   │
│                          │                                           │
│  receives isMobile prop  │  Drag/resize props default to null        │
│                          │  on mobile — handlers exist but are       │
│  isMobile=false:         │  inert because Drawer owns layout         │
│    two Paper cards       │                                           │
│    (existing layout)     │                                           │
│    flyout submenus       │                                           │
│    (position: absolute)  │                                           │
│                          │                                           │
│  isMobile=true:          │                                           │
│    delegates to          │                                           │
│    ScribeDrawerMenu      │                                           │
│    (push navigation)     │                                           │
└──────────────┬───────────┴──────────────────────────────────────────┘
               │
┌──────────────▼───────────┐
│   ScribeDrawerMenu.jsx   │
│   (NEW — mobile only)    │
│                          │
│   viewStack state        │
│   [{ type:'root' }]      │
│     → { type:'submenu',  │
│         actionId }       │
│                          │
│   Back header row        │
│   Full-width list items  │
│   Full-width prompt      │
└──────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Modified for v2.3? |
|-----------|---------------|---------------------|
| `View.jsx` | Passes `isMobile` to ScribePopover | YES — one prop added |
| `ScribePopover.jsx` | Chooses Popover vs Drawer container; owns step machine | YES — major |
| `ScribeActionMenu.jsx` | Renders desktop two-card layout OR delegates to ScribeDrawerMenu | YES — major |
| `ScribeDrawerMenu.jsx` | Push-navigation view stack for mobile submenus | YES — new file |
| `ScribePromptInput.jsx` | Free-prompt input row | YES — remove hard-coded 500px width |
| `ScribeResultPanel.jsx` | AI result with drag/resize (inert on mobile) | NO — structurally unchanged |
| `scribeActions.js` | Declarative action tree | NO |

## Recommended Project Structure

No new directories. One new component file. The existing Scribe module structure is preserved.

```
src/modules/views/OnlyOffice/Scribe/
├── ScribePopover.jsx          # MODIFIED: isMobile prop → Popover|Drawer switch
├── ScribeActionMenu.jsx       # MODIFIED: isMobile prop, delegates to ScribeDrawerMenu on mobile
├── ScribeDrawerMenu.jsx       # NEW: push-navigation view stack (mobile only)
├── ScribePromptInput.jsx      # MODIFIED: remove hard-coded width: 500px
├── ScribeResultPanel.jsx      # unchanged
├── MarkdownPreview.jsx        # unchanged
├── scribeActions.js           # unchanged
├── scribeAI.js                # unchanged
├── scribeConversion.js        # unchanged
├── scribeDevMode.js           # unchanged
├── mockTransform.js           # unchanged
└── scribe.styl                # MINOR: add .scribe-drawer-header, .scribe-drawer-list classes
```

### Structure Rationale

- **ScribeDrawerMenu.jsx (new):** The push-navigation stack (root view → submenu view) is sufficiently complex — back button, dynamic header, full-width list items, custom lang input inline — to justify its own file rather than a 200-line `if (isMobile)` block inside `ScribeActionMenu`.
- **ScribePromptInput.jsx:** Only the Paper wrapper in `ScribeActionMenu` has `width: 500px`. The input component itself has no width constraint; the fix is in `ScribeActionMenu`'s layout code, not in `ScribePromptInput`.

## Architectural Patterns

### Pattern 1: isMobile prop threading

**What:** `isMobile` is read once in `View.jsx` (already calls `useBreakpoints()`) and passed as a prop down to `ScribePopover`, then to `ScribeActionMenu`. No hook duplication, no new context needed.

**When to use:** When a single boolean reaches 2-3 component levels deep. Prop drilling is appropriate at this depth; a dedicated context would add indirection with no benefit.

**Trade-offs:** Explicit and testable. Each component's interface clearly declares its dependency on `isMobile`. Becomes unwieldy only beyond 4-5 levels, which is not the case here.

```jsx
// View.jsx (add one prop)
const { isMobile } = useBreakpoints() // already exists
<ScribePopover isMobile={isMobile} ... />

// ScribePopover.jsx
const ScribePopover = ({ isMobile, ...rest }) => {
  const content = (
    <>
      {step === 'menu' && (
        <ScribeActionMenu isMobile={isMobile} ref={menuRef} ... />
      )}
      {/* loading and result steps: same on both */}
    </>
  )
  return isMobile ? (
    <Drawer anchor="bottom" open={open} onClose={handleClose}
      PaperProps={{ style: { height: '100%', maxHeight: '100%', borderRadius: 0 } }}>
      {content}
    </Drawer>
  ) : (
    <Popover ... >{content}</Popover>
  )
}
```

### Pattern 2: Push-navigation view stack for mobile submenus

**What:** `ScribeDrawerMenu` maintains a `viewStack` state array tracking navigation history. The current view is `viewStack[viewStack.length - 1]`. Each view is a descriptor: `{ type: 'root' }` or `{ type: 'submenu', actionId: string }`. Push appends; the Back button pops.

**When to use:** Whenever a nested menu needs mobile-style in-place navigation instead of flyout panels. The stack replaces `position: absolute` flyouts (which work on desktop but overflow or clip on mobile).

**Trade-offs:** Simple. No animation library required (the Drawer entry animation handles perceived responsiveness). The action tree never exceeds depth 2 (root + one submenu level), so the stack is always either 1 or 2 entries.

```jsx
// ScribeDrawerMenu.jsx
const ScribeDrawerMenu = ({ actions, onSelect, onClose, t }) => {
  const [viewStack, setViewStack] = useState([{ type: 'root' }])
  const currentView = viewStack[viewStack.length - 1]

  const pushSubmenu = (actionId) =>
    setViewStack(prev => [...prev, { type: 'submenu', actionId }])

  const popView = () =>
    setViewStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev)

  if (currentView.type === 'root') {
    return <RootView actions={actions} onPush={pushSubmenu} onSelect={onSelect} t={t} />
  }
  const parent = actions.find(a => a.id === currentView.actionId)
  return <SubmenuView parent={parent} onBack={popView} onSelect={onSelect} t={t} />
}
```

### Pattern 3: ScribeResultPanel unchanged — drag/resize inert on mobile

**What:** `ScribeResultPanel` already accepts `dragOffset`, `onDragMove`, `panelSize`, `onResize` as props that default to `null`. On mobile, `ScribePopover` simply omits these props — the defaultProps take effect and the drag/resize event handlers are never registered.

**When to use:** When a component has desktop-only interactive behaviors that must be absent on mobile without modifying the component itself.

**Trade-offs:** Zero mobile-specific code in `ScribeResultPanel`. The Drawer's full-screen layout and native scrolling subsume the need for manual resize and drag.

## Data Flow

### Menu navigation flow — desktop (unchanged)

```
User hover/click on action with children
    ↓
ScribeActionMenu: setActiveSubmenu(actionId)
    ↓
Absolute-positioned Paper renders at left: 100%
    ↓
User clicks child → onSelect(childId, label, breadcrumb)
    ↓
ScribePopover: handleActionSelect → AI call → setStep('result')
```

### Menu navigation flow — mobile (new)

```
User taps action with children (inside ScribeDrawerMenu root view)
    ↓
ScribeDrawerMenu: pushSubmenu(actionId)
    ↓
Re-render: submenu view replaces root view (in-place, no animation)
Back header shows parent action label + back button
    ↓
User taps child → onSelect(childId, label, breadcrumb)
    ↓
ScribePopover: handleActionSelect → AI call → setStep('result')
(identical downstream flow as desktop from this point)
```

### Drawer open/close lifecycle

```
pendingIntent becomes truthy in useCozyBridge (existing)
    ↓
ScribePopover: open=true
    ↓
isMobile=false → Popover (center viewport, existing behavior)
isMobile=true  → Drawer (anchor=bottom, 100% height)
    ↓
step='menu'    → ScribeActionMenu (desktop layout or ScribeDrawerMenu)
step='loading' → Spinner Paper (same on both)
step='result'  → ScribeResultPanel (drag/resize props omitted on mobile)
    ↓
onClose → Drawer/Popover closes → step resets to 'menu' on next open
```

### Key data flows

1. **isMobile propagation:** `View.jsx` reads `useBreakpoints()` (already there) → passes `isMobile` to `ScribePopover` → passes to `ScribeActionMenu` → passes to `ScribeDrawerMenu`. Single read point, no hook duplication.

2. **View stack state:** Owned entirely by `ScribeDrawerMenu`. Never propagates upward. When the user selects an action, `onSelect` fires and the stack state is irrelevant from that point forward.

3. **Prompt input width:** The `width: 500px` Paper wrapper is in `ScribeActionMenu`, not inside `ScribePromptInput`. On mobile, that Paper should be `width: '100%'`. The fix is a conditional style in `ScribeActionMenu`'s JSX: `style={{ width: isMobile ? '100%' : 500 }}`.

## Scaling Considerations

Not applicable — this is a responsive layout refactor, not a backend or data scaling concern.

## Anti-Patterns

### Anti-Pattern 1: Duplicating the step machine in a separate mobile component

**What people do:** Create a `ScribeDrawer.jsx` that reimplements menu → loading → result state and the AI call logic for mobile.

**Why it's wrong:** The step machine, `handleActionSelect` async logic, `AbortController`, and retry handling all live in `ScribePopover`. Duplicating them creates two sources of truth that diverge over time. The mobile path needs only two things to change: the container shell (Popover → Drawer) and the menu layout (flyout → push navigation).

**Do this instead:** `ScribePopover` remains the single orchestrator. It chooses its container based on `isMobile`, then renders the same step machine content inside either shell.

### Anti-Pattern 2: Calling useBreakpoints inside ScribeActionMenu

**What people do:** Call `useBreakpoints()` inside `ScribeActionMenu` to avoid prop threading, reasoning it keeps the component self-contained.

**Why it's wrong:** `View.jsx` already calls `useBreakpoints()`. Calling it again in a child creates a second context subscription for the same value. It also couples `ScribeActionMenu` to the global breakpoints context, making it harder to unit test (requires BreakpointsProvider in test setup).

**Do this instead:** Receive `isMobile` as a prop from `ScribePopover`. At 2-level depth (Popover → ActionMenu), props are the right tool.

### Anti-Pattern 3: Rendering both Drawer and Popover simultaneously

**What people do:** Keep both mounted but set `open={false}` on whichever is not active, believing it avoids mount/unmount cost on viewport resize.

**Why it's wrong:** Both MUI Popover and Drawer create Portal elements in `document.body`. Having both mounted adds unnecessary DOM nodes and potential z-index conflicts. `isMobile` only changes on viewport resize (not during a Scribe session), so the mount/unmount cost on resize is negligible.

**Do this instead:** `isMobile ? <Drawer ...> : <Popover ...>` — render only one at a time.

### Anti-Pattern 4: Adding slide/transition animation to push navigation

**What people do:** Reach for `react-transition-group` or a custom CSS slide animation to animate root → submenu navigation.

**Why it's wrong:** The v2.3 requirements state "push navigation" as the interaction model — navigation, not animation. The Drawer's entry animation already provides perceived responsiveness. Adding a transition library adds bundle size and implementation complexity for a non-required polish item.

**Do this instead:** Simple state swap — `currentView` changes, list re-renders immediately. No animation library. Revisit polish only if users request it.

### Anti-Pattern 5: Using keyboard navigation logic from the desktop menu in ScribeDrawerMenu

**What people do:** Reuse the complex arrow-key + submenu focus state from `ScribeActionMenu` in the mobile drawer.

**Why it's wrong:** Mobile touch doesn't use arrow navigation. The desktop keyboard state (`focusIndex`, `submenuFocusIndex`, `mouseMoveEnabledRef`) is entirely irrelevant on mobile. Sharing this logic couples the two layouts unnecessarily.

**Do this instead:** `ScribeDrawerMenu` handles only tap/click interactions. No `focusIndex` state, no `mouseMoveEnabledRef`. Keep them cleanly separated.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| cozy-ui Drawer | `import Drawer from 'cozy-ui/transpiled/react/Drawer'` — thin re-export of MUI Drawer | `anchor="bottom"`, `PaperProps={{ style: { height: '100%' } }}` for fullscreen. `variant="temporary"` (default). |
| cozy-ui useBreakpoints | Already imported in View.jsx | `isMobile` is `true` when `window.innerWidth <= 768px`. No change to breakpoint logic. |
| MUI Popover | Existing desktop container — unchanged | `anchorReference="anchorPosition"`, center viewport positioning |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `View.jsx` → `ScribePopover` | `isMobile` prop added | View already reads `useBreakpoints()`; one-line change |
| `ScribePopover` → `ScribeActionMenu` | `isMobile` prop threaded through | Add to `ScribeActionMenu` PropTypes |
| `ScribeActionMenu` → `ScribeDrawerMenu` | `actions`, `onSelect`, `onClose`, `t` as props | ScribeDrawerMenu is purely presentational — `useState` only, no external hooks |
| `ScribePopover` → `ScribeResultPanel` | No interface change | `dragOffset`/`panelSize` not passed on mobile; defaultProps `null` values take effect |

## Build Order

Dependencies flow from smallest change to largest integration:

1. **`ScribePromptInput.jsx`** — Remove the hard-coded `width: 500px` from the Paper wrapper in `ScribeActionMenu` (it is in `ScribeActionMenu`, not inside `ScribePromptInput`). Change to `width: isMobile ? '100%' : 500`. This is the smallest change and has zero risk.

2. **`ScribeDrawerMenu.jsx` (new)** — Build the push-navigation component in complete isolation. Takes `actions`, `t`, `onSelect`, `onClose` as props, manages `viewStack` state internally. No dependency on Popover or Drawer. Testable standalone by rendering with mock actions.

3. **`ScribeActionMenu.jsx`** — Add `isMobile` prop. On `isMobile=true`: render `<ScribeDrawerMenu .../>` passing through actions and callbacks. On `isMobile=false`: keep the existing two-Paper layout exactly as-is. This is the largest change but isolated to a conditional render.

4. **`ScribePopover.jsx`** — Add `isMobile` prop. Conditional container: `isMobile ? <Drawer ...> : <Popover ...>`. Pass `isMobile` to `ScribeActionMenu`. On mobile, do not pass `dragOffset`/`panelSize`/`onDragMove`/`onResize` to `ScribeResultPanel`.

5. **`View.jsx`** — Add `isMobile` to the `<ScribePopover>` props call. One-line change; `isMobile` is already destructured from `useBreakpoints()` on line 37.

## Sources

- Codebase: `/src/modules/views/OnlyOffice/Scribe/` (all files read directly)
- Codebase: `/src/modules/views/OnlyOffice/View.jsx` (line 37: `useBreakpoints()` already present)
- cozy-ui: `node_modules/cozy-ui/transpiled/react/Drawer/index.js` — `import MuiDrawer from '@material-ui/core/Drawer'; export default MuiDrawer`
- cozy-ui: `node_modules/cozy-ui/transpiled/react/helpers/breakpoints.js` — `isMobile: [0, 768]`
- MUI Drawer API: `node_modules/@material-ui/core/Drawer/Drawer.d.ts` — `anchor`, `open`, `onClose`, `PaperProps`, `variant`
- Project context: `.planning/PROJECT.md` (v2.3 requirements: drawer fullscreen, push submenus, adaptive prompt)

---
*Architecture research for: Scribe responsive drawer — v2.3 milestone*
*Researched: 2026-03-12*
