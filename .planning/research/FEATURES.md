# Feature Landscape: v2.0 Scribe Live AI

**Domain:** LLM integration for AI writing assistant (Scribe) in OnlyOffice / Cozy Drive
**Researched:** 2026-03-03
**Milestone context:** v2.0 -- replacing mock AI with real Anthropic Claude API, adding streaming UX
**Confidence:** HIGH -- Anthropic streaming API is well-documented; patterns for streaming UX, error handling, and cancellation are well-established across industry; existing cozy-stack AI routes provide clear extension points.

---

## Existing v1.0 Foundation (Already Shipped)

These features are built and working. v2.0 builds directly on top of them.

| Feature | Status | Location |
|---------|--------|----------|
| Text selection detection in OO | Shipped | `plugins/onlyoffice-scribe/` |
| Action menu (Correct grammar, Translate, Change tone, Improve, Free prompt) | Shipped | `ScribeActionMenu.jsx`, `scribeActions.js` |
| Result preview panel (Insert/Replace/Cancel) | Shipped | `ScribeResultPanel.jsx` |
| Floating button with Ctrl+I shortcut | Shipped | React portal on `document.body` |
| Mock AI transformation (instant, config-driven) | Shipped | `mockTransform.js` |
| Declarative SCRIBE_ACTIONS config (prompts + mock results) | Shipped | `scribeActions.js` |
| Two-step state machine (menu -> result) | Shipped | `ScribePopover.jsx` |
| postMessage protocol (plugin <-> host) | Shipped | `cozy-bridge/protocol.js` |

---

## Table Stakes

Features users expect when a mock AI is replaced with a real one. Missing any of these means the product feels broken or worse than the mock.

| Feature | Why Expected | Complexity | Dependency on Existing UI |
|---------|--------------|------------|--------------------------|
| **Real AI text transformation** | The mock prefix/wrap transforms are obviously fake. Users expect actual rewriting, translation, correction from a real LLM. This is the entire point of v2.0. | MEDIUM | Replace `mockTransform()` call in `ScribePopover.handleActionSelect` with real API call. `SCRIBE_ACTIONS.prompt` templates already contain the right prompts with `{selectedText}` placeholders. |
| **Loading state during AI processing** | Mock transforms were instant. Real API calls take 1-5s (TTFT) + generation time. Users need visual feedback that something is happening. | LOW | Add a third step `'loading'` to `ScribePopover`'s `step` state machine (currently `'menu'` / `'result'`). Show spinner/skeleton in the result panel area. |
| **Error feedback on API failure** | Network errors, rate limits (429), overload (529), server errors (500) will happen. Users must see a clear message, not a silent failure or infinite spinner. | MEDIUM | New error state in `ScribePopover`. Display in the result panel area with a "Try again" button. Must distinguish retryable (429, 529, network) from non-retryable (400, 401) errors. |
| **Retry on transient failure** | 529 (overloaded) and 429 (rate limit) are expected from Anthropic's API. Automatic retry with exponential backoff is standard practice. | MEDIUM | Implement in the API service layer, transparent to UI. Retry 529/429 up to 3 times with exponential backoff (1s, 2s, 4s) + jitter. Surface error to UI only after retries exhausted. |
| **Dark theme text visibility** | Known bug: "Selected Text" white-on-white in OO dark theme. With real AI output appearing in the result panel, this becomes critical -- users cannot read the AI response. | LOW | Use `theme.palette.text.primary` and `theme.palette.background.paper` from MUI/cozy-ui theme. The `ScribeResultPanel` already uses `useTheme()` for the background but the text color may not adapt. Ensure WCAG 4.5:1 contrast ratio. |
| **Prompt template interpolation** | `SCRIBE_ACTIONS` already has prompt templates like `"Correct the grammar and spelling of the following text:\n\n{selectedText}"`. These must be sent to the real API with the actual selected text substituted. | LOW | Simple string replacement already implied by the config. Build a `buildPrompt(action, selectedText, extra)` function that replaces `{selectedText}` and `{language}` placeholders, then sends to API. |

---

## Differentiators

Features that elevate v2.0 beyond "mock replaced with real API." These create the perception of a polished, professional AI writing tool.

