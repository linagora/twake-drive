# Research Summary: v2.0 Scribe Live AI

**Synthesized:** 2026-03-03
**Scope correction:** Initial research (STACK.md, ARCHITECTURE.md) assumed cozy-stack modifications. **They are not needed.** The route `POST /ai/v1/chat/completions` already exists (OpenAI format). `cozy-client` provides `chatCompletion()`. This is a **frontend-only** milestone.

---

## Executive Summary

Scribe v2.0 replaces the mock AI with real LLM calls via the existing cozy-stack `/ai/v1/chat/completions` endpoint. The API follows the OpenAI chat completion format. `cozy-client` already provides a `chatCompletion()` function that handles auth and URL construction. For streaming, `stackClient.fetch()` gives access to the raw `ReadableStream`. No new backend code, no new npm packages, no API key management needed on the frontend.

The core work is: (1) replace `mockTransform()` with real API calls, (2) add streaming UX with progressive text display and cancel, (3) expand the ScribePopover state machine from 2 to 5 states, (4) fix dark theme and other carried-over bugs.

---

## Existing API Infrastructure (No Changes Needed)

| Component | Location | What It Does |
|-----------|----------|--------------|
| `POST /ai/v1/chat/completions` | cozy-stack (existing route) | OpenAI-compatible chat completion proxy to RAG server |
| `chatCompletion(client, messages, options)` | `cozy-client/models/ai.js` | Calls the route with auth. Options: `stream`, `model`, `temperature`, `max_tokens` |
| `stackClient.fetchJSON()` | `cozy-client` | Auth + URL construction (non-streaming) |
| `stackClient.fetch()` | `cozy-client` | Raw fetch with auth — needed for streaming (ReadableStream access) |
| `c.Stream()` in `web/ai/ai.go` | cozy-stack | Transparently proxies response body including SSE chunks |

### API Contract (OpenAI Format)

**Request:**
```json
{
  "messages": [
    {"role": "system", "content": "You are a writing assistant..."},
    {"role": "user", "content": "Rewrite this text:\n\nHello world"}
  ],
  "temperature": 0.3,
  "stream": true
}
```

**Non-streaming response:**
```json
{
  "choices": [{"message": {"content": "Transformed text", "role": "assistant"}}],
  "usage": {"prompt_tokens": 42, "completion_tokens": 15, "total_tokens": 57}
}
```

**Streaming response (SSE, OpenAI chunk format):**
```
data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}

data: {"choices":[{"delta":{"content":" world"},"index":0}]}

data: [DONE]
```

---

## Feature Landscape

### Table Stakes (must have)

| Feature | Complexity | Approach |
|---------|------------|----------|
| Real AI text transformation | MEDIUM | Replace `mockTransform()` with `chatCompletion()` |
| Loading state | LOW | Add `'loading'` step to state machine |
| Error feedback with retry | MEDIUM | Classify errors (429, 500, network), retry button |
| Dark theme fix | LOW | `theme.palette.text.primary` on all Scribe elements |
| Prompt template interpolation | LOW | Build OpenAI `messages` array from SCRIBE_ACTIONS |

### Differentiators (should have)

| Feature | Complexity | Approach |
|---------|------------|----------|
| Streaming response | HIGH | `stream: true` + ReadableStream + progressive display |
| Cancel mid-stream | MEDIUM | `AbortController.abort()`, keep partial result |
| Regenerate | LOW | Re-call with same params |
| Button disable on deselection | LOW | Track selection state |

### Defer

| Feature | Reason |
|---------|--------|
| Context menu integration | Independent, needs OO plugin API research |
| Rich text formatting | Complex serialization, defer to v3.0 |
| Conversation memory | Architectural change |

### Anti-Features

- Client-side API keys (security)
- Model selection UI (unnecessary complexity)
- Markdown rendering in preview (WYSIWYG mismatch with plain text insert)
- Real-time grammar underlining (performance prohibitive)

---

## Architecture

### Data Flow

