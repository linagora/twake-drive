# Phase 7: Real AI Integration - Research

**Researched:** 2026-03-03
**Domain:** LLM API integration (frontend-only), loading UX, request cancellation
**Confidence:** HIGH

## Summary

Phase 7 replaces the mock text transformation in ScribePopover with real LLM calls via `chatCompletion()` from `cozy-client/dist/models/ai`. The function already exists, is proven in production (used by cozy-viewer's AIAssistantPanel), and handles authentication and URL construction automatically. The cozy-stack endpoint `POST /ai/v1/chat/completions` follows the OpenAI chat completion format and already exists -- no backend changes are needed.

The core work is: (1) make `handleActionSelect` async, (2) build the messages array from existing prompt templates in `scribeActions.js`, (3) add a `'loading'` step to the state machine with a spinner and action-specific message, and (4) implement cancellation via AbortController when the popover closes. A critical finding is that `chatCompletion()` does NOT pass fetch options (like `signal`) to the underlying `fetchJSON` -- it merges all options into the request body. For cancellation, we must call `client.stackClient.fetchJSON()` directly or wrap the promise.

**Primary recommendation:** Call `client.stackClient.fetchJSON('POST', '/ai/v1/chat/completions', requestBody, { signal })` directly instead of `chatCompletion()`, to get AbortController cancellation support. This is a one-liner that replicates what `chatCompletion` does internally, with the addition of the signal.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use `chatCompletion()` from `cozy-client/dist/models/ai` -- handles auth, URL construction, hits `POST /ai/v1/chat/completions`
- Same function already used by cozy-viewer's AIAssistantPanel -- proven in the ecosystem
- Non-streaming: send request, await full response, display result. Streaming deferred to future milestone
- Access cozy-client instance via `useClient()` hook inside ScribePopover (already in CozyProvider tree)
- Frontend builds prompts: interpolate `{selectedText}` (and `{language}` for translate) into existing `scribeActions.js` prompt templates before calling chatCompletion()
- No backend/cozy-stack changes required
- Show a spinner + action-specific loading message ("Rewriting...", "Translating to English...", "Simplifying...")
- Derive loading message from the action label in scribeActions.js
- New step in ScribePopover state machine: `'menu'` | `'loading'` | `'result'`
- Cancellation via AbortController: create signal on API call, abort on popover close
- No explicit cancel button -- closing the popover (X button or click outside) cancels the in-flight request
- Insert/Replace buttons disabled during loading
- System message framing Scribe as a writing assistant: "You are a writing assistant. Return only the transformed text, no explanations or commentary."
- System prompt includes: "Respond in the same language as the input text"
- Prompt templates stay in English (better LLM instruction-following) -- output language handled by system prompt
- Free-prompt action wrapped with guardrails: "Apply the following instruction to the text below. Return only the modified text.\n\nInstruction: {userPrompt}\n\nText: {selectedText}"
- Translate-custom: `{language}` placeholder interpolated from user-typed language name
- Same ScribeResultPanel layout as mock -- minimal UI changes
- Empty/unexpected response: show inline error message in result panel area ("No result received. Try again.")
- No regenerate button in Phase 7
- No artificial length limit or max_tokens

### Claude's Discretion
- Exact spinner component choice (cozy-ui Spinner vs custom)
- How to structure the messages array for chatCompletion() (system + user message ordering)
- Exact wording of the system prompt (the intent is captured above)
- Error message wording for empty/failed responses
- Whether to add a subtle transition animation between loading and result states

### Deferred Ideas (OUT OF SCOPE)
- Streaming UX (token-by-token text appearance) -- STREAM-01/02/03, future milestone
- Regenerate button -- STREAM-03, future milestone
- Diff view (original vs AI text side-by-side) -- potential future enhancement
- Server-side prompt templates -- could revisit if prompt management becomes complex
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| API-01 | User sees real AI-generated text when selecting a Scribe action (replaces mock) | `chatCompletion()` API verified, response format documented (`response.choices[0].message.content`), integration point identified (`handleActionSelect` in ScribePopover.jsx line 42-50) |
| API-02 | Scribe sends correct prompt to LLM based on selected action and text via POST /ai/v1/chat/completions | `scribeActions.js` already has complete prompt templates per action with `{selectedText}` placeholders; system prompt pattern from AIAssistantPanel verified |
| API-03 | Free-prompt action sends user's custom instruction to LLM with selected text | Free-prompt flow traced: ScribePromptInput -> handlePromptSubmit -> onSelect('free-prompt', prompt, prompt) -> handleActionSelect; wrapping template defined in CONTEXT.md |
| LOAD-01 | User sees visual feedback (loading indicator) while AI processes request | cozy-ui Spinner component available (already used in View.jsx line 4/125), `'loading'` step added to state machine, action-specific messages derivable from action labels |
| LOAD-02 | User can close the popover during loading (cancels the in-flight request) | AbortController + signal approach verified; requires direct `fetchJSON` call (not `chatCompletion`) for signal passthrough; `handleClose` already calls `onCancel` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cozy-client | (installed) | `chatCompletion()` API + `useClient()` hook | Official Cozy SDK; handles auth, token refresh, URL construction |
| cozy-stack-client | (installed) | `fetchJSON()` with signal support for cancellation | Underlying HTTP layer; supports 4th arg options including AbortController signal |
| cozy-ui | (installed) | Spinner, CircularProgress components | Official Cozy UI library; Spinner already used in View.jsx |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| AbortController | Web API (native) | Cancel in-flight fetch requests | When user closes popover during loading |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cozy-ui Spinner | MUI CircularProgress | CircularProgress is also available via cozy-ui re-export; Spinner is already used in the OnlyOffice View.jsx, so prefer consistency |
| Direct fetchJSON | chatCompletion() wrapper | chatCompletion() is simpler but does NOT support AbortController signal -- must use fetchJSON directly for cancellation |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/modules/views/OnlyOffice/Scribe/
├── ScribePopover.jsx         # Modified: async handleActionSelect, 3-step state machine
├── ScribeResultPanel.jsx     # No changes
├── ScribeActionMenu.jsx      # No changes
├── ScribePromptInput.jsx     # No changes
├── ScribeFloatingButton.jsx  # No changes
├── scribeActions.js          # Minor: add prompt interpolation helper
├── scribeAI.js               # NEW: chatCompletion wrapper with signal + prompt building
├── mockTransform.js          # Kept but no longer imported by ScribePopover
└── scribe.styl               # Minor: loading state styles
```

### Pattern 1: API Call with AbortController
**What:** Call `fetchJSON` directly with an AbortController signal for cancellation support
**When to use:** Every Scribe action that calls the LLM
**Example:**
```javascript
// Source: verified from cozy-stack-client/dist/CozyStackClient.js lines 447-565
// and cozy-client/dist/models/ai.js lines 160-198

/**
 * Call LLM via cozy-stack, with AbortController support.
 * Replicates chatCompletion() but passes signal as fetch option.
 *
 * @param {CozyClient} client - from useClient()
 * @param {Array} messages - [{role: 'system', content: '...'}, {role: 'user', content: '...'}]
 * @param {Object} options - {signal: AbortController.signal}
 * @returns {Promise<string>} The AI-generated text
 */
async function callScribeAI(client, messages, { signal } = {}) {
  const requestBody = { messages }
  const response = await client.stackClient.fetchJSON(
    'POST',
    '/ai/v1/chat/completions',
    requestBody,
    { signal }
  )
  const content = response?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Empty response from AI')
  }
  return content
}
```

### Pattern 2: State Machine Extension (menu -> loading -> result)
**What:** Add intermediate `'loading'` step between menu selection and result display
**When to use:** ScribePopover state machine
**Example:**
```javascript
// Source: current ScribePopover.jsx + AIAssistantPanel.jsx reference pattern

