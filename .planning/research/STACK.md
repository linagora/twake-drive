# Technology Stack

**Project:** Scribe Chat Side Panel (v3.0)
**Researched:** 2026-03-10

## Principle: Zero New Dependencies

The existing dependency tree already contains everything needed for the chat side panel. No new npm packages required. This is both a constraint (cozy-ui components preferred) and an advantage (no bundle size increase, no version conflicts).

## Recommended Stack

### Side Panel Layout

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| cozy-ui `Panel` (Group/Main/Side) | 135.8.0 | Main + side panel flexbox layout | **Already in cozy-ui.** `Panel.Group` = flex row, `Panel.Main` = flex 65%, `Panel.Side` = flex 35%. Responsive: collapses to block on mobile (<48rem). Import from `cozy-ui/transpiled/react/Panel`. |
| CSS flex overrides | - | Customize panel width | Panel.Side defaults to `flex: 0 0 35%`. Override to `flex: 0 0 380px` (or similar fixed width) for chat panel consistency. Use inline styles or stylus. |
| cozy-ui `Drawer` | 135.8.0 | **NOT recommended** for desktop | Drawer is a thin wrapper around MUI Drawer (slide-in overlay). Overlays the OO editor instead of resizing it. Only suitable for mobile fallback. |

**Layout architecture decision:** Use simple flex siblings inside the existing `u-flex u-flex-grow-1` div in `View.jsx`. The OO iframe + a chat panel div as siblings. This matches the proven pattern from `OnlyOfficeAIAssistantPanel` which already takes 30% width as a sibling div.

Alternatively, use `Panel.Group` wrapping `Panel.Main` (OO editor) + `Panel.Side` (chat) inside `Editor.jsx`. Both approaches work; the sibling-div approach requires less structural refactoring.

**Confidence:** HIGH -- verified Panel component source at `node_modules/cozy-ui/transpiled/react/Panel/index.js` and CSS (flex row, 65%/35% split, responsive collapse at 48rem).

### Iframe Resize

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CSS flexbox (natural) | - | OO iframe auto-shrinks when panel opens | OO editor is in a `u-flex u-flex-grow-1` div. Adding a sibling panel reduces available width. No JavaScript iframe resize needed. |
| `forceIframeHeight()` (existing) | - | Already in `View.jsx` for height control | Pattern exists; can extend to width if needed, but flex should handle it. |

**Key insight:** The existing `View.jsx` renders OO inside `<div className="u-flex u-flex-grow-1">`. When the chat panel is added as a sibling, the flex container automatically splits space. The OO iframe resizes because it is inside a flex child.

**Precedent:** `OnlyOfficeAIAssistantPanel.tsx` already does exactly this. It renders as a sibling div with `width: 30%` inside the same flex container. OO handles the resize event internally.

**Confidence:** HIGH -- existing AI assistant panel uses this exact pattern and works.

### Chat UI Components

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| cozy-ui `Paper` | 135.8.0 | Message bubbles, panel container | Already used extensively in Scribe. Theme-aware background + elevation. |
| cozy-ui `Typography` | 135.8.0 | Message text, timestamps, headers | Already used. Consistent typography scale. |
| cozy-ui `TextField` | 135.8.0 | Chat input field | MUI TextField wrapper. Already used in codebase (`ShortcutCreationModal.jsx`). Supports `multiline` + `maxRows` for auto-expanding input. |
| cozy-ui `IconButton` | 135.8.0 | Send button, close, copy, insert actions | Already used. |
| cozy-ui `Buttons` | 135.8.0 | Action buttons (Insert/Replace) on AI messages | Already used in AIAssistantPanel. |
| cozy-ui `Spinner` | 135.8.0 | Loading indicator during AI response | Already used. |
| cozy-ui `Divider` | 135.8.0 | Separator between conversation sections | Available in cozy-ui. |
| cozy-ui `Stack` | 135.8.0 | Vertical spacing in message list | Already used in AIAssistantPanel. |
| cozy-ui Icons | 135.8.0 | Chat UI icons | `Send`, `CrossMedium`, `Copy`, `Refresh`, `Assistant` -- all available. |
| `react-markdown` + `remark-gfm` | 10.1.0 / 4.0.1 | Render AI responses as formatted markdown | Already installed and used in `ScribeResultPanel`. |

**Chat message component:** Build a custom `ChatMessage` component. Each message = `Paper` with `Typography` + optional action buttons. User messages right-aligned (or full-width with distinct background), AI messages left-aligned. This is 50 lines of JSX -- simpler and lighter than any chat UI library.

**Confidence:** HIGH -- all components verified present in `node_modules/cozy-ui/transpiled/react/`.

### Conversation Persistence

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `localforage` | 1.10.0 | Persist chat history locally | **Already installed.** Used by `persistedState.js` and push client. IndexedDB-backed with localStorage fallback. Async API. |

