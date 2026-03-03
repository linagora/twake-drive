# Phase 3: Scribe Interface with Mock AI - Research

**Researched:** 2026-03-01
**Domain:** React popover UI with submenu navigation, mock text transformation, cross-iframe communication
**Confidence:** HIGH

## Summary

Phase 3 replaces the Phase 2 placeholder `ScribeModal` (a centered ConfirmDialog) with a contextual floating popover that offers AI action presets with nested submenus, a free prompt input, and a result panel with Replace/Insert actions. The transformation is mocked (no real AI backend).

The existing codebase provides a solid foundation: `useCozyBridge.js` manages the intent lifecycle, `View.jsx` renders the ScribeModal and wires callbacks, and the plugin's `code.js` handles document operations (PasteText for replace, InsertContent workaround for insert-after). The communication protocol (`cozy-bridge/protocol.js`) and response format `{ status: 'ok', action: 'replace'|'insert'|'cancel', data: { text } }` are unchanged.

cozy-ui re-exports Material-UI v4 components including `Popover`, `Menu`, `MenuItem`, `MenuList`, `ListItemIcon`, `ListItemText`, `ClickAwayListener`, and `Paper`. These provide the exact building blocks for the two-step popover flow (action menu -> result panel). The project already uses these patterns extensively (ActionMenuWithHeader, SelectionBar, etc.).

**Primary recommendation:** Build the Scribe popover as a new React component (`ScribePopover.jsx`) using cozy-ui's Popover (MUI v4) with two internal states -- action selection and result display. Replace ScribeModal in View.jsx. Add mock transformation functions per action type. No changes to the plugin or bridge layer.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Floating contextual popover** positioned near the Scribe button/selection -- NOT a centered modal
- No dimmed backdrop -- the editor remains visible and unblocked behind the popover
- Close (X button) dismisses without modifying the document
- Click outside dismisses (standard popover behavior)
- **Action menu structure (Step 1):**
  1. **Correct grammar** -- direct action (no submenu, no chevron)
  2. **Translate >** -- submenu with language choices: Francais, Anglais, Russe, Vietnamien
  3. **Change tone >** -- submenu with 3 options: More professional, More casual, More polite (each with icon)
  4. **Improve >** -- submenu with 4 options: Make it shorter, Expand context, Emojify, Transform to bullets (each with icon)
- Chevron (>) on items 2, 3, 4 indicates submenu availability
- Submenus open to the right of the main menu
- **Free prompt input** below the menu: placeholder "Help me write" with a send button (arrow icon)
- Labels in English for actions (matching the mockups)
- Language names in French in Translate submenu (Francais, Anglais, Russe, Vietnamien)
- **Result panel (Step 2):**
  - Header: action breadcrumb showing the path taken (e.g. "Translate > Anglais") + close button (X)
  - Result text: displayed as plain read-only text (not an editable textarea)
  - 2 action buttons at bottom-right: "Replace" (text/link style, blue) and "Inserer" (primary button, blue background/pill shape)
  - Clicking Replace or Insert closes Scribe and sends the result to the editor
  - X closes without modifying the document
- **Two-step flow:** Step 1 (action selection) -> Step 2 (result display)
- No back arrow in step 2 -- user closes (X) and re-triggers if they want a different action
- No "before/after" comparison -- only the result is shown

### Claude's Discretion
- Mock transformation strategy (should produce visibly different text per action type)
- Instant vs simulated delay with loading state

