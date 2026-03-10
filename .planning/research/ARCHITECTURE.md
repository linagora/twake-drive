# Architecture Patterns

**Domain:** Chat side panel integration into existing OnlyOffice Scribe writing assistant
**Researched:** 2026-03-10

## Current Architecture (Before Changes)

```
Dialog (fullScreen)
  OnlyOfficeProvider (context: fileId, editorMode, isEditorReady, ...)
    Editor
      Title (toolbar)
      DialogContent (u-flex u-flex-column)
        View
          Spinner (while loading)
          div.u-flex.u-flex-grow-1
            div#onlyOfficeEditor  -->  OO creates iframe[name="frameEditor"] inside
            OnlyOfficeAIAssistantPanel  -->  existing cozy-viewer summary panel (30% width)
          ScribeFloatingButton (portal on body, z-index 100000)
          ScribePopover (Popover, centered modal overlay)
          ReadOnlyFab
```

### Key Observations

1. **`div#onlyOfficeEditor`** is a mount point. OO's `DocsAPI.DocEditor()` constructor replaces its content with an iframe named `frameEditor`. The iframe height is forced to `100%` via `forceIframeHeight()`.

2. **The flex container** `div.u-flex.u-flex-grow-1` already hosts the editor div and `OnlyOfficeAIAssistantPanel` side by side. The AI panel uses `width: 30%` (from `styles.styl`), and the editor div fills the rest. This is the exact pattern the chat panel should follow.

3. **`OnlyOfficeAIAssistantPanel`** is a thin wrapper that imports `AIAssistantPanel` from `cozy-viewer`. It only shows when `isOpenAiAssistant` is true (from ViewerProvider). This is a file-summarization panel, NOT the Scribe chat. The Scribe chat panel will be a separate component.

4. **ScribePopover** is a modal overlay (MUI Popover) centered on screen. It manages a 3-step state machine: menu -> loading -> result. It receives selectedText/selectedHtml from the pending intent.

5. **useCozyBridge** manages the bridge lifecycle and exposes `{ pendingIntent, showScribeButton, respond }`. All Scribe state is currently transient -- no conversation history, no persistent messages.

6. **Intent flow**: Plugin detects selection -> casts `SHOW_SCRIBE_BUTTON` (one-way) -> user clicks button -> `triggerScribe()` broadcasts `cozy-bridge:trigger-intent` -> plugin casts `AI_TEXT_EDIT` with text/html -> `useCozyBridge` sets `pendingIntent` -> ScribePopover opens.

## Recommended Architecture

### Layout Strategy: Sibling Flex Panel

The Scribe chat panel renders as a sibling to `#onlyOfficeEditor` inside the existing flex container, identical to how `OnlyOfficeAIAssistantPanel` already works. The OO editor naturally shrinks because it is a flex child.

```
div.u-flex.u-flex-grow-1
  div#onlyOfficeEditor  (flex: 1, OO iframe fills it)
  ScribeChatPanel       (width: 380px, conditional render)
```

**Why this approach:**
- Already proven by `OnlyOfficeAIAssistantPanel` (same flex parent, `width: 30%`)
- No DOM manipulation needed -- CSS flexbox handles the resize
- OO iframe auto-adjusts to its container width (confirmed by existing AI panel behavior)
- No need to call OO resize API -- the iframe adapts to its parent div

**Why NOT a Drawer/overlay:**
- A MUI Drawer would overlay the editor, not resize it
- The existing `OnlyOfficeAIAssistantPanel` proves the sibling pattern works
- Side-by-side layout lets users see their document while chatting

### Component Boundaries

