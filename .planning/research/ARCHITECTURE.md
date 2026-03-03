# Architecture: Anthropic Claude Integration into Cozy-Stack + Cozy-Drive

**Domain:** LLM API proxy integration + SSE streaming for writing assistant
**Researched:** 2026-03-03
**Confidence:** HIGH (existing code analyzed directly, Anthropic API docs verified, cozy-stack RAG patterns well-understood)

## Executive Summary

The integration follows a **proxy pattern** where cozy-stack acts as an intermediary between the cozy-drive frontend and the Anthropic Claude API. The existing `/ai` route group and `rag` model package already implement a nearly identical pattern for the RAGondin chatbot. Scribe v2.0 reuses this architecture with one critical difference: Scribe uses **direct SSE streaming** from cozy-stack to the browser (no realtime/WebSocket intermediary), because Scribe is a stateless text transformation -- not a persistent conversation.

## Existing Architecture (What We Have)

### Current RAG Chat Flow (reference pattern)

```
Browser (cozy-search)
  |
  | POST /ai/chat/conversations/:id  {q: "question"}
  v
cozy-stack (web/ai/ai.go)
  |
  | 1. Save user message to CouchDB
  | 2. Push "rag-query" job to worker queue
  v
Job Worker (model/rag/chat.go)
  |
  | POST /v1/chat/completions  (to RAG server)
  | Stream: SSE from RAG -> parse -> realtime events
  v
RAG Server (external)
  |
  | SSE stream: data: {"choices": [{"delta": {"content": "token"}}]}
  v
cozy-stack Realtime Hub
  |
  | WebSocket: io.cozy.ai.chat.events {object: "delta", content: "token", position: N}
  v
Browser (cozy-realtime plugin subscribes, updates UI)
```

**Key observation:** The RAG chat uses a **2-hop streaming architecture**:
1. RAG server -> cozy-stack (SSE, parsed by `foreachSSE` in `chat.go`)
2. cozy-stack -> browser (realtime WebSocket via `publishDelta`)

This 2-hop pattern exists because RAG chat is **persistent** (stored in CouchDB) and **async** (job worker). Scribe does NOT need either.

### Current cozy-stack AI Components

| File | Purpose | Modify? |
|------|---------|---------|
| `web/ai/ai.go` | Route handlers: Chat, OpenAICompletion, ExecuteTool | **YES -- add ScribeCompletion** |
| `model/rag/chat.go` | RAG chat logic, SSE parsing, realtime publishing | **NO -- reference only** |
| `model/rag/index.go` | Document indexing for RAG | NO |
| `pkg/config/config/config.go` | RAGServer struct (URL + APIKey) | **YES -- add AnthropicServer** |
| `model/instance/instance.go` | `RAGServer()` method | **YES -- add AnthropicServer() method** |

### Current Frontend Components

| File | Purpose | Modify? |
|------|---------|---------|
| `ScribePopover.jsx` | Two-step state machine (menu -> result) | **YES -- add streaming state** |
| `ScribeResultPanel.jsx` | Displays transformed text | **YES -- progressive text display** |
| `ScribeActionMenu.jsx` | Action selection UI | NO |
| `scribeActions.js` | Declarative action config (prompts, mockResults) | **Minor -- may remove mockResult** |
| `mockTransform.js` | Mock transformation logic | **REPLACE with API call** |
| `useCozyBridge.js` | PostMessage bridge for plugin comms | NO |

## Recommended Architecture (What To Build)

### Design Decision: Direct SSE vs Realtime WebSocket

**Use direct SSE streaming** (cozy-stack -> browser), NOT the realtime WebSocket pattern.

Rationale:
- Scribe is **stateless**: no conversation history, no CouchDB persistence needed
- Scribe is **synchronous**: user waits for result, no background jobs
- SSE is simpler: one HTTP request/response, no WebSocket subscription setup
- The existing `OpenAICompletion` handler already does direct streaming (`c.Stream()`)
- Anthropic's API returns SSE natively -- cozy-stack just proxies it through

The realtime pattern adds unnecessary complexity (CouchDB write, job queue, WebSocket subscription, event routing) for a simple text-in/text-out transformation.

### End-to-End Data Flow

