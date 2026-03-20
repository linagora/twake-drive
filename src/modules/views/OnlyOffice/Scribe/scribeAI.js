/**
 * Scribe AI module — LLM API call wrapper, prompt builder, and loading message derivation.
 *
 * Calls POST /ai/v1/chat/completions via client.stackClient.fetchJSON() directly
 * (not chatCompletion()) to support AbortController signal for request cancellation.
 *
 * Exports: callScribeAI, buildMessages, deriveLoadingMessage, classifyScribeError, SYSTEM_PROMPT
 *
 * deriveLoadingMessage returns { key, params? } i18n descriptors (not strings).
 * classifyScribeError returns { messageKey, canRetry } with i18n keys (not strings).
 */

import {
  SCRIBE_ACTIONS,
  FREE_PROMPT_CONFIG,
  buildTranslateChildren
} from '@/modules/views/OnlyOffice/Scribe/scribeActions'
import { htmlToMarkdown } from '@/modules/views/OnlyOffice/Scribe/scribeConversion'

/**
 * System prompt framing Scribe as a writing assistant.
 * Prompt templates stay in English; output language handled by system prompt.
 */
export const SYSTEM_PROMPT =
  'You are a writing assistant. Return only the transformed text, no explanations or commentary. Preserve any Markdown formatting (bold, italic, lists, headings) present in the input. Respond in the same language as the input text.'

/**
 * Search SCRIBE_ACTIONS (including children and dynamic translate children)
 * for an action matching the given id.
 *
 * Reused from mockTransform.js pattern.
 *
 * @param {string} actionId
 * @returns {Object|null} The action config object, or null if not found
 */
function findActionConfig(actionId) {
  if (actionId === 'free-prompt') {
    return FREE_PROMPT_CONFIG
  }

  for (const action of SCRIBE_ACTIONS) {
    if (action.id === actionId) {
      return action
    }
    if (action.children) {
      for (const child of action.children) {
        if (child.id === actionId) {
          return child
        }
      }
    }
  }

  // Check dynamic translate children (not in static SCRIBE_ACTIONS)
  if (actionId.startsWith('translate-')) {
    const translateChildren = buildTranslateChildren('')
    for (const child of translateChildren) {
      if (child.id === actionId) {
        return child
      }
    }
  }

  return null
}

/**
 * Build the messages array for a Scribe AI call.
 *
 * @param {string} actionId - The action identifier from scribeActions.js
 * @param {string} selectedText - The text selected in the editor
 * @param {string} label - Display label (for free-prompt: the user's instruction; for translate-custom: the language name)
 * @param {Object} [extra] - Extra data (e.g. { language: 'Spanish' } for translate-custom)
 * @returns {Array<{role: string, content: string}>} Messages array for the AI endpoint
 */
export function buildMessages(actionId, selectedText, label, extra) {
  // Prepend system instructions to user message (single user role)
  // to avoid issues with RAG backends that may not support the system role
  const systemPrefix = SYSTEM_PROMPT + '\n\n'

  // Prefer enrichedMd (plugin-side extraction) > htmlToMarkdown(html) > plain text
  const textForPrompt = extra?.enrichedMd || (extra?.html ? htmlToMarkdown(extra.html) : selectedText)

  // Free-prompt: wrap user instruction with guardrail template
  if (actionId === 'free-prompt') {
    return [
      {
        role: 'user',
        content: `${systemPrefix}Apply the following instruction to the text below. Return only the modified text.\n\nInstruction: ${label}\n\nText: ${textForPrompt}`
      }
    ]
  }

  // All other actions: look up config and interpolate prompt template
  const action = findActionConfig(actionId)
  if (!action || !action.prompt) {
    // Fallback: send selectedText as-is with label as instruction
    return [
      {
        role: 'user',
        content: `${systemPrefix}${label}:\n\n${textForPrompt}`
      }
    ]
  }

  let prompt = action.prompt
  prompt = prompt.replace('{selectedText}', textForPrompt)

  // translate-custom: label contains the user-typed language name (Pitfall 5)
  if (actionId === 'translate-custom') {
    prompt = prompt.replace('{language}', label)
  }

  // Also handle extra.language for any translate action
  if (extra && extra.language) {
    prompt = prompt.replace('{language}', extra.language)
  }

  return [{ role: 'user', content: `${systemPrefix}${prompt}` }]
}

