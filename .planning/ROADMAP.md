# Roadmap: Scribe pour OnlyOffice

## Milestones

- ✅ **v1.0 Scribe Interface Mock AI** -- Phases 1-6 (shipped 2026-03-03)
- ✅ **v2.0 Scribe Live AI** -- Phases 7-9 (shipped 2026-03-06)
- ✅ **v2.1 Formatage Riche** -- Phases 10-13 (shipped 2026-03-09)
- **v3.0 Scribe Chat Panel** -- Phases v3.0-01 to v3.0-04 (in progress)

## Phases

<details>
<summary>v1.0 Scribe Interface Mock AI (Phases 1-6) -- SHIPPED 2026-03-03</summary>

- [x] Phase 1: Plugin OnlyOffice POC (2/2 plans) -- completed 2026-02-28
- [x] Phase 2: Contextual Trigger and Communication Bridge (2/2 plans) -- completed 2026-02-28
- [x] Phase 3: Scribe Interface with Mock AI (2/2 plans) -- completed 2026-03-01
- [x] Phase 4: End-to-End Actions (covered by Phases 2-3) -- completed 2026-03-01
- [x] Phase 5: Bouton Scribe flottant ancre a la selection (2/2 plans) -- completed 2026-03-03
- [x] Phase 6: Affinement UI/UX (2/2 plans) -- completed 2026-03-03

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>v2.0 Scribe Live AI (Phases 7-9) -- SHIPPED 2026-03-06</summary>

- [x] Phase 7: Real AI Integration (2/2 plans) -- completed 2026-03-04
- [x] Phase 8: Error Handling (1/1 plan) -- completed 2026-03-05
- [x] Phase 9: Internationalization (2/2 plans) -- completed 2026-03-06

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>v2.1 Formatage Riche (Phases 10-13) -- SHIPPED 2026-03-09</summary>

- [x] Phase 10: Extraction Rich Text (2/2 plans) -- completed 2026-03-06
- [x] Phase 11: Pipeline de Conversion (2/2 plans) -- completed 2026-03-06
- [x] Phase 12: Preview Markdown (1/1 plan) -- completed 2026-03-07
- [x] Phase 13: Reinjection et Integrite Pipeline (1/1 plan) -- completed 2026-03-09

Full details: `.planning/milestones/v2.1-ROADMAP.md`

</details>

### v3.0 Scribe Chat Panel (In Progress)

**Milestone Goal:** Add a conversational chat side panel alongside the existing inline popover mode, letting the user have multi-turn AI conversations while working in OnlyOffice.

- [x] **Phase v3.0-01: ScribeContext + Panel Shell** - State provider and flex sibling panel that resizes OO iframe
- [x] **Phase v3.0-02: Chat Core** - Working conversational chat with AI, markdown rendering, and error handling
- [x] **Phase v3.0-03: Selection Context + Document Actions** - Selection chip in input, Copy/Replace/Insert on AI responses (completed 2026-03-18)
- [x] **Phase v3.0-04: Panel Resize** - Drag-resizable panel width (completed 2026-03-19)

## Phase Details

### Phase v3.0-01: ScribeContext + Panel Shell
**Goal**: User can open and close a side panel next to the OO editor, and the editor resizes correctly
**Depends on**: Nothing (first phase of v3.0; builds on shipped v2.1 codebase)
**Requirements**: PANEL-01, PANEL-02, PANEL-04
**Success Criteria** (what must be TRUE):
  1. User can open a panel to the right of the OO editor via a toggle button
  2. The OO editor iframe shrinks horizontally when the panel opens and expands back when it closes
  3. User can close the panel via a close button in the panel header
  4. User can open the panel from the inline Scribe popover via Ctrl+Shift+I
  5. User can open the panel from the editor via double Ctrl+Shift+I
  6. The existing inline Scribe popover continues to work exactly as before
**Plans**: 2 plans

Plans:
- [ ] v3.0-01-01-PLAN.md — ScribeContext provider + ScribePanel shell + View.jsx wiring
- [ ] v3.0-01-02-PLAN.md — FloatingZone 2-button stack + Ctrl+Shift+I double-tap + coexistence logic