```
                           SCRIBE v2.0 DATA FLOW
                           ======================

Browser (cozy-drive)
  |
  | 1. User selects text, picks Scribe action
  | 2. ScribePopover calls scribeTransform(actionId, selectedText)
  |
  | POST /ai/scribe/completions
  | Headers: Authorization (cozy-stack session token)
  | Body: {
  |   "system": "You are a writing assistant...",
  |   "prompt": "Rewrite in a professional tone:\n\nHello world",
  |   "max_tokens": 4096,
  |   "stream": true
  | }
  |
  v
cozy-stack (web/ai/ai.go -- NEW: ScribeCompletion handler)
  |
  | 1. Permission check (POST io.cozy.ai.scribe)
  | 2. Read request body
  | 3. Build Anthropic Messages API payload:
  |    {
  |      "model": "claude-sonnet-4-5-20250514",
  |      "max_tokens": 4096,
  |      "system": "You are a writing assistant...",
  |      "messages": [{"role": "user", "content": "Rewrite..."}],
  |      "stream": true
  |    }
  | 4. POST to https://api.anthropic.com/v1/messages
  |    with x-api-key from config
  |
  v
Anthropic API (api.anthropic.com)
  |
  | SSE stream:
  |   event: message_start
  |   data: {"type":"message_start","message":{...}}
  |
  |   event: content_block_start
  |   data: {"type":"content_block_start","index":0,...}
  |
  |   event: content_block_delta
  |   data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}
  |   ...more deltas...
  |
  |   event: message_stop
  |   data: {"type":"message_stop"}
  |
  v
cozy-stack (proxy -- transparent pass-through OR simplified relay)
  |
  | Option A: Transparent proxy (stream Anthropic SSE directly to browser)
  |   - Simplest: c.Stream(res.StatusCode, "text/event-stream", res.Body)
  |   - Frontend parses Anthropic's native SSE format
  |
  | Option B: Simplified relay (parse + re-emit simpler events)       <-- RECOMMENDED
  |   - cozy-stack parses Anthropic SSE, re-emits simplified events:
  |     data: {"type":"delta","text":"Hello"}
  |     data: {"type":"done"}
  |     data: {"type":"error","message":"..."}
  |   - Decouples frontend from Anthropic's format
  |   - Allows switching LLM provider without frontend changes
  |
  v
Browser (EventSource or fetch + ReadableStream)
  |
  | Frontend reads SSE events, appends text to ScribeResultPanel
  | progressively
  |
  v
ScribeResultPanel renders tokens as they arrive
```

### Why Option B (Simplified Relay)

1. **Provider independence**: If Scribe later uses a different LLM (OpenAI, Mistral, local model), only cozy-stack changes. Frontend stays the same.
2. **Error normalization**: Anthropic errors (`overloaded_error`, rate limits) get translated to a consistent format.
3. **Security**: Anthropic-specific response metadata (usage tokens, model IDs) stays server-side. Only text content reaches the browser.
4. **Precedent**: The existing RAG proxy already does this (parses OpenAI-format SSE, re-emits simplified `delta`/`done`/`error` events via realtime).

The simplified relay format:

```
# Success stream
data: {"type":"start"}

data: {"type":"delta","text":"Hello"}

data: {"type":"delta","text":" world"}

data: {"type":"done"}


# Error
data: {"type":"error","message":"Rate limit exceeded","code":"rate_limit"}
```

## Component Architecture

### New Components

#### 1. cozy-stack: `web/ai/ai.go` -- ScribeCompletion handler

```go
// ScribeCompletion proxies writing assistant requests to Anthropic Claude.
// It handles SSE streaming, translating Anthropic's event format to a
// simplified delta/done/error format for the frontend.
func ScribeCompletion(c echo.Context) error {
    // 1. Permission check
    if err := middlewares.AllowWholeType(c, permission.POST, consts.AIScribe); err != nil {
        return middlewares.ErrForbidden
    }

    // 2. Parse request
    var payload ScribePayload
    if err := c.Bind(&payload); err != nil {
        return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
    }

    // 3. Get Anthropic config
    inst := middlewares.GetInstance(c)
    anthropic := inst.AnthropicServer()
    if anthropic.URL == "" {
        return echo.NewHTTPError(http.StatusServiceUnavailable, "AI not configured")
    }

    // 4. Build Anthropic Messages API request
    // 5. Make request, stream response back with simplified events
    // 6. Handle errors, rate limits
}
```

