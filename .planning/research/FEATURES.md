# Feature Landscape: v3.0 Scribe Chat Panel

**Domain:** Conversational AI chat side panel for document writing assistant (Scribe) in OnlyOffice / Cozy Drive
**Researched:** 2026-03-10
**Milestone context:** v3.0 -- adding a chat panel alongside the existing inline mode, with conversational UI, selection awareness, action buttons in responses, and conversation history
**Confidence:** MEDIUM-HIGH -- patterns are well-established (Copilot in Word, Gemini in Docs both ship these features); the Scribe-specific integration (iframe resizing, postMessage protocol, cozy-ui constraints) needs validation but builds on proven v2.1 architecture.

---

## Existing v2.1 Foundation (Already Shipped)

These features are built and working. v3.0 builds on top of them.

| Feature | Status | Location |
|---------|--------|----------|
| Rich text extraction via `GetSelectedContent` + HTML->MD | Shipped | `code.js`, `scribeConversion.js` |
| LLM call via cozy-stack `/ai/v1/chat/completions` | Shipped | `scribeAI.js` |
| Result preview with Markdown rendering (react-markdown) | Shipped | `ScribeResultPanel.jsx` |
| Replace/Insert actions via PasteHtml | Shipped | `View.jsx`, `code.js` |
| Floating button + Ctrl+I trigger | Shipped | `ScribeFloatingButton.jsx` |
| Action menu (correct, tone, translate, free prompt) | Shipped | `ScribeActionMenu.jsx` |
| Error handling with retry, i18n (5 locales) | Shipped | `ScribePopover.jsx` |
| Existing AI panel (cozy-viewer AIAssistantPanel) for doc summary | Shipped (separate) | `OnlyOfficeAIAssistantPanel.tsx` |

### Existing OO iframe resize pattern

The cozy-viewer `AIAssistantPanel` already demonstrates the side panel pattern: it renders alongside the OO editor `div` in a flex container (`u-flex u-flex-grow-1`), with the panel taking `width: 30%`. This proves the layout pattern works. The Scribe chat panel can follow the same approach.

---

## Industry Reference: How Document Editor Chat Panels Work

Analysis of Google Docs Gemini, Microsoft Copilot in Word, Notion AI, and CKEditor AI, distilled into patterns relevant to Scribe.

### Common Pattern: Side Panel Chat

All major implementations use a **right-side panel** that coexists with the document. The document area shrinks (not overlapped) when the panel opens. Key shared traits:

1. **Toggle open/close** via button in toolbar or keyboard shortcut
2. **Text input at bottom** with send button
3. **Message history** scrolling upward (newest at bottom)
4. **Action buttons on AI responses** (Copy, Insert/Add to doc)
5. **Selection awareness** -- the AI knows what text is selected
6. **Suggested prompts** -- contextual quick-action chips

### Key Divergences

| Aspect | Copilot (Word) | Gemini (Docs) | Scribe Target |
|--------|---------------|---------------|---------------|
| Panel width | ~30% fixed | ~30% fixed | ~30%, user not expected to resize for v3.0 |
| Insert mechanism | "Add to doc" button | Arrow icon + Preview | Replace/Insert (existing Scribe pattern) |
| Selection context | Auto-detected, "Chat with Copilot" on selection | Auto-summary on open | Show selection chip in input area |
| Conversation history | Persisted cross-device | Added March 2026 | In-memory for v3.0, persist later |
| Suggested prompts | Follow-up chips after response | Contextual on open | Quick action chips (reuse SCRIBE_ACTIONS) |

---

## Table Stakes

Features users expect in a v1 chat panel. Missing any of these means the panel feels broken or incomplete.

