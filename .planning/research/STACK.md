# Technology Stack: v2.0 Scribe Live AI

**Project:** Scribe pour OnlyOffice -- Anthropic Claude API integration with streaming
**Researched:** 2026-03-03
**Scope:** NEW stack additions only. Existing v1.0 stack (React 18, MUI, cozy-ui, OO plugin, postMessage protocol) is validated and not re-researched.

## Recommended Stack Additions

### Backend: Anthropic Go SDK (cozy-stack)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `github.com/anthropics/anthropic-sdk-go` | v1.26.0 | Official Anthropic Go client for Claude Messages API | Official SDK from Anthropic. Type-safe, streaming support via iterator pattern, built-in retries (2x), context-based cancellation. Requires Go 1.22+ (cozy-stack uses Go 1.24). HIGH confidence. |
| Claude Haiku 4.5 (primary model) | `claude-haiku-4-5-20250929` | Text transformations (rewrite, translate, correct, expand) | Best cost/speed ratio for Scribe use cases. $1/$5 per M input/output tokens. 4-5x faster than Sonnet. Scribe tasks are simple text transforms, not complex reasoning. Configurable per-instance to allow upgrading to Sonnet if quality insufficient. |
| Claude Sonnet 4.5 (fallback/premium) | `claude-sonnet-4-5-20250929` | Higher-quality free-prompt and complex rewrites | $3/$15 per M tokens. Use as configurable upgrade when Haiku quality is insufficient. Do NOT default to Sonnet -- cost is 3x Haiku for marginal improvement on simple edits. |

**Model choice rationale:** Scribe actions are bounded text transforms (grammar correction, tone changes, translation, bullet points). These are not open-ended creative tasks. Haiku 4.5 delivers performance comparable to Sonnet 4 at 1/3 the cost and 4-5x speed. Start with Haiku, make model configurable.

### Backend: SSE Streaming Route (cozy-stack)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Echo v4 SSE via `http.Flusher` | v4.15.1 (existing) | Stream Claude responses as SSE to frontend | Cozy-stack already uses Echo. Echo's `Response` implements `http.Flusher`. Existing pattern confirmed in `web/apps/apps.go` and `web/instances/checks.go`. Do NOT use the realtime WebSocket system -- it is designed for CouchDB document events, not request-scoped AI streams. |
| `text/event-stream` content type | HTTP standard | SSE wire format | Standard SSE format. Frontend consumes via `fetch()` + `ReadableStream`, not `EventSource` (because we need POST, not GET). |

**Why NOT use the existing RAG/realtime pattern:**
The existing `model/rag/chat.go` pattern uses:
1. Job queue (`rag-query` worker) to process chat asynchronously
2. CouchDB to persist conversation state
3. Realtime WebSocket hub (`publishDelta`) to stream tokens to frontend

This is over-engineered for Scribe:
- Scribe has no conversation history (single-shot transforms)
- Scribe needs no persistence (text in, text out)
- Scribe needs synchronous request-response, not async job processing
- The job queue adds latency and complexity

**Instead, use a direct SSE proxy pattern:**
1. Frontend POSTs to `/ai/scribe` with action + selected text
2. cozy-stack creates Anthropic streaming request with `context.Context`
3. cozy-stack proxies SSE events directly to the HTTP response
4. Frontend reads stream via `fetch()` + `ReadableStream` reader
5. Cancellation: frontend aborts fetch -> Go context cancelled -> Anthropic stream closed

### Frontend: Streaming State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `fetch()` + `ReadableStream` | Web API (native) | Consume SSE stream from `/ai/scribe` | Cannot use `EventSource` because it only supports GET. Scribe needs POST with body (selected text, action, prompt). `fetch()` with `ReadableStream` reader is the standard pattern for POST-based SSE. No library needed. |
| `AbortController` | Web API (native) | Cancel mid-stream requests | Native browser API. Create per-request, pass `signal` to `fetch()`. Call `.abort()` on cancel button click. Propagates to Go `context.Done()` channel. |
| `useRef` for AbortController | React 18 (existing) | Store AbortController reference across renders | Standard React pattern. `abortControllerRef.current = new AbortController()` on each request. Cleanup in `useEffect` return. |
| `useState` for streaming state | React 18 (existing) | Progressive text accumulation | `const [streamedText, setStreamedText] = useState('')`. Append each delta: `setStreamedText(prev => prev + delta)`. No external state library needed for this simple case. |

