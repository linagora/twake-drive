# Phase 16: Drawer Scaffold + Breakpoint Split - Research

**Researched:** 2026-03-12
**Domain:** Responsive UI -- MUI Drawer + cozy-ui breakpoints
**Confidence:** HIGH

## Summary

Phase 16 introduces a mobile-responsive container for Scribe: on viewports <= 768px, the existing `Popover` is replaced by a fullscreen bottom `Drawer`. The desktop path remains entirely untouched.

The key technical decision is **where to branch**: a new wrapper component (`ScribeContainer`) will read `isMobile` from `useBreakpoints()` and render either the existing `<Popover>` (desktop) or a `<Drawer>` (mobile). All state-machine logic in `ScribePopover.jsx` stays unchanged -- the swap happens at the container/shell level only.

cozy-ui re-exports MUI's `Drawer` verbatim (`cozy-ui/transpiled/react/Drawer`), and `useBreakpoints()` is already available via the app-level `BreakpointsProvider` in `DriveProvider.jsx`. Zero new dependencies are needed.

**Primary recommendation:** Create a thin `ScribeContainer` component that conditionally renders `<Popover>` or `<Drawer>` based on `useBreakpoints().isMobile`, forwarding all children and callbacks identically.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RESP-01 | User on mobile viewport sees Scribe menu as a fullscreen drawer instead of a centered popover | Drawer with `anchor="bottom"` + `height: 100%` replaces Popover when `isMobile` is true. MUI Drawer supports `ModalProps` for scroll/focus control. |
| RESP-05 | Breakpoint uses cozy-ui `isMobile` for consistency with Cozy ecosystem | `useBreakpoints()` from `cozy-ui/transpiled/react/providers/Breakpoints` -- `isMobile` threshold is `[0, 768]`. Already provided by `BreakpointsProvider` in `DriveProvider.jsx`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cozy-ui Drawer | (re-exports @material-ui/core/Drawer) | Fullscreen bottom drawer on mobile | Already in cozy-ui, zero new deps |
| cozy-ui useBreakpoints | (cozy-ui/transpiled/react/providers/Breakpoints) | `isMobile` breakpoint detection | Ecosystem standard, used in 10+ components in codebase |
| cozy-ui Popover | (re-exports @material-ui/core/Popover) | Desktop container (existing) | Already used by ScribePopover |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @material-ui/core/Slide | Already bundled | Drawer transition | Drawer uses Slide internally for anchor="bottom" |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MUI Drawer | CSS media query + transform | Would not integrate with cozy-ui BreakpointsProvider; breaks RESP-05 |
| Wrapper component | Conditional render inside ScribePopover | Tighter coupling; harder to test desktop isolation |

**Installation:**
```bash
# No installation needed -- all components already available
```

## Architecture Patterns

### Recommended Project Structure
```
src/modules/views/OnlyOffice/Scribe/
  ScribePopover.jsx          # (MODIFY) Extract container logic into wrapper
  ScribeContainer.jsx        # (NEW) Breakpoint-aware shell: Popover vs Drawer
  ScribeActionMenu.jsx       # (UNCHANGED)
  ScribePromptInput.jsx      # (UNCHANGED)
  ScribeResultPanel.jsx      # (UNCHANGED)
  scribe.styl                # (MINOR) Add drawer-specific styles
```

### Pattern 1: Breakpoint-Conditional Container
**What:** A thin wrapper that reads `isMobile` and renders either `<Popover>` or `<Drawer>`, delegating all content and callbacks to the inner state machine.
**When to use:** When desktop and mobile need fundamentally different container shells but identical content.
**Example:**
```jsx
// Source: project codebase pattern analysis + MUI Drawer API
import React from 'react'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import Popover from 'cozy-ui/transpiled/react/Popover'
import Drawer from 'cozy-ui/transpiled/react/Drawer'

const ScribeContainer = ({ open, onClose, children, ...popoverProps }) => {
  const { isMobile } = useBreakpoints()

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        ModalProps={{
          disableScrollLock: true,
          disableEnforceFocus: true,
          disableAutoFocus: true
        }}
        PaperProps={{
          style: {
            height: '100%',
            borderRadius: 0
          }
        }}
      >
        {children}
      </Drawer>
    )
  }

  return (
    <Popover open={open} onClose={onClose} {...popoverProps}>
      {children}
    </Popover>
  )
}
```