Route registration addition:
```go
func Routes(router *echo.Group) {
    router.POST("/chat/conversations/:id", Chat)
    router.POST("/v1/chat/completions", OpenAICompletion)
    router.POST("/v1/tools/execute", ExecuteTool)
    router.POST("/scribe/completions", ScribeCompletion)  // NEW
}
```

#### 2. cozy-stack: `model/ai/scribe.go` -- NEW file

```go
package ai

// ScribePayload is the request body from the frontend
type ScribePayload struct {
    System    string `json:"system"`
    Prompt    string `json:"prompt"`
    MaxTokens int    `json:"max_tokens"`
    Stream    bool   `json:"stream"`
}

// CallAnthropic sends a request to the Anthropic Messages API
// and returns the HTTP response for streaming.
func CallAnthropic(inst *instance.Instance, payload ScribePayload) (*http.Response, error) {
    // Build Anthropic API request
    // POST https://api.anthropic.com/v1/messages
    // Headers: x-api-key, anthropic-version, content-type
}

// StreamAnthropicResponse parses Anthropic SSE and writes simplified
// events to the HTTP response writer.
func StreamAnthropicResponse(w http.ResponseWriter, body io.Reader) error {
    // Parse: content_block_delta -> extract text_delta.text -> emit {"type":"delta","text":"..."}
    // Parse: message_stop -> emit {"type":"done"}
    // Parse: error -> emit {"type":"error","message":"..."}
}
```

#### 3. cozy-stack: Config extension in `pkg/config/config/config.go`

```go
// AnthropicServer contains config for Anthropic Claude API.
type AnthropicServer struct {
    URL    string  // default: "https://api.anthropic.com"
    APIKey string
    Model  string  // default: "claude-sonnet-4-5-20250514"
}
```

cozy.yaml addition:
```yaml
anthropic:
  default:
    url: https://api.anthropic.com
    api_key: sk-ant-...
    model: claude-sonnet-4-5-20250514
```

#### 4. cozy-drive: `src/modules/views/OnlyOffice/Scribe/scribeApi.js` -- NEW file

```javascript
/**
 * Call the Scribe API endpoint on cozy-stack, returning an SSE stream.
 *
 * @param {CozyClient} client - cozy-client instance (for auth headers + base URL)
 * @param {string} system - System prompt
 * @param {string} prompt - User prompt (with selected text embedded)
 * @param {AbortSignal} [signal] - For cancellation
 * @returns {ReadableStream} SSE event stream
 */
export async function scribeStream(client, system, prompt, signal) {
    const stackClient = client.getStackClient()
    const url = stackClient.fullpath('/ai/scribe/completions')
    const token = stackClient.getAuthorizationHeader()

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
            system,
            prompt,
            max_tokens: 4096,
            stream: true,
        }),
        signal,
        credentials: 'include',
    })

    if (!response.ok) {
        throw new Error(`Scribe API error: ${response.status}`)
    }

    return response.body  // ReadableStream
}
```

#### 5. cozy-drive: `src/modules/views/OnlyOffice/Scribe/useScribeStream.js` -- NEW hook

```javascript
/**
 * React hook that manages an SSE stream from the Scribe API.
 *
 * Returns: { streamText, isStreaming, error, startStream, cancelStream }
 *
 * Replaces mockTransform as the transformation engine.
 */
export function useScribeStream() {
    const [streamText, setStreamText] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const [error, setError] = useState(null)
    const abortRef = useRef(null)
    const client = useClient()

    const startStream = useCallback(async (system, prompt) => {
        // 1. Create AbortController
        // 2. Call scribeStream()
        // 3. Read from ReadableStream, parse SSE lines
        // 4. For each {"type":"delta","text":"..."} -> append to streamText
        // 5. On {"type":"done"} -> set isStreaming=false
        // 6. On {"type":"error"} -> set error
    }, [client])

    const cancelStream = useCallback(() => {
        if (abortRef.current) abortRef.current.abort()
        setIsStreaming(false)
    }, [])

    return { streamText, isStreaming, error, startStream, cancelStream }
}
```