**Why NOT use cozy-realtime (WebSocket):**
- `cozy-realtime` (v5.8.0) manages WebSocket subscriptions to CouchDB document changes
- It subscribes to doctypes (e.g., `io.cozy.files`) and receives `created`/`updated`/`deleted` events
- Scribe streaming is request-scoped (one request, one stream, one response), not document-change-driven
- Using realtime would require: create a CouchDB doc, push a job, subscribe to events, correlate events to the request, clean up subscription -- all unnecessary complexity
- Direct SSE via fetch is simpler, faster, and maps naturally to the request/response lifecycle

### Frontend: Stream UI Components

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `ScribeResultPanel` (existing) | - | Display streamed text progressively | Already exists. Currently receives `resultText` as a static string. Change to receive `streamedText` that grows as tokens arrive. Minimal modification needed. |
| CSS `white-space: pre-wrap` | CSS (existing) | Preserve line breaks in streamed text | Already in `scribe.styl`. Ensures multi-line responses display correctly during and after streaming. |
| Loading/typing indicator | cozy-ui `Spinner` or custom | Show streaming-in-progress state | Use a simple blinking cursor or "..." at the end of streamed text while `isStreaming` is true. Keep it minimal -- the text appearing progressively IS the indicator. |

## Integration Points with Existing cozy-stack

### New Route: `/ai/scribe` (POST)

```
POST /data/ai/scribe
Content-Type: application/json
Accept: text/event-stream

{
  "action": "correct-grammar",
  "text": "selected text here",
  "prompt": "optional custom prompt for free-prompt",
  "model": "claude-haiku-4-5-20250929"  // optional override
}
```

**Response (SSE):**
```
event: delta
data: {"text": "Correc"}

event: delta
data: {"text": "ted text "}

event: delta
data: {"text": "here."}

event: done
data: {"usage": {"input_tokens": 42, "output_tokens": 15}}

event: error
data: {"message": "rate limit exceeded", "code": "rate_limit"}
```

### Configuration: Extend RAGServer or Separate Config

**Recommendation: Separate `anthropic` config block in cozy.yaml**, not reuse `rag` config.

```yaml
# cozy.yaml
anthropic:
  default:
    api_key: "sk-ant-..."
    model: "claude-haiku-4-5-20250929"
    max_tokens: 4096
```

**Why separate from RAG:**
- RAG config points to an internal RAGondin server (different API, different auth)
- Anthropic API has its own endpoint (api.anthropic.com), its own auth (x-api-key header)
- The SDK handles the base URL, retries, and authentication natively
- Mixing them in the same config creates confusion

### Permission Model

Use existing `io.cozy.ai.chat.conversations` permission type (already defined in consts) OR create a new `io.cozy.ai.scribe` doctype. The existing pattern in `web/ai/ai.go` checks:
```go
middlewares.AllowWholeType(c, permission.POST, consts.ChatConversations)
```

For Scribe, either reuse this permission or add a `Scribe` constant to `consts/doctype.go`.

### System Prompt Architecture

System prompts live in `scribeActions.js` (already defined as `prompt` field per action). The frontend sends the `action` id, and cozy-stack maps it to a system prompt. Two approaches:

**Option A (recommended): Frontend sends action + text, backend has prompt templates.**
- System prompts stored in cozy-stack as Go constants or config
- Frontend sends: `{"action": "correct-grammar", "text": "..."}`
- Backend builds the full Messages API request with system prompt + user message
- **Advantage:** Prompts are not exposed to the client, can be updated without frontend deploy