| # | Feature | Category | Why Expected | Complexity | Dependencies | Notes |
|---|---------|----------|-------------|------------|--------------|-------|
| 1 | **Side panel container** | Layout | Users expect a panel beside the document, not a floating dialog. Both Copilot and Gemini use this pattern. | Medium | Flex layout in View.jsx, OO iframe resizes via `forceIframeHeight` or flex. Existing `AIAssistantPanel` pattern proves this works (30% width, Paper elevation). | Must coexist with existing `OnlyOfficeAIAssistantPanel` (or replace it). Panel opens/closes without page reload. Use cozy-ui Paper, Stack, Typography. |
| 2 | **Chat message list** | UI | Conversational UI requires visible history of user messages and AI responses. Every chat interface has this. | Medium | React state array of `{ role, content, timestamp }` messages. Scroll container with `overflow-y: auto`. | Render user messages right-aligned or distinguished, AI messages with Markdown rendering (reuse existing react-markdown + remark-gfm from v2.1). Auto-scroll to bottom on new message. |
| 3 | **Text input with send** | UI | Users need a way to type prompts. The input area is the primary interaction point. | Low | Controlled textarea/input, send button, Enter to send (Shift+Enter for newline). | Use cozy-ui TextField or MUI OutlinedInput. Disable send when empty or loading. Show loading indicator while AI responds. |
| 4 | **Selection awareness in chat** | Context | When user selects text in OO and switches to chat, the chat should know about the selection. Both Copilot and Gemini auto-detect selection context. | Medium | Extend existing plugin polling (`GetSelectedText` every 500ms) to broadcast selection to chat panel. Reuse `SHOW_SCRIBE_BUTTON` / `HIDE_SCRIBE_BUTTON` intent data. | Display a "selection chip" in the input area showing truncated selected text (e.g., "Working with: 'Lorem ipsum dolor...'"). Include selection as context in LLM prompt. If no selection, chat operates on full document context (or no context). |
| 5 | **Action buttons on AI responses** | Interaction | Users need to act on AI-generated content. "Copy" is universal. "Replace" and "Insert" are Scribe-specific and already proven in inline mode. | Medium | Each AI response bubble includes conditional action buttons. Replace/Insert only shown when there is an active selection in the editor. Copy always available. | Reuse existing `handleReplace` / `handleInsert` logic from View.jsx. The LLM response is already Markdown; convert via `markdownToHtml()` for PasteHtml. Buttons: Copy (always), Replace (if selection), Insert After (if selection). |
| 6 | **Toggle between inline and panel** | Navigation | Users should choose their preferred interaction mode. The inline popover is better for quick actions; the panel is better for iterative work. | Low | A toggle button/icon in the floating button area or toolbar. State: `mode: 'inline' | 'panel'`. When panel is open, floating button still triggers inline flow; panel button opens panel. | Could be a split: floating button = inline (existing), toolbar/menu button = panel. Or: floating button opens whichever mode was last used. Simplest for v3.0: separate triggers. Keyboard: Ctrl+I = inline (existing), Ctrl+Shift+I = panel. |
| 7 | **Panel open/close toggle** | Layout | Users need to dismiss the panel to reclaim document space, and re-open it without losing context. | Low | Toggle state in View.jsx. Close button (X) in panel header. OO iframe resizes back to 100% on close. | Preserve chat history in state when panel closes (not unmount). Re-opening shows previous conversation. |
| 8 | **Loading state for AI responses** | UX | Users need feedback that the AI is processing. Chat without a loading indicator feels broken. | Low | Typing indicator or skeleton message while waiting. Reuse AbortController pattern from v2.1. | Show a pulsing "..." or skeleton bubble in the message list. Allow cancellation (X button or Escape). Reuse `classifyScribeError` for error display in chat. |
| 9 | **Conversational message format** | API | Chat requires multi-turn messages (not single-shot). The current `buildMessages` sends one user message. | Medium | Accumulate conversation history: `[{role:'user', content:'...'}, {role:'assistant', content:'...'}, ...]`. Send full history to `/ai/v1/chat/completions`. | The cozy-stack endpoint accepts the OpenAI format which supports multi-turn. System prompt goes first, then alternating user/assistant messages. Must manage token limits -- truncate early messages if conversation gets long. |
| 10 | **Error handling in chat** | Resilience | Errors should appear as messages in the chat flow, not break the UI. | Low | Reuse `classifyScribeError`. Render error as a special message type with retry button. | Error message in chat: "Something went wrong. [Retry]". Rate limit: "Too many requests. Try again in a moment." Auth error: "Session expired." Network: "Check your connection." |

