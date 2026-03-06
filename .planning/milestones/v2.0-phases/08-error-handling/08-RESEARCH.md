# Phase 8: Error Handling - Research

**Researched:** 2026-03-06
**Domain:** Error classification, retry logic, FetchError handling in cozy-stack-client
**Confidence:** HIGH

## Summary

Phase 8 adds error classification and user-facing error states to ScribePopover. The existing code already catches errors in `handleActionSelect` (ScribePopover.jsx lines 84-91) but currently shows a generic "No result received. Try again." message for all failures. The work involves: (1) classifying errors by HTTP status from `FetchError`, (2) adding a retry mechanism that re-fires the same request for transient errors, and (3) showing a non-retryable message for auth/config errors.

The cozy-stack-client `FetchError` class (verified in `node_modules/cozy-stack-client/dist/errors.js`) exposes `err.status` (HTTP status code), `err.message`, `err.reason`, and `err.url`. The `fetchJSON` method already handles token refresh for 401 internally (tries once to refresh, then throws if refresh fails). This means a `FetchError` with status 401 reaching our catch block means the token is truly invalid -- a permanent error.

**Primary recommendation:** Classify errors into transient (429, 500, 502, 503, 504, network/TypeError) vs permanent (401, 403, 404, empty response). Add an `onRetry` callback to ScribeResultPanel for transient errors. Store the last action parameters so retry can re-fire without user re-selecting.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ERR-01 | User sees clear error message when API call fails (network error, server error, timeout) | FetchError provides `status` for HTTP errors; network errors are TypeError/plain Error; classify and map to user-facing messages |
| ERR-02 | User can retry after a transient error (429 rate limit, 500 server error, network) | Store last action params (actionId, label, breadcrumb, extra) in state; retry callback re-invokes handleActionSelect with same params |
| ERR-03 | User sees appropriate non-retryable message for auth/config errors (401, 403) | FetchError.status === 401 or 403 after fetchJSON's internal token refresh has already failed; show permanent error without retry button |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cozy-stack-client | (installed) | FetchError class with `.status`, `.message`, `.reason` | Already used by callScribeAI via fetchJSON |
| cozy-ui Buttons | (installed) | Retry button rendering | Already used in ScribeResultPanel |

### Supporting
No additional libraries needed. Error handling is pure logic on top of existing FetchError.

## Architecture Patterns

### Error Classification Function

Create a pure function `classifyScribeError(err)` in `scribeAI.js` that returns a structured error object:

```javascript
// In scribeAI.js

/**
 * Classify an error from callScribeAI into a user-facing error descriptor.
 *
 * @param {Error} err - The caught error
 * @returns {{ message: string, canRetry: boolean }}
 */
export function classifyScribeError(err) {
  // AbortError is handled upstream (popover close) -- should not reach here
  if (err.name === 'AbortError') {
    return { message: '', canRetry: false }
  }

  // FetchError from cozy-stack-client has .status
  if (err.name === 'FetchError' && err.status) {
    // Permanent auth/config errors
    if (err.status === 401 || err.status === 403) {
      return {
        message: 'Authorization error. Please check your Cozy permissions.',
        canRetry: false
      }
    }
    // Rate limited
    if (err.status === 429) {
      return {
        message: 'Too many requests. Please wait a moment and try again.',
        canRetry: true
      }
    }
    // Server errors (transient)
    if (err.status >= 500) {
      return {
        message: 'The AI service is temporarily unavailable. Please try again.',
        canRetry: true
      }
    }
    // Other HTTP errors (404, 422, etc.) -- likely config issues
    return {
      message: 'Something went wrong. Please try again later.',
      canRetry: false
    }
  }

  // Network errors (TypeError: Failed to fetch, or generic Error)
  if (err.name === 'TypeError' || err.message === 'Failed to fetch' || err.message === 'Network request failed') {
    return {
      message: 'Network error. Check your connection and try again.',
      canRetry: true
    }
  }

  // Our own "Empty response from AI" error
  if (err.message === 'Empty response from AI') {
    return {
      message: 'No result received. Please try again.',
      canRetry: true
    }
  }

  // Unknown errors
  return {
    message: 'An unexpected error occurred. Please try again.',
    canRetry: true
  }
}
```

### ScribePopover State Changes

The result state already has an `error` field. Extend with `canRetry` boolean and store last action params for retry:

```javascript
// Current state shape:
const [result, setResult] = useState({ text: '', breadcrumb: '', error: '' })

// New state shape:
const [result, setResult] = useState({ text: '', breadcrumb: '', error: '', canRetry: false })
const [lastAction, setLastAction] = useState(null) // { actionId, label, breadcrumb }
```

In `handleActionSelect`, store the action params before calling AI, then on error:

```javascript
catch (err) {
  if (err.name === 'AbortError') return
  const classified = classifyScribeError(err)
  setResult({ text: '', breadcrumb, error: classified.message, canRetry: classified.canRetry })
  setStep('result')
}
```

### ScribeResultPanel Error State

ScribeResultPanel needs to handle error vs success differently:
- **Success:** Show Insert + Replace buttons (current behavior)
- **Error with retry:** Show error message + Retry button + Close button
- **Error without retry:** Show error message + Close button only

```javascript
// ScribeResultPanel receives new props:
// error: string (empty = no error)
// canRetry: boolean
// onRetry: function (only called when canRetry is true)

// When error is truthy:
// - Hide Insert/Replace buttons
// - Show error message in the text area (with error styling)
// - Show Retry button if canRetry
// - Always show Close button
```

### Retry Flow

Retry re-invokes `handleActionSelect` with the stored `lastAction` params. This reuses the same loading state, AbortController, and error handling path -- no duplicate logic.