| Component | Responsibility | Communicates With | New/Modified |
|-----------|---------------|-------------------|-------------|
| `ScribeChatPanel` | Chat panel container, conversation display, input area | ScribeContext, scribeAI | **NEW** |
| `ScribeChatMessages` | Renders message history (user + AI bubbles) | ScribeChatPanel (props) | **NEW** |
| `ScribeChatInput` | Text input, selection chip, action suggestions, send button | ScribeChatPanel (callbacks) | **NEW** |
| `ScribeChatMessage` | Single message bubble (markdown rendering, action buttons) | ScribeChatMessages (props) | **NEW** |
| `ScribeContext` (provider) | Shared state: panel open/closed, chat messages, current selection, mode | View.jsx, all Scribe components | **NEW** |
| `View.jsx` | Renders ScribeChatPanel in flex container, manages toggle | ScribeContext | **MODIFIED** |
| `useCozyBridge.js` | Add selection state sharing (not just intent) | ScribeContext | **MODIFIED** |
| `ScribePopover` | Keep as-is for inline quick actions | ScribeContext (for selection) | **MINOR MODIFY** |
| `ScribeFloatingButton` | Add panel toggle, not just trigger inline | ScribeContext | **MODIFIED** |
| `scribeAI.js` | Add conversational mode (multi-turn messages) | ScribeChatPanel | **MODIFIED** |

### New Component: ScribeContext

The biggest architectural addition. Currently, Scribe state is scattered across `View.jsx` (intent handling), `ScribePopover` (action state machine), and `useCozyBridge` (bridge lifecycle). The chat panel needs shared state.

```jsx
// ScribeContext provides:
{
  // Panel state
  isPanelOpen: boolean,
  openPanel: () => void,
  closePanel: () => void,
  togglePanel: () => void,

  // Selection state (shared between inline and panel modes)
  currentSelection: { text: string, html: string } | null,

  // Chat state
  conversations: Conversation[],         // all conversations
  activeConversation: Conversation|null,  // current one
  createConversation: () => void,
  sendMessage: (text: string) => Promise<void>,

  // Inline mode bridge (existing, relocated)
  pendingIntent: object | null,
  showScribeButton: object | null,
  respond: (payload) => void,
}
```

**Why a context, not Redux or cozy-client store:**
- Scribe state is UI-local, not persisted server-side (yet)
- Scope is narrow: only OnlyOffice editor view uses it
- Existing patterns in codebase use React context (OnlyOfficeContext, ViewerProvider)
- If conversation persistence is added later, the context can delegate to cozy-client queries without API change

### Data Flow

#### Panel Open Flow
```
User clicks panel toggle (FloatingButton or keyboard shortcut)
  -> ScribeContext.togglePanel()
  -> isPanelOpen = true
  -> View.jsx renders ScribeChatPanel in flex container
  -> OO iframe shrinks via flexbox
```

#### Selection Sharing (Inline <-> Panel)
```
Plugin detects selection
  -> casts SHOW_SCRIBE_BUTTON (one-way intent)
  -> useCozyBridge receives it
  -> ScribeContext.currentSelection updated

If panel is open:
  -> ScribeChatInput shows selection chip ("Using: first 50 chars...")
  -> User can send message referencing selection

If panel is closed and user clicks FloatingButton:
  -> EITHER opens inline popover (current behavior)
  -> OR opens panel (configurable, or long-press/right-click)

Plugin deselects:
  -> casts HIDE_SCRIBE_BUTTON
  -> ScribeContext.currentSelection = null
  -> Panel input chip disappears, but conversation continues
```

#### Chat Message Flow
```
User types message in ScribeChatInput
  -> ScribeContext.sendMessage(text)
  -> Appends user message to activeConversation.messages
  -> Calls scribeAI with full conversation history (multi-turn)
  -> Appends AI response to activeConversation.messages
  -> AI response may include action buttons (replace/insert)
    -> These trigger the same respond() flow as inline mode
```

### Chat State Model

```typescript
interface Conversation {
  id: string            // crypto.randomUUID()
  title: string         // auto-generated from first message
  messages: Message[]
  createdAt: number
  updatedAt: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string       // markdown
  timestamp: number
  // For user messages that included a selection:
  selection?: { text: string, html: string }
  // For AI responses with document actions:
  actions?: Array<{
    type: 'replace' | 'insert'
    text: string         // the content to apply
    applied: boolean     // tracks if user already applied it
  }>
}
```

**Storage strategy for v3.0:** In-memory only (React state). Conversations lost on page reload. This is intentional for MVP -- persistence adds complexity (localStorage serialization, cozy-client doctype, sync) with limited immediate value. Can be added in a later phase.