const [step, setStep] = useState('menu') // 'menu' | 'loading' | 'result'
const [loadingMessage, setLoadingMessage] = useState('')
const abortRef = useRef(null)

const handleActionSelect = useCallback(
  async (actionId, label, breadcrumb) => {
    // 1. Transition to loading
    setStep('loading')
    setLoadingMessage(deriveLoadingMessage(actionId, label))
    setResult({ text: '', breadcrumb })

    // 2. Create AbortController
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // 3. Build messages and call API
      const messages = buildMessages(actionId, selectedText, label)
      const text = await callScribeAI(client, messages, { signal: controller.signal })

      // 4. Show result
      setResult({ text, breadcrumb })
      setStep('result')
    } catch (err) {
      if (err.name === 'AbortError') {
        // User closed popover -- do nothing
        return
      }
      // Show error in result panel
      setResult({ text: '', breadcrumb, error: 'No result received. Try again.' })
      setStep('result')
    }
  },
  [selectedText, client]
)
```

### Pattern 3: Prompt Building from Action Config
**What:** Interpolate selectedText and language into prompt templates from scribeActions.js
**When to use:** Building the messages array for each action
**Example:**
```javascript
// Source: scribeActions.js prompt field analysis

const SYSTEM_PROMPT = 'You are a writing assistant. Return only the transformed text, no explanations or commentary. Respond in the same language as the input text.'

