/**
 * Scribe AI module — LLM API call wrapper, prompt builder, and loading message derivation.
 *
 * Calls POST /ai/v1/chat/completions via client.stackClient.fetchJSON() directly
 * (not chatCompletion()) to support AbortController signal for request cancellation.
 *
 * Exports: callScribeAI, buildMessages, deriveLoadingMessage, SYSTEM_PROMPT
 */

import {
  SCRIBE_ACTIONS,
  FREE_PROMPT_CONFIG,
  buildTranslateChildren
} from '@/modules/views/OnlyOffice/Scribe/scribeActions'

/**
 * System prompt framing Scribe as a writing assistant.
 * Prompt templates stay in English; output language handled by system prompt.
 */
export const SYSTEM_PROMPT =
  'You are a writing assistant. Return only the transformed text, no explanations or commentary. Respond in the same language as the input text.'

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

  // Free-prompt: wrap user instruction with guardrail template
  if (actionId === 'free-prompt') {
    return [
      {
        role: 'user',
        content: `${systemPrefix}Apply the following instruction to the text below. Return only the modified text.\n\nInstruction: ${label}\n\nText: ${selectedText}`
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
        content: `${systemPrefix}${label}:\n\n${selectedText}`
      }
    ]
  }

  let prompt = action.prompt
  prompt = prompt.replace('{selectedText}', selectedText)

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
 * Derive a user-friendly loading message for a Scribe action.
 *
 * @param {string} actionId - The action identifier
 * @param {string} label - The action's display label
 * @returns {string} Loading message (e.g. "Correcting grammar...")
 */
export function deriveLoadingMessage(actionId, label) {
  // Free-prompt: label is the user's full prompt, not suitable for display (Pitfall 4)
  if (actionId === 'free-prompt') {
    return 'Processing...'
  }

  // Translate actions: use explicit "Translating to..." pattern
  if (actionId.startsWith('translate-')) {
    return `Translating to ${label}...`
  }

  // Known action labels: map to natural gerund form
  const loadingMessages = {
    'Correct grammar': 'Correcting grammar...',
    'More professional': 'Making it more professional...',
    'More casual': 'Making it more casual...',
    'More polite': 'Making it more polite...',
    'Make it shorter': 'Making it shorter...',
    'Expand context': 'Expanding context...',
    'Emojify': 'Emojifying...',
    'Transform to bullets': 'Transforming to bullets...'
  }

  if (loadingMessages[label]) {
    return loadingMessages[label]
  }

  // Fallback: use label directly with ellipsis
  return `${label}...`
}