### Modified View.jsx Layout

```jsx
// View.jsx render (simplified)
<ScribeProvider allowedOrigins={allowedOrigins}>
  {!isEditorReady && <Spinner />}
  <div className="u-flex u-flex-grow-1">
    <div id="onlyOfficeEditor" style={{ flex: 1 }} />
    {isScribeEnabled && <ScribeChatPanel />}   {/* renders only when isPanelOpen */}
    <OnlyOfficeAIAssistantPanel />              {/* existing, unmodified */}
  </div>
  {isScribeEnabled && (
    <>
      <ScribeFloatingButton />    {/* now reads from ScribeContext */}
      <ScribePopover />            {/* now reads from ScribeContext */}
    </>
  )}
  {showReadOnlyFab && <ReadOnlyFab />}
</ScribeProvider>
```

The `ScribeProvider` wraps everything and absorbs the `useCozyBridge` logic currently in `View.jsx`. This removes ~40 lines from View.jsx and centralizes all Scribe state.

### OO Iframe Resize Behavior

**Critical finding:** The OO iframe is created by `DocsAPI.DocEditor('onlyOfficeEditor', config)` inside the `div#onlyOfficeEditor` container. The iframe gets `width: 100%` from OO's own styles. When the flex container allocates less space to the editor div (because the panel sibling takes some), the iframe automatically adapts.

This is confirmed by the existing `OnlyOfficeAIAssistantPanel` which uses `width: 30%` and successfully coexists with the editor.

**No OO API calls needed for resize.** The CSS flexbox approach is sufficient.

**Panel width:** Use fixed 380px (not percentage) for the chat panel. A fixed width provides consistent chat UX regardless of viewport size. The editor gets `flex: 1` and absorbs the remaining space.

**Transition animation:** Apply `transition: width 200ms ease` on the panel and `transition: flex 200ms ease` on the editor container for smooth open/close.

### Handling Both Panels (AI Summary + Scribe Chat)

Both `OnlyOfficeAIAssistantPanel` (existing file summary) and `ScribeChatPanel` (new chat) can theoretically be open simultaneously. However, this would squeeze the editor too much.

**Recommendation:** When Scribe chat panel opens, hide the AI summary panel (and vice versa). Implement via ScribeContext: `openPanel()` also calls `setIsOpenAiAssistant(false)` via ViewerProvider. This requires ScribeContext to have access to ViewerProvider -- achievable because both are within the OnlyOffice component tree.

### scribeAI.js Changes for Conversational Mode

Current `callScribeAI` sends a single user message. For chat, it needs multi-turn support:

```javascript
// New function alongside existing callScribeAI
export async function callScribeChatAI(client, messages, { signal } = {}) {
  // messages is the full conversation history: [{role, content}, ...]
  // System prompt is prepended
  const fullMessages = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    ...messages
  ]
  const response = await client.stackClient.fetchJSON(
    'POST',
    '/ai/v1/chat/completions',
    { messages: fullMessages, temperature: 0.7 },
    { signal }
  )
  // ... same response extraction
}
```
captureFormatSnapshot() → callCommand(function() {
  var doc = Api.GetDocument();
  var range = doc.GetRangeBySelect();
  var paragraphs = range.GetAllParagraphs();
  var snapshot = { paragraphs: [] };

The existing `callScribeAI` stays untouched for inline mode. A new `CHAT_SYSTEM_PROMPT` instructs the LLM to be conversational and optionally suggest document actions.

## Patterns to Follow

### Pattern 1: Context Provider Wrapping View
**What:** ScribeContext provider wraps the View component, absorbing bridge lifecycle
**When:** Always -- this is the primary architectural change
**Example:**
```jsx
// In View.jsx
const View = ({ id, apiUrl, docEditorConfig }) => {
  return (
    <ScribeProvider>
      <ViewInner id={id} apiUrl={apiUrl} docEditorConfig={docEditorConfig} />
    </ScribeProvider>
  )
}
```

### Pattern 2: Conditional Flex Sibling for Panel
**What:** Panel renders conditionally in the flex container, editor auto-resizes
**When:** Panel open/close toggle
**Example:**
```jsx
<div className="u-flex u-flex-grow-1">
  <div id="onlyOfficeEditor" style={{ flex: 1, minWidth: 0 }} />
  {isPanelOpen && (
    <div style={{ width: 380, flexShrink: 0, borderLeft: '1px solid divider' }}>
      <ScribeChatPanel />
    </div>
  )}
</div>
```

### Pattern 3: Selection Passthrough Without Refactoring Bridge
**What:** Current SHOW_SCRIBE_BUTTON intent already carries `text`. Extend it to also carry `html` (the plugin already sends HTML in AI_TEXT_EDIT). The ScribeContext stores this as `currentSelection`.
**When:** Any time the user selects text in OO
**Why important:** The chat panel needs to reference the current selection WITHOUT triggering the full AI_TEXT_EDIT intent flow.

### Pattern 4: Message-Level Action Buttons
**What:** AI responses in chat can include actionable suggestions (replace selection, insert at cursor). These are rendered as buttons on the message bubble.
**When:** The LLM response includes document-modifiable content
**Example:** The LLM returns "Here's a revised version: ..." and the UI adds Replace/Insert buttons below that message. Clicking triggers the same `respond()` flow back to the plugin.

## Anti-Patterns to Avoid

### Anti-Pattern 1: DOM Manipulation for Resize
**What:** Directly setting iframe width/height via JavaScript to resize OO editor
**Why bad:** The existing flex layout already handles this. Direct DOM manipulation fights React's rendering model and creates race conditions with OO's own resize handlers.
**Instead:** Use CSS flexbox siblings. The iframe auto-adapts to its container.

### Anti-Pattern 2: Duplicating Bridge Logic in Chat Panel
**What:** Creating a second CozyBridge instance or second postMessage listener for the chat panel
**Why bad:** Message routing conflicts, duplicate handlers, race conditions on intent resolution
**Instead:** Single CozyBridge in ScribeContext, shared between inline and panel modes.

### Anti-Pattern 3: Storing Full Conversation in URL/Query Params
**What:** Persisting chat state in URL for "shareable conversations"
**Why bad:** URLs have length limits, conversation data is large, security concerns with AI prompts in URLs
**Instead:** In-memory state for v3.0. Future: cozy-client doctype for server-side persistence.

### Anti-Pattern 4: Using MUI Drawer for Side Panel
**What:** MUI Drawer overlays content with a backdrop
**Why bad:** User cannot see/interact with document while panel is open. The existing `OnlyOfficeAIAssistantPanel` already demonstrates the correct sibling approach.
**Instead:** Flex sibling with fixed width, no backdrop.

### Anti-Pattern 5: Refactoring ScribePopover for Chat
**What:** Trying to make ScribePopover work as both inline modal AND chat panel
**Why bad:** Completely different UX paradigms. Popover is transient (open-act-close). Chat is persistent (stays open across interactions). Merging them creates a confused component.
**Instead:** Keep ScribePopover for inline quick actions. Build ScribeChatPanel as a separate component. They share ScribeContext for selection state.

## Build Order (Dependency-Driven)

**Alternative: Marker approach**
1. Insert a unique zero-width character (e.g., `\u200B`) at start and end of content
2. After InsertContent, search for markers
3. Select range between markers
4. Delete markers

**Recommendation:** Defer post-injection selection to a sub-phase. Build content injection first, add selection after. The marker approach is more robust than position calculation but adds complexity.

## Format Preservation Strategy

### The Problem

Markdown is a lossy format. When original text goes through the LLM:
```
Phase 1: ScribeContext + Provider
  - Extract useCozyBridge logic from View.jsx into ScribeContext
  - Add isPanelOpen state
  - Add currentSelection tracking (from SHOW_SCRIBE_BUTTON intent data)
  - Refactor View.jsx to use ScribeProvider
  - Existing inline mode must keep working identically

Phase 2: Panel Shell + Layout
  - ScribeChatPanel renders in flex container (empty shell)
  - Toggle button to open/close (modify ScribeFloatingButton or add toolbar button)
  - Verify OO iframe resizes correctly
  - Handle mutual exclusion with OnlyOfficeAIAssistantPanel

Phase 3: Chat Messages + Input
  - ScribeChatMessages component (message list with auto-scroll)
  - ScribeChatInput component (text area + selection chip + send button)
  - Conversation state model in ScribeContext
  - Wire to scribeAI.js with multi-turn support

Phase 4: Action Buttons on AI Messages
  - AI messages get Replace/Insert buttons
  - Wire to existing respond() flow to apply changes to OO document
  - Handle edge cases (selection changed since AI response, no selection)

Phase 5: Conversation History
  - List of past conversations in panel header/sidebar
  - Create new conversation
  - Switch between conversations
  - Auto-title from first message
```

**Phase ordering rationale:**
- Phase 1 is prerequisite for everything -- centralizes state without visible changes
- Phase 2 proves the layout works before investing in chat UI
- Phase 3 is the core feature
- Phase 4 connects chat to document (the differentiator vs generic chat)
- Phase 5 is polish, can be deferred

## New vs Modified Files Summary

### New Files (5+)

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `src/.../OnlyOffice/Scribe/ScribeContext.jsx` | Context provider, shared state, bridge integration | ~150 LOC |
| `src/.../OnlyOffice/Scribe/ScribeChatPanel.jsx` | Panel container, layout, header | ~100 LOC |
| `src/.../OnlyOffice/Scribe/ScribeChatMessages.jsx` | Message list with auto-scroll | ~80 LOC |
| `src/.../OnlyOffice/Scribe/ScribeChatMessage.jsx` | Single message bubble, action buttons | ~100 LOC |
| `src/.../OnlyOffice/Scribe/ScribeChatInput.jsx` | Text input, selection chip, send | ~120 LOC |

### Modified Files (4)

| File | Changes |
|------|---------|
| `View.jsx` | Wrap with ScribeProvider, remove inline bridge logic, add ScribeChatPanel to flex container |
| `useCozyBridge.js` | Extract into ScribeContext (may become internal to ScribeContext) |
| `ScribeFloatingButton.jsx` | Read from ScribeContext, add panel toggle behavior |
| `scribeAI.js` | Add `callScribeChatAI` and `CHAT_SYSTEM_PROMPT` for multi-turn |

### Unchanged Files

| File | Why Unchanged |
|------|---------------|
| `ScribePopover.jsx` | Inline mode works the same, just reads from context instead of props |
| `ScribeActionMenu.jsx` | Menu UI unchanged |
| `ScribeResultPanel.jsx` | Result display unchanged |
| `scribeActions.js` | Action config unchanged |
| `cozy-bridge/index.js` | Bridge routing unchanged |
| `cozy-bridge/protocol.js` | No protocol changes needed |
| `OnlyOfficeProvider.jsx` | Not modified, ScribeContext wraps inside it |

## Scalability Considerations

| Concern | At launch | At 100 conversations | At 1000+ messages/conv |
|---------|-----------|---------------------|----------------------|
| Memory | In-memory state, ~KB | ~100KB, fine | Risk: 10MB+. Add pagination or auto-archive old conversations |
| API token limit | ~4K context window | Same per conversation | Truncate old messages, keep system prompt + last N |
| Panel render perf | Fine | Fine | Virtualize message list (react-window) if needed |
| State persistence | None (lost on reload) | Users will want persistence | Add cozy-client doctype io.cozy.ai.conversations |

## Sources

- Codebase analysis: `View.jsx`, `Editor.jsx`, `useCozyBridge.js`, `ScribePopover.jsx`, `OnlyOfficeAIAssistantPanel.tsx` (HIGH confidence)
- `styles.styl`: existing `ai-assistant-panel { width: 30% }` confirms flex sibling pattern (HIGH confidence)
- `OnlyOfficeProvider.jsx`: context pattern to follow (HIGH confidence)
- cozy-ui Panel component: exports `Group`, `Main`, `Side` -- could use `Panel.Side` for semantic markup, but inline styles are simpler and match existing Scribe patterns (MEDIUM confidence)
- cozy-ui Drawer: re-exports MUI Drawer -- confirmed NOT suitable for persistent side panel (HIGH confidence)