---

## Differentiators

Features that add polish and set Scribe apart. Not required for a working v1 panel but significantly improve the experience.

| # | Feature | Category | Value Proposition | Complexity | Dependencies | Notes |
|---|---------|----------|-------------------|------------|--------------|-------|
| D1 | **Selection chip with preview** | Context UX | Show the selected text as a removable chip above the input, so users see what context the AI will use. CKEditor AI does this ("push selection into chat"). | Low-Medium | Selection data from plugin. Chip component (cozy-ui Chip or custom). | Truncate to ~50 chars with ellipsis. Click to expand/collapse. "X" to remove (chat without selection context). Visual: light background chip with document icon. |
| D2 | **Quick action chips** | Efficiency | Suggested actions below the input (Correct, Summarize, Translate) that auto-fill the prompt. Both Gemini and Copilot show contextual suggestions. | Low | Reuse `SCRIBE_ACTIONS` config. Render as horizontal scrollable chip row. | Click a chip = send that action as a prompt with the current selection. Chips change based on whether text is selected (with selection: Correct, Improve, Translate; without: Summarize document, Continue writing). |
| D3 | **Streaming responses** | Perceived speed | Token-by-token display makes AI feel faster. Copilot and Gemini both stream. The v2.1 FEATURES.md explicitly deferred this to v3.0. | Medium-High | Backend must support streaming (SSE or chunked response). `react-markdown` can render partial Markdown but needs buffering for incomplete syntax (`**bol` mid-stream). | Buffer tokens until a complete Markdown block is detected. Use `EventSource` or `fetch` with `ReadableStream`. Significantly improves perceived latency for long responses. Flag: investigate if cozy-stack AI endpoint supports streaming. |
| D4 | **Conversation persistence** | Continuity | Restore previous chat when re-opening the panel or returning to the document. Google just added this to Gemini in March 2026 -- it is now table stakes for premium products. | Medium | Store conversation in localStorage keyed by document ID, or in cozy-client (io.cozy.files metadata or separate doctype). | For v3.0 MVP: localStorage keyed by file ID. Later: persist via cozy-client for cross-device. Clear/new conversation button. |
| D5 | **Markdown rendering in AI responses** | Quality | AI responses in chat should render formatted (bold, lists, code blocks) not raw Markdown. Already built for inline mode (react-markdown). | Low | Reuse existing react-markdown + remark-gfm setup from ScribeResultPanel. | Direct reuse -- the same `<ReactMarkdown remarkPlugins={[remarkGfm]}>` component. Style with theme-aware overrides matching the panel background. |
| D6 | **Context indicator** | Transparency | Show users what context the AI is using: "Using selected text (142 words)" or "Using full document". Builds trust. | Low | Word count from selection or document. Small caption text below input. | Notion and Gemini both show source attribution. Simple implementation: `{selectionWordCount} words selected` or `No selection -- general assistant mode`. |
| D7 | **New conversation button** | Session management | Allow users to start fresh without closing and reopening the panel. Standard in all chat interfaces. | Low | Reset message array. Clear button in panel header next to close. | Icon: plus or refresh. Confirm if conversation has >2 messages (prevent accidental clear). |

---

## Anti-Features