### Modified Components

#### 6. ScribePopover.jsx -- Add streaming state

Current state machine: `menu` -> `result` (instant, via `mockTransform`)

New state machine: `menu` -> `streaming` -> `result`

```
 [menu]
   |
   | user selects action
   v
 [streaming]  <-- NEW STATE
   |   |
   |   | tokens arrive via SSE
   |   | ScribeResultPanel shows partial text
   |   |
   |   +-- user clicks Cancel -> back to [menu]
   |
   | stream completes (type: "done")
   v
 [result]
   |
   | user clicks Replace/Insert/Close
   v
 [closed]
```

Key change in `handleActionSelect`:
```javascript
// BEFORE (sync, instant):
const transformed = mockTransform(actionId, selectedText, extra)
setResult({ text: transformed, breadcrumb })
setStep('result')

// AFTER (async, streaming):
setStep('streaming')
setResult({ text: '', breadcrumb })
const system = buildSystemPrompt(actionId)
const prompt = buildUserPrompt(actionId, selectedText, extra)
startStream(system, prompt)
// ScribeResultPanel receives streamText progressively
// On stream complete: setStep('result')
```

#### 7. ScribeResultPanel.jsx -- Progressive text display

Changes needed:
- Accept `isStreaming` prop to show loading indicator / cursor
- Accept `streamText` that updates on every delta
- Disable Replace/Insert buttons while streaming
- Add Cancel button during streaming (calls `cancelStream`)
- Auto-scroll the text area as new content arrives

### Component Boundaries (v2.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Browser (Cozy Drive)                                 │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  OnlyOffice Editor Page                                               │  │
│  │                                                                       │  │
│  │  ┌─────────────────────┐                                              │  │
│  │  │  useCozyBridge      │  (unchanged -- handles plugin communication) │  │
│  │  └────────┬────────────┘                                              │  │
│  │           │ pendingIntent / showScribeButton                          │  │
│  │           v                                                           │  │
│  │  ┌─────────────────────┐                                              │  │
│  │  │  ScribeFloatingButton│  (unchanged)                                │  │
│  │  └────────┬────────────┘                                              │  │
│  │           │ click                                                     │  │
│  │           v                                                           │  │
│  │  ┌──────────────────────────────────────────────────────────────┐     │  │
│  │  │  ScribePopover  (state: menu|streaming|result)               │     │  │
│  │  │                                                              │     │  │
│  │  │  ┌────────────────────┐  ┌─────────────────────────────────┐│     │  │
│  │  │  │  ScribeActionMenu  │  │  ScribeResultPanel              ││     │  │
│  │  │  │  (unchanged)       │  │  + isStreaming prop             ││     │  │
│  │  │  │  + ScribePromptInput│  │  + progressiveText             ││     │  │
│  │  │  └────────────────────┘  │  + cancel button (streaming)   ││     │  │
│  │  │                          │  + disabled btns (streaming)   ││     │  │
│  │  │                          └─────────────────────────────────┘│     │  │
│  │  │                                                              │     │  │
│  │  │  ┌──────────────────────────────────────────────────────────┐│     │  │
│  │  │  │  useScribeStream  (NEW)                                  ││     │  │
│  │  │  │  - manages fetch + ReadableStream                        ││     │  │
│  │  │  │  - exposes: streamText, isStreaming, error,              ││     │  │
│  │  │  │    startStream, cancelStream                             ││     │  │
│  │  │  └──────────────────────────────────────────────────────────┘│     │  │
│  │  └──────────────────────────────────────────────────────────────┘     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  API call: POST /ai/scribe/completions                                     │
│  Auth: session cookie / Authorization header (from cozy-client)            │
│                                                                             │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               │ HTTPS
                               v