function buildMessages(actionId, selectedText, label, extra) {
  const systemMsg = { role: 'system', content: SYSTEM_PROMPT }

  if (actionId === 'free-prompt') {
    return [
      systemMsg,
      {
        role: 'user',
        content: `Apply the following instruction to the text below. Return only the modified text.\n\nInstruction: ${label}\n\nText: ${selectedText}`
      }
    ]
  }

  // Find action config and interpolate prompt
  const action = findActionConfig(actionId)
  let prompt = action.prompt
  prompt = prompt.replace('{selectedText}', selectedText)
  if (extra?.language) {
    prompt = prompt.replace('{language}', extra.language)
  }

  return [systemMsg, { role: 'user', content: prompt }]
}
```

### Pattern 4: Cancellation on Close
**What:** Abort in-flight API request when user closes popover
**When to use:** handleClose in ScribePopover
**Example:**
```javascript
// Source: Web API AbortController + ScribePopover.handleClose analysis

const handleClose = useCallback(() => {
  // Abort any in-flight request
  if (abortRef.current) {
    abortRef.current.abort()
    abortRef.current = null
  }
  onCancel()
}, [onCancel])
```

### Anti-Patterns to Avoid
- **Passing signal through chatCompletion():** The `chatCompletion()` function merges its options into the request body. A `signal` property would end up as `{"messages": [...], "signal": {}}` in the POST body, NOT as a fetch option. Use `fetchJSON` directly.
- **Synchronous state updates after async:** After `await callScribeAI(...)`, check that the component is still mounted / popover is still open before updating state. The AbortController pattern handles this naturally -- if aborted, the catch block returns early.
- **Hardcoded loading messages:** Derive from action labels in scribeActions.js. A `deriveLoadingMessage('correct-grammar', 'Correct grammar')` should return "Correcting grammar..." not a hardcoded string per action.
- **Retrying on error in Phase 7:** Error retry is Phase 8 scope. Phase 7 shows a simple inline error. Do not build retry logic yet.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth header management | Custom auth token handling | `client.stackClient.fetchJSON()` | Handles token, refresh on 401, URL construction automatically |
| Loading spinner | Custom CSS animation | cozy-ui `Spinner` component | Consistent with rest of app; already used in View.jsx |
| Request cancellation | Custom flag/boolean to ignore response | `AbortController` + `signal` | Web standard; actually cancels the network request, not just ignores the response |
| Prompt template interpolation | Complex template engine | Simple string replacement | Prompts only have `{selectedText}` and `{language}` -- no need for a template library |

**Key insight:** The entire AI integration is ~50 lines of new code. The heavy lifting (auth, HTTP, response parsing) is already done by cozy-client and cozy-stack-client. The risk is in state management (loading/error transitions), not in API complexity.

## Common Pitfalls

### Pitfall 1: chatCompletion() Swallows AbortError
**What goes wrong:** `chatCompletion()` wraps all errors in `new Error("Failed to generate chat completion: ...")`, losing the original error type. An AbortError becomes a generic Error, making it hard to distinguish cancellation from real failures.
**Why it happens:** Line 185 in ai.js: `throw new Error("Failed to generate chat completion: ".concat(_context2.t0.message))`
**How to avoid:** Call `fetchJSON` directly instead of `chatCompletion()`. This preserves the original error, including `AbortError` with `err.name === 'AbortError'`.
**Warning signs:** Closing the popover during loading shows an error message instead of silently cancelling.

### Pitfall 2: State Updates After Unmount/Close
**What goes wrong:** If the user closes the popover while the API call is in-flight, and the AbortController fails to abort (or the response arrives between close and abort), `setStep('result')` is called on an unmounted or reset component.
**Why it happens:** React strict mode or fast close/reopen cycles.
**How to avoid:** After `await`, check a ref or use the AbortController's `signal.aborted` flag before updating state. The `useEffect` that resets state on `open` change also helps.
**Warning signs:** React "Can't perform state update on unmounted component" warning.

### Pitfall 3: Empty or Unexpected Response Format
**What goes wrong:** The API returns successfully but with no content (empty `choices` array, or `content: null`).
**Why it happens:** Model timeout, token limit reached, or API returning unexpected format.
**How to avoid:** Check `response?.choices?.[0]?.message?.content` with fallback. Show "No result received. Try again." in the result panel area.
**Warning signs:** Result panel shows empty text or `undefined`.

### Pitfall 4: Free-Prompt Label is the User's Text, Not an Action Name
**What goes wrong:** For free-prompt, `label` is the user-typed instruction, not a menu label. Using it directly as a loading message would show the user's full prompt as the loading text.
**Why it happens:** `handlePromptSubmit` calls `onSelect('free-prompt', prompt, prompt)` -- both label and breadcrumb are the prompt text.
**How to avoid:** For free-prompt, use a generic loading message like "Processing..." or "Thinking..." instead of deriving from the label.
**Warning signs:** Loading message shows the full user prompt instead of a clean status message.

### Pitfall 5: translate-custom Needs Extra Data Handling
**What goes wrong:** The `translate-custom` action gets `label` as the language name but the prompt template uses `{language}`. If `extra` is not passed correctly, `{language}` remains uninterpolated.
**Why it happens:** `handleActionSelect` currently builds `extra` only for `translate-custom` (line 44). The same logic must be preserved when building the messages array.
**How to avoid:** When `actionId === 'translate-custom'`, populate `{language}` from `label` (which contains the user-typed language name).
**Warning signs:** Translated text prompt says "Translate the following text to {language}:" literally.

## Code Examples

Verified patterns from codebase analysis:

### Response Extraction (from AIAssistantPanel reference)
```javascript
// Source: node_modules/cozy-viewer/src/Panel/AI/AIAssistantPanel.jsx lines 148-149
const summaryContent =
  response?.content || response?.choices?.[0]?.message?.content