### Phase v3.0-02: Chat Core
**Goal**: User can have a multi-turn conversation with the AI in the side panel
**Depends on**: Phase v3.0-01
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06
**Success Criteria** (what must be TRUE):
  1. User can type a message, press Enter or click Send, and see it appear in the conversation
  2. AI response appears below the user message, rendered with Markdown formatting (bold, lists, code blocks, tables)
  3. Conversation scrolls to show the latest message, and user can scroll up to see earlier messages
  4. Each new message includes full conversation history so the AI maintains context across turns
  5. While the AI is responding, user sees a loading indicator; errors appear as chat messages
**Plans**: 2 plans

Plans:
- [ ] v3.0-02-01-PLAN.md — Conversation state in ScribeContext + ChatMessageList + ChatInput + ScribePanel wiring
- [ ] v3.0-02-02-PLAN.md — Popover actions mirrored to shared conversation + end-to-end verification

### Phase v3.0-03: Selection Context + Document Actions
**Goal**: User can reference selected document text in chat and apply AI responses back to the document
**Depends on**: Phase v3.0-02
**Requirements**: SEL-01, SEL-02, ACT-01, ACT-02, ACT-03
**Success Criteria** (what must be TRUE):
  1. When text is selected in OO, a chip showing the selected text appears in the chat input area
  2. The selected text is automatically included as context when the user sends a message to the AI
  3. User can copy any AI response to the clipboard via a Copy button on the message
  4. When text is selected in OO, AI responses show Replace and Insert buttons that modify the document
**Plans**: 2 plans

Plans:
- [ ] v3.0-03-01-PLAN.md — Selection state in ScribeContext + SelectionChip + selection context in AI prompts
- [ ] v3.0-03-02-PLAN.md — MessageActions (Copy/Replace/Insert) on AI messages with respond protocol wiring

### Phase v3.0-04: Panel Resize
**Goal**: User can drag-resize the panel width
**Depends on**: Phase v3.0-01
**Requirements**: PANEL-03
**Success Criteria** (what must be TRUE):
  1. User can drag the left edge of the panel to make it wider or narrower
  2. The OO editor iframe adjusts its width in real time as the panel is resized
**Plans**: 1 plan

Plans:
- [ ] v3.0-04-01-PLAN.md — ResizeHandle component + dynamic panelWidth in ScribeContext + ScribePanel wiring

## Progress

**Execution Order:**
Phases execute in order: v3.0-01 -> v3.0-02 -> v3.0-03 -> v3.0-04

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Plugin OnlyOffice POC | v1.0 | 2/2 | Complete | 2026-02-28 |
| 2. Contextual Trigger and Communication Bridge | v1.0 | 2/2 | Complete | 2026-02-28 |
| 3. Scribe Interface with Mock AI | v1.0 | 2/2 | Complete | 2026-03-01 |
| 4. End-to-End Actions | v1.0 | 0/0 | Complete | 2026-03-01 |
| 5. Bouton Scribe flottant | v1.0 | 2/2 | Complete | 2026-03-03 |
| 6. Affinement UI/UX | v1.0 | 2/2 | Complete | 2026-03-03 |
| 7. Real AI Integration | v2.0 | 2/2 | Complete | 2026-03-04 |
| 8. Error Handling | v2.0 | 1/1 | Complete | 2026-03-05 |
| 9. Internationalization | v2.0 | 2/2 | Complete | 2026-03-06 |
| 10. Extraction Rich Text | v2.1 | 2/2 | Complete | 2026-03-06 |
| 11. Pipeline de Conversion | v2.1 | 2/2 | Complete | 2026-03-06 |
| 12. Preview Markdown | v2.1 | 1/1 | Complete | 2026-03-07 |
| 13. Reinjection et Integrite Pipeline | v2.1 | 1/1 | Complete | 2026-03-09 |
| v3.0-01. ScribeContext + Panel Shell | v3.0 | 2/2 | Complete | 2026-03-15 |
| v3.0-02. Chat Core | v3.0 | 2/2 | Complete | 2026-03-18 |
| v3.0-03. Selection Context + Document Actions | 1/2 | Complete    | 2026-03-18 | - |
| v3.0-04. Panel Resize | v3.0 | Complete    | 2026-03-19 | - |