```
ScribePopover → buildMessages(actionId, selectedText)
  |
  | stackClient.fetch('POST', '/ai/v1/chat/completions', { messages, stream: true })
  |
  v
cozy-stack (EXISTING — transparent proxy via c.Stream())
  |
  v
RAG Server (EXISTING — returns OpenAI-format response)
  |
  v
Browser receives response
  |
  | Non-streaming: response.json() → choices[0].message.content
  | Streaming: response.body.getReader() → parse SSE → accumulate text
  |
  v
ScribeResultPanel displays result
```

### State Machine (Expanded from 2 to 5 states)

| State | Trigger | UI | User Actions |
|-------|---------|-----|-------------|
| `menu` | Popover opens | Action menu + prompt input | Select action, close |
| `loading` | Action selected | Spinner/skeleton | Close (cancels) |
| `streaming` | First token arrives | Progressive text + Stop button | Stop, Close |
| `result` | Stream completes / Stop | Final text + Insert/Replace/Regenerate/Close | All |
| `error` | API error | Error message + Try Again/Close | Retry, Close |

### Files to Create/Modify

**New:**
- `Scribe/scribeApi.js` — streaming fetch wrapper, SSE parser for OpenAI format
- `Scribe/useScribeStream.js` — React hook: startStream, cancelStream, streamText, isStreaming, error

**Modified:**
- `ScribePopover.jsx` — 5-state machine, AbortController, wire streaming hook
- `ScribeResultPanel.jsx` — progressive text, Stop/Regenerate, error display, dark theme
- `ScribeFloatingButton.jsx` — dark theme fix, disable when no selection
- `scribeActions.js` — build OpenAI `messages` array from action config

**Removed:**
- `mockTransform.js` — replaced by real API

---

## Key Pitfalls (Frontend-Only)

### Critical

1. **Streaming state race conditions** — Concurrent streams write to same state. Fix: AbortController per request, request ID correlation, cleanup on unmount.

2. **SSE buffering through reverse proxy** — nginx may buffer `application/json` responses. The cozy-stack route uses this content type. If streaming arrives in batches, fall back to non-streaming, investigate proxy config separately.

3. **Auth for streaming fetch** — `chatCompletion()` uses `fetchJSON()` which returns parsed JSON, not ReadableStream. For streaming, use `stackClient.fetch()` with raw body access.

### Moderate

4. **Token render frequency** — 50+ setState/s causes jank. Fix: ref accumulator, 50ms flush timer.
5. **Dark theme white-on-white** — Hardcoded `background: 'white'` in ScribeFloatingButton. Use theme tokens.
6. **Ctrl+I conflicts with Italic** — Standard editor shortcut. Consider alternate binding.

### Low

7. **CSP connect-src** — API is same-origin via cozy-stack. Should work. Verify in staging.
8. **Streaming support unknown** — Does the RAG server support `stream: true`? Test early. Non-streaming works as fallback.

---

## Implementation Strategy

**Phase 1: Non-streaming API integration + error handling**
- Replace mockTransform with chatCompletion() call (non-streaming)
- Add loading + error states to state machine
- Proves end-to-end chain works before adding streaming complexity

**Phase 2: Streaming UX + cancellation**
- Add stream: true, ReadableStream consumption, SSE parsing
- Progressive text display, Stop button, Regenerate
- Token batching for smooth rendering

**Phase 3: Bug fixes + polish**
- Dark theme fix (all Scribe components)
- Button disable on deselection
- Keyboard shortcut fix

---

## Open Questions

1. **Does the RAG server support `stream: true`?** — Must test. If not, ship non-streaming first.
2. **System prompt language** — French? English? Match user's locale?
3. **Token/cost limits** — Server-side concern (RAG server config), not frontend.

---

## Zero New Dependencies

| Need | Solution | Already Available |
|------|----------|-------------------|
| API calls | `cozy-client/models/ai.chatCompletion()` | Yes |
| Auth headers | `stackClient.fetch()` | Yes |
| SSE parsing | Manual line parsing (~30 LOC) | Native Web API |
| Stream cancellation | `AbortController` | Native Web API |
| Streaming state | `useState` + `useRef` | React 18 |

---
*Summary for: v2.0 Scribe Live AI*
*Corrected: 2026-03-03 — frontend-only scope, existing API, no stack changes*