**Storage schema:**

```javascript
// Key: `scribe-conversations-${fileId}`
// Value:
{
  conversations: [{
    id: string,              // crypto.randomUUID() or Date.now().toString(36)
    title: string,           // first user message, truncated
    createdAt: string,       // ISO 8601
    updatedAt: string,       // ISO 8601
    messages: [{
      role: 'user' | 'assistant',
      content: string,       // markdown text
      timestamp: string,     // ISO 8601
      metadata: {            // optional
        selectedText: string,  // OO selection context (if any)
        action: string         // 'replace' | 'insert' | null
      }
    }]
  }]
}
```

**Why NOT cozy-client doctypes for v3.0:**
1. New `io.cozy.scribe.conversations` doctype requires cozy-stack changes (permissions in manifest.webapp, server-side registration) -- heavy process.
2. Chat history is ephemeral data -- losing it is not catastrophic.
3. localforage is already battle-tested in this codebase.
4. Can migrate to doctypes in v4.0 if cross-device sync is wanted.

**Why NOT sessionStorage or raw localStorage:**
- localforage uses IndexedDB by default (much larger storage quota, async, non-blocking).
- Already imported and configured in the project.

**Confidence:** HIGH -- localforage verified at 1.10.0, already used in `src/store/persistedState.js`.

### Streaming Responses

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `client.stackClient.fetch()` (raw) | 60.19.0 | Get raw Response object for SSE streaming | `fetchJSON()` parses response as JSON (unusable for streaming). `fetch()` returns raw Response with `.body` ReadableStream. Handles auth headers automatically. |
| `ReadableStream` + `TextDecoder` | Browser native | Parse SSE chunks from streaming response | Standard Web API. No polyfill needed (React 18 targets modern browsers). |
| `{ stream: true }` in request body | - | Enable streaming in cozy-stack AI proxy | Verified in `cozy-client/dist/models/ai.js` -- `ChatCompletionOptions` typedef includes `stream` boolean. |

**Streaming implementation pattern:**

```javascript
async function callScribeAIStream(client, messages, { signal, onChunk }) {
  const response = await client.stackClient.fetch(
    'POST',
    '/ai/v1/chat/completions',
    JSON.stringify({ messages, stream: true, temperature: 0.3 }),
    {
      signal,
      headers: { 'Content-Type': 'application/json' }
    }
  )

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let accumulated = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Parse SSE lines: "data: {...}\n\n"
    const lines = buffer.split('\n')
    buffer = lines.pop() // keep incomplete line

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') return accumulated

      const parsed = JSON.parse(data)
      const delta = parsed.choices?.[0]?.delta?.content || ''
      accumulated += delta
      onChunk(accumulated) // update UI with accumulated text
    }
  }
  return accumulated
}
```

**Key finding:** `cozy-stack-client`'s `fetch()` method (CozyStackClient.js line 217) returns the raw Response object with automatic auth header injection. Supports `{ signal }` for AbortController. This is exactly what is needed -- no need to bypass cozy-stack-client or use raw `window.fetch`.

**Phased approach:** Start v3.0 with non-streaming (reuse existing `callScribeAI` with multi-turn messages array). Add streaming in a later phase. Chat UX benefits more from streaming than inline mode because responses are longer.

**Confidence:** MEDIUM -- `stream: true` is typed in cozy-client and follows OpenAI convention. However, actual cozy-stack server-side SSE support has not been tested in this project. Runtime verification needed.

### Mode Toggle (Inline vs Panel)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React state in `View.jsx` | - | Runtime panel open/close | Simple `useState(false)` for `isScribePanelOpen`. |
| `cozy-flags` | 4.6.1 | Feature flag | `flag('drive.scribe.panel')` to gate panel feature during development. Already used for `drive.scribe.enabled`. |

No new dependencies needed. Toggle is pure UI state.

## Post-Insertion Selection: Sentinel Marker Strategy

| Library | Why Not |
|---------|---------|
| Chat UI library (`@chatscope/chat-ui-kit-react`, `stream-chat-react`) | Overkill. Chat messages are Paper + Typography. These libraries add 50-200KB for features we don't need (presence, typing indicators, threads, avatar groups). |
| MUI Drawer (directly) | cozy-ui wraps it as `Drawer`. But wrong for this use case -- overlays content instead of resizing editor. Use `Panel` or flex sibling instead. |
| WebSocket library | SSE via fetch ReadableStream is sufficient. The AI proxy speaks HTTP. |
| State management (`zustand`, `jotai`, `recoil`) | Existing React state + context is sufficient. Chat state is local to the panel component tree. Not shared across the app. |
| `uuid` | Use `crypto.randomUUID()` (native in all modern browsers) or `Date.now().toString(36)` for conversation IDs. |
| New cozy-client doctype | Defer server-side persistence to v4.0. localforage is sufficient. |
| `@mui/material` Drawer/Panel directly | Must go through cozy-ui wrappers for ecosystem consistency. |
| Virtualized list (`react-window`, `react-virtualized`) | Chat message lists won't have thousands of items. Simple `overflow-y: auto` with native scrolling is fine for < 200 messages per conversation. |