### Deferred Ideas (OUT OF SCOPE)
- Editable result textarea (user modifies AI proposition before applying) -- future phase
- Back arrow in result panel to try a different action without closing -- future enhancement
- Regenerate button (re-run same action for different result) -- future enhancement
- Button disable on text deselection (deferred from Phase 2 -- requires floating button redesign)
- OO dark theme CSS fix for "Selected Text" display (cosmetic, Phase 2 pending todo)
- Real AI backend integration (Phase 4 or separate milestone)
- Production i18n with Cozy Drive's locales system (post-MVP)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Interface HTML/JS basique (pas de React/cozy-ui pour l'instant) | CONTEXT.md decisions override: build as React component using cozy-ui Popover/Menu (MUI v4 re-exports). The "basique" intent is honored by keeping it simple -- no heavy framework additions beyond what cozy-ui already provides. |
| UI-02 | Affichage du texte selectionne dans l'interface | Selected text is already delivered via `pendingIntent.data.text` from useCozyBridge. Display in result panel header or use as input to mock transformation. |
| UI-03 | Bouton pour declencher la transformation mock (pas d'API IA reelle) | Each menu item and free prompt submit triggers mock transformation. Action menu structure defined in CONTEXT.md decisions. |
| UI-04 | Previsualisation du resultat de la transformation | Result panel (Step 2) displays transformed text as read-only. cozy-ui Typography + Paper for styling. |
| MOCK-01 | Transformation mock: ajouter du texte au debut et a la fin du bloc, prefixer chaque ligne avec `$ ` | Base mock transformation per spec. Each action type should produce visibly different output to demonstrate the UI works per action. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cozy-ui/Popover | MUI v4.12.3 re-export | Floating panel positioning and backdrop-free overlay | Already used throughout codebase, handles anchorEl positioning, scroll behavior, z-index |
| cozy-ui/Paper | MUI v4 re-export | Card-like container for the popover content | Standard elevation/shadow container in the project |
| cozy-ui/ClickAwayListener | MUI v4 re-export | Dismiss popover on outside click | Project pattern for click-outside behavior |
| cozy-ui/Icon + cozy-ui/Icons/* | project version | Action item icons | Full icon set available: Check, Globe, MagicTrick, Pen, Right, Send, Contract, Expand, List, Cross |
| cozy-ui/Typography | MUI v4 re-export | Text rendering for labels, breadcrumb, result text | Standard text component in the project |
| cozy-ui/Buttons | project version | Replace and Inserer action buttons | Standard button component (supports variant="text", variant="primary") |
| cozy-ui/ListItem, ListItemIcon, ListItemText | MUI v4 re-exports | Menu item structure with icon + label + chevron | Project pattern from ActionMenuWithHeader |
| Stylus (.styl) | project standard | Component-level styles | Project convention: styles.styl in OnlyOffice module |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cozy-ui/Divider | MUI v4 re-export | Visual separator between menu sections and free prompt | Separating action items from the free prompt input |
| cozy-ui/InputBase | MUI v4 re-export | Free prompt text input | For the "Help me write" input field |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cozy-ui Popover (MUI v4) | Custom positioned div + CSS | Popover handles scroll, resize, z-index, portal rendering automatically; custom div would re-implement all of this |
| cozy-ui ListItem for menu items | Custom divs | ListItem already integrates icon, text, and secondary action (chevron) with correct spacing and hover states |
| Inline SVG icons | cozy-ui Icons | cozy-ui Icons are consistent with the rest of the application; inline SVG only for icons not in cozy-ui set |

**No new installations required.** All components are already available via the existing cozy-ui dependency.

## Architecture Patterns

### Recommended Component Structure
```
src/modules/views/OnlyOffice/
  Scribe/
    ScribePopover.jsx       # Main popover container (replaces ScribeModal.jsx)
    ScribeActionMenu.jsx    # Step 1: Action menu with submenus
    ScribeResultPanel.jsx   # Step 2: Result display with Replace/Insert
    ScribePromptInput.jsx   # Free prompt input ("Help me write")
    mockTransform.js        # Mock transformation functions per action type
    scribeActions.js        # Action definitions (id, label, icon, children)
    scribe.styl             # Scribe-specific styles
```

### Pattern 1: Two-Step Popover State Machine
**What:** The popover has two internal states managed by a single React state variable: `'menu'` (action selection) and `'result'` (showing transformation result).
**When to use:** When a single floating panel changes its content based on user interaction.
**Example:**
```jsx
// ScribePopover.jsx
const ScribePopover = ({ open, selectedText, onReplace, onInsert, onCancel }) => {
  const [step, setStep] = useState('menu') // 'menu' | 'result'
  const [result, setResult] = useState({ text: '', breadcrumb: '' })
  const anchorRef = useRef(null)

  const handleActionSelect = useCallback((actionId, label, breadcrumb) => {
    const transformed = mockTransform(actionId, selectedText)
    setResult({ text: transformed, breadcrumb })
    setStep('result')
  }, [selectedText])

  const handleClose = useCallback(() => {
    setStep('menu')
    setResult({ text: '', breadcrumb: '' })
    onCancel()
  }, [onCancel])

  const handleReplace = useCallback(() => {
    onReplace(result.text)
    setStep('menu')
  }, [result.text, onReplace])

  const handleInsert = useCallback(() => {
    onInsert(result.text)
    setStep('menu')
  }, [result.text, onInsert])

  // Reset to menu state when popover opens with new intent
  useEffect(() => {
    if (open) setStep('menu')
  }, [open])

  return (
    <Popover
      open={open}
      anchorEl={anchorRef.current}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      // No backdrop dimming:
      BackdropProps={{ invisible: true }}
    >
      {step === 'menu'
        ? <ScribeActionMenu onSelect={handleActionSelect} selectedText={selectedText} />
        : <ScribeResultPanel
            breadcrumb={result.breadcrumb}
            resultText={result.text}
            onReplace={handleReplace}
            onInsert={handleInsert}
            onClose={handleClose}
          />
      }
    </Popover>
  )
}
```

### Pattern 2: Nested Submenu via Hover/Click State
**What:** Top-level menu items with children expand a secondary menu to the right.
**When to use:** Multi-level action menus with categories.
**Example:**
```jsx
// ScribeActionMenu.jsx
const ScribeActionMenu = ({ onSelect, selectedText }) => {
  const [activeSubmenu, setActiveSubmenu] = useState(null)

  return (
    <Paper style={{ minWidth: 220 }}>
      {SCRIBE_ACTIONS.map(action => (
        <div
          key={action.id}
          onMouseEnter={() => action.children && setActiveSubmenu(action.id)}
          onMouseLeave={() => setActiveSubmenu(null)}
          style={{ position: 'relative' }}
        >
          <ListItem
            button
            onClick={() => !action.children && onSelect(action.id, action.label, action.label)}
          >
            <ListItemIcon><Icon icon={action.icon} /></ListItemIcon>
            <ListItemText primary={action.label} />
            {action.children && <Icon icon={RightIcon} size={16} />}
          </ListItem>

          {/* Submenu */}
          {action.children && activeSubmenu === action.id && (
            <Paper style={{ position: 'absolute', left: '100%', top: 0, minWidth: 180 }}>
              {action.children.map(child => (
                <ListItem
                  button
                  key={child.id}
                  onClick={() => onSelect(child.id, child.label, `${action.label} > ${child.label}`)}
                >
                  <ListItemIcon><Icon icon={child.icon} /></ListItemIcon>
                  <ListItemText primary={child.label} />
                </ListItem>
              ))}
            </Paper>
          )}
        </div>
      ))}
      <Divider />
      <ScribePromptInput onSubmit={(prompt) => onSelect('free-prompt', prompt, prompt)} />
    </Paper>
  )
}
```

### Pattern 3: Mock Transform Strategy (Claude's Discretion)
**What:** Per-action mock transformations that produce visibly different text, making the UI testable and demonstrating distinct behaviors.
**Recommendation:** Use instant transformation (no simulated delay) -- keeps the UX snappy and simplifies the implementation. A loading state can be added in Phase 4 when real AI latency exists.

```js
// mockTransform.js
const MOCK_PREFIX = '$ '

