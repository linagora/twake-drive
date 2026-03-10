# Project Research Summary

**Project:** Scribe Chat Side Panel (v3.0)
**Domain:** Conversational AI chat panel integrated into OnlyOffice document editor
**Researched:** 2026-03-10
**Confidence:** MEDIUM-HIGH

## Executive Summary

Scribe v3.0 adds a persistent chat side panel alongside the existing inline popover mode in Cozy Drive's OnlyOffice editor. This is a well-established pattern -- Google Docs Gemini, Microsoft Copilot in Word, and CKEditor AI all ship right-side panels that coexist with the document editor via flex layout. The existing codebase already proves this works: `OnlyOfficeAIAssistantPanel` renders at 30% width as a flex sibling to the OO editor iframe, and the iframe resizes naturally. Zero new npm dependencies are needed -- cozy-ui, localforage, react-markdown, and cozy-stack-client already provide everything required.

The recommended approach is to introduce a `ScribeContext` provider that centralizes all Scribe state (currently scattered across View.jsx, useCozyBridge, and ScribePopover), then build the chat panel as a flex sibling in the existing layout container. The chat uses the cozy-stack `/ai/chat/conversations` API for server-side persistence and streaming via cozy-realtime websockets, while the inline mode continues using the synchronous `/ai/v1/chat/completions` endpoint. This dual-API approach avoids rearchitecting the working inline mode.

The primary risk is OO iframe resize behavior. While the existing AI panel proves the flex sibling pattern works, OO has no documented resize callback, and the cross-origin iframe prevents direct DOM manipulation. This must be validated in Phase 1 as a go/no-go gate. The second major risk is state desynchronization between inline and panel modes -- a single "active mode" state with lifted selection context prevents both modes from competing for the plugin communication channel.

## Key Findings

### Recommended Stack

Zero new dependencies. The entire stack is already installed.

**Core technologies:**
- **cozy-ui Panel/Paper/Typography/TextField/IconButton** (135.8.0): All chat UI components, already available and verified
- **localforage** (1.10.0): Conversation persistence via IndexedDB, already used in `persistedState.js`
- **cozy-stack-client `fetch()`** (60.19.0): Raw Response for SSE streaming with automatic auth headers
- **cozy-realtime** (5.8.0): Websocket subscriptions for conversation API streaming events
- **react-markdown + remark-gfm** (10.1.0 / 4.0.1): Markdown rendering in AI response bubbles, already used in ScribeResultPanel
- **cozy-flags** (4.6.1): Feature flag `drive.scribe.panel` to gate panel during development

**What NOT to add:** No chat UI libraries (overkill), no MUI Drawer (overlays instead of resizing), no state management libraries (React context sufficient), no WebSocket libraries (cozy-realtime handles it).

### Expected Features

**Must have (table stakes):**
- Side panel container (flex sibling, 380px fixed width)
- Chat message list with auto-scroll
- Text input with send button (Enter to send, Shift+Enter for newline)
- Selection awareness (chip showing selected text context)
- Action buttons on AI responses (Copy, Replace, Insert)
- Panel open/close toggle preserving conversation state
- Loading state with cancel support
- Multi-turn conversational messages (full history sent to API)
- Error handling rendered as chat messages with retry
- Toggle between inline and panel modes

**Should have (differentiators):**
- Selection chip with preview and dismiss
- Quick action chips (reuse SCRIBE_ACTIONS)
- Markdown rendering in AI responses (direct reuse from v2.1)
- Context indicator ("142 words selected")
- New conversation button

**Defer (v3.1+):**
- Streaming responses (needs backend SSE verification)
- File/URL/image attachment
- Model/agent selection
- Past conversation history browser with search
- LLM-decided action buttons
- Resizable panel
- Document-wide context (full doc as input)

### Architecture Approach

The architecture centers on a new `ScribeContext` provider that wraps View.jsx and absorbs the existing `useCozyBridge` logic, centralizing panel state, selection tracking, conversation management, and plugin communication. The chat panel renders as a conditional flex sibling to `div#onlyOfficeEditor` in the existing `u-flex u-flex-grow-1` container. Inline mode (ScribePopover) and panel mode (ScribeChatPanel) share the context but enforce mutual exclusion via an `activeMode` state.