**Option B: Frontend sends full prompt.**
- Frontend builds the prompt from `scribeActions.js` and sends the complete user message
- Backend is a dumb proxy
- **Advantage:** Simpler backend, but prompts are visible in network tab and tied to frontend releases

**Choose Option A** because it keeps prompt engineering server-side and allows A/B testing or improvement without redeployment.

## What NOT to Add

| Avoid | Why | What to Do Instead |
|-------|-----|---------------------|
| Conversation persistence (CouchDB) | Scribe is single-shot, not a chatbot. No conversation history needed. | Stateless request/response. Each Scribe action is independent. |
| Job queue (`rag-query` worker pattern) | Adds latency. Scribe needs synchronous streaming, not async background processing. | Direct SSE proxy in the HTTP handler. |
| `cozy-realtime` WebSocket for streaming | Designed for CouchDB document change events, not request-scoped AI streams. Over-engineering. | `fetch()` + `ReadableStream` consuming direct SSE from `/ai/scribe`. |
| `EventSource` on frontend | Only supports GET requests. Scribe needs POST (sends text + action in body). | `fetch()` with `ReadableStream` reader. |
| Third-party SSE library (e.g., `sse.js`, `eventsource-polyfill`) | Unnecessary. Native `fetch()` + `TextDecoder` + `ReadableStream` is sufficient and well-supported. | Native Web APIs. |
| OpenAI-compatible proxy format | Existing `OpenAICompletion` route proxies to RAGondin which speaks OpenAI format. Anthropic has its own format. The SDK handles it. | Use Anthropic SDK directly. Its SSE format is different from OpenAI's. |
| Community Go Anthropic libraries (`liushuangls/go-anthropic`, `unfunco/anthropic-sdk-go`) | Unofficial. The official `anthropics/anthropic-sdk-go` exists since 2024 and is actively maintained. | Use official SDK only. |
| Rate limit handling library | Anthropic SDK has built-in retry with exponential backoff for 429s. | Configure `option.WithMaxRetries(2)` (default). Surface rate limit errors to frontend as `event: error`. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Go Anthropic client | `anthropics/anthropic-sdk-go` (official) | `liushuangls/go-anthropic` (community) | Official SDK has better type safety, streaming support, is maintained by Anthropic. Community libs may lag API changes. |
| Streaming transport | Direct SSE proxy (POST -> SSE response) | Realtime WebSocket (existing `cozy-realtime` pattern) | WebSocket is for persistent subscriptions to document changes. Scribe is request/response. SSE is simpler, maps to the lifecycle naturally. |
| Model | Haiku 4.5 (default) | Sonnet 4.5 (premium) | Haiku is 3x cheaper, 4-5x faster. Text transforms don't need Sonnet's reasoning depth. Make model configurable, default to Haiku. |
| Frontend SSE consumption | `fetch()` + `ReadableStream` | `EventSource` API | `EventSource` is GET-only. Scribe needs POST with body. |
| Frontend SSE consumption | `fetch()` + `ReadableStream` | `@microsoft/fetch-event-source` library | Adds a dependency for what is ~30 lines of code. The parsing is trivial for our simple event format. |
| State management for streaming | `useState` + `useRef` | Redux/Zustand/Jotai | Massive over-engineering. Streaming state is local to `ScribePopover`. One component, one piece of state (`streamedText`). |
| Backend prompt location | Server-side prompt templates | Client-side prompts (current `scribeActions.js`) | Server-side allows prompt iteration without frontend redeploy. Keeps prompts out of network inspector. |
| Configuration | Separate `anthropic` config block | Reuse `rag` config block | Different API, different auth, different endpoint. Mixing creates confusion. |

## Installation

### cozy-stack (Go backend)

```bash
cd ~/Dev-local/cozy-stack

# Add official Anthropic Go SDK
go get -u 'github.com/anthropics/anthropic-sdk-go@v1.26.0'
```