┌─────────────────────────────────────────────────────────────────────────────┐
│                          cozy-stack                                         │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  web/ai/ai.go                                                         │  │
│  │  Route: POST /ai/scribe/completions -> ScribeCompletion()             │  │
│  │                                                                       │  │
│  │  1. Permission check (io.cozy.ai.scribe)                             │  │
│  │  2. Parse ScribePayload (system, prompt, max_tokens, stream)         │  │
│  │  3. Get AnthropicServer config from instance context                  │  │
│  │  4. Build Anthropic Messages API request                              │  │
│  │  5. Forward to Anthropic API                                          │  │
│  │  6. Parse Anthropic SSE, re-emit simplified events to client          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  model/ai/scribe.go (NEW)                                            │  │
│  │  - CallAnthropic(): HTTP request to api.anthropic.com/v1/messages     │  │
│  │  - StreamAnthropicResponse(): parse SSE, emit simplified events       │  │
│  │  - ParseAnthropicError(): normalize error responses                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  pkg/config/config/config.go (MODIFIED)                               │  │
│  │  + AnthropicServer struct {URL, APIKey, Model}                        │  │
│  │  + makeAnthropicServers() parser                                      │  │
│  │  + config.AnthropicServers map[string]AnthropicServer                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  model/instance/instance.go (MODIFIED)                                │  │
│  │  + AnthropicServer() config.AnthropicServer                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  pkg/consts/doctype.go (MODIFIED)                                     │  │
│  │  + AIScribe = "io.cozy.ai.scribe"  // permission doctype              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               │ HTTPS + SSE
                               v
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Anthropic API (api.anthropic.com)                        │
│                                                                             │
│  POST /v1/messages                                                          │
│  Headers:                                                                   │
│    x-api-key: sk-ant-...                                                    │
│    anthropic-version: 2023-06-01                                            │
│    content-type: application/json                                           │
│                                                                             │
│  Request:                                                                   │
│    {                                                                        │
│      "model": "claude-sonnet-4-5-20250514",                                 │
│      "max_tokens": 4096,                                                    │
│      "system": "You are a writing assistant. Output ONLY the transformed    │
│                 text. No explanations, no markdown formatting.",             │
│      "messages": [{"role":"user","content":"Rewrite...\n\nHello world"}],   │
│      "stream": true                                                         │
│    }                                                                        │
│                                                                             │
│  Response: SSE stream with Anthropic event types                            │
│    event: message_start / content_block_delta / message_stop                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## SSE Parsing Detail

### Anthropic SSE -> Simplified SSE Translation

cozy-stack reads Anthropic's SSE stream and translates events:

```
ANTHROPIC INPUT                                  COZY OUTPUT
==================                               ===========

event: message_start                         --> data: {"type":"start"}
data: {"type":"message_start",...}

event: content_block_start                   --> (skip, no output)
data: {"type":"content_block_start",...}

event: content_block_delta                   --> data: {"type":"delta","text":"Hello"}
data: {"type":"content_block_delta",
  "delta":{"type":"text_delta",
    "text":"Hello"}}

event: content_block_delta                   --> data: {"type":"delta","text":" world"}
data: {"type":"content_block_delta",
  "delta":{"type":"text_delta",
    "text":" world"}}

event: content_block_stop                    --> (skip)

event: message_delta                         --> (skip -- contains usage stats)

event: message_stop                          --> data: {"type":"done"}
data: {"type":"message_stop"}

event: error                                 --> data: {"type":"error","message":"...","code":"..."}
data: {"type":"error",
  "error":{"type":"overloaded_error",
    "message":"Overloaded"}}
```

### Frontend SSE Parsing

The frontend uses `fetch` + `ReadableStream` (NOT `EventSource`), because:
1. `EventSource` only supports GET requests -- we need POST
2. `fetch` gives us control over headers (Authorization) and cancellation (AbortController)
3. `ReadableStream` with a `TextDecoder` and line-by-line parsing is simple and well-supported

```javascript
// Simplified SSE parser for fetch ReadableStream
async function parseSSEStream(body, onDelta, onDone, onError) {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line in buffer

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'delta') onDelta(data.text)
                else if (data.type === 'done') onDone()
                else if (data.type === 'error') onError(data)
            }
        }
    }
}
```

## Authentication and Permissions

### How Auth Works

1. cozy-drive is served as a webapp by cozy-stack, which sets a session cookie
2. `cozy-client` includes the session cookie on requests (`credentials: 'include'`)
3. For the Scribe endpoint, we use the standard cozy-stack permission system

### Permission Model

