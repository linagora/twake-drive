# Domain Pitfalls

**Domain:** Chat side panel addition to existing OnlyOffice writing assistant (Scribe v3.0)
**Researched:** 2026-03-10
**Confidence:** MEDIUM-HIGH (OO iframe behavior from direct codebase analysis + official API docs; conversation storage from official cozy-stack docs; state management from React ecosystem evidence; performance concerns from community experience)

---

## Critical Pitfalls

Mistakes that cause rewrites, broken editor experience, or data loss.

---

### Pitfall 1: OO Editor Iframe Has No Resize Callback -- Blind Resize Causes Layout Corruption

**What goes wrong:**
The side panel opens by reducing the OO editor iframe width (e.g., from 100% to 70%). The OO editor does not detect the container size change. The document canvas, ruler, page layout, and scroll positions remain calculated for the old width. Text reflows incorrectly or not at all. The editor appears cropped, shows horizontal scrollbars, or renders blank areas. Closing the panel does not restore the correct layout.

**Why it happens:**
The OnlyOffice Docs API has **no resize event or callback** for when the editor's container element changes dimensions. The official events API (onAppReady, onDocumentReady, onDocumentStateChange, onInfo, etc.) covers document lifecycle and user actions -- none relate to container/iframe size changes. The editor internally listens to `window.resize` on its own iframe window, but changing the iframe element's CSS width from the parent frame does not necessarily trigger a `resize` event inside the iframe's own window context. The behavior depends on how the browser propagates layout changes to cross-origin iframes.

In the current codebase, View.jsx uses `forceIframeHeight` to manipulate the iframe directly:
```javascript
const forceIframeHeight = value => {
  const iframe = document.getElementsByName(FRAME_EDITOR_NAME)[0]
  if (iframe) iframe.style.height = value
}
```
The existing `OnlyOfficeAIAssistantPanel` already uses `width: 30%` in styles.styl alongside the editor, placed in a flex container. This means the pattern of side-by-side layout already exists, but its actual behavior under resize is unverified at scale.

**Consequences:**
- Document appears cropped or has wrong page width after panel opens
- Text reflow fails: lines extend beyond visible area, pagination breaks
- User cannot edit properly with the panel open (effectively broken editor)
- Closing the panel may not restore correct layout without a full editor reload
- The failure is visual and immediate -- users will report it as a critical bug

**Prevention:**

1. **Test the existing `OnlyOfficeAIAssistantPanel` behavior first.** Open the AI assistant panel (if available via feature flag), verify whether OO correctly reflows when the panel appears. This is a 5-minute validation that reveals the actual OO behavior on resize. The existing `width: 30%` in `styles.styl` and flex layout in View.jsx suggest someone has already attempted this pattern.

2. **Force a `window.resize` dispatch inside the OO iframe after changing its container width:**
   ```javascript
   const iframe = document.getElementsByName(FRAME_EDITOR_NAME)[0]
   if (iframe && iframe.contentWindow) {
     try {
       iframe.contentWindow.dispatchEvent(new Event('resize'))
     } catch (e) {
       // Cross-origin: cannot dispatch events into OO iframe
     }
   }
   ```
   This may fail due to cross-origin restrictions (the OO editor iframe is served from a different origin than Cozy Drive). If it fails, the only option is to set the iframe width via CSS and hope OO handles it internally.

3. **Use CSS flex/grid layout, not JavaScript width manipulation.** Let the browser handle the iframe sizing via flex properties. OO may respond better to a gradual flex-based resize than to a sudden `style.width` change:
   ```css
   .onlyoffice-container { display: flex; }
   .editor-wrapper { flex: 1 1 auto; min-width: 0; }
   .side-panel { flex: 0 0 400px; } /* or percentage */
   ```

4. **Add a CSS transition on the editor container width** (200-300ms). A gradual transition may trigger the browser to fire resize events that OO picks up, whereas an instant width change may not. Test both.

5. **Fallback: reload the editor config with new width.** If OO truly cannot handle container resize, the nuclear option is to destroy and recreate the DocsAPI.DocEditor instance with updated configuration. This is terrible UX (document flickers, loses undo history, may trigger a save cycle) but guarantees correct layout. Use this only as last resort.

6. **Add a ResizeObserver on the editor container** to detect when the actual resize happens, and debounce any follow-up actions (like dispatching resize events) to avoid resize loops.

**Detection:**
- Open panel, look at the OO editor. If page margins, ruler width, or text reflow look wrong, the resize was not detected.
- Check if horizontal scrollbars appear in the OO editor iframe after resize.
- Measure the OO canvas element width vs. the iframe width -- they should match.

**Phase to address:** Phase 1, first task. This is a go/no-go gate. If OO cannot handle container resize at all, the side panel architecture must change (overlay instead of resize, or full-page takeover).

**Confidence:** MEDIUM -- the existing `OnlyOfficeAIAssistantPanel` code suggests this pattern has been attempted, but its actual runtime behavior is unverified. OO's internal resize handling is not documented.

---

### Pitfall 2: Cross-Origin Iframe Blocks Resize Event Dispatch and Direct DOM Access