export function mockTransform(actionId, text) {
  const lines = text.split('\n')

  switch (actionId) {
    // Grammar correction: capitalize first letter of each sentence, add period
    case 'correct-grammar':
      return lines.map(l => MOCK_PREFIX + capitalize(l)).join('\n')

    // Translate: wrap with language markers
    case 'translate-francais':
      return `[FR] Traduction:\n${lines.map(l => MOCK_PREFIX + l).join('\n')}\n[/FR]`
    case 'translate-anglais':
      return `[EN] Translation:\n${lines.map(l => MOCK_PREFIX + l).join('\n')}\n[/EN]`
    case 'translate-russe':
      return `[RU] Перевод:\n${lines.map(l => MOCK_PREFIX + l).join('\n')}\n[/RU]`
    case 'translate-vietnamien':
      return `[VI] Bản dịch:\n${lines.map(l => MOCK_PREFIX + l).join('\n')}\n[/VI]`

    // Tone changes
    case 'tone-professional':
      return `Dear Sir/Madam,\n${lines.map(l => MOCK_PREFIX + l).join('\n')}\nBest regards.`
    case 'tone-casual':
      return `Hey!\n${lines.map(l => MOCK_PREFIX + l).join('\n')}\nCheers!`
    case 'tone-polite':
      return `If I may,\n${lines.map(l => MOCK_PREFIX + l).join('\n')}\nThank you kindly.`

    // Improve
    case 'improve-shorter':
      return lines.map(l => MOCK_PREFIX + l.split(' ').slice(0, Math.ceil(l.split(' ').length / 2)).join(' ')).join('\n')
    case 'improve-expand':
      return lines.map(l => MOCK_PREFIX + l + ' (expanded with additional context and detail)').join('\n')
    case 'improve-emojify':
      return lines.map(l => MOCK_PREFIX + '✨ ' + l + ' 🎉').join('\n')
    case 'improve-bullets':
      return lines.map(l => MOCK_PREFIX + '• ' + l.trim()).join('\n')

    // Free prompt
    case 'free-prompt':
      return `[Custom: applied]\n${lines.map(l => MOCK_PREFIX + l).join('\n')}\n[/Custom]`

    // Default fallback (MOCK-01 spec)
    default:
      return `[Mock transform]\n${lines.map(l => MOCK_PREFIX + l).join('\n')}\n[/Mock transform]`
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
```

### Pattern 4: Action Data Definitions
**What:** Declarative action tree structure that drives menu rendering.
```js
// scribeActions.js
// Icons imported from cozy-ui/transpiled/react/Icons/*
import CheckIcon from 'cozy-ui/transpiled/react/Icons/Check'
import GlobeIcon from 'cozy-ui/transpiled/react/Icons/Globe'
import PenIcon from 'cozy-ui/transpiled/react/Icons/Pen'
import MagicTrickIcon from 'cozy-ui/transpiled/react/Icons/MagicTrick'
import ContractIcon from 'cozy-ui/transpiled/react/Icons/Contract'
import ExpandIcon from 'cozy-ui/transpiled/react/Icons/Expand'
import ListIcon from 'cozy-ui/transpiled/react/Icons/List'

export const SCRIBE_ACTIONS = [
  {
    id: 'correct-grammar',
    label: 'Correct grammar',
    icon: CheckIcon,
    children: null // direct action, no submenu
  },
  {
    id: 'translate',
    label: 'Translate',
    icon: GlobeIcon,
    children: [
      { id: 'translate-francais', label: 'Francais', icon: null },
      { id: 'translate-anglais', label: 'Anglais', icon: null },
      { id: 'translate-russe', label: 'Russe', icon: null },
      { id: 'translate-vietnamien', label: 'Vietnamien', icon: null }
    ]
  },
  {
    id: 'change-tone',
    label: 'Change tone',
    icon: PenIcon,
    children: [
      { id: 'tone-professional', label: 'More professional', icon: null },
      { id: 'tone-casual', label: 'More casual', icon: null },
      { id: 'tone-polite', label: 'More polite', icon: null }
    ]
  },
  {
    id: 'improve',
    label: 'Improve',
    icon: MagicTrickIcon,
    children: [
      { id: 'improve-shorter', label: 'Make it shorter', icon: ContractIcon },
      { id: 'improve-expand', label: 'Expand context', icon: ExpandIcon },
      { id: 'improve-emojify', label: 'Emojify', icon: null },
      { id: 'improve-bullets', label: 'Transform to bullets', icon: ListIcon }
    ]
  }
]
```

### Anti-Patterns to Avoid
- **Building a custom positioning system:** MUI Popover already handles anchor positioning, viewport edge detection, scroll behavior, and z-index. Do not re-implement with `getBoundingClientRect` and manual offsets.
- **Using MUI Menu component for the action menu:** MUI's `<Menu>` auto-focuses the first item and has built-in keyboard navigation that conflicts with the nested submenu UX. Use `<Popover>` + `<Paper>` + `<ListItem>` instead for full control over hover/click submenu behavior.
- **Modifying the bridge protocol:** The response format (`{ status: 'ok', action: 'replace'|'insert'|'cancel', data: { text } }`) is already established. The mock transformation happens BEFORE calling `respond()` -- the bridge layer is unchanged.
- **Storing transformation state in the bridge/hook:** The mock transformation is local to the ScribePopover component. The `useCozyBridge` hook stays unchanged -- it provides `pendingIntent` and `respond`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Floating panel positioning | Manual `position: fixed` + JS calculations | cozy-ui Popover (MUI v4) | Handles viewport edges, scroll, resize, portal rendering, z-index stacking |
| Click-outside dismissal | Manual `document.addEventListener('click')` | cozy-ui ClickAwayListener or Popover's built-in onClose | Handles event bubbling, portal clicks, edge cases correctly |
| Icon system | Inline SVGs for each action | cozy-ui Icons/* | Consistent size, color, accessibility; already includes Globe, Check, MagicTrick, Pen, etc. |
| Menu item layout | Custom flexbox div with icon + text + chevron | cozy-ui ListItem + ListItemIcon + ListItemText | Correct spacing, padding, hover states, accessibility roles |
| Button variants | Styled divs | cozy-ui Buttons (variant="text" for Replace, variant="primary" for Inserer) | Consistent with app-wide button styling |

**Key insight:** cozy-ui wraps MUI v4, and MUI v4's Popover/Paper/ListItem are battle-tested for exactly this kind of contextual menu UI. The project already has these components -- zero additional dependencies needed.

## Common Pitfalls

### Pitfall 1: Popover Anchor Element Timing
**What goes wrong:** `anchorEl` is null when the popover first tries to open because the element hasn't mounted yet, or the element reference is from a previous render cycle.
**Why it happens:** When `pendingIntent` changes from null to an object, the popover opens immediately, but if the anchor element is a ref that hasn't been set yet (or is in a different part of the DOM), MUI's Popover throws a warning or positions at (0,0).
**How to avoid:** Use `anchorReference="anchorPosition"` with `anchorPosition={{ top: ..., left: ... }}` to position the popover at a fixed location (e.g., center-right of the viewport, near the editor area). This sidesteps the anchor element issue entirely since the OO editor is in a nested iframe and we cannot reference DOM elements inside it.
**Warning signs:** Popover appearing at top-left corner of the screen, MUI console warnings about anchorEl.

### Pitfall 2: Submenu Flicker on Mouse Movement
**What goes wrong:** When moving the mouse from a parent menu item to its submenu, the submenu disappears because `onMouseLeave` fires on the parent before `onMouseEnter` fires on the child.
**Why it happens:** There's a gap (even 1px) between the parent item and the submenu Paper, or the submenu is positioned with a margin.
**How to avoid:** Wrap the parent item AND its submenu in the same container div, so `onMouseLeave` only fires when leaving the entire group. Alternatively, add a small delay (100-150ms) before hiding the submenu.
**Warning signs:** Submenu impossible to click, flickers when trying to reach it.

### Pitfall 3: Popover Not Closing on Outside Click
**What goes wrong:** Clicking outside the popover doesn't dismiss it because clicks are landing on the OO editor iframe, which is a cross-origin iframe that doesn't propagate click events to the parent.
**Why it happens:** MUI Popover's onClose relies on click events reaching the document where the Popover is rendered. Clicks inside a cross-origin iframe never bubble up.
**How to avoid:** The Popover's X button is the primary dismissal mechanism. Also consider adding an `onBlur` handler or listening for new `pendingIntent` changes. This is acceptable UX since the popover is lightweight and non-blocking. The user can also press Escape (MUI Popover handles this natively).
**Warning signs:** Popover stays open after clicking in the editor; user has to use X button or Escape.

### Pitfall 4: State Not Resetting Between Intents
**What goes wrong:** Opening Scribe a second time shows the result panel from the previous interaction instead of the action menu.
**Why it happens:** The `step` and `result` state persist across intent cycles if not reset.
**How to avoid:** Reset state in a `useEffect` that watches `open` or `pendingIntent`. When `open` transitions to `true`, set `step` back to `'menu'` and clear `result`.
**Warning signs:** Stale result text shown, wrong breadcrumb displayed.

### Pitfall 5: Free Prompt Input Keyboard Events
**What goes wrong:** Typing in the free prompt input triggers Popover keyboard shortcuts (Escape closes it, Tab moves focus away).
**Why it happens:** MUI Popover listens for keyboard events.
**How to avoid:** The Escape behavior is actually desirable (dismiss the popover). For the input, ensure it captures focus correctly and `stopPropagation` on Enter to prevent form submission bubbling. The input should call `onSubmit` on Enter key or Send button click.
**Warning signs:** Typing in the prompt closes the popover or moves focus.

## Code Examples

Verified patterns from the existing codebase:

### Popover with anchorPosition (no anchor element)
```jsx
// MUI v4 Popover supports anchorReference="anchorPosition"
// This avoids needing a DOM element reference inside the OO iframe
import Popover from 'cozy-ui/transpiled/react/Popover'

<Popover
  open={open}
  anchorReference="anchorPosition"
  anchorPosition={{ top: 200, left: window.innerWidth / 2 }}
  onClose={handleClose}
  BackdropProps={{ invisible: true }}
  PaperProps={{
    style: { borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }
  }}
>
  {/* content */}
</Popover>
```

### View.jsx Integration (replacing ScribeModal)
```jsx
// Current (Phase 2):
import { ScribeModal } from '@/modules/views/OnlyOffice/ScribeModal'
// ...
<ScribeModal
  open={!!pendingIntent}
  selectedText={pendingIntent?.data?.text || ''}
  onReplace={handleReplace}
  onInsert={handleInsert}
  onCancel={handleCancel}
/>

// Phase 3 replacement:
import { ScribePopover } from '@/modules/views/OnlyOffice/Scribe/ScribePopover'
// ...
<ScribePopover
  open={!!pendingIntent}
  selectedText={pendingIntent?.data?.text || ''}
  onReplace={handleReplace}
  onInsert={handleInsert}
  onCancel={handleCancel}
/>
```

### handleReplace/handleInsert With Mock Transform
```jsx
// In View.jsx, the callbacks remain unchanged.
// The mock transformation happens INSIDE ScribePopover before calling onReplace/onInsert.
// ScribePopover receives selectedText, transforms it, then calls onReplace(transformedText).
// This keeps View.jsx's respond() calls identical to Phase 2.
```

### cozy-ui Icon Usage (project pattern)
```jsx
import Icon from 'cozy-ui/transpiled/react/Icon'
import GlobeIcon from 'cozy-ui/transpiled/react/Icons/Globe'
import RightIcon from 'cozy-ui/transpiled/react/Icons/Right'

<ListItemIcon>
  <Icon icon={GlobeIcon} />
</ListItemIcon>
// ...
{hasChildren && <Icon icon={RightIcon} size={16} />}
```

### cozy-ui Buttons (project pattern, from ScribeModal.jsx)
```jsx
import Buttons from 'cozy-ui/transpiled/react/Buttons'

// Text/link style button (Replace)
<Buttons variant="text" label="Replace" onClick={handleReplace} />

// Primary pill button (Inserer)
<Buttons label="Inserer" onClick={handleInsert} />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ConfirmDialog (Phase 2 ScribeModal) | Popover with action menu + result panel | Phase 3 | Complete replacement of the UI component; bridge layer unchanged |
| Pass-through text (no transformation) | Mock transformation per action type | Phase 3 | Demonstrates action differentiation; real AI in Phase 4 |
| Single "Replace"/"Insert" buttons | Menu with 4 categories + 11 sub-actions + free prompt | Phase 3 | Full action menu structure matching UX mockups |

**Deprecated/outdated:**
- `ScribeModal.jsx`: Will be replaced entirely by `ScribePopover.jsx`. Can be deleted or preserved as reference.

## Open Questions

1. **Popover positioning strategy**
   - What we know: MUI v4 Popover supports both `anchorEl` (DOM element) and `anchorPosition` (x,y coordinates). The OO editor is in a nested cross-origin iframe, so we cannot reference DOM elements inside it.
   - What's unclear: Ideal default position for the popover. Options: (a) center of the viewport, (b) near the right side where the plugin panel is, (c) a fixed position relative to the editor area.
   - Recommendation: Use `anchorPosition` with a sensible default (e.g., top-right area near the editor). The exact position can be refined during implementation. If `pendingIntent` carries coordinates in the future, those can be used.

2. **Icons for submenu items**
   - What we know: CONTEXT.md says "each with icon" for tone and improve sub-items. cozy-ui has Check, Globe, MagicTrick, Pen, Contract, Expand, List. Missing: Emojify icon, individual tone icons, individual language icons.
   - What's unclear: Whether every sub-item needs a distinct icon or if some can omit icons.
   - Recommendation: Use available cozy-ui icons where they map well (Contract for "shorter", Expand for "expand", List for "bullets"). For items without a natural cozy-ui icon (Emojify, tone sub-items, language items), either use a generic icon or leave the icon slot empty. Inline SVG as last resort.

3. **Requirement UI-01 interpretation**
   - What we know: The original requirement says "Interface HTML/JS basique (pas de React/cozy-ui pour l'instant)." But the CONTEXT.md decisions describe replacing ScribeModal.jsx (a React component) with a new React popover component, and explicitly mention "popover may use cozy-ui Popover/Menu components or custom implementation."
   - What's unclear: Whether UI-01 should be considered overridden by the user's CONTEXT decisions.
   - Recommendation: Treat the CONTEXT.md decisions as the authoritative specification. The "basique" intent of UI-01 is honored by keeping the implementation simple and not introducing new dependencies. The React + cozy-ui approach is simpler than raw HTML/JS in this context because the component already lives in the React tree.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/modules/views/OnlyOffice/ScribeModal.jsx` -- Phase 2 placeholder component
- Codebase inspection: `src/modules/views/OnlyOffice/useCozyBridge.js` -- intent lifecycle hook
- Codebase inspection: `src/modules/views/OnlyOffice/View.jsx` -- integration point
- Codebase inspection: `src/lib/cozy-bridge/index.js` + `protocol.js` -- bridge and wire format
- Codebase inspection: `plugins/onlyoffice-scribe/scripts/code.js` -- plugin document operations
- Codebase inspection: `node_modules/cozy-ui/transpiled/react/Popover/index.d.ts` -- confirms MUI v4 re-export
- Codebase inspection: `node_modules/@material-ui/core/package.json` -- confirms v4.12.3
- Codebase inspection: `src/modules/actionmenu/ActionMenuWithHeader.jsx` -- existing menu pattern

### Secondary (MEDIUM confidence)
- MUI v4 Popover API (from training data, well-established API): anchorEl, anchorPosition, anchorOrigin, transformOrigin, BackdropProps, PaperProps
- MUI v4 ListItem API (from training data): button prop, onClick, nested ListItemIcon/ListItemText

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components verified in node_modules and used in existing codebase
- Architecture: HIGH -- follows existing project patterns (ActionMenuWithHeader, ScribeModal replacement pattern documented in CONTEXT.md)
- Pitfalls: MEDIUM -- based on general MUI v4 Popover experience; specific iframe interaction issues may surface during implementation

**Research date:** 2026-03-01
**Valid until:** 2026-03-31 (stable domain -- cozy-ui and MUI v4 are not changing)