The webapp's manifest declares the required permission:

```json
{
  "permissions": {
    "ai-scribe": {
      "type": "io.cozy.ai.scribe",
      "verbs": ["POST"]
    }
  }
}
```

cozy-stack checks this via `middlewares.AllowWholeType(c, permission.POST, consts.AIScribe)`.

**Alternative (simpler):** Reuse the existing `io.cozy.ai.chat.conversations` permission with `POST` verb. This avoids creating a new doctype and modifying the cozy-drive manifest. The downside is less granular permission control. Use the existing permission for v2.0, add a dedicated one later if needed.

## Config Architecture

### Separate from RAG or Same Entry?

**Recommendation: Separate config entry.** The RAG server is an internal Cozy service (RAGondin). The Anthropic API is an external third-party API with different auth (API key vs bearer token), different headers (`x-api-key` + `anthropic-version`), and a completely different API format (Anthropic Messages API vs OpenAI-compatible).

```yaml
# cozy.yaml
rag:
  default:
    url: http://localhost:8000
    api_key: $3cr3t

anthropic:
  default:
    url: https://api.anthropic.com
    api_key: sk-ant-api03-...
    model: claude-sonnet-4-5-20250514
```

### Model Selection

Default to `claude-sonnet-4-5-20250514` because:
- Best cost/quality ratio for text transformation tasks
- Fast enough for streaming UX (Haiku is faster but lower quality for rewriting)
- Configurable per context (instance admins can change it)

Model is server-side config only -- the frontend never specifies or sees the model.

## System Prompts

System prompts live in the `SCRIBE_ACTIONS` config on the frontend and are sent to cozy-stack in the request body. This keeps the prompt logic declarative and co-located with the action definitions.

**Design principle:** The frontend owns "what to ask" (system prompt + user prompt with selected text). cozy-stack owns "how to ask" (which API, which model, which API key).

Example system prompt for the Scribe writing assistant:

```
You are a writing assistant integrated into a document editor. Your task is to transform the user's text according to their instructions. Rules:
1. Output ONLY the transformed text -- no explanations, no commentary, no markdown code blocks.
2. Preserve the original formatting (paragraphs, line breaks) unless the transformation requires changing it.
3. If the user asks for a translation, output only in the target language.
4. Match the length and style of the original unless explicitly asked to change it.
```

The action-specific instruction is in the user prompt (from `scribeActions.js`):

```
Rewrite the following text in a more professional tone:

Hello world, this is some text the user selected.
```

## Cancellation Architecture

### Frontend Cancellation

```javascript
const abortController = new AbortController()

// Pass signal to fetch
const response = await fetch(url, { signal: abortController.signal })

// User clicks Cancel
abortController.abort()
// -> fetch throws AbortError
// -> ReadableStream reader rejects
// -> cleanup in catch block
```

### Server-Side Implications

When the frontend aborts, the HTTP connection closes. cozy-stack detects this via the request context:

```go
// In the streaming loop
select {
case <-c.Request().Context().Done():
    // Client disconnected, close Anthropic connection
    return nil
default:
    // Continue reading from Anthropic
}
```

The Anthropic HTTP response body should be closed when the handler returns, which stops the upstream SSE stream. This is handled by `defer res.Body.Close()`.

## Non-Streaming Fallback

For reliability, the API should also work without streaming (`"stream": false`). In this mode:
1. cozy-stack makes a non-streaming request to Anthropic
2. Waits for the full response
3. Returns a simple JSON response: `{"text": "transformed text"}`

This is useful for:
- Debugging / testing without SSE complexity
- Fallback if streaming fails
- Short transformations where streaming adds no UX value

## Error Handling Architecture

### Error Categories

| Error | Source | HTTP Status | Frontend Display |
|-------|--------|-------------|------------------|
| Invalid request | cozy-stack | 400 | "Invalid request" |
| No AI configured | cozy-stack config | 503 | "AI service not available" |
| Auth failure | Anthropic API | 401 | "AI service configuration error" |
| Rate limited | Anthropic API | 429 | "AI service busy, try again" |
| Overloaded | Anthropic SSE | 529 | "AI service busy, try again" |
| Model error | Anthropic API | 500 | "AI service error, try again" |
| Network timeout | cozy-stack -> Anthropic | 504 | "AI service timeout" |
| User cancel | Browser | N/A | Return to menu |