## Integration Points

### Where the Panel Attaches (View.jsx, line 142)

Current structure:
```jsx
<div className="u-flex u-flex-grow-1">
  <div id="onlyOfficeEditor" />
  <OnlyOfficeAIAssistantPanel />
</div>
```

Becomes:
```jsx
<div className="u-flex u-flex-grow-1">
  <div id="onlyOfficeEditor" style={{ flex: '1 1 auto' }} />
  {isScribePanelOpen && (
    <div style={{ flex: '0 0 380px', overflow: 'hidden' }}>
      <ScribeChatPanel
        onClose={() => setIsScribePanelOpen(false)}
        fileId={file._id}
        /* selection context from useCozyBridge */
      />
    </div>
  )}
</div>
```

Note: The existing `OnlyOfficeAIAssistantPanel` may need to be hidden or integrated when Scribe panel is open to avoid two side panels competing for space.

### Chat to Plugin Communication

Reuse `useCozyBridge` hook and `respond()` callback from `View.jsx`. When user clicks "Insert" or "Replace" on a chat AI message, call `respond()` exactly as `ScribePopover` does. The plugin already handles these response actions.

Potential new intent: `CHAT_INSERT` for inserting text without requiring prior selection (e.g., user generates new content in chat and wants to insert at cursor). This is a postMessage protocol extension, not a library dependency.

### Extending scribeAI.js for Conversation

Add `callScribeAIChat()` function that accepts the full messages array (multi-turn) instead of building it from a single action. Keep `callScribeAI()` and `buildMessages()` intact for inline mode.

```javascript
export async function callScribeAIChat(client, messages, { signal } = {}) {
  // messages = [{ role: 'system', content: '...' }, { role: 'user', ... }, { role: 'assistant', ... }, ...]
  const response = await client.stackClient.fetchJSON(
    'POST',
    '/ai/v1/chat/completions',
    { messages, temperature: 0.3 },
    { signal }
  )
  const content = response?.content || response?.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from AI')
  return content
}
```

## Versions Summary

| Package | Installed | Used For | New? |
|---------|-----------|----------|------|
| cozy-ui | 135.8.0 | Panel, Paper, Typography, TextField, IconButton, Buttons, Stack, Divider, Icons | No |
| cozy-client | 60.20.0 | AI model types (stream option) | No |
| cozy-stack-client | 60.19.0 | Raw fetch for streaming, fetchJSON for non-streaming | No |
| react-markdown | 10.1.0 | Render AI markdown in chat bubbles | No |
| remark-gfm | 4.0.1 | GFM support (tables, strikethrough) in chat | No |
| localforage | 1.10.0 | Conversation persistence (IndexedDB) | No |
| turndown | 7.2.2 | HTML-to-MD for OO selection context in chat | No |
| marked | 17.0.4 | MD-to-HTML for reinsertion from chat | No |
| date-fns | 2.30.0 | Timestamp formatting in chat messages | No |
| cozy-flags | 4.6.1 | Feature flag for panel mode | No |

**Total new npm packages: 0**

## Sources

- cozy-ui Panel component: verified at `node_modules/cozy-ui/transpiled/react/Panel/index.js` -- Group (flex row), Main (65%), Side (35% + paleGrey background)
- cozy-ui Panel CSS: verified at `node_modules/cozy-ui/transpiled/react/stylesheet.css` -- responsive collapse at 48rem breakpoint
- cozy-ui Drawer: verified at `node_modules/cozy-ui/transpiled/react/Drawer/index.js` -- thin MUI Drawer re-export (overlay, not layout)
- cozy-stack-client fetch: verified at `node_modules/cozy-stack-client/dist/CozyStackClient.js` lines 206-328 -- raw Response return, auto auth headers, signal support
- cozy-client AI model: verified at `node_modules/cozy-client/dist/models/ai.js` line 74 -- `stream` option in ChatCompletionOptions typedef
- Existing AI panel pattern: verified at `src/modules/views/OnlyOffice/OnlyOfficeAIAssistantPanel.tsx` + `styles.styl` -- sibling div, width 30%, inside flex container
- Existing flex layout: verified at `src/modules/views/OnlyOffice/View.jsx` line 142 -- `u-flex u-flex-grow-1` container
- localforage usage: verified at `src/store/persistedState.js` (setItem/getItem), `src/components/pushClient/Banner.jsx`
- cozy-ui component list: verified via `ls node_modules/cozy-ui/transpiled/react/` -- TextField, Divider, Stack, all Icons present

---
*Stack research for: v3.0 Scribe Chat Side Panel*
*Researched: 2026-03-10*