**Files to create/modify:**
- `model/ai/scribe.go` -- Anthropic client, system prompts, streaming logic
- `web/ai/ai.go` -- Add `POST /ai/scribe` route with SSE handler
- `pkg/config/config/config.go` -- Add `Anthropic` config struct and `makeAnthropicConfig`
- `model/instance/instance.go` -- Add `AnthropicConfig()` method (mirrors `RAGServer()`)
- `pkg/consts/doctype.go` -- Add `ScribeEvents` doctype if needed for permissions

### cozy-drive (React frontend)

```bash
# No new npm packages needed.
# All required capabilities exist in:
# - Native Web APIs: fetch, ReadableStream, AbortController, TextDecoder
# - React 18: useState, useRef, useCallback, useEffect
# - cozy-client 60.20.0: HTTP client for cozy-stack API calls
```

**Files to create/modify:**
- `src/modules/views/OnlyOffice/Scribe/useScribeStream.js` -- Custom hook: fetch + SSE parsing + AbortController
- `src/modules/views/OnlyOffice/Scribe/scribeApi.js` -- Replace `mockTransform.js` with API call via `useScribeStream`
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` -- Wire streaming state (`isStreaming`, `streamedText`, `cancel`)
- `src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx` -- Accept streaming text, show progress indicator

## Key Implementation Patterns

### Go: SSE Proxy Handler Pattern

```go
// web/ai/ai.go - Scribe SSE streaming handler
func ScribeTransform(c echo.Context) error {
    // 1. Parse request
    var req ScribeRequest
    if err := c.Bind(&req); err != nil {
        return err
    }

    // 2. Build Anthropic messages
    inst := middlewares.GetInstance(c)
    cfg := inst.AnthropicConfig()
    client := anthropic.NewClient(option.WithAPIKey(cfg.APIKey))

    // 3. Create streaming request with request context
    //    (cancelled when client disconnects)
    ctx := c.Request().Context()
    stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
        Model:     anthropic.Model(cfg.Model),
        MaxTokens: int64(cfg.MaxTokens),
        System:    []anthropic.TextBlockParam{{Text: systemPromptFor(req.Action)}},
        Messages:  []anthropic.MessageParam{
            anthropic.NewUserMessage(anthropic.NewTextBlock(req.Text)),
        },
    })

    // 4. Set SSE headers
    w := c.Response()
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")
    w.WriteHeader(http.StatusOK)

    // 5. Stream deltas
    for stream.Next() {
        event := stream.Current()
        switch v := event.AsAny().(type) {
        case anthropic.ContentBlockDeltaEvent:
            switch d := v.Delta.AsAny().(type) {
            case anthropic.TextDelta:
                fmt.Fprintf(w, "event: delta\ndata: %s\n\n",
                    jsonMarshal(map[string]string{"text": d.Text}))
                if f, ok := w.(http.Flusher); ok {
                    f.Flush()
                }
            }
        }
    }

    if err := stream.Err(); err != nil {
        fmt.Fprintf(w, "event: error\ndata: %s\n\n",
            jsonMarshal(map[string]string{"message": err.Error()}))
        if f, ok := w.(http.Flusher); ok {
            f.Flush()
        }
        return nil // error already sent via SSE
    }

    // 6. Send done event
    fmt.Fprintf(w, "event: done\ndata: {}\n\n")
    if f, ok := w.(http.Flusher); ok {
        f.Flush()
    }
    return nil
}
```

### JavaScript: useScribeStream Hook Pattern

```javascript
// useScribeStream.js
import { useState, useRef, useCallback } from 'react'