| Feature | Value Proposition | Complexity | Dependency on Existing UI |
|---------|-------------------|------------|--------------------------|
| **Streaming response (token-by-token display)** | Users perceive streaming as 40-60% faster than waiting for a complete response. The "AI typing" effect transforms a 3-10s wait into an engaging experience. Every major AI chat product (ChatGPT, Claude.ai, Gemini) uses streaming. For a text editor integration, this is becoming table stakes in 2026. | HIGH | Major change to `ScribeResultPanel`: must accept incremental text updates instead of a static `resultText` string. The result panel currently renders `{resultText}` as a static string in a div. Must become a live-updating display. New `step` value `'streaming'` in the state machine. The `ScribePopover` must manage an `AbortController` for cancellation. |
| **Cancel mid-stream** | If the AI starts generating obviously wrong output, users need to stop it immediately rather than waiting 10+ seconds for completion. Every streaming AI interface has a "Stop" button. | MEDIUM | Add a "Stop generating" button visible only during `step === 'streaming'`. On click, abort the fetch via `AbortController.abort()`. Transition to `'result'` step with whatever text was accumulated so far. User can then Replace/Insert the partial result or Close. The cozy-stack proxy must forward the client disconnect to close the upstream Anthropic connection. |
| **Graceful degradation (non-streaming fallback)** | If the SSE stream breaks mid-response (network hiccup, proxy timeout), the UI should not crash. Show accumulated text with a "Response interrupted" notice and still allow Replace/Insert on partial text. | LOW | Catch stream errors in the fetch reader loop. On error, transition from `'streaming'` to `'result'` with accumulated text + error banner. The `onAbort` vs `onFinish` distinction from the fetch is key here. |
| **Regenerate (try again)** | After seeing the AI result, users may want to try again with the same prompt. "Regenerate" is standard in ChatGPT, Copilot (Regenerate), Google Docs (Retry). | LOW | Add a "Regenerate" button to `ScribeResultPanel` next to Replace/Insert/Close. On click, transition back to `'loading'` / `'streaming'` and re-call the API with the same prompt. Store the original `actionId` and `selectedText` in state so regeneration is trivial. |
| **Context menu integration** | Users right-click in text editors constantly. Having Scribe actions available in the OO context menu is a natural discovery path alongside the floating button. | MEDIUM | Requires OO plugin API `AddContextMenuItem`. The plugin must register menu items and handle click events. When clicked, sends intent to host. This is independent of the streaming/API work but is a v2.0 polish feature. |
| **Keyboard shortcut (Ctrl+I) reliability** | The shortcut exists but may be inconsistent across OS/browser combinations. Making it reliable is a quality signal. | LOW | Already implemented. Verify cross-browser behavior and fix edge cases. |

---

## Anti-Features

Features to explicitly NOT build in v2.0.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Client-side Anthropic API calls** | Exposing the API key in the browser is a security disaster. Even with obfuscation, browser DevTools reveal it instantly. The cozy-stack proxy pattern exists for this reason. | All API calls go through cozy-stack's `/ai/` routes, which hold the API key server-side. The frontend never sees the key. |
| **Model selection UI** | Adding Claude model picker (Haiku vs Sonnet vs Opus) creates confusion for non-technical users and complicates the backend. Cozy controls the model server-side. | Use a single model configured in cozy-stack. The backend team selects the best model for the use case. Users do not need to know or care. |
| **Conversation/chat memory** | Maintaining multi-turn context across Scribe invocations is architecturally complex (session state, token budget management, context window limits) and misaligned with the "select text, transform, apply" paradigm. | Each Scribe action is a single-shot API call. The prompt template contains all necessary context. Defer conversation memory to v3.0 if needed. |
| **Editable preview before applying** | While listed as a v1.0 differentiator, implementing a contenteditable area that correctly handles the AI output, cursor positioning, and then re-sends the edited text to OO adds significant complexity for marginal value. | Keep the preview read-only for v2.0. Users can always Replace into the document and then edit there. Revisit if users specifically request this. |
| **Markdown rendering in preview** | The AI may return markdown (bullet lists, bold, etc.) but the preview panel is plain text and the OO InsertContent API works with plain text. Rendering markdown creates a WYSIWYG expectation that cannot be fulfilled on insert. | Display AI output as plain text in the preview. If the AI returns markdown formatting, it will be visible as-is. Instruct the AI via system prompt to return plain text only. |
| **Usage tracking/token counting UI** | Showing users how many tokens they consumed, cost per request, or usage limits is unnecessary complexity for an integrated tool. | Handle rate limiting silently with retries. If hard limits are hit, show a simple "Service temporarily unavailable, try again later" message. |