### Error Flow

```
Anthropic error
  |
  v
cozy-stack catches in SSE parser or HTTP status
  |
  v
Emits: data: {"type":"error","message":"...","code":"rate_limit"}
  |
  v
Frontend useScribeStream sets error state
  |
  v
ScribeResultPanel shows error message with Retry button
```

## Suggested Build Order

The build order is designed so each phase produces a testable artifact.

### Phase 1: cozy-stack Config + Route Skeleton (backend, no Anthropic yet)

**What:** Add `AnthropicServer` config struct, parse from cozy.yaml, add the `/ai/scribe/completions` route that returns a mock SSE stream.

**Files:**
- `pkg/config/config/config.go` -- add `AnthropicServer` struct + `makeAnthropicServers()`
- `model/instance/instance.go` -- add `AnthropicServer()` method
- `web/ai/ai.go` -- add `ScribeCompletion()` handler with mock SSE response
- `pkg/consts/doctype.go` -- add `AIScribe` doctype (if using new permission)

**Test:** `curl -X POST http://localhost:8080/ai/scribe/completions` returns mock SSE events.

**Why first:** This gives the frontend team a real endpoint to integrate against while the Anthropic proxy is built. The mock SSE response matches the final format.

### Phase 2: Frontend SSE Consumer (frontend, against mock backend)

**What:** Replace `mockTransform` with the SSE-based `useScribeStream` hook. Wire into `ScribePopover` state machine.

**Files (cozy-drive):**
- NEW: `Scribe/scribeApi.js` -- fetch-based SSE client
- NEW: `Scribe/useScribeStream.js` -- React hook
- MODIFY: `Scribe/ScribePopover.jsx` -- add `streaming` state, wire hook
- MODIFY: `Scribe/ScribeResultPanel.jsx` -- progressive text, cancel button

**Test:** Full UI flow works against the mock SSE endpoint from Phase 1.

**Why second:** Frontend changes are the most visible. Getting the streaming UX right with a mock backend means the team can iterate on UX without waiting for real Anthropic calls.

### Phase 3: Anthropic API Proxy (backend, real calls)

**What:** Replace the mock SSE response with real Anthropic API calls. Add SSE parsing, error handling, rate limit handling.

**Files:**
- NEW: `model/ai/scribe.go` -- `CallAnthropic()`, `StreamAnthropicResponse()`
- MODIFY: `web/ai/ai.go` -- `ScribeCompletion()` calls real proxy
- MODIFY: `cozy.yaml` -- add real Anthropic API key

**Test:** End-to-end streaming from browser through cozy-stack to Anthropic and back.

### Phase 4: Error Handling + Cancellation

**What:** Robust error handling for all failure modes. Mid-stream cancellation. Retry UI.

**Backend:**
- Timeout configuration for Anthropic requests
- Graceful handling of client disconnect
- Rate limit header parsing for retry-after

**Frontend:**
- AbortController wiring
- Error display in ScribeResultPanel
- Retry button
- Cancel button during streaming

### Phase 5: Polish + Non-Streaming Fallback

**What:** Non-streaming mode, prompt refinement, dark theme fix, remaining UX issues.

- Non-streaming fallback (stream=false)
- System prompt tuning per action type
- Token count / cost awareness (optional)
- Dark theme fixes (existing bug)

## Patterns to Follow

### Pattern 1: Echo SSE Streaming

Use Echo's streaming response with `Flush()` for SSE:

```go
func ScribeCompletion(c echo.Context) error {
    // ... setup ...

    c.Response().Header().Set("Content-Type", "text/event-stream")
    c.Response().Header().Set("Cache-Control", "no-cache")
    c.Response().Header().Set("Connection", "keep-alive")
    c.Response().WriteHeader(http.StatusOK)

    flusher, ok := c.Response().Writer.(http.Flusher)
    if !ok {
        return echo.NewHTTPError(http.StatusInternalServerError, "Streaming not supported")
    }

    // Write events
    fmt.Fprintf(c.Response(), "data: %s\n\n", jsonEvent)
    flusher.Flush()
}
```