### Pattern 2: Extracting Content from ScribePopover
**What:** Move the `step` state machine (menu/loading/result) content rendering out of the Popover wrapper, so `ScribePopover` becomes content-only and `ScribeContainer` wraps it.
**When to use:** To cleanly separate container (Popover vs Drawer) from content (steps).
**Example:**
```jsx
// ScribePopover.jsx -- becomes the "inner" content
const ScribePopoverContent = ({ open, selectedText, ... }) => {
  // All existing state machine logic stays here
  // Returns the step-appropriate content (menu / loading / result)
  // WITHOUT any Popover/Drawer wrapping
  return (
    <>
      {step === 'menu' && <ScribeActionMenu ... />}
      {step === 'loading' && <Paper ...>...</Paper>}
      {step === 'result' && <ScribeResultPanel ... />}
    </>
  )
}

// ScribeContainer wraps it
const ScribePopover = (props) => {
  return (
    <ScribeContainer open={props.open} onClose={props.onCancel} ...>
      <ScribePopoverContent {...props} />
    </ScribeContainer>
  )
}
```

### Anti-Patterns to Avoid
- **Duplicating ScribePopover for mobile:** Never copy-paste the component. One content layer, two container shells.
- **Custom media queries or hardcoded widths:** RESP-05 explicitly requires cozy-ui `isMobile`. Do not use `window.matchMedia` or `@media (max-width: 768px)`.
- **Modifying Popover props conditionally for mobile:** The Popover should remain 100% unchanged on desktop. The branching happens at the container level, not by tweaking Popover props.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Breakpoint detection | Custom `window.innerWidth` listener | `useBreakpoints().isMobile` | Already matches cozy ecosystem, handles resize throttling, iframe-aware |
| Bottom sheet / drawer | CSS transform + backdrop | MUI Drawer via `cozy-ui/transpiled/react/Drawer` | Handles focus trap, backdrop, transitions, a11y |
| Scroll lock prevention | Manual body overflow toggling | `ModalProps={{ disableScrollLock: true }}` | MUI's built-in, one prop |

**Key insight:** The entire mobile drawer can be built with zero custom CSS for the container itself -- MUI Drawer + `anchor="bottom"` + PaperProps height handles fullscreen. Only content layout needs adaptation (Phase 17 handles that).

## Common Pitfalls

### Pitfall 1: Scroll Lock Layout Shift
**What goes wrong:** MUI Drawer/Modal adds `overflow: hidden` + `padding-right` to `<body>` to compensate for scrollbar disappearing, causing visible reflow.
**Why it happens:** MUI's default scroll lock measures scrollbar width and adds padding-right to body.
**How to avoid:** Pass `ModalProps={{ disableScrollLock: true }}` to the Drawer. This is already identified as a project decision in STATE.md.
**Warning signs:** Body jumps/shifts when drawer opens, especially on pages with scrollbars.

### Pitfall 2: Focus Conflicts with OO Editor
**What goes wrong:** MUI Drawer steals focus on open and enforces focus trap, conflicting with OO editor iframe focus management.
**Why it happens:** MUI Modal (which Drawer extends) has `disableEnforceFocus: false` and `disableAutoFocus: false` by default.
**How to avoid:** Pass `ModalProps={{ disableEnforceFocus: true, disableAutoFocus: true }}` -- same pattern already used by ScribePopover (`disableAutoFocus`, `disableEnforceFocus` props).
**Warning signs:** Focus jumping to drawer on open, keyboard shortcuts not working in editor after close.

### Pitfall 3: Backdrop Click Not Closing Drawer
**What goes wrong:** Tapping the backdrop doesn't close the drawer because `onClose` is not wired or is intercepted by the content.
**Why it happens:** MUI Drawer fires `onClose` with reason `"backdropClick"`. If the handler checks the reason or is missing, close won't fire.
**How to avoid:** Pass `onClose={handleClose}` directly -- MUI calls it for backdrop clicks by default. No reason filtering needed.
**Warning signs:** Tapping outside drawer does nothing.

### Pitfall 4: Drawer Height Not Fullscreen
**What goes wrong:** Drawer opens as a partial sheet instead of fullscreen.
**Why it happens:** MUI Drawer with `anchor="bottom"` defaults to auto height (content-sized).
**How to avoid:** Set `PaperProps={{ style: { height: '100%' } }}` for fullscreen. Do NOT use `100vh` (mobile browser chrome issue); `100%` relative to viewport is correct for a Drawer whose container is the modal overlay which is already `100vh`.
**Warning signs:** Drawer only covers part of screen.