Features to explicitly NOT build for v3.0. These are scope traps.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Rich text input in chat** | Adding formatting toolbar, markdown shortcuts, or WYSIWYG editing to the chat input is massive complexity for minimal value. Users type short prompts, not formatted documents. | Plain text textarea. Users can reference formatting in natural language ("make the heading bold"). |
| **File/URL/image attachment in chat input** | The PROJECT.md mentions "ajout de contexte (fichiers, URLs, images)" but this requires file picker integration, URL fetching, image processing, and multi-modal LLM support. Each is a separate feature. | Defer to v3.1+. For v3.0, context comes from: (a) selected text, (b) conversation history. Add a research flag for file attachment feasibility. |
| **Model/agent selection in chat** | PROJECT.md mentions "choix modele/agent" but this requires backend changes to expose available models, UI for model picker, and handling different model capabilities. | Defer to v3.1+. Use the default model via existing cozy-stack endpoint. Add model selection when backend supports it. |
| **Past conversation history browser** | PROJECT.md mentions "Historique des discussions passees avec reprise" but building a conversation list, search, delete, and resume UI is a full feature. | Defer to v3.1+. For v3.0: single conversation per document, persisted in localStorage. New conversation clears the old one. |
| **Resizable panel** | Drag-to-resize the panel width adds complexity (drag handles, min/max widths, persistence of width preference). | Fixed 30% width (matching existing AIAssistantPanel). Revisit if user feedback demands it. |
| **LLM-decided action buttons** | PROJECT.md mentions "boutons d'action conditionnels (replace/insert decides par le LLM)" -- having the LLM decide which buttons to show requires structured output parsing, prompt engineering, and fallback handling. | For v3.0: show Replace/Insert buttons on ALL responses when there is an active selection. The user decides which action to take. LLM-driven button logic is a v3.1+ refinement. |
| **Document-wide context (full doc as input)** | Sending the entire document to the LLM for every chat message is expensive (token cost), slow, and may exceed context limits. | For v3.0: context = selected text + conversation history. "Summarize document" action can use the existing cozy-viewer AIAssistantPanel pattern (fetch blob, extract text) but is a separate concern. |
| **Collaborative chat** | Multiple users seeing the same chat in real-time collaborative editing. Massive complexity, unclear value. | Single-user chat only. Each user has their own conversation state. |
| **Voice input** | Speech-to-text for chat input. Niche, browser support varies. | Text input only. Defer indefinitely. |

---

## Feature Dependencies

### Data Flow for Chat Panel

```
Plugin (ES5, OO iframe)                    React (Cozy Drive iframe)
========================                    ==========================

GetSelectedText (polling)
        |
        v
  castIntent("SHOW_SCRIBE_BUTTON",
    { text: selectedText })
        |                    postMessage
        +-------------------------------------->  useCozyBridge receives selection
                                                        |
                                                        v
                                                  Chat panel shows selection chip
                                                  User types prompt + sends
                                                        |
                                                        v
                                                  buildChatMessages():
                                                    system prompt +
                                                    conversation history +
                                                    [optional: selected text context] +
                                                    user message
                                                        |
                                                        v
                                                  callScribeAI(client, messages)
                                                        |
                                                        v
                                                  AI response appended to chat
                                                  Action buttons shown
                                                        |
                                                  User clicks [Replace] or [Insert]
                                                        |
                                                        v
                                                  markdownToHtml(response)
                                                  respond({ action: 'replace',
                                                    data: { html } })
                                                        |
        +<--------------------------------------+
        |                    postMessage
        v
  handleIntentResponse
  executeMethod("PasteHtml", [html])
```

### Feature Dependency Graph

```
Feature 1 (Panel container)  ----required by---->  All other features
Feature 2 (Message list)     ----required by---->  Feature 8 (Loading), Feature 10 (Errors)
Feature 3 (Text input)       ----required by---->  Feature 9 (Conversational format)
Feature 4 (Selection awareness) --required by--->  Feature 5 (Action buttons conditions)
Feature 5 (Action buttons)   ----depends on---->   Feature 4 (Selection) + existing replace/insert
Feature 6 (Toggle inline/panel) --independent-->   Can be built in parallel
Feature 7 (Open/close)       ----required by---->  Feature 1 (Panel container)
Feature 9 (Multi-turn)       ----required by---->  Meaningful chat experience
```

### Key Integration Points

1. **View.jsx** -- must orchestrate panel state alongside existing popover/floating button
2. **useCozyBridge** -- selection data already available, needs to be shared with panel
3. **scribeAI.js** -- `buildMessages` needs a multi-turn variant (`buildChatMessages`)
4. **scribeConversion.js** -- `markdownToHtml` reused as-is for action buttons
5. **Plugin code.js** -- no changes needed for v3.0 (selection polling + intent response already work)

---

## MVP Recommendation

### Phase 1: Panel Shell + Basic Chat (Features 1, 2, 3, 7, 8, 10)

Build the container and basic send/receive flow first. This validates the layout, iframe resizing, and chat rendering.