```
Note: AIAssistantPanel checks both `response.content` and `response.choices[0].message.content`. The OpenAI format should return `choices[0].message.content`, but the double-check is a defensive pattern worth copying.

### Messages Array Structure (from AIAssistantPanel reference)
```javascript
// Source: node_modules/cozy-viewer/src/Panel/AI/AIAssistantPanel.jsx lines 86-92
const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userPrompt }
]
const response = await chatCompletion(client, messages, { stream: false })
```

### Spinner Usage (from View.jsx)
```javascript
// Source: src/modules/views/OnlyOffice/View.jsx lines 4, 123-126
import Spinner from 'cozy-ui/transpiled/react/Spinner'

<Spinner size="xxlarge" />

// Available sizes: 'tiny', 'small', 'medium', 'large', 'xlarge', 'xxlarge'
// Default color: 'var(--primaryColor)'
```

### Existing handleActionSelect (what we replace)
```javascript
// Source: src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx lines 42-50
const handleActionSelect = useCallback(
  (actionId, label, breadcrumb) => {
    const extra = actionId === 'translate-custom' ? { language: label } : undefined
    const transformed = mockTransform(actionId, selectedText, extra)
    setResult({ text: transformed, breadcrumb })
    setStep('result')
  },
  [selectedText]
)
```

### Action Config Lookup (reusable from mockTransform.js)
```javascript
// Source: src/modules/views/OnlyOffice/Scribe/mockTransform.js lines 41-70
function findActionConfig(actionId) {
  if (actionId === 'free-prompt') return FREE_PROMPT_CONFIG
  for (const action of SCRIBE_ACTIONS) {
    if (action.id === actionId) return action
    if (action.children) {
      for (const child of action.children) {
        if (child.id === actionId) return child
      }
    }
  }
  if (actionId.startsWith('translate-')) {
    const translateChildren = buildTranslateChildren('')
    for (const child of translateChildren) {
      if (child.id === actionId) return child
    }
  }
  return null
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `mockTransform()` (sync, instant) | `callScribeAI()` (async, network) | Phase 7 | Need loading state, error handling, cancellation |
| 2-step state machine (menu, result) | 3-step state machine (menu, loading, result) | Phase 7 | New loading UI between action selection and result display |

**Deprecated/outdated:**
- `mockTransform.js`: Will no longer be imported by ScribePopover after Phase 7. Can be kept for development/testing purposes but is no longer part of the production flow.

## Open Questions

1. **AbortController signal passthrough via chatCompletion()**
   - What we know: `chatCompletion()` merges options into request body, not fetch options. Signal won't work through it.
   - What's unclear: Whether the cozy-client team plans to add signal support to `chatCompletion()` in a future version.
   - Recommendation: Use `fetchJSON` directly. If `chatCompletion()` adds signal support later, refactoring is trivial (swap one function call). The user decision says "use chatCompletion()" but the cancellation requirement (LOAD-02) necessitates the lower-level call. Document this deviation clearly.

2. **Error response format from cozy-stack**
   - What we know: `fetchJSON` throws `FetchError` with `response` and `reason` properties when the HTTP response is not OK.
   - What's unclear: The exact error body format for 429 (rate limit), 500 (server error), and other failure modes from the AI endpoint specifically.
   - Recommendation: For Phase 7, treat all errors the same way (show generic error message). Phase 8 will differentiate error types for retry logic.

3. **Token/response timeout**
   - What we know: No explicit timeout is configured in `fetchJSON` or the browser fetch API by default.
   - What's unclear: Whether cozy-stack has a server-side timeout for AI proxy requests, and how long typical responses take.
   - Recommendation: For Phase 7, rely on the default browser timeout (typically ~2 minutes). If responses are routinely slow, consider adding a client-side timeout in Phase 8.

## Sources

### Primary (HIGH confidence)
- `cozy-client/dist/models/ai.js` - Verified `chatCompletion()` implementation: lines 160-198 show it calls `fetchJSON('POST', '/ai/v1/chat/completions', requestBody)` with NO 4th argument for fetch options
- `cozy-client/types/models/ai.d.ts` - Full TypeScript type definitions for ChatMessage, ChatCompletionResponse, ChatCompletionOptions
- `cozy-stack-client/dist/CozyStackClient.js` - Verified `fetchJSON` accepts 4th `options` arg (line 458), passes through to `fetch` (line 547), which passes to browser fetch (line 270); signal IS supported
- `cozy-viewer/src/Panel/AI/AIAssistantPanel.jsx` - Reference implementation: uses `chatCompletion(client, messages, { stream: false })`, extracts content via `response?.choices?.[0]?.message?.content`
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` - Current state machine: 2-step (menu/result), sync `mockTransform()` call at lines 42-50
- `src/modules/views/OnlyOffice/Scribe/scribeActions.js` - All action prompt templates verified: each has `{selectedText}` placeholder, translate has `{language}` placeholder
- `src/modules/views/OnlyOffice/Scribe/mockTransform.js` - `findActionConfig()` helper reusable for prompt lookup
- `cozy-ui/transpiled/react/Spinner/index.js` - Spinner component: sizes tiny/small/medium/large/xlarge/xxlarge, default color `var(--primaryColor)`

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` - Previous research confirming `POST /ai/v1/chat/completions` exists in cozy-stack as OpenAI-compatible proxy
- `.planning/research/SUMMARY.md` - Previous research confirming frontend-only approach, no new packages needed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries verified in node_modules, API signatures confirmed from source code
- Architecture: HIGH - integration point precisely identified (ScribePopover.handleActionSelect), reference implementation (AIAssistantPanel) analyzed
- Pitfalls: HIGH - AbortController/signal limitation in chatCompletion() discovered through source code analysis, not speculation

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- cozy-client models/ai.js unlikely to change significantly)