---

## Feature Dependencies

```
[cozy-stack /ai/ route extension]  (NEW - backend)
    |
    +--provides--> [SSE streaming endpoint for text transformation]
    |                   |
    |                   +--consumed by--> [Frontend API service layer]  (NEW)
    |                                         |
    |                                         +--manages--> [AbortController for cancellation]
    |                                         +--handles--> [Retry logic with exponential backoff]
    |                                         +--handles--> [Error classification (retryable vs fatal)]
    |                                         |
    |                                         +--feeds--> [ScribePopover state machine]  (MODIFIED)
    |                                                         |
    |                                                         +-- step: 'menu' (existing)
    |                                                         +-- step: 'loading' (NEW: TTFT wait)
    |                                                         +-- step: 'streaming' (NEW: tokens arriving)
    |                                                         +-- step: 'result' (existing, now also for stream-complete)
    |                                                         +-- step: 'error' (NEW: API failure)
    |                                                         |
    |                                                         +--renders--> [ScribeResultPanel]  (MODIFIED)
    |                                                                          |
    |                                                                          +-- Loading skeleton (NEW)
    |                                                                          +-- Streaming text display (NEW)
    |                                                                          +-- "Stop generating" button (NEW)
    |                                                                          +-- "Regenerate" button (NEW)
    |                                                                          +-- Error message + retry (NEW)
    |                                                                          +-- Dark theme fix (BUG FIX)

[Floating button disable on deselection]  (BUG FIX, independent)

[Context menu integration]  (ENHANCEMENT, independent of streaming work)
```

### Key Dependency: cozy-stack Backend

The frontend cannot call Anthropic directly. The cozy-stack `/ai/` routes must be extended to:
1. Accept a text transformation request (prompt + selected text)
2. Forward to Anthropic Claude API with streaming enabled
3. Proxy the SSE stream back to the frontend
4. Handle API key management server-side

The existing cozy-stack `callAI()` function already uses `c.Stream()` to pipe upstream responses. The pattern is established -- it needs extension for text transformation specifically.

### Key Dependency: SSE Consumption in Frontend

The native `EventSource` API only supports GET requests. Since the AI transformation requires sending the prompt + selected text (POST body), the frontend must use `fetch()` with `ReadableStream` to consume the SSE response. This is a well-established pattern:

```javascript
// Pattern: POST-based SSE consumption with AbortController
const controller = new AbortController()
const response = await fetch('/ai/transform', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, text }),
  signal: controller.signal
})

const reader = response.body.getReader()
const decoder = new TextDecoder()
let accumulated = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  const chunk = decoder.decode(value, { stream: true })
  // Parse SSE events from chunk, extract text deltas
  accumulated += parseTextDelta(chunk)
  onChunk(accumulated)  // Update UI
}
```

---

## Streaming UX Specification

### State Machine

The `ScribePopover` state machine expands from 2 steps to 5:

| State | Trigger | UI | User Actions |
|-------|---------|-------|--------------|
| `menu` | Popover opens | Action menu + prompt input | Select action, type prompt, close |
| `loading` | Action selected, API call initiated | Breadcrumb + loading skeleton/spinner | Close (cancels request) |
| `streaming` | First token arrives (TTFT) | Breadcrumb + live-updating text + "Stop" button | Stop generating, close |
| `result` | Stream completes or user stops | Breadcrumb + final text + Insert/Replace/Regenerate/Close | Insert, Replace, Regenerate, Close |
| `error` | API error after retries exhausted | Breadcrumb + error message + "Try again" button | Try again, Close |

### Streaming Text Display

During `streaming` state, the result panel text area updates as tokens arrive:

- **No cursor blink animation** -- unlike chat UIs, this is a text transformation tool. A blinking cursor implies the user should type. Instead, simply append text smoothly.
- **Skip expensive parsing during stream** -- do not apply markdown rendering, syntax highlighting, or diff visualization while tokens are arriving. Apply formatting only after stream completes (if ever).
- **Scroll to bottom** -- if the generated text exceeds the visible area, auto-scroll to show the latest tokens.
- **Show partial text count** -- optional: display "(generating...)" or a subtle animation near the text to indicate more is coming.