export function useScribeStream() {
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const startStream = useCallback(async (action, text, extra) => {
    // Cancel any existing stream
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setStreamedText('')
    setIsStreaming(true)
    setError(null)

    try {
      const res = await fetch('/data/ai/scribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({ action, text, ...extra }),
        signal: abortRef.current.signal
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            if (data.text) {
              setStreamedText(prev => prev + data.text)
            }
          }
          // event: error is handled by checking the event line
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message)
      }
    } finally {
      setIsStreaming(false)
    }
  }, [])

  const cancelStream = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }, [])

  return { streamedText, isStreaming, error, startStream, cancelStream }
}
```

### Cancellation Flow

```
User clicks Cancel → cancelStream() → AbortController.abort()
  → fetch signal aborted → ReadableStream closed
  → Server: c.Request().Context().Done() fires
  → Go: stream.Next() returns false (context cancelled)
  → Anthropic SDK: HTTP connection to api.anthropic.com closed
  → No more tokens billed after cancellation
```

## Version Compatibility

| Component | Required | Current | Notes |
|-----------|----------|---------|-------|
| Go | >= 1.22 | 1.24.0 | cozy-stack go.mod. Meets anthropic-sdk-go requirement. |
| anthropic-sdk-go | v1.26.0 | (new) | Latest stable. Published 2026-02-19. |
| Echo | v4 | v4.15.1 | Existing. Supports `http.Flusher` for SSE. |
| React | >= 18 | 18.2.0 | Existing. Hooks for streaming state. |
| cozy-client | any | 60.20.0 | Existing. Used for auth token in fetch headers. |
| Browser (fetch ReadableStream) | Chrome 43+, FF 65+, Safari 10.1+ | Modern | All Cozy-supported browsers handle this. |

## Pricing Estimates

| Model | Input Cost | Output Cost | Typical Scribe Request | Estimated Cost/Request |
|-------|------------|-------------|----------------------|----------------------|
| Haiku 4.5 | $1/M tokens | $5/M tokens | ~200 input + ~300 output tokens | ~$0.0017 |
| Sonnet 4.5 | $3/M tokens | $15/M tokens | ~200 input + ~300 output tokens | ~$0.0051 |

At 1000 Scribe uses/day with Haiku: ~$1.70/day, ~$51/month.
At 1000 Scribe uses/day with Sonnet: ~$5.10/day, ~$153/month.

## Sources

- [Anthropic Go SDK (official)](https://github.com/anthropics/anthropic-sdk-go) -- v1.26.0, streaming examples, error handling (HIGH confidence)
- [Anthropic Go SDK documentation](https://platform.claude.com/docs/en/api/sdks/go) -- Official installation, usage, streaming, error patterns (HIGH confidence)
- [Anthropic Messages Streaming API](https://platform.claude.com/docs/en/api/messages-streaming) -- SSE event types, wire format, event flow (HIGH confidence)
- [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) -- Token costs per model (HIGH confidence)
- [Echo v4 SSE cookbook](https://echo.labstack.com/docs/cookbook/sse) -- SSE handler pattern with Flush (MEDIUM confidence -- page content not fully loaded)
- [Existing cozy-stack SSE patterns](file:///home/ben/Dev-local/cozy-stack/web/apps/apps.go) -- `http.Flusher` usage confirmed in codebase (HIGH confidence)
- [Existing cozy-stack RAG/chat streaming](file:///home/ben/Dev-local/cozy-stack/model/rag/chat.go) -- `foreachSSE`, `publishDelta`, realtime pattern (HIGH confidence -- read directly)
- [Existing cozy-stack AI routes](file:///home/ben/Dev-local/cozy-stack/web/ai/ai.go) -- Route structure, permission model (HIGH confidence -- read directly)
- [cozy-stack config for RAG](file:///home/ben/Dev-local/cozy-stack/pkg/config/config/config.go) -- RAGServer config pattern to mirror for Anthropic (HIGH confidence -- read directly)
- [SSE with POST (not EventSource)](https://solovyov.net/blog/2023/eventsource-post/) -- Why fetch+ReadableStream instead of EventSource for POST-based SSE (MEDIUM confidence)

---
*Stack research for: v2.0 Scribe Live AI -- Anthropic Claude integration with streaming*
*Researched: 2026-03-03*
