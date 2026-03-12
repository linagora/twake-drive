# Stack Research: v2.3 Responsive Drawer Menu

**Domain:** Responsive UI — fullscreen drawer on mobile, push navigation for submenus
**Researched:** 2026-03-12
**Confidence:** HIGH

**Scope:** NEW stack additions only for the responsive drawer milestone. Existing v2.2 stack
(React 18, `@material-ui/core` 4.12.3 via cozy-ui 135.8.0, cozy-ui hooks, twake-i18n,
postMessage protocol, OO Plugin API) is validated and not re-researched.

---

## Recommended Stack

### Core Technologies

No new npm dependencies. Everything needed is already installed.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@material-ui/core/Drawer` | 4.12.3 (installed) | Full-screen mobile drawer container | Already available via cozy-ui re-export at `cozy-ui/transpiled/react/Drawer`. MUI v4 `Drawer` with `variant="temporary"` + `anchor="bottom"` or `anchor="right"` provides modal overlay with backdrop. No new install. HIGH confidence. |
| `@material-ui/core/Slide` | 4.12.3 (installed) | Push navigation panel transition | Used inside the drawer to animate submenu panels sliding in (left) and back (right). Already available at `cozy-ui/transpiled/react/Slide`. Driven by a `direction` prop. No new install. HIGH confidence. |
| `useBreakpoints` from cozy-ui | 135.8.0 (installed) | Detect mobile breakpoint | `isMobile` is `true` when `window.innerWidth <= 768px`. Already imported in 78+ files in this codebase. Import path: `cozy-ui/transpiled/react/providers/Breakpoints`. HIGH confidence. |
| `useState` (React) | 18.2.0 (installed) | Navigation stack for push navigation | A simple `useState` holding the active submenu ID replaces the current `activeSubmenu` state in `ScribeActionMenu`. No library needed — push navigation in a drawer is controlled by React state, not a router. HIGH confidence. |

### Supporting Libraries

None required. All building blocks are present in the installed packages.

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@material-ui/core/IconButton` | 4.12.3 (installed) | Back arrow button in drawer header | Already used throughout Scribe. Renders the `←` back button that pops the navigation stack. |
| `@material-ui/core/Typography` | 4.12.3 (installed) | Drawer header title (current action name) | Shows the current submenu name as the drawer title, contextualizing where the user is in the navigation. |
| `cozy-ui/transpiled/react/Icons/Left` | 135.8.0 (installed) | Back arrow icon | Cozy-ui icon set already includes a `Left` directional icon for the back button. |

### Development Tools

No additions needed. Existing rsbuild dev server, eslint, and jest are sufficient.

---

## Architecture of the Responsive Pattern

The change is **conditional rendering at the `ScribePopover` level** based on `isMobile`:

```
isMobile=false (desktop, current behavior):
  ScribePopover
    └─ MUI Popover (centered on viewport)
         └─ ScribeActionMenu (flat list + absolute-positioned submenus)

isMobile=true (new mobile behavior):
  ScribePopover
    └─ MUI Drawer (fullscreen, anchor="bottom" or anchor="right")
         └─ ScribeDrawerMenu (push navigation, no absolute submenus)
```

`ScribeActionMenu` is **unchanged** — it stays the desktop component. A new `ScribeDrawerMenu` component handles the mobile push-navigation pattern. This avoids tangling responsive logic into the existing menu.

### Push Navigation State Machine

```jsx
// ScribeDrawerMenu internal state
const [view, setView] = useState('root') // 'root' | actionId (e.g. 'translate')

// Root view: full action list with → arrows
// Submenu view: back button + header + children of actions[view]
```

No routing library, no history stack. A single `view` string is sufficient because the menu has exactly one level of nesting (root → submenu). A full navigation stack (array) would be over-engineering for this depth.

---

## Integration Points

### ScribePopover (modified)

```jsx
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import Drawer from 'cozy-ui/transpiled/react/Drawer'

const { isMobile } = useBreakpoints()

// Replace current:
<Popover ...>
  {step === 'menu' && <ScribeActionMenu ... />}
</Popover>

// With:
{isMobile ? (
  <Drawer open={open} anchor="bottom" onClose={handleClose} PaperProps={{ style: { height: '100%' } }}>
    {step === 'menu' && <ScribeDrawerMenu ... />}
    {/* loading + result steps remain inside drawer */}
  </Drawer>
) : (
  <Popover ...>
    {step === 'menu' && <ScribeActionMenu ... />}
  </Popover>
)}
```

`anchor="bottom"` is standard for mobile action sheets. `anchor="right"` is an alternative for tablet-like experiences — bottom is preferred for thumb reachability on phones.

### ScribePromptInput (modified)

Remove the fixed `width: 500` from `ScribeActionMenu`. In `ScribeDrawerMenu`, the prompt input uses `width: '100%'` — the drawer provides the container width. The `Paper` wrapper around the prompt input becomes full-width automatically.

Current problem: `<Paper style={{ width: 500 }}>` in `ScribeActionMenu` is hardcoded. This must become `width: '100%'` when inside the drawer. The simplest fix: pass a `fullWidth` prop to `ScribePromptInput`, or use `width: isMobile ? '100%' : 500` at the `ScribeActionMenu` level.