**What goes wrong:**
The developer tries to dispatch `resize` events, read `contentWindow.innerWidth`, or access the OO editor's internal DOM from the Cozy Drive parent. All attempts fail with `SecurityError: Blocked a frame with origin "X" from accessing a cross-origin frame`.

**Why it happens:**
The frame hierarchy is: Cozy Stack > Cozy Drive iframe > OO Editor iframe > Plugin iframe. The OO editor iframe is served from the OO document server (a different origin than Cozy Drive). The Same-Origin Policy prevents:
- Dispatching events into the OO iframe's window
- Reading or writing the OO iframe's document or DOM
- Accessing `iframe.contentWindow.innerWidth` or similar properties
- Calling any methods on `iframe.contentDocument`

The only cross-origin communication channel is `postMessage`, which the existing cozy-bridge protocol already uses.

**Consequences:**
- Cannot programmatically trigger OO to detect its new size
- Cannot read OO's internal state (canvas width, page layout, scroll position)
- Cannot verify whether OO correctly handled the resize
- Debugging is harder because you cannot inspect the OO iframe from Cozy Drive's DevTools context

**Prevention:**

1. **Do not attempt direct DOM access to the OO iframe.** Rely exclusively on CSS-based sizing (flex/grid) and let the browser propagate layout changes.

2. **The OO plugin CAN detect its own iframe resize.** If needed, add logic to the plugin's `code.js` that listens for `window` resize events (the plugin has access to its parent OO editor frame via postMessage). The plugin could notify Cozy Drive that OO has (or has not) detected a resize:
   ```javascript
   // In plugin code.js (runs inside OO's iframe tree)
   window.addEventListener('resize', function() {
     postToAncestors({ type: 'cozy-bridge:intent', action: 'EDITOR_RESIZED', ... })
   })
   ```

3. **Test with the actual OO dev setup.** The cross-origin behavior depends on the exact deployment configuration. In dev, OO runs at `localhost:80` while Cozy Drive runs at `drive.cozy.localhost:8080` -- they are cross-origin. In production, the origins may differ further.

4. **Consider using the plugin as a resize coordinator.** Since the plugin can access `window.Asc.plugin.executeMethod` and runs inside OO's context, it could potentially trigger an internal OO relayout. Research whether any executeMethod or callCommand can force OO to recalculate its layout.

**Detection:**
- `try { iframe.contentWindow.innerWidth } catch(e) { /* SecurityError */ }` -- if this throws, you are cross-origin.
- Check browser console for "Blocked a frame with origin" errors.

**Phase to address:** Phase 1 (alongside Pitfall 1 -- both are part of the resize feasibility validation).

**Confidence:** HIGH -- cross-origin restrictions are a browser standard, verified in the existing architecture (the entire cozy-bridge protocol exists because of this constraint).

---

### Pitfall 3: State Desynchronization Between Inline Mode and Chat Panel Mode

**What goes wrong:**
The user selects text, opens the inline Scribe popover, gets a result, then switches to the chat panel to ask a follow-up question about the same text. The chat panel does not know about the inline interaction. Conversely, the user has a conversation in the chat panel, then closes it and triggers inline Scribe -- the inline mode does not know the chat context. The two modes operate as completely separate systems despite the user expecting continuity.

Worse: the user opens the chat panel while an inline operation is in progress. Both modes try to communicate with the plugin simultaneously via the cozy-bridge protocol. The plugin responds to one but not the other, or the responses get crossed.

**Why it happens:**
The current architecture has a clear single-mode flow:
1. Plugin detects selection -> SHOW_SCRIBE_BUTTON intent -> floating button appears
2. User clicks button -> trigger-intent -> plugin casts AI_TEXT_EDIT -> pendingIntent state in useCozyBridge
3. ScribePopover opens with pendingIntent data, user picks action, gets result
4. User clicks Replace/Insert/Cancel -> respond() clears pendingIntent

This flow assumes exactly one interaction at a time. Adding a second mode (chat panel) that also needs to communicate with the plugin creates:
- **Protocol conflicts**: Who handles the AI_TEXT_EDIT intent when both modes are available?
- **Selection state ownership**: Does the plugin send selection data to the inline mode, the chat panel, or both?
- **Response routing**: When the user says "replace with this" in the chat, who sends the response to the plugin?

**Consequences:**
- User sees stale selection data in the chat panel
- Plugin sends intent responses to the wrong handler
- Race conditions between inline popover and chat panel competing for the same intent
- Confusing UX where actions in one mode do not reflect in the other

**Prevention:**

1. **Establish a single "active mode" state.** At any given time, only one mode is active (inline or panel). When the panel is open, the floating button and inline popover are disabled. When the panel is closed, inline mode resumes:
   ```javascript
   const [activeMode, setActiveMode] = useState('inline') // 'inline' | 'panel'
   ```

2. **Lift selection state above both modes.** The current `useCozyBridge` hook manages `pendingIntent` and `showScribeButton`. Create a higher-level state manager that both modes consume:
   ```javascript
   // ScribeContext provides:
   // - currentSelection: { text, html } (from plugin)
   // - activeMode: 'inline' | 'panel'
   // - respondToPlugin: (response) => void
   ```

