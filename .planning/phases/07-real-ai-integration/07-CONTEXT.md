# Phase 7: Real AI Integration - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace mock transforms with live LLM calls via cozy-stack, with loading feedback and cancellation. User gets real AI-generated text from Scribe actions instead of mock placeholders. Streaming UX (token-by-token), regeneration, and detailed error handling are separate phases.

</domain>

<decisions>
## Implementation Decisions

### API call approach
- Use `chatCompletion()` from `cozy-client/dist/models/ai` — handles auth, URL construction, hits `POST /ai/v1/chat/completions`
- Same function already used by cozy-viewer's AIAssistantPanel — proven in the ecosystem
- Non-streaming: send request, await full response, display result. Streaming deferred to future milestone
- Access cozy-client instance via `useClient()` hook inside ScribePopover (already in CozyProvider tree)
- Frontend builds prompts: interpolate `{selectedText}` (and `{language}` for translate) into existing `scribeActions.js` prompt templates before calling chatCompletion()
- No backend/cozy-stack changes required

### Loading experience
- Show a spinner + action-specific loading message ("Rewriting...", "Translating to English...", "Simplifying...")
- Derive loading message from the action label in scribeActions.js
- New step in ScribePopover state machine: `'menu'` | `'loading'` | `'result'`
- Cancellation via AbortController: create signal on API call, abort on popover close
- No explicit cancel button — closing the popover (X button or click outside) cancels the in-flight request
- Insert/Replace buttons disabled during loading

### Prompt design
- System message framing Scribe as a writing assistant: "You are a writing assistant. Return only the transformed text, no explanations or commentary."
- System prompt includes: "Respond in the same language as the input text" — critical for French-first Cozy Cloud users
- Prompt templates stay in English (better LLM instruction-following) — output language handled by system prompt
- Free-prompt action wrapped with guardrails: "Apply the following instruction to the text below. Return only the modified text.\n\nInstruction: {userPrompt}\n\nText: {selectedText}"
- Translate-custom: `{language}` placeholder interpolated from user-typed language name (same flow as current `extra.language`)

### Result handling
- Same ScribeResultPanel layout as mock — breadcrumb trail, text area (pre-wrap), Insert/Replace/Close buttons
- Real AI text appears where mock text used to appear — minimal UI changes
- Empty/unexpected response: show inline error message in result panel area ("No result received. Try again.")
- Detailed error handling (retry, error types, network vs auth) is Phase 8 scope
- No regenerate button in Phase 7 (STREAM-03 is a future requirement)
- No artificial length limit or max_tokens — let the LLM produce natural-length output

### Claude's Discretion
- Exact spinner component choice (cozy-ui Spinner vs custom)
- How to structure the messages array for chatCompletion() (system + user message ordering)
- Exact wording of the system prompt (the intent is captured above)
- Error message wording for empty/failed responses
- Whether to add a subtle transition animation between loading and result states

</decisions>

<specifics>
## Specific Ideas

- The integration point is a single function: `mockTransform()` in `ScribePopover.jsx` line ~42-50 — this becomes an async call to `chatCompletion()`
- `scribeActions.js` already has complete `prompt` fields per action with `{selectedText}` placeholders — these become the real LLM prompts
- cozy-viewer's `AIAssistantPanel` is the reference implementation for calling `chatCompletion()` in this ecosystem
- Loading messages should feel natural: "Rewriting..." not "Processing your request..."

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `chatCompletion()` from `cozy-client/dist/models/ai`: proven API call function, handles auth + URL
- `scribeActions.js` prompt templates: complete prompts per action, ready for LLM use
- `useClient()` hook: standard way to access cozy-client in React components
- `cozy-ui` Spinner component: available for loading indicator
- ScribeResultPanel: existing result display, reusable as-is

### Established Patterns
- `client.getStackClient().fetch()` for raw HTTP calls (if chatCompletion needs extension)
- AbortController for fetch cancellation (standard Web API, supported by cozy-stack-client)
- State machine pattern in ScribePopover (`step` state variable) — extend with `'loading'` step

### Integration Points
- `ScribePopover.handleActionSelect()`: the exact function to make async — currently calls `mockTransform()` synchronously
- `chatCompletion(client, messages)`: the API function to call, returns `response.choices[0].message.content`
- Plugin code (`code.js`): requires zero changes — intent/response protocol already handles arbitrary text

</code_context>

<deferred>
## Deferred Ideas

- Streaming UX (token-by-token text appearance) — STREAM-01/02/03, future milestone
- Regenerate button — STREAM-03, future milestone
- Diff view (original vs AI text side-by-side) — potential future enhancement
- Server-side prompt templates — could revisit if prompt management becomes complex

</deferred>

---

*Phase: 07-real-ai-integration*
*Context gathered: 2026-03-03*