### Slide transition for push navigation

```jsx
// Inside ScribeDrawerMenu:
import Slide from 'cozy-ui/transpiled/react/Slide'

// Root panel slides out to the left when entering submenu
<Slide direction="left" in={view === 'root'} mountOnEnter unmountOnExit>
  <div>
    {/* Root action list */}
  </div>
</Slide>

// Submenu panel slides in from the right
<Slide direction="right" in={view !== 'root'} mountOnEnter unmountOnExit>
  <div>
    {/* Back button + submenu items */}
  </div>
</Slide>
```

**Alternative (simpler):** Skip `Slide` entirely and just conditionally render root vs. submenu views without animation. This is acceptable — the drawer itself already has an enter animation. The push transition is a polish item, not a functional requirement.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-router-dom` for drawer navigation | The menu has one level of nesting. Routing is disproportionate overhead and introduces URL coupling for an ephemeral UI. | `useState('root' \| actionId)` — single state variable is sufficient. |
| `notistack` / dedicated toast library | Not needed here. | n/a |
| `react-spring` / `framer-motion` for transitions | MUI v4 `Slide` already provides the needed push animation. Adding a separate animation library (300-500KB) for one transition is wasteful. | `@material-ui/core/Slide` (already installed). |
| New breakpoint library (`react-responsive`, etc.) | cozy-ui `useBreakpoints` is already wired throughout the app (78 files). Adding another breakpoint system creates duplication and risk of mismatch. | `useBreakpoints()` from `cozy-ui/transpiled/react/providers/Breakpoints`. |
| MUI v5 Drawer | The project uses MUI v4 via `@material-ui/core`. MUI v5 uses a different import path (`@mui/material`) and is NOT installed. Mixing v4 and v5 causes style conflicts. | `@material-ui/core/Drawer` (v4, installed). |
| `SwipeableDrawer` | Adds touch-swipe gesture to close. Requires `iOS` and `onOpen` props. Increases complexity for no clear gain — the drawer already has a backdrop click-to-close. | `Drawer` (non-swipeable). Re-evaluate if user feedback requests swipe-to-close. |
| Separate mobile stylesheet / CSS media queries | The codebase uses `useBreakpoints` for adaptive rendering. Using CSS media queries in a different breakpoint system creates two sources of truth. | Conditional JSX based on `isMobile`. |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| MUI `Drawer` (bottom anchor, fullscreen) | MUI `Dialog` fullscreen | Dialog is semantically correct for blocking workflows (confirm/cancel). A navigation menu is not a dialog. Drawer is the correct pattern for action sheets / navigation trays. |
| Single `view` state for push nav | Array-based navigation stack | Only needed if depth > 1. Scribe menu is root → submenu (depth 1). A stack would be over-engineering. |
| New `ScribeDrawerMenu` component | Modify `ScribeActionMenu` with isMobile branching | Keeping components separate avoids conditional logic sprawl and preserves the desktop component untouched. The mobile drawer has fundamentally different layout requirements (full-width items, back button, no absolute-position submenus). |
| `Slide` for push transition | CSS `transform: translateX()` with `useState` | MUI `Slide` handles enter/exit lifecycle (mount/unmount) correctly. Manual CSS transitions require careful cleanup. MUI is already installed. |

---

## Version Compatibility

| Package | Version | Notes |
|---------|---------|-------|
| `@material-ui/core` (Drawer, Slide) | 4.12.3 | Installed. Re-exported by cozy-ui. No install needed. |
| `cozy-ui` (useBreakpoints, Icons) | 135.8.0 | Installed. `isMobile` breakpoint at 768px. |
| React | 18.2.0 | No constraints — MUI v4 supports React 16-18. |

---

## Installation

```bash
# No new packages required.
# All components (Drawer, Slide, useBreakpoints) are already installed.
```

---

## Sources

- Codebase audit — `/home/ben/Dev-local/cozy-drive/node_modules/@material-ui/core/` directory listing confirms Drawer, Slide, SwipeableDrawer present at v4.12.3 (HIGH confidence)
- Codebase audit — `cozy-ui/transpiled/react/Drawer/index.js` re-exports `@material-ui/core/Drawer` (HIGH confidence)
- Codebase audit — `cozy-ui/transpiled/react/helpers/breakpoints.js` confirms `isMobile: [0, 768]` (HIGH confidence)
- Codebase audit — `grep useBreakpoints src/` shows 78 files using established import path `cozy-ui/transpiled/react/providers/Breakpoints` (HIGH confidence)
- Codebase audit — `ScribeActionMenu.jsx` shows current `width: 500` hardcoded on prompt Paper, confirms this must be made adaptive (HIGH confidence)
- MUI v4 Drawer docs — `variant="temporary"` creates modal overlay with backdrop; `anchor` prop controls entry direction (HIGH confidence, training data + confirmed by source inspection)

---
*Stack research for: v2.3 Responsive Drawer Menu — fullscreen mobile drawer, push navigation submenus*
*Researched: 2026-03-12*