### Pattern 2: Config Lookup by Instance Context

Follow the exact pattern of `RAGServer()`:

```go
func (i *Instance) AnthropicServer() config.AnthropicServer {
    servers := config.GetConfig().AnthropicServers
    if i.ContextName != "" {
        if server, ok := servers[i.ContextName]; ok {
            return server
        }
    }
    return servers[config.DefaultInstanceContext]
}
```

### Pattern 3: Frontend Auth via cozy-client stackClient

Use `stackClient.fullpath()` for URL construction and `stackClient.getAuthorizationHeader()` for auth, but use raw `fetch()` (not `fetchJSON`) because we need the raw `Response.body` ReadableStream for SSE parsing.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Using Realtime WebSocket for Scribe

**What:** Routing Scribe responses through the realtime hub like RAG chat does.
**Why bad:** Adds 4 unnecessary layers (CouchDB write, job queue, realtime publish, WebSocket subscription) for a stateless transformation.
**Instead:** Direct SSE from cozy-stack to browser via HTTP streaming.

### Anti-Pattern 2: Using EventSource API

**What:** Using the browser's `EventSource` API to consume the SSE stream.
**Why bad:** `EventSource` only supports GET requests. Scribe needs POST with a JSON body. `EventSource` also lacks AbortController support and custom headers.
**Instead:** Use `fetch()` with `ReadableStream` + manual SSE line parsing.

### Anti-Pattern 3: Transparent Anthropic Proxy

**What:** Forwarding Anthropic's raw SSE events directly to the frontend.
**Why bad:** Leaks Anthropic-specific format to the frontend. Model info, usage tokens, and Anthropic event types become frontend concerns. Switching providers requires frontend changes.
**Instead:** Parse and re-emit simplified `delta`/`done`/`error` events.

### Anti-Pattern 4: Storing API Keys in Frontend

**What:** Having the Anthropic API key accessible to the browser in any way.
**Why bad:** API key exposure. The whole point of the proxy is to keep the key server-side.
**Instead:** API key is only in cozy.yaml, read by cozy-stack, never sent to the browser.

### Anti-Pattern 5: Large System Prompts in scribeActions.js

**What:** Putting the full multi-paragraph system prompt in the declarative config.
**Why bad:** Makes scribeActions.js hard to read. System prompts may need A/B testing or server-side override.
**Instead:** A small `buildSystemPrompt()` function that composes the system prompt from the action config. Keep the per-action instruction concise in SCRIBE_ACTIONS; build the full system prompt separately.

## Scalability Considerations

| Concern | 10 users | 1K users | 10K users |
|---------|----------|----------|-----------|
| Anthropic rate limits | No issue | Monitor rate limits, add retry logic | Need Anthropic rate limit increase or request queuing |
| cozy-stack memory (streaming) | Negligible | ~1KB per active stream | Monitor goroutine count, consider max concurrent streams |
| Cost | ~$0.01/request | ~$10/day | Implement per-user rate limiting, consider caching common transformations |
| Latency | Direct connection | Direct connection | Consider connection pooling to Anthropic API |

## Sources

- Anthropic Messages API: [https://platform.claude.com/docs/en/api/messages](https://platform.claude.com/docs/en/api/messages) (verified 2026-03-03)
- Anthropic Streaming docs: [https://platform.claude.com/docs/en/build-with-claude/streaming](https://platform.claude.com/docs/en/build-with-claude/streaming) (verified 2026-03-03)
- cozy-stack `web/ai/ai.go`: analyzed at `/home/ben/Dev-local/cozy-stack/web/ai/ai.go`
- cozy-stack `model/rag/chat.go`: analyzed at `/home/ben/Dev-local/cozy-stack/model/rag/chat.go`
- cozy-stack config: analyzed at `/home/ben/Dev-local/cozy-stack/pkg/config/config/config.go`
- cozy-client `models/ai.js`: existing `chatCompletion()` function uses `fetchJSON('POST', '/ai/v1/chat/completions')`
- cozy-search `AssistantProvider.js`: reference for realtime-based streaming pattern (WebSocket approach we are NOT using)
- cozy-stack-client `CozyStackClient.js`: `fetch()` method provides auth headers + URL construction