1. **Feature 1** -- Panel container (Paper, flex layout alongside OO editor div)
2. **Feature 7** -- Open/close toggle (button in existing UI, X in panel header)
3. **Feature 2** -- Message list (scrollable, user/AI message styling)
4. **Feature 3** -- Text input with send button
5. **Feature 8** -- Loading indicator while AI processes
6. **Feature 10** -- Error messages in chat flow

At this point: panel opens, user types, AI responds, user sees formatted response. No selection awareness, no action buttons, no multi-turn yet.

### Phase 2: Selection + Actions + Multi-turn (Features 4, 5, 9, D1, D5)

Wire up document context and make the chat actually useful for editing.

7. **Feature 4** -- Selection awareness (chip showing selected text)
8. **Feature 5** -- Action buttons on responses (Copy/Replace/Insert)
9. **Feature 9** -- Multi-turn conversation (accumulate history in API calls)
10. **D1** -- Selection chip with preview
11. **D5** -- Markdown rendering in responses (direct reuse)

### Phase 3: Polish + Toggle (Features 6, D2, D4, D6, D7)

12. **Feature 6** -- Toggle between inline and panel modes
13. **D2** -- Quick action chips
14. **D4** -- Conversation persistence (localStorage)
15. **D6** -- Context indicator
16. **D7** -- New conversation button

### Defer to v3.1+:

- **Streaming responses (D3)** -- needs backend investigation, buffering strategy
- **File/URL attachment** -- requires file picker, multi-modal support
- **Model/agent selection** -- requires backend API for model listing
- **Past conversation browser** -- requires persistence and list UI
- **LLM-decided action buttons** -- requires structured output parsing

---

## Sources

### Industry References (MEDIUM confidence -- WebSearch based, patterns verified across multiple products)
- [Google Workspace: Gemini side panel](https://support.google.com/a/users/answer/15146419?hl=en) -- panel layout, suggested prompts, insert/copy buttons
- [Gemini conversation history announcement (Feb 2026)](https://workspaceupdates.googleblog.com/2026/02/gemini-conversation-history-is-coming-to-side-panel-in-google-workspace.html) -- confirms history was NOT table stakes until 2026
- [Copilot Chat in Word practical guide](https://office-watch.com/2025/copilot-chat-microsoft-365-apps/) -- "Add to doc" button, follow-up suggestions, panel width issues
- [Microsoft Copilot Word chat](https://support.microsoft.com/en-us/office/chat-with-copilot-about-your-word-document-4482c688-a495-4571-bfcd-4a9fc6608090) -- selection-based "Chat with Copilot", image input, references
- [Computerworld: Gemini AI sidebar guide](https://www.computerworld.com/article/3845447/google-workspace-how-to-use-gemini-ai-side-panel.html) -- action buttons (Insert, Copy, Preview, Retry), sources link, thumbs up/down
- [CKEditor AI Quick Actions](https://docs.typo3.org/p/t3planet/rte-ckeditor-pack/main/en-us/CKEditorAI/AIQuickActions/Index.html) -- push selection into chat panel pattern
- [Capacities AI Assistant](https://docs.capacities.io/reference/ai-assistant) -- copy/replace/append action pattern in responses
- [Smashing Magazine: Design Patterns for AI Interfaces](https://www.smashingmagazine.com/2025/07/design-patterns-ai-interfaces/) -- side panel vs inline patterns
- [NN/g: Prompt Controls in GenAI Chatbots](https://www.nngroup.com/articles/prompt-controls-genai/) -- suggested prompt UX best practices

### Existing Codebase (HIGH confidence)
- `OnlyOfficeAIAssistantPanel.tsx` -- proves side panel layout works with 30% width
- `styles.styl` -- `.ai-assistant-panel { width: 30% }` existing pattern
- `View.jsx` -- flex container `u-flex u-flex-grow-1` already wraps editor + panel
- `scribeAI.js` -- `callScribeAI` and `buildMessages` ready for multi-turn extension
- `useCozyBridge.js` -- selection data already flows via `showScribeButton.text`

---
*Feature research for: v3.0 Scribe Chat Panel*
*Researched: 2026-03-10*