### Cancel Semantics

When the user clicks "Stop generating":
1. `AbortController.abort()` is called
2. The fetch reader loop catches the `AbortError`
3. State transitions to `'result'` with the accumulated text so far
4. The user can Replace/Insert the partial result, or Close
5. The cozy-stack proxy should detect the closed connection and terminate the upstream Anthropic request (standard HTTP behavior)

### Error Classification

| Error Type | HTTP Status | Retryable | User Message | Action |
|------------|-------------|-----------|--------------|--------|
| Rate limited | 429 | Yes (auto) | *(not shown -- auto-retry)* | Exponential backoff, max 3 retries |
| Overloaded | 529 | Yes (auto) | *(not shown -- auto-retry)* | Exponential backoff, max 3 retries |
| Network error | 0 / timeout | Yes (manual) | "Connection lost. Check your internet and try again." | Show "Try again" button |
| Server error | 500 | Yes (manual) | "Something went wrong. Please try again." | Show "Try again" button |
| Auth error | 401/403 | No | "AI service is not configured. Contact your administrator." | Show Close only |
| Bad request | 400 | No | "Unable to process this text. Try selecting different text." | Show Close only |
| Stream error | 200 then error event | Partial | "Response was interrupted." + show partial text | Show partial result + "Try again" |
| Mid-stream SSE error | `overloaded_error` in event stream | Yes (manual) | "Response was interrupted due to high demand." + show partial text | Show partial result + "Try again" |

### Anthropic-Specific Error Events

Per official documentation, errors can occur mid-stream even after a 200 response:
```
event: error
data: {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}
```
The SSE parser must handle these gracefully -- treat as stream interruption, preserve accumulated text, show error state.

---

## Dark Theme Fix Specification

### Current Bug

In OO dark theme, text appears white-on-white in certain elements. This is caused by:
1. OO sets a dark background on its editor
2. The Scribe UI (rendered in the Cozy Drive frame) uses MUI theme which may or may not match
3. Some elements use hardcoded colors or inherit incorrectly

### Fix Approach

| Element | Current Issue | Fix |
|---------|---------------|-----|
| Result panel text area | `backgroundColor: theme.palette.action.hover` is set but text color inherits from parent which may be wrong | Explicitly set `color: theme.palette.text.primary` on the text area |
| Result panel background | Uses `Paper` which should respect theme, but verify | Ensure `Paper` component receives the correct theme context |
| Loading/streaming states | New elements -- must be theme-aware from the start | Use `theme.palette.text.secondary` for loading indicators, `theme.palette.text.primary` for streaming text |
| Error messages | New elements | Use `theme.palette.error.main` for error text with sufficient contrast |

### WCAG Compliance

- Normal text: minimum 4.5:1 contrast ratio
- Large text (>= 18px or >= 14px bold): minimum 3:1 contrast ratio
- Use MUI theme tokens (not hardcoded colors) to automatically adapt to light/dark mode

---

## API Integration Points

### Where mockTransform Gets Replaced

In `ScribePopover.jsx`, the `handleActionSelect` callback currently calls:
```javascript
const transformed = mockTransform(actionId, selectedText, extra)
setResult({ text: transformed, breadcrumb })
setStep('result')
```

This becomes:
```javascript
setResult({ text: '', breadcrumb })
setStep('loading')
const prompt = buildPrompt(actionId, selectedText, extra)
try {
  await streamTransform(prompt, {
    onFirstToken: () => setStep('streaming'),
    onChunk: (accumulated) => setResult(r => ({ ...r, text: accumulated })),
    onComplete: () => setStep('result'),
    onError: (error) => { setError(error); setStep('error') },
    signal: abortControllerRef.current.signal
  })
} catch (e) {
  if (e.name !== 'AbortError') {
    setError(classifyError(e))
    setStep('error')
  }
}
```

### New Files Needed

| File | Purpose |
|------|---------|
| `scribeApi.js` | API service layer: `streamTransform(prompt, callbacks)`, SSE parsing, retry logic |
| `scribeErrors.js` | Error classification: `classifyError(error)` -> `{ type, message, retryable }` |
| `buildPrompt.js` | Prompt construction: `buildPrompt(actionId, selectedText, extra)` from SCRIBE_ACTIONS config |