3. **Do NOT allow both modes to receive intents simultaneously.** The cozy-bridge handler for AI_TEXT_EDIT must route to exactly one consumer based on `activeMode`.

4. **Share conversation context.** When the user switches from inline to panel, the inline result (if any) should appear as the first message in the chat. When switching from panel to inline, the last AI response from the chat could pre-populate the result panel.

5. **Guard the plugin communication channel.** Add a mutex-like mechanism so that only one operation (inline replace/insert OR chat-initiated document modification) can be in progress at a time. Queue subsequent requests.

**Detection:**
- Open panel while inline popover is showing -- check if both remain functional or if one breaks.
- Select text, start inline action, switch to panel mid-operation -- check if operation completes or hangs.
- Have a chat conversation, close panel, trigger inline Scribe -- check if selection data is fresh.

**Phase to address:** Phase 2 (protocol and state architecture). Must be designed before building either the panel UI or the mode toggle.

**Confidence:** HIGH -- this is a fundamental architectural concern visible directly from the current codebase structure.

---

### Pitfall 4: Conversation Persistence via io.cozy.ai.chat.conversations API is Async + Websocket-Based

**What goes wrong:**
The developer calls `POST /ai/chat/conversations/:id` expecting a synchronous response with the AI's answer. Instead, the API returns `202 Accepted` immediately with the conversation document (containing only the user's message). The AI response arrives later via websocket (`io.cozy.ai.chat.events`). The developer does not set up the websocket subscription, so the response is never received. The chat shows the user's message but never shows the AI's reply.

Alternatively: the developer sets up the websocket but does not handle the streaming protocol correctly. The `io.cozy.ai.chat.events` doctype sends `delta` objects (individual tokens) and a `done` signal. Missing the `done` signal means the chat never knows the response is complete. Missing `delta` objects means the response is incomplete.

**Why it happens:**
The existing Scribe AI integration (`scribeAI.js`) uses a different endpoint: `POST /ai/v1/chat/completions`, which is synchronous (returns the full response in the HTTP body). The chat conversations API (`POST /ai/chat/conversations/:id`) uses a fundamentally different pattern:
1. POST creates a job on the server
2. Server returns 202 with the conversation document (user message added)
3. Server pushes response tokens via realtime websocket on `io.cozy.ai.chat.events`
4. Client accumulates tokens and displays them
5. `done` event signals completion, includes sources (relevant documents from RAG)

These are two different APIs with different protocols. The v3.0 chat panel must use the conversations API (for persistence and streaming), while the inline mode continues using the completions API (for simplicity).

**Consequences:**
- Chat panel shows user messages but no AI responses (if websocket not connected)
- Partial responses if token streaming is not handled correctly
- "Conversation saved but response missing" if the websocket connection drops mid-stream
- Duplicate responses if the websocket reconnects and replays events

**Prevention:**

1. **Use cozy-realtime for websocket subscriptions.** Cozy Drive already uses `cozy-realtime` (5.8.0) for file change subscriptions (see `OnlyOfficeProvider.jsx`). Use the same pattern:
   ```javascript
   const realtime = client.plugins.realtime
   realtime.subscribe('created', 'io.cozy.ai.chat.events', conversationId, handleEvent)
   ```

2. **Handle the streaming protocol explicitly:**
   - `object: "delta"` -> append `content` to accumulated response, update chat UI
   - `object: "done"` -> mark response as complete, save final state
   - Handle `position` field for ordering (tokens may arrive out of order in edge cases)

3. **Implement reconnection logic.** If the websocket drops during a response:
   - Re-fetch the conversation document to get any persisted partial response
   - Re-subscribe to events
   - Show a "reconnecting..." indicator in the chat

4. **Keep the inline mode's synchronous API (`/ai/v1/chat/completions`) unchanged.** Do not try to unify both modes onto the same API. They serve different purposes: inline = quick one-shot, panel = multi-turn conversational.

5. **Test the conversation lifecycle end-to-end early.** Before building the chat UI, verify:
   - POST creates conversation and returns 202
   - Websocket events arrive with correct format
   - Final conversation document has both user and assistant messages
   - Conversation can be re-fetched by ID for history display

**Detection:**
- POST to conversations API, check response status code. If 200 with AI response -> wrong API. If 202 without AI response -> correct API, need websocket.
- Check browser DevTools Network tab for websocket frames after posting.
- Look for `io.cozy.ai.chat.events` in websocket traffic.