**Major components:**
1. **ScribeContext** (new provider) -- shared state: panel open/close, current selection, active conversation, mode toggle, plugin communication
2. **ScribeChatPanel** (new) -- panel container, renders in flex layout, 380px width
3. **ScribeChatMessages + ScribeChatMessage** (new) -- message list with markdown rendering and action buttons
4. **ScribeChatInput** (new) -- text input, selection chip, quick actions, send
5. **scribeAI.js** (modified) -- new `callScribeChatAI` for multi-turn alongside existing `callScribeAI`

**Key architectural decisions:**
- Fixed 380px panel width (not percentage) for consistent chat UX
- In-memory conversation state for MVP, localforage persistence added in a later phase
- Plugin code.js unchanged -- existing selection polling and intent response protocol is sufficient
- When Scribe panel opens, hide the existing AI summary panel (mutual exclusion)

### Critical Pitfalls

1. **OO iframe resize has no callback** -- The editor may not detect container size changes via flex. Must validate with existing AIAssistantPanel as first task. Prevention: CSS flex layout (not JS), test instant toggle before animation, have fallback plan (overlay instead of resize). Phase 1 go/no-go gate.

2. **Cross-origin iframe blocks resize dispatch** -- Cannot dispatch events into or access DOM of the OO iframe. Prevention: rely exclusively on CSS flex sizing, use plugin as resize coordinator if needed (it runs inside OO's context).

3. **State desync between inline and panel modes** -- Both modes competing for plugin communication causes intent routing conflicts and stale selection. Prevention: single `activeMode` state, lifted selection context in ScribeContext, only one mode receives intents at a time.

4. **Conversations API is async + websocket-based** -- `POST /ai/chat/conversations/:id` returns 202, AI response arrives via websocket on `io.cozy.ai.chat.events`. Prevention: use cozy-realtime subscriptions, subscribe before first POST, handle delta/done streaming protocol, keep inline mode on synchronous API.

5. **Selection lost during panel interaction** -- User changes selection while chatting, Replace/Insert acts on wrong text. Prevention: pin selection when attaching context to a message, separate "conversation context" from "modification target", require explicit re-select for document modifications.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: ScribeContext + Panel Layout Validation

**Rationale:** OO iframe resize is a go/no-go gate. Must prove the flex sibling layout works before investing in chat UI. ScribeContext is prerequisite for all subsequent work.
**Delivers:** ScribeContext provider wrapping View.jsx with existing inline mode still working; empty panel shell toggling open/close; verified OO resize behavior; mutual exclusion with AIAssistantPanel.
**Addresses:** Features 1 (panel container), 7 (open/close toggle)
**Avoids:** Pitfall 1 (resize corruption), Pitfall 2 (cross-origin), Pitfall 7 (z-index), Pitfall 8 (toggle animation), Pitfall 15 (mobile)

### Phase 2: Chat Messages + Input + AI Integration

**Rationale:** Core chat functionality builds on the validated panel shell. Multi-turn API integration is the feature that makes the panel useful.
**Delivers:** Working chat with send/receive, markdown-rendered AI responses, loading states, error handling, auto-scroll.
**Addresses:** Features 2 (message list), 3 (text input), 8 (loading), 9 (multi-turn), 10 (errors), D5 (markdown rendering)
**Avoids:** Pitfall 5 (render performance -- design memoization from start), Pitfall 10 (cozy-ui width audit), Pitfall 11 (keyboard shortcuts)

### Phase 3: Selection Context + Document Actions

**Rationale:** Connecting chat to the document is what differentiates this from a generic chatbot. Depends on working chat from Phase 2 and ScribeContext selection tracking from Phase 1.
**Delivers:** Selection chip in input, Replace/Insert buttons on AI responses, context indicator, pinned selection management.
**Addresses:** Features 4 (selection awareness), 5 (action buttons), D1 (selection chip), D6 (context indicator)
**Avoids:** Pitfall 3 (state desync -- activeMode enforcement), Pitfall 6 (selection pinning)

### Phase 4: Mode Toggle + Quick Actions

**Rationale:** Polish phase. Both modes are individually functional; this phase connects them and adds efficiency features.
**Delivers:** Inline/panel mode toggle (Ctrl+I vs Ctrl+Shift+I), quick action chips, floating button behavior update.
**Addresses:** Features 6 (mode toggle), D2 (quick actions)
**Avoids:** Pitfall 12 (floating button position)

### Phase 5: Conversation Persistence + History

**Rationale:** Persistence is valuable but not required for a functional chat. Can use in-memory state through Phase 1-4, add persistence as final polish.
**Delivers:** Conversation saved to localforage keyed by fileId, restore on re-open, new conversation button, basic conversation management.
**Addresses:** D4 (persistence), D7 (new conversation button)
**Avoids:** Pitfall 9 (conversation ID races), Pitfall 13 (document-scoped history), Pitfall 14 (websocket cleanup)

### Phase Ordering Rationale

- Phase 1 must come first because iframe resize is a hard blocker -- if OO cannot handle it, the entire architecture changes
- Phase 2 before Phase 3 because chat must work standalone before adding document integration
- Phase 3 before Phase 4 because document actions are the core value proposition, while mode toggle is navigation polish
- Phase 5 last because in-memory conversations are sufficient for MVP; persistence adds complexity with limited immediate impact
- Each phase delivers a testable, demonstrable increment

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** OO iframe resize behavior must be empirically validated -- no documentation exists. 5-minute test with existing AIAssistantPanel may resolve this immediately.
- **Phase 2:** cozy-stack conversations API (async + websocket) needs end-to-end validation before building the UI. May discover the synchronous `/ai/v1/chat/completions` endpoint is simpler for MVP.
- **Phase 3:** Selection pinning strategy needs prototyping -- "conversation context" vs "modification target" distinction is novel to this codebase.

Phases with standard patterns (skip research-phase):
- **Phase 4:** Mode toggle is straightforward React state + keyboard shortcut registration. Well-understood patterns.
- **Phase 5:** localforage persistence is a known pattern already used in the codebase (`persistedState.js`).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All dependencies verified present at exact versions. Zero new packages. Integration points confirmed in source code. |
| Features | MEDIUM-HIGH | Industry patterns well-established (Copilot, Gemini, CKEditor). Scribe-specific integration (iframe, postMessage) builds on proven v2.1 architecture. |
| Architecture | HIGH | ScribeContext + flex sibling pattern directly follows existing AIAssistantPanel. Component boundaries are clear. ~550 LOC of new code estimated. |
| Pitfalls | MEDIUM-HIGH | OO iframe resize and conversations API behavior are the two areas of genuine uncertainty. All other pitfalls have clear prevention strategies. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **OO iframe resize behavior:** Undocumented. Must be tested empirically in Phase 1 before committing to flex sibling layout. Fallback: overlay panel.
- **cozy-stack streaming support:** `stream: true` is typed in cozy-client but not tested in this project. The conversations API uses websockets, not SSE. Need to determine which API path to use for chat (synchronous completions vs async conversations).
- **Conversations API availability:** The `io.cozy.ai.chat.conversations` doctype and API may require specific cozy-stack version or permissions. Need to verify availability in the target deployment.
- **Plugin as resize coordinator:** If CSS flex alone does not trigger OO relayout, the plugin could potentially force it via `executeMethod`. No known method for this exists -- would need exploration.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `View.jsx`, `Editor.jsx`, `useCozyBridge.js`, `ScribePopover.jsx`, `OnlyOfficeAIAssistantPanel.tsx`, `styles.styl`, `scribeAI.js`, plugin `code.js`
- cozy-ui components: verified at `node_modules/cozy-ui/transpiled/react/` (Panel, Paper, Typography, TextField, etc.)
- cozy-stack-client: verified `fetch()` returns raw Response with auth headers (CozyStackClient.js line 217)
- localforage: verified at 1.10.0, used in `src/store/persistedState.js`
- [Cozy-Stack AI Documentation](https://docs.cozy.io/en/cozy-stack/ai/) -- conversations API, websocket protocol
- [io.cozy.ai.chat.conversations Doctype](https://docs.cozy.io/en/cozy-doctypes/docs/io.cozy.ai.chat.conversations/)
- [ONLYOFFICE Events API](https://api.onlyoffice.com/docs/docs-api/usage-api/config/events/)

### Secondary (MEDIUM confidence)
- Industry patterns: Google Gemini side panel, Microsoft Copilot in Word, CKEditor AI Quick Actions
- cozy-client AI model types: `stream` option in ChatCompletionOptions typedef (not runtime-tested)
- Community patterns: React context for editor state, CSS flex iframe resize

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
