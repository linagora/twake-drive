# Requirements: Scribe v3.0 Chat Panel

**Defined:** 2026-03-11
**Core Value:** L'utilisateur peut interagir avec l'IA de maniere fluide -- actions rapides inline ou chat conversationnel dans un panneau lateral -- pour transformer et manipuler le contenu de son document OnlyOffice.

## v3.0 Requirements

Requirements for the Scribe Chat Panel milestone. Each maps to roadmap phases.

### Panel Layout

- [x] **PANEL-01**: User can open a side panel to the right of the OO editor
- [x] **PANEL-02**: OO editor iframe resizes when panel opens/closes
- [ ] **PANEL-03**: User can resize the panel width by dragging
- [x] **PANEL-04**: User can close the panel via a close button
- [x] **PANEL-05**: User can toggle between inline mode and panel mode

### Chat

- [x] **CHAT-01**: User can type a message and send it to the AI
- [x] **CHAT-02**: User sees AI responses rendered in Markdown
- [x] **CHAT-03**: Conversation history is displayed as a scrollable message list
- [x] **CHAT-04**: AI receives full conversation history (multi-turn)
- [x] **CHAT-05**: User sees a loading indicator while AI responds
- [x] **CHAT-06**: Errors appear as messages in the chat with retry option

### Selection Context

- [x] **SEL-01**: Selected text from OO is shown as a chip in the chat input area
- [x] **SEL-02**: Selected text is included as context in the AI prompt

### Actions

- [x] **ACT-01**: User can copy an AI response to clipboard
- [x] **ACT-02**: User can replace selected text with AI response
- [x] **ACT-03**: User can insert AI response after selected text

## Future Requirements

Deferred to v3.1+. Tracked but not in current roadmap.

### Streaming

- **STRM-01**: AI responses stream token by token
- **STRM-02**: User sees partial response while AI generates

### Persistence

- **PERS-01**: Conversations are saved and survive page reload
- **PERS-02**: User can browse past conversations
- **PERS-03**: User can resume a past conversation

### Context Attachments

- **CTX-01**: User can attach files as context
- **CTX-02**: User can attach URLs as context
- **CTX-03**: User can attach images as context

### Model Selection

- **MOD-01**: User can choose AI model/agent for the conversation

## Out of Scope

| Feature | Reason |
|---------|--------|
| Rich text input in chat | Users type short prompts, not formatted documents -- plain textarea sufficient |
| LLM-decided action buttons | Requires structured output parsing -- v3.0 shows buttons on all responses when selection active |
| Collaborative chat | Multiple users seeing same chat -- massive complexity, unclear value |
| Voice input | Niche, browser support varies |
| Document-wide context | Sending full doc expensive -- v3.0 uses selected text + conversation history |
| Plugin OO natif pour le panel | Moins de controle UI, pas de composants cozy-ui |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PANEL-01 | Phase v3.0-01 | Complete |
| PANEL-02 | Phase v3.0-01 | Complete |
| PANEL-03 | Phase v3.0-04 | Pending |
| PANEL-04 | Phase v3.0-01 | Complete |
| PANEL-05 | Phase v3.0-01 | Complete |
| CHAT-01 | Phase v3.0-02 | Complete |
| CHAT-02 | Phase v3.0-02 | Complete |
| CHAT-03 | Phase v3.0-02 | Complete |
| CHAT-04 | Phase v3.0-02 | Complete |
| CHAT-05 | Phase v3.0-02 | Complete |
| CHAT-06 | Phase v3.0-02 | Complete |
| SEL-01 | Phase v3.0-03 | Complete |
| SEL-02 | Phase v3.0-03 | Complete |
| ACT-01 | Phase v3.0-03 | Complete |
| ACT-02 | Phase v3.0-03 | Complete |
| ACT-03 | Phase v3.0-03 | Complete |

**Coverage:**
- v3.0 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after roadmap creation*