**Phase to address:** Phase 2 or 3 (when implementing the chat panel's AI interaction). Requires early validation of the API behavior.

**Confidence:** HIGH -- verified from official cozy-stack documentation (docs.cozy.io/en/cozy-stack/ai/).

---

## Moderate Pitfalls

---

### Pitfall 5: Chat History Growth Degrades React Rendering Performance

**What goes wrong:**
After 50+ messages in a conversation (or many conversations loaded in the sidebar), the chat panel becomes sluggish. Typing in the input field has noticeable lag. Scrolling through history stutters. Each new AI token during streaming causes a re-render of the entire message list.

**Why it happens:**
React re-renders the entire message list component when state changes (new message added, streaming token appended). With 50+ messages, each containing potentially rich Markdown content rendered via react-markdown, a single state update triggers:
1. Re-render of the message list component
2. Re-render of each message component (unless memoized)
3. Re-parse and re-render of Markdown in each message (if using react-markdown)

The streaming case is worst: every 50-100ms a new token arrives, triggering a state update that re-renders the entire list.

**Consequences:**
- Visible lag when typing in the chat input (blocked by rendering)
- Scroll jank during history browsing
- Browser tab becomes unresponsive during long AI responses
- OO editor (sharing the same main thread) becomes sluggish

**Prevention:**

1. **Virtualize the message list.** Only render messages visible in the viewport. Use a lightweight virtualizer (react-window or similar) for the message list. Estimated row heights work for variable-height chat messages.

2. **Memoize individual message components aggressively:**
   ```javascript
   const ChatMessage = React.memo(({ message }) => {
     // Only re-render if message content changes
     return <MarkdownPreview content={message.content} />
   })
   ```

3. **For streaming, update only the last message.** Do not replace the entire messages array. Use a ref or separate state for the in-progress message:
   ```javascript
   const [messages, setMessages] = useState([]) // completed messages
   const streamingContentRef = useRef('') // current streaming message
   const [streamingDisplay, setStreamingDisplay] = useState('')
   // Batch token updates: flush every 100-200ms, not every token
   ```

4. **Render streaming content as plain text, switch to Markdown on completion.** Parsing Markdown on every token is expensive. Show raw text during streaming, render as Markdown only after the `done` event.

5. **Paginate conversation history.** Do not load all conversations at once. Load the 10 most recent conversations, fetch older ones on scroll or explicit "load more."

6. **Limit message count per conversation in the UI.** If a conversation exceeds 100 messages, show only the last 50 with a "load earlier messages" button.

**Detection:**
- Open Chrome DevTools Performance tab during a streaming response with 30+ existing messages. Look for long tasks > 50ms.
- Type in the input field with 50+ messages rendered -- if keystroke-to-character delay > 100ms, the list is too heavy.

**Phase to address:** Phase 3 (chat UI implementation). Design the component structure with performance in mind from the start -- retrofitting virtualization is harder than building with it.

**Confidence:** HIGH -- React re-rendering costs with large lists and Markdown parsing are well-documented.

---

### Pitfall 6: Panel Open/Close Loses Plugin Selection State

**What goes wrong:**
The user selects text in OO, opens the side panel, and starts chatting. Mid-conversation, they click elsewhere in the document (changing the selection) or OO auto-deselects. The chat panel still shows the old selection context, but the plugin's `lastSelectedText` and `lastSelectedHtml` now reflect the new (or empty) selection. When the user says "replace the selected text with this," the plugin operates on the wrong selection or fails because nothing is selected.

**Why it happens:**
The plugin's selection tracking (`init()` callback + polling) is designed for ephemeral interactions (inline Scribe). It continuously updates `lastSelectedText` as the user's selection changes. There is no mechanism to "pin" a selection for a long-running chat conversation.

When the panel is open, the user may:
- Click in the document to position the cursor (deselects)
- Select different text for a new question
- Navigate to a different page in the document
- The OO editor may auto-deselect after certain operations

**Consequences:**
- "Replace" action from chat modifies wrong text or fails
- User confusion: chat shows "your selected text: X" but the actual selection is Y
- Silent data corruption: AI response replaces the wrong paragraph

**Prevention:**

1. **Snapshot the selection when the panel opens or when the user explicitly attaches context.** Store the snapshot (text, HTML, document position) separately from the live plugin selection state:
   ```javascript
   const [pinnedSelection, setPinnedSelection] = useState(null)
   // When user opens panel with selection:
   setPinnedSelection({ text: currentSelection.text, html: currentSelection.html })
   ```

2. **Show a clear visual indicator of the pinned selection in the chat panel.** Display the pinned text as a quote or chip that the user can see and dismiss. Make it obvious what text the conversation is about.

3. **Require explicit re-selection for document modification.** When the user wants to replace text from the chat:
   - Option A: Re-select the original text programmatically (if OO supports selecting by position -- risky, positions may have changed if the document was edited)
   - Option B: Ask the user to re-select the target text ("Please select the text you want to replace, then click Replace")
   - Option C: Show the replacement text and let the user copy-paste manually

4. **Track whether the original selection is still valid.** If the document has been edited since the selection was pinned (detectable via `onDocumentStateChange` event), warn the user that the original context may have changed.

5. **Separate "context for conversation" from "target for modification."** The pinned selection is context for the AI conversation. The current live selection is the target for insert/replace. These may be different, and the UI should reflect that.

**Detection:**
- Open panel with selected text, click elsewhere in document, try to use "Replace" from chat. If it replaces wrong text or errors, selection sync is broken.
- Open panel, edit the document (add/remove paragraphs before the selected text), try to use Replace. If the replacement lands in the wrong position, positional tracking is broken.

**Phase to address:** Phase 2 (state architecture) and Phase 3 (UI for pinned selection).

**Confidence:** HIGH -- this is a direct consequence of the existing plugin architecture's ephemeral selection model.

---

### Pitfall 7: CSS z-index and Stacking Context Conflicts Between Panel, Floating Button, and Popover

**What goes wrong:**
The side panel renders behind the OO editor iframe, or the floating button appears on top of the panel, or the inline popover renders inside the panel instead of over the editor area. Z-index values that worked for a single overlay (floating button) break when a second persistent UI element (side panel) is added.

**Why it happens:**
The current UI uses:
- ScribeFloatingButton: rendered via React portal on `document.body` with `z-index: 100000`
- ScribePopover: MUI Popover (renders in a portal with its own z-index)
- OO editor iframe: has very high z-index (set internally by OO)
- OnlyOfficeAIAssistantPanel: existing panel with `width: 30%` in a flex container

Adding a side panel creates a new stacking context participant. The panel must:
- Be above the page background but below modals/popovers
- Not overlap with the OO editor area
- Not interfere with the floating button (which should be hidden when the panel is open)
- Work correctly when MUI Popover/Dialog components are used inside the panel

**Consequences:**
- Panel invisible (behind OO iframe)
- UI elements overlapping incorrectly
- Click events captured by the wrong layer
- MUI components inside the panel (menus, autocomplete, dialogs) clipped or hidden

**Prevention:**

1. **Use flex layout, not absolute/fixed positioning with z-index, for the panel.** The panel should be a sibling of the OO editor container in the DOM, not a portal:
   ```jsx
   <div className="u-flex u-flex-grow-1">
     <div id="onlyOfficeEditor" style={{ flex: 1 }} />
     {showPanel && <SidePanel style={{ width: 400 }} />}
   </div>
   ```
   This is the pattern already used by `OnlyOfficeAIAssistantPanel` in `View.jsx`.

2. **Hide the floating button when the panel is open.** Do not rely on z-index to prevent overlap:
   ```javascript
   const showButton = showScribeButton && !pendingIntent && !isPanelOpen
   ```

3. **Ensure the panel does not create a new stacking context that traps MUI portals.** MUI components (Popover, Menu, Dialog) use React portals to render on `document.body`. If the panel has `overflow: hidden` or `transform` or `filter` CSS, it creates a stacking context that can clip these portals. Avoid these properties on the panel container.

4. **Test MUI components inside the panel:** autocomplete dropdowns, select menus, tooltip popovers. Verify they render above the panel and are not clipped.

**Detection:**
- Open panel, check if it is visible and correctly positioned beside (not behind) the OO editor.
- Open a MUI Menu/Select inside the panel. If the dropdown is clipped at the panel boundary, there is a stacking context issue.

**Phase to address:** Phase 1 (layout implementation) and Phase 3 (chat UI with interactive components).

**Confidence:** HIGH -- z-index issues with iframes and MUI portals are well-documented in the React/MUI ecosystem.

---

### Pitfall 8: Toggle Animation Causes OO Editor Blank Flash or Content Jump

**What goes wrong:**
When the user toggles the side panel open or closed, the OO editor area resizes. During the transition, the editor shows a blank white area, or the document content jumps/shifts abruptly, or there is a visible "repaint flash" where the old layout briefly coexists with the new one.

**Why it happens:**
OO's internal rendering engine repaints its canvas when the container size changes. If the transition is animated (CSS transition on width), OO may:
- Repaint on every animation frame (expensive, causes jank)
- Repaint only at the start and end (causes a sudden jump)
- Not repaint at all during the transition (shows stale/clipped content)
- Show a brief blank state while recalculating page layout

The OO editor renders to a `<canvas>` element, not HTML. Canvas rendering is synchronous and does not participate in CSS transitions. The canvas must be explicitly resized and redrawn.

**Consequences:**
- Jarring visual experience every time the panel opens/closes
- Users avoid using the panel because the transition feels broken
- Potential loss of scroll position or cursor position during resize

**Prevention:**

1. **Test with no animation first.** Implement panel toggle as an instant width change (no CSS transition). If OO handles this correctly, then add animation. If OO cannot handle even instant resize, animation will make it worse.

2. **If animation is desired, hide the editor during transition:**
   ```javascript
   const handleToggle = () => {
     setEditorVisible(false) // or opacity: 0
     setIsPanelOpen(!isPanelOpen)
     setTimeout(() => {
       setEditorVisible(true) // restore after layout settles
     }, 300) // match transition duration
   }
   ```
   This is a hack but prevents the user from seeing the broken intermediate states.

3. **Use `will-change: width` on the editor container** to hint to the browser that width will change, potentially improving repaint performance.

4. **After the transition completes, force a resize event** (see Pitfall 1 prevention) to ensure OO recalculates its layout for the final width.

5. **Consider an overlay panel instead of a resize panel.** An overlay panel (absolute positioned on top of the editor, partially covering it) avoids the resize issue entirely. The tradeoff is reduced editor visible area, but the editor layout is never disturbed. This is how many editor integrations handle side panels (VS Code extensions, Google Docs add-ons).

**Detection:**
- Toggle the panel and watch the editor area during the transition. Any flicker, blank flash, or content jump indicates OO is not handling the resize smoothly.
- Record the screen at 60fps and step through frames during toggle.

**Phase to address:** Phase 1 (layout/resize validation). The animation polish can wait for later phases, but the basic toggle behavior must work.

**Confidence:** MEDIUM -- OO's canvas rendering behavior during resize is not documented. Must be empirically tested.

---

### Pitfall 9: Conversation ID Management and Race Conditions with cozy-stack

**What goes wrong:**
The user opens the chat panel and starts typing before a conversation ID is created. The first message is sent to a randomly generated conversation ID. A second message is sent before the first POST returns. Both create separate conversation documents on the server, or the second POST fails because the conversation does not exist yet.

Alternatively: the user opens an old conversation from history, sends a new message, but the server returns a 404 because the conversation was deleted or the ID is wrong.

**Why it happens:**
The cozy-stack conversations API (`POST /ai/chat/conversations/:id`) expects the client to provide the conversation ID. The client generates a random ID for new conversations. Race conditions arise when:
1. Two messages are sent before the conversation document is created
2. The client generates the ID but the server has not yet persisted the document
3. The user navigates away and back, and the local ID does not match any server document
4. The websocket subscription uses one ID while the POST uses another

**Consequences:**
- Messages split across multiple conversation documents
- Lost messages (sent to non-existent conversation ID)
- Conversation history shows duplicates or missing entries
- Websocket events arrive for wrong conversation ID

**Prevention:**

1. **Generate the conversation ID upfront and reuse it.** Create the ID before the first message, store it in state, and use the same ID for all subsequent messages and websocket subscriptions:
   ```javascript
   const [conversationId] = useState(() => generateConversationId())
   ```

2. **Disable the send button until the previous message's POST returns 202.** This prevents concurrent POSTs to the same conversation:
   ```javascript
   const [isSending, setIsSending] = useState(false)
   // On send: setIsSending(true), POST, wait for 202, setIsSending(false)
   ```

3. **Subscribe to websocket events before sending the first POST.** This ensures you do not miss the response for the first message:
   ```javascript
   useEffect(() => {
     realtime.subscribe('created', 'io.cozy.ai.chat.events', conversationId, handleEvent)
     return () => realtime.unsubscribe(...)
   }, [conversationId])
   ```

4. **When loading conversation history, handle 404 gracefully.** If a conversation document cannot be found, remove it from the local history list and show a message.

5. **Validate conversation state before document operations.** Before sending a "replace" command from a chat message, verify the conversation still exists and the referenced selection/document has not changed.

**Detection:**
- Send two messages in quick succession. Check if both appear in the same conversation document.
- Open a conversation from history, send a message. If 404, the conversation was lost.
- Check websocket events during the first message of a new conversation -- events should arrive for the correct conversation ID.

**Phase to address:** Phase 3 (chat implementation). Design the state management to prevent race conditions.

**Confidence:** HIGH -- verified from the async nature of the cozy-stack conversations API.

---

### Pitfall 10: cozy-ui Components May Not Fit Chat Panel Width Constraints

**What goes wrong:**
The developer uses cozy-ui components (List, ListItem, TextField, Button, Paper, etc.) inside the 300-400px side panel. Components designed for full-width app views overflow, truncate text awkwardly, or have excessive padding that wastes space. The chat UI looks cramped and unprofessional.

**Why it happens:**
cozy-ui components are built on Material UI v4 and designed for Cozy apps that typically render at full viewport width. They may have:
- Minimum widths that exceed the panel width
- Padding/margins designed for spacious layouts
- Typography sizes optimized for main content areas, not sidebars
- Responsive breakpoints that do not account for a narrow panel context

The constraint is "use cozy-ui components without modification" -- no forking components or overriding their internal styles.

**Consequences:**
- Chat messages overflow horizontally or are truncated
- Input fields are too wide or too narrow
- Buttons stack vertically when they should be inline
- The panel feels like a poorly scaled version of a full-width app

**Prevention:**

1. **Audit cozy-ui components at 300-400px width before committing to the design.** Render each candidate component in a fixed-width container and verify appearance. Priority components to test:
   - TextField / InputBase (for chat input)
   - Paper (for message bubbles)
   - Typography (for message content)
   - List / ListItem (for conversation history)
   - IconButton (for send, attachment, model selection)
   - Spinner (for loading states)
   - Button (for action buttons in messages)

2. **Use the `dense` prop on MUI-based components** where available to reduce padding.

3. **Wrap cozy-ui components in custom container divs** with appropriate width constraints, rather than modifying the components themselves. This stays within the "no modification" constraint:
   ```jsx
   <div style={{ maxWidth: '100%', overflow: 'hidden' }}>
     <CozyUIComponent />
   </div>
   ```

4. **Design the panel at 400px minimum width.** Narrower than 300px will break most component-based designs. Wider than 500px wastes too much editor space.

5. **If a cozy-ui component truly cannot fit, use a basic HTML/CSS alternative** rather than modifying cozy-ui. For chat messages, simple `<div>` elements with inline styles may look better than force-fitting a List component.

**Detection:**
- Render the panel at target width (400px) with real cozy-ui components. If horizontal scrollbars appear, or text overflows, or layout looks broken, the component does not fit.

**Phase to address:** Phase 1 (component audit and panel width decision). Revisited in Phase 3 (chat UI implementation).

**Confidence:** MEDIUM -- depends on which specific cozy-ui components are used. The constraint is verified (from PROJECT.md).

---

## Minor Pitfalls

Issues that cause friction or minor bugs but are easily fixable.

---

### Pitfall 11: Keyboard Shortcuts Conflict Between Chat Input and OO Editor

**What goes wrong:**
The user types in the chat input field. Ctrl+B triggers OO's bold formatting instead of browser text selection. Ctrl+I triggers Scribe (via the existing shortcut) instead of italic in the input. Enter sends the message but also triggers OO's newline/paragraph break. Tab moves focus to the OO editor instead of indenting in the chat input.

**Prevention:**
- Stop propagation of keyboard events from the chat input to prevent them from reaching the OO iframe:
  ```javascript
  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) handleSend() }}
  ```
- The existing Ctrl+I shortcut (registered on `window.parent.document` by the plugin) should be conditionally disabled when the chat input is focused. Add a focus state to the Scribe context.
- Test all common keyboard shortcuts (Ctrl+A/C/V/X/Z/B/I/U) with focus in the chat input.

**Phase to address:** Phase 3 (chat input implementation).

---

### Pitfall 12: Panel Resize Breaks Floating Button Position Calculation

**What goes wrong:**
The floating button uses fixed positioning relative to the viewport. When the side panel opens, the visible editor area shrinks, but the button remains at its original position (now potentially overlapping the panel or floating in empty space).

**Prevention:**
- Hide the floating button when the panel is open (prevention already in Pitfall 7).
- If the button should remain visible with the panel open, recalculate its position relative to the editor container (not the viewport). Use the editor container's getBoundingClientRect().
- The simplest approach: the floating button is only relevant for inline mode. Panel mode has its own trigger UI (a compose area).

**Phase to address:** Phase 1 (mode toggle implementation).

---

### Pitfall 13: Conversation History Query Returns All Conversations, Not Just Current Document

**What goes wrong:**
The conversation history sidebar shows conversations from all documents the user has ever chatted about. The user opens a spreadsheet's chat history while editing a text document. Or the list is overwhelmingly long because it includes every AI interaction.

**Prevention:**
- Filter conversations by document ID when querying: `Q('io.cozy.ai.chat.conversations').where({ documentId: currentFileId })`
- Store the `fileId` (from `useOnlyOfficeContext`) as metadata in the conversation document when creating it
- Provide a "show all conversations" option separately from the document-scoped default view
- Verify the conversations API supports custom metadata fields alongside the messages array

**Phase to address:** Phase 3 (conversation history UI).

---

### Pitfall 14: Memory Leak from Websocket Subscriptions Not Cleaned Up on Panel Close

**What goes wrong:**
The user opens and closes the panel multiple times during a session. Each open creates a new websocket subscription for `io.cozy.ai.chat.events`. Subscriptions from closed panels are not unsubscribed. After multiple cycles, dozens of active subscriptions exist, consuming memory and processing events that are no longer displayed.

**Prevention:**
- Always unsubscribe in the cleanup function of the useEffect that creates the subscription:
  ```javascript
  useEffect(() => {
    realtime.subscribe('created', 'io.cozy.ai.chat.events', convId, handler)
    return () => realtime.unsubscribe('created', 'io.cozy.ai.chat.events', convId, handler)
  }, [convId])
  ```
- Use a single subscription manager (not per-component) to track active subscriptions
- Follow the existing pattern from `OnlyOfficeProvider.jsx` which correctly unsubscribes on cleanup

**Phase to address:** Phase 3 (websocket integration).

---

### Pitfall 15: Mobile/Responsive Layout Not Considered for Panel

**What goes wrong:**
The panel works on desktop but on tablet or narrow browser windows, it squishes the OO editor to an unusable width (< 300px). Or the panel itself becomes too narrow to display chat messages.

**Prevention:**
- Set minimum widths: editor min-width 500px, panel min-width 300px
- On mobile (`isMobile` from `useBreakpoints()`), show the panel as a full-screen overlay instead of a side panel
- Add a breakpoint check: if viewport width < 900px, default to overlay mode
- The existing codebase already uses `useBreakpoints()` for responsive behavior

**Phase to address:** Phase 1 (layout design).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Iframe resize / layout | OO has no resize callback (Pitfall 1) | Test existing AIAssistantPanel first, validate OO behavior |
| Iframe resize / layout | Cross-origin blocks direct manipulation (Pitfall 2) | Use CSS flex layout, not DOM access |
| Iframe resize / layout | Toggle animation causes blank flash (Pitfall 8) | Test instant toggle first, add animation later |
| State architecture | Two modes desynchronize (Pitfall 3) | Single active-mode state, lifted selection context |
| State architecture | Selection lost during panel interaction (Pitfall 6) | Pin selection on panel open, explicit re-select for modifications |
| Protocol architecture | Conversations API is async/websocket (Pitfall 4) | Use cozy-realtime, handle streaming protocol correctly |
| Chat UI implementation | Performance degrades with message history (Pitfall 5) | Virtualize list, memoize messages, batch streaming updates |
| Chat UI implementation | cozy-ui components may not fit panel width (Pitfall 10) | Audit at target width before building |
| Chat UI implementation | Keyboard shortcuts conflict (Pitfall 11) | stopPropagation on chat input |
| CSS / visual | z-index conflicts with OO iframe (Pitfall 7) | Use flex layout, not z-index stacking |
| Conversation persistence | Race conditions with conversation IDs (Pitfall 9) | Generate ID upfront, sequential message sends |
| Conversation persistence | History query unscoped to document (Pitfall 13) | Filter by fileId |
| Websocket lifecycle | Memory leaks from subscriptions (Pitfall 14) | Unsubscribe on cleanup, follow existing patterns |
| Responsive | Panel breaks on mobile/narrow viewports (Pitfall 15) | Min-widths, overlay mode on mobile |

---

## "Looks Done But Isn't" Checklist for v3.0

- [ ] **Resize stability**: Open/close panel 10 times rapidly. OO editor should remain correctly laid out every time.
- [ ] **Selection pinning**: Open panel with selection, click elsewhere in doc, use Replace from chat. Verify correct text is modified.
- [ ] **Mode switching**: Switch between inline and panel mode 5 times. Each mode should work correctly with fresh state.
- [ ] **First conversation**: Open panel, send first message to new conversation. AI response should appear via websocket.
- [ ] **History loading**: Create 3 conversations on the same document. Close and reopen panel. All 3 should appear in history.
- [ ] **Long conversation**: Send 30+ messages in a single conversation. Chat should remain responsive (type, scroll, receive).
- [ ] **Streaming display**: During AI response streaming, type in the input field simultaneously. No lag should be felt.
- [ ] **Panel width**: All cozy-ui components in the panel should render correctly at the chosen panel width. No horizontal overflow.
- [ ] **Keyboard shortcuts**: With focus in chat input, Ctrl+B/I/U should NOT trigger OO editor commands.
- [ ] **Mobile fallback**: On a 768px-wide viewport, the panel should not squish the editor below usable width.
- [ ] **Websocket cleanup**: Open/close panel 5 times, check browser DevTools for active websocket subscriptions. Count should not grow.
- [ ] **Error recovery**: Disconnect network during AI response, reconnect. Chat should recover gracefully.
- [ ] **Cross-document isolation**: Open different documents in separate tabs with chat panels. Conversations should not mix.

---

## Sources

- [ONLYOFFICE Events API](https://api.onlyoffice.com/docs/docs-api/usage-api/config/events/) -- HIGH confidence (official docs; confirms no resize event exists)
- [ONLYOFFICE Plugin Windows and Panels](https://api.onlyoffice.com/docs/plugin-and-macros/customization/windows-and-panels/) -- HIGH confidence (official docs)
- [Cozy-Stack AI Documentation](https://docs.cozy.io/en/cozy-stack/ai/) -- HIGH confidence (official docs; confirms async conversation API with websocket)
- [io.cozy.ai.chat.conversations Doctype](https://docs.cozy.io/en/cozy-doctypes/docs/io.cozy.ai.chat.conversations/) -- HIGH confidence (official docs; confirms message structure)
- [ResizeObserver Best Practices](https://web.dev/articles/resize-observer) -- HIGH confidence (web.dev)
- [iframe-resizer React](https://github.com/davidjbradshaw/iframe-resizer-react) -- MEDIUM confidence (community library)
- [IndexedDB Chat Persistence Performance](https://www.quora.com/Is-IndexedDB-suitable-for-storing-chat-messages-It%E2%80%99s-getting-too-slow-as-number-of-messages-grow) -- MEDIUM confidence (community experience)
- [React State Sharing](https://react.dev/learn/sharing-state-between-components) -- HIGH confidence (official React docs)
- cozy-drive source: `src/modules/views/OnlyOffice/View.jsx`, `src/modules/views/OnlyOffice/OnlyOfficeProvider.jsx`, `src/modules/views/OnlyOffice/OnlyOfficeAIAssistantPanel.tsx`, `src/modules/views/OnlyOffice/useCozyBridge.js`, `src/modules/views/OnlyOffice/styles.styl`, `plugins/onlyoffice-scribe/scripts/code.js`, `src/lib/cozy-bridge/index.js` -- HIGH confidence (direct code analysis)

---
*Pitfalls research for: Chat side panel addition to Scribe v3.0 (Cozy Drive + OnlyOffice)*
*Researched: 2026-03-10*