/**
 * Call the LLM via cozy-stack with AbortController support.
 *
 * Uses fetchJSON directly instead of chatCompletion() because
 * chatCompletion() merges options into request body, preventing
 * AbortController signal passthrough (Pitfall 1 in research).
 *
 * @param {Object} client - CozyClient instance from useClient()
 * @param {Array<{role: string, content: string}>} messages - System + user messages
 * @param {Object} [options] - { signal: AbortController.signal }
 * @returns {Promise<string>} The AI-generated text content
 * @throws {Error} If response is empty
 * @throws {DOMException} AbortError if request was cancelled
 * @throws {FetchError} If HTTP request fails
 */
export async function callScribeAI(client, messages, { signal } = {}) {
  const response = await client.stackClient.fetchJSON(
    'POST',
    '/ai/v1/chat/completions',
    { messages, temperature: 0.3 },
    { signal }
  )

  // Defensive double-check pattern from AIAssistantPanel
  const content =
    response?.content || response?.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Empty response from AI')
  }

  return content
}

/**
 * Map of action IDs to their i18n loading message keys.
 */
const LOADING_KEYS = {
  'correct-grammar': 'Scribe.loading.correct_grammar',
  'tone-professional': 'Scribe.loading.tone_professional',
  'tone-casual': 'Scribe.loading.tone_casual',
  'tone-polite': 'Scribe.loading.tone_polite',
  'improve-shorter': 'Scribe.loading.improve_shorter',
  'improve-expand': 'Scribe.loading.improve_expand',
  'improve-emojify': 'Scribe.loading.improve_emojify',
  'improve-bullets': 'Scribe.loading.improve_bullets'
}

/**
 * Derive a loading message descriptor for a Scribe action.
 *
 * Returns an object with { key, params? } so the caller can resolve
 * the translated string via t(result.key, result.params).
 *
 * @param {string} actionId - The action identifier
 * @param {string} label - The action's display label (used as language name for translate actions)
 * @returns {{ key: string, params?: Object }} i18n descriptor for the loading message
 */
export function deriveLoadingMessage(actionId, label) {
  // Free-prompt: label is the user's full prompt, not suitable for display
  if (actionId === 'free-prompt') {
    return { key: 'Scribe.loading.processing' }
  }

  // Translate actions: use interpolated "Translating to %{language}..." pattern
  if (actionId.startsWith('translate-')) {
    return { key: 'Scribe.translate.translating_to', params: { language: label } }
  }

  // Known action IDs: map to i18n loading key
  if (LOADING_KEYS[actionId]) {
    return { key: LOADING_KEYS[actionId] }
  }

  // Fallback for unknown IDs
  return { key: 'Scribe.loading.processing' }
}

/**
 * Classify a Scribe AI error into an i18n message key and retry eligibility.
 *
 * Returns { messageKey, canRetry } so the caller can resolve the translated
 * error string via t(result.messageKey).
 *
 * @param {Error} err - The error thrown by callScribeAI
 * @returns {{ messageKey: string, canRetry: boolean }}
 */
export function classifyScribeError(err) {
  // AbortError: user cancelled — handled upstream, safety catch
  if (err.name === 'AbortError') {
    return { messageKey: '', canRetry: false }
  }

  // FetchError from cozy-stack-client (check by name, not instanceof)
  if (err.name === 'FetchError' && typeof err.status === 'number') {
    if (err.status === 401 || err.status === 403) {
      return { messageKey: 'Scribe.error.auth', canRetry: false }
    }
    if (err.status === 429) {
      return { messageKey: 'Scribe.error.rate_limit', canRetry: true }
    }
    if (err.status >= 500) {
      return { messageKey: 'Scribe.error.server', canRetry: true }
    }
    return { messageKey: 'Scribe.error.generic', canRetry: false }
  }

  // Network errors (TypeError or fetch failure messages)
  if (
    err instanceof TypeError ||
    (err.message &&
      (err.message.includes('Failed to fetch') ||
        err.message.includes('Network request failed')))
  ) {
    return { messageKey: 'Scribe.error.network', canRetry: true }
  }

  // Empty response from AI
  if (err.message === 'Empty response from AI') {
    return { messageKey: 'Scribe.error.empty_response', canRetry: true }
  }

  // Default: unexpected error, allow retry
  return { messageKey: 'Scribe.error.unexpected', canRetry: true }
}