```javascript
const handleRetry = useCallback(() => {
  if (lastAction) {
    handleActionSelect(lastAction.actionId, lastAction.label, lastAction.breadcrumb)
  }
}, [lastAction, handleActionSelect])
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP status classification | Custom fetch wrapper | Check `err.name === 'FetchError'` and `err.status` | cozy-stack-client already throws FetchError with status |
| Token refresh/retry for 401 | Manual token refresh | Built into `fetchJSON` | fetchJSON already retries once with refreshed token before throwing |
| Toast/snackbar errors | Global error notification | Inline error in result panel | Scribe popover is a self-contained UI; errors belong inside it |

**Key insight:** cozy-stack-client's `fetchJSON` already handles token refresh internally. A 401 FetchError reaching our catch block means the token is permanently invalid -- do not retry.

## Common Pitfalls

### Pitfall 1: Retrying 401 errors
**What goes wrong:** Treating 401 as transient and offering retry, causing infinite retry loops
**Why it happens:** `fetchJSON` already attempts token refresh internally before throwing
**How to avoid:** Classify 401 as permanent (non-retryable). The user needs to re-authenticate.
**Warning signs:** Retry button appearing for auth errors

### Pitfall 2: Losing action context on retry
**What goes wrong:** User clicks Retry but the action params (actionId, label, breadcrumb) are lost
**Why it happens:** `handleActionSelect` receives params from the menu callback; retry has no menu
**How to avoid:** Store `lastAction` in state when starting an action, before the API call
**Warning signs:** Retry doing nothing or throwing an error

### Pitfall 3: Insert/Replace buttons showing during error state
**What goes wrong:** Error text appears in result area but Insert/Replace buttons are still active
**Why it happens:** ScribeResultPanel currently renders buttons unconditionally
**How to avoid:** Conditionally render action buttons only when `!error`; show Retry/Close for errors
**Warning signs:** User inserting error text into their document

### Pitfall 4: Network errors not being TypeError
**What goes wrong:** Some network errors are plain `Error` not `TypeError`
**Why it happens:** Different browsers throw different error types for network failures
**How to avoid:** Check both `err.name === 'TypeError'` and common network error messages
**Warning signs:** Network errors showing generic "unexpected error" message

### Pitfall 5: AbortError during retry
**What goes wrong:** User clicks Retry, then immediately closes popover -- old AbortController already nulled
**Why it happens:** Retry creates a new AbortController via `handleActionSelect`, which is correct
**How to avoid:** The existing `handleActionSelect` creates a fresh AbortController each time -- retry is safe
**Warning signs:** None if using existing handleActionSelect flow

## Code Examples

### FetchError shape (from cozy-stack-client/dist/errors.js)

```javascript
// Source: node_modules/cozy-stack-client/dist/errors.js (verified)
class FetchError extends Error {
  constructor(response, reason) {
    super()
    this.name = 'FetchError'
    this.response = response  // The fetch Response object
    this.url = response.url
    this.status = response.status  // HTTP status code (number)
    this.reason = reason  // Parsed response body
    this.message = getReasonMessage(reason, wwwAuthenticateErrorMessage)
  }
}
```

### fetchJSON token retry behavior (from CozyStackClient.js)

```javascript
// Source: node_modules/cozy-stack-client/dist/CozyStackClient.js (verified)
// fetchJSON:
//   1. Calls fetchJSONWithCurrentToken (throwFetchErrors = true)
//   2. On FetchError: checks if token expired
//   3. If expired: refreshes token, retries fetchJSONWithCurrentToken once
//   4. If refresh fails or second attempt fails: throws FetchError
//
// Implication: a 401 reaching our catch block is NOT retryable
```

### Existing error handling pattern in cozy-drive (upload module)

```javascript
// Source: src/modules/upload/index.js (verified)
// Pattern: switch on error.status for different behaviors
} else if (error.status in statusError) {
  status = statusError[error.status]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic error string | Classified error with retry flag | Phase 8 | Users can self-recover from transient failures |
| Single error message | Different messages per error type | Phase 8 | Users understand what went wrong |

## Open Questions

1. **Timeout duration for API calls**
   - What we know: No explicit timeout is set on the fetch call currently
   - What's unclear: How long until the RAG backend times out server-side
   - Recommendation: Do not add a client-side timeout in Phase 8. If the server times out, it returns a 504/502 which is already handled as transient. Adding client-side timeout is a separate concern.

2. **Error message language**
   - What we know: I18N is Phase 9; current strings are hardcoded English
   - What's unclear: Whether French-speaking users will see English error messages before Phase 9
   - Recommendation: Hardcode English error messages (consistent with Phase 7 approach). Phase 9 will wrap all strings in i18n.

## Sources

### Primary (HIGH confidence)
- `node_modules/cozy-stack-client/dist/errors.js` - FetchError class shape, properties
- `node_modules/cozy-stack-client/dist/CozyStackClient.js` - fetchJSON token refresh logic, throwFetchErrors behavior
- `src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx` - Current error handling stub
- `src/modules/views/OnlyOffice/Scribe/scribeAI.js` - callScribeAI throw behavior
- `src/modules/views/OnlyOffice/Scribe/ScribeResultPanel.jsx` - Current result panel (no error/retry props)

### Secondary (MEDIUM confidence)
- `src/modules/upload/index.js` - Pattern for switching on error.status in this codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries, verified FetchError shape from source code
- Architecture: HIGH - Pure function classification + stored action state for retry, straightforward React patterns
- Pitfalls: HIGH - Verified fetchJSON token refresh behavior from source code; 401 non-retryable is confirmed

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- cozy-stack-client error handling unlikely to change)