### Pitfall 5: Desktop Path Regression
**What goes wrong:** Changes to accommodate mobile drawer accidentally alter desktop Popover behavior.
**Why it happens:** Conditional logic or shared styles leak across breakpoints.
**How to avoid:** The `ScribeContainer` pattern ensures the Popover branch receives exactly the same props as today. Use the `if (isMobile) return <Drawer>` early-return pattern so the Popover path is literally unchanged code.
**Warning signs:** Popover position, submenus, or focus behavior differ after changes.

## Code Examples

### useBreakpoints Usage (from codebase)
```jsx
// Source: src/modules/trash/components/TrashToolbar.tsx (existing pattern)
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

const { isMobile } = useBreakpoints()
// isMobile = true when window.innerWidth <= 768
```

### Drawer Import
```jsx
// Source: node_modules/cozy-ui/transpiled/react/Drawer/index.js
import Drawer from 'cozy-ui/transpiled/react/Drawer'
// This is a direct re-export of @material-ui/core/Drawer
```

### Drawer with All Required ModalProps
```jsx
// Source: MUI Drawer API + project decisions from STATE.md
<Drawer
  anchor="bottom"
  open={open}
  onClose={onClose}
  ModalProps={{
    disableScrollLock: true,      // Prevents body padding-right reflow
    disableEnforceFocus: true,    // Prevents focus trap conflicts with OO
    disableAutoFocus: true        // Prevents auto-focus on open
  }}
  PaperProps={{
    style: {
      height: '100%',            // Fullscreen (not 100vh -- avoids mobile browser chrome)
      borderRadius: 0,           // No rounded corners for fullscreen
      display: 'flex',
      flexDirection: 'column'    // Content flows vertically
    }
  }}
>
  {children}
</Drawer>
```

### Breakpoint Thresholds (verified from source)
```javascript
// Source: node_modules/cozy-ui/transpiled/react/helpers/breakpoints.js
// isMobile: [0, 768]    -- width 0..768
// isTablet: [769, 1023]  -- width 769..1023
// isDesktop: [1024, ...]  -- width 1024+
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom window.innerWidth listeners | cozy-ui useBreakpoints() | Already standard in cozy ecosystem | Consistent breakpoints, throttled, iframe-aware |
| Popover on all viewports | Conditional Drawer/Popover based on breakpoint | This phase | Mobile gets native-feeling fullscreen UX |

**Deprecated/outdated:**
- Using `withBreakpoints` HOC: use `useBreakpoints()` hook instead (HOC still exists but hook is preferred in functional components)

## Open Questions

1. **Drawer transition direction**
   - What we know: `anchor="bottom"` slides up from bottom by default (MUI Slide transition)
   - What's unclear: Whether the slide animation feels right for a fullscreen panel vs. a partial sheet
   - Recommendation: Use default MUI transition; can be tuned later if needed

2. **Content layout in drawer**
   - What we know: The existing ScribeActionMenu has fixed widths (Paper minWidth 220, prompt input 500px)
   - What's unclear: How content adapts within the fullscreen drawer
   - Recommendation: This is Phase 17 scope (RESP-04: prompt input adapts to drawer width). Phase 16 only scaffolds the drawer container; content may overflow but that is expected and will be fixed in Phase 17.

## Sources

### Primary (HIGH confidence)
- `node_modules/cozy-ui/transpiled/react/helpers/breakpoints.js` -- exact breakpoint thresholds verified
- `node_modules/cozy-ui/transpiled/react/Drawer/index.js` -- confirmed re-export of MUI Drawer
- `node_modules/cozy-ui/transpiled/react/providers/Breakpoints/index.js` -- BreakpointsProvider implementation verified
- `node_modules/@material-ui/core/Drawer/Drawer.d.ts` -- Drawer props (ModalProps, anchor, PaperProps)
- `node_modules/@material-ui/core/Modal/Modal.d.ts` -- confirmed `disableScrollLock` prop exists
- `src/lib/DriveProvider.jsx` -- BreakpointsProvider already wraps app
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` -- current implementation analyzed
- `.planning/STATE.md` -- project decisions (disableScrollLock, disableEnforceFocus, disableAutoFocus, anchor bottom, height 100%)

### Secondary (MEDIUM confidence)
- MUI Drawer documentation -- `anchor="bottom"` with `height: 100%` for fullscreen pattern

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components verified in node_modules, zero new dependencies
- Architecture: HIGH -- pattern follows existing codebase conventions (useBreakpoints used in 10+ components), container/content separation is straightforward
- Pitfalls: HIGH -- all ModalProps verified from type definitions, scroll lock behavior confirmed from MUI source, decisions pre-documented in STATE.md

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable -- cozy-ui and MUI versions locked in package.json)
