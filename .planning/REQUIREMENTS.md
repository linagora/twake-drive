# Requirements: Scribe pour OnlyOffice

**Defined:** 2026-03-03
**Core Value:** La chaîne de communication complète — depuis la sélection de texte dans OnlyOffice jusqu'à la réinjection du texte modifié par l'IA — doit fonctionner de bout en bout, de manière transparente pour l'utilisateur.

## v2.0 Requirements

Requirements for milestone v2.0 Scribe Live AI. Each maps to roadmap phases.

### API Integration

- [x] **API-01**: User sees real AI-generated text when selecting a Scribe action (replaces mock)
- [x] **API-02**: Scribe sends correct prompt to LLM based on selected action and text via POST /ai/v1/chat/completions
- [x] **API-03**: Free-prompt action sends user's custom instruction to LLM with selected text

### Loading State

- [x] **LOAD-01**: User sees visual feedback (loading indicator) while AI processes request
- [x] **LOAD-02**: User can close the popover during loading (cancels the in-flight request)

### Error Handling

- [x] **ERR-01**: User sees clear error message when API call fails (network error, server error, timeout)
- [x] **ERR-02**: User can retry after a transient error (429 rate limit, 500 server error, network)
- [x] **ERR-03**: User sees appropriate non-retryable message for auth/config errors (401, 403)

### Internationalization

- [x] **I18N-01**: All Scribe UI strings use cozy-ui i18n system (no hardcoded French or English strings)
- [x] **I18N-02**: Translations provided for all cozy-ui supported locales
- [x] **I18N-03**: Action labels, button text, error messages, and tooltips are all translated

## Future Requirements

Deferred to v2.x or later. Tracked but not in current roadmap.

### Streaming UX

- **STREAM-01**: User sees AI response appear token-by-token (streaming)
- **STREAM-02**: User can cancel mid-stream and keep partial result
- **STREAM-03**: User can regenerate (re-call API with same params)

### UI Polish

- **POLISH-01**: Dark theme text visibility fix (white-on-white)
- **POLISH-02**: Floating button disabled when no text selected
- **POLISH-03**: Keyboard shortcut does not conflict with OO italic

### Context Menu

- **CTX-01**: Scribe actions available in OO right-click context menu

### Formatting

- **FMT-01**: Rich text formatting preserved during extract/transform/reinsert

## Out of Scope

| Feature | Reason |
|---------|--------|
| cozy-stack modifications | Route POST /ai/v1/chat/completions already exists |
| Client-side API keys | Security — all API calls go through cozy-stack proxy |
| Model selection UI | Model configured server-side in RAG server |
| Conversation memory | Architectural complexity, single-shot transforms only |
| Real-time grammar underlining | Performance prohibitive |
| Markdown rendering in preview | WYSIWYG mismatch with plain text insert |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| API-01 | Phase 7 | Complete |
| API-02 | Phase 7 | Complete |
| API-03 | Phase 7 | Complete |
| LOAD-01 | Phase 7 | Complete |
| LOAD-02 | Phase 7 | Complete |
| ERR-01 | Phase 8 | Complete |
| ERR-02 | Phase 8 | Complete |
| ERR-03 | Phase 8 | Complete |
| I18N-01 | Phase 9 | Complete |
| I18N-02 | Phase 9 | Complete |
| I18N-03 | Phase 9 | Complete |

**Coverage:**
- v2.0 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after roadmap creation*