### Files Modified

| File | Changes |
|------|---------|
| `ScribePopover.jsx` | Expanded state machine (5 states), AbortController management, API call integration |
| `ScribeResultPanel.jsx` | Loading state, streaming display, Stop button, Regenerate button, error display, dark theme fix |
| `scribeActions.js` | Add system prompt prefix configuration for real AI calls |

---

## MVP Recommendation for v2.0

### Must Have (launch blockers)

1. **Real API integration via cozy-stack** -- the entire point of v2.0
2. **Loading state** -- users cannot stare at nothing while API responds
3. **Error handling with retry** -- API will fail; users need clear feedback
4. **Dark theme fix** -- existing bug, becomes critical with real content
5. **Prompt template interpolation** -- SCRIBE_ACTIONS prompts must work with real API

### Should Have (significant quality improvement)

6. **Streaming response** -- transforms the UX from "wait and see" to "watch it write"
7. **Cancel mid-stream** -- safety valve for wrong outputs
8. **Regenerate** -- standard expectation, trivial once API integration exists

### Defer to v2.x

9. **Context menu integration** -- independent enhancement, not blocking
10. **Visual diff between original and result** -- nice but not essential
11. **Editable preview** -- complexity not justified yet
12. **Conversation memory** -- architectural complexity, defer to v3.0

---

## Sources

### Official Documentation (HIGH confidence)
- [Anthropic Claude Streaming API](https://platform.claude.com/docs/en/build-with-claude/streaming) -- event types, text_delta format, error recovery
- [Anthropic API Errors](https://platform.claude.com/docs/en/api/errors) -- HTTP error codes (400, 401, 429, 500, 529), error shapes, request IDs
- [Cozy Stack AI Documentation](https://docs.cozy.io/en/cozy-stack/ai/) -- existing RAG endpoint, WebSocket streaming, chat conversations
- [Cozy Stack GitHub - web/ai/ai.go](https://github.com/cozy/cozy-stack/tree/master/web/ai) -- route definitions, `callAI()` proxy pattern, `c.Stream()` usage

### Implementation Patterns (MEDIUM confidence)
- [AI SDK - Stopping Streams](https://ai-sdk.dev/docs/advanced/stopping-streams) -- AbortSignal, onAbort callback, stop() helper pattern
- [Streaming LLM Responses Guide](https://dev.to/hobbada/the-complete-guide-to-streaming-llm-responses-in-web-applications-from-sse-to-real-time-ui-3534) -- SSE implementation, React rendering, backpressure, error recovery
- [Simon Willison - How Streaming LLM APIs Work](https://til.simonwillison.net/llms/streaming-llm-apis) -- SSE protocol mechanics
- [Beyond EventSource: ReadableStream](https://rob-blackbourn.medium.com/beyond-eventsource-streaming-fetch-with-readablestream-5765c7de21a1) -- POST-based SSE consumption pattern

### Competitor Analysis (MEDIUM confidence)
- [Notion AI vs Coda AI vs Google Docs AI](https://genesysgrowth.com/blog/notion-ai-vs-coda-ai-vs-google-docs-ai) -- feature comparison, 2026 landscape
- [Notion 3.2 Release](https://www.notion.com/releases/2026-01-20) -- multi-model selection, mobile AI
- [Gemini vs Notion AI](https://www.eesel.ai/blog/gemini-vs-notion-ai) -- writing assistant comparison

### Error Handling (MEDIUM confidence)
- [Handling Claude API overloaded_error](https://coldfusion-example.blogspot.com/2026/02/handling-claude-api-overloadederror-and.html) -- exponential backoff, circuit breaker pattern
- [API Rate Limits Best Practices](https://orq.ai/blog/api-rate-limit) -- client-side rate limiting, graceful degradation

### Accessibility (MEDIUM confidence)
- [WCAG Color Contrast Guide 2025](https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025) -- 4.5:1 minimum ratio
- [Accessible Dark Mode Design](https://medium.com/@design.ebuniged/designing-accessible-dark-mode-a-wcag-compliant-interface-redesign-0e0225833aa4) -- dark grey vs pure black, contrast requirements

---
*Feature research for: v2.0 Scribe Live AI -- LLM integration, streaming, error handling*
*Researched: 2026-03-03*
