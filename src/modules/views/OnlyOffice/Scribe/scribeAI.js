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
import { parseScribeResponse } from '@/modules/views/OnlyOffice/Scribe/scribeResponse'

/**
 * System prompt framing Scribe as a writing assistant.
 * Prompt templates stay in English; output language handled by system prompt.
 */
export const SYSTEM_PROMPT =
  'You are a writing assistant. Return only the transformed text, no explanations or commentary. ' +
  'Preserve all Markdown formatting and HTML tags exactly as structured in the input. ' +
  'Key rules for formatting markers: ' +
  '(1) Each formatted segment is self-contained — markers open and close within the same segment (e.g. <u>**bold underlined**</u>, never **<u>bold underlined</u>**). ' +
  '(2) Adjacent <u> tags are intentional — do NOT merge </u><u> into a single <u>...</u>. ' +
  '(3) Adjacent links to the same URL are intentional — do NOT merge [a](url)[b](url) into [ab](url). ' +
  '(4) Nesting order is always: <u> outermost, then [link], then ~~, then **, then *, then ` innermost. ' +
  '(5) If you add or rewrite text that should carry formatting from adjacent segments, replicate the same marker structure. ' +
  'Respond in the same language as the input text.'

/**
 * Shared, surface-agnostic response-contract CORE (D-01, hardened "v2" after the
 * v3.1-03 HARD GATE — see v3.1-03-GATE.md). BOTH surfaces (inline popover + chat)
 * compose this SAME core, then append exactly one surface-specific clause
 * (CARDINALITY_INLINE or CARDINALITY_CHAT) plus the shared marker-preservation
 * clauses. This unification makes the gate-validated separation rules apply to
 * both surfaces by construction — previously the two surfaces hand-maintained two
 * divergent copies, so the hardening only landed on inline.
 *
 * The core asserts the SEPARATION imperatively (insertable text lives ONLY in
 * `fragments`, never duplicated in `discussion`). The pre-gate v1 wording only
 * *implied* it, which let Mistral-Small duplicate / dump-into-discussion (gate
 * evidence: v1 dup 34%, preamble 21.4%, 1 split table).
 */
export const RESPONSE_CONTRACT_CORE =
  'Return ONLY a JSON object with exactly two keys: `discussion` (a string) and ' +
  '`fragments` (an array of strings). No prose, no code fences, no text outside the JSON. ' +
  'Insertable/transformed text goes inside `fragments` and ONLY there — `discussion` ' +
  'MUST NOT contain or repeat it. Inside `discussion` you may place `{{fragment:N}}` ' +
  'position markers (0-indexed); marker `{{fragment:N}}` resolves to `fragments[N]`.'

/**
 * Inline (popover) cardinality clause: a one-shot transform yields exactly one
 * fragment and a terse note. Appended to RESPONSE_CONTRACT_CORE by buildMessages.
 * Leading space — concatenated directly after the core.
 */
export const CARDINALITY_INLINE =
  ' `discussion` is a SHORT one-sentence note to the user. Return EXACTLY ONE ' +
  'fragment holding the complete transformed text. Never leave `fragments` empty, ' +
  'and never put the transformed text in `discussion`. ' +
  'Example: {"discussion":"Here is the result: {{fragment:0}}","fragments":["the transformed text"]}.'

/**
 * Chat cardinality clause: a conversation yields 0..N fragments and a free-form
 * discussion. Appended to RESPONSE_CONTRACT_CORE by buildChatSystemPrompt.
 */
export const CARDINALITY_CHAT =
  ' `discussion` is conversational markdown and may be free-form. You may return ' +
  '0..N fragments: put any insertable content in `fragments` (never duplicated in ' +
  '`discussion`); when nothing is meant to be inserted, return an empty `fragments` ' +
  'array and answer entirely in `discussion`. ' +
  'Example: {"discussion":"Sure — here is a tighter intro:\\n\\n{{fragment:0}}\\n\\nLet me know if you want it shorter.","fragments":["Our platform helps teams ship faster."]}'

/**
 * Chat persona (conversational variant of the inline SYSTEM_PROMPT role line).
 */
export const CHAT_PERSONA =
  'You are a helpful writing assistant. Help the user with their writing tasks. ' +
  "Respond in the same language as the user's message. Use Markdown formatting when appropriate."

/**
 * Surface-agnostic marker-preservation clauses, appended when the input markdown
 * carries the OO plugin's structural markers. SHARED by both surfaces — the chat
 * path previously had NONE, a latent table/REF corruption risk. Marker tests
 * mirror scribeProbe.deriveContentTags and the gate-harness prompt guard.
 *
 * @param {string} md - markdown the model will transform (enrichedMd inline; selection md chat)
 * @returns {string} concatenated clauses (each leading-space-prefixed), or ''
 */
export function markerPreservationClauses(md) {
  const s = typeof md === 'string' ? md : ''
  let out = ''
  if (s.includes('[TABLE:') || s.includes('[CELL:')) {
    out += ' Inside the fragment string(s) (never in `discussion`), preserve all [TABLE:N]...[/TABLE] and [CELL:r,c]...[/CELL] markers exactly as-is. Only modify the text content between the opening [CELL:r,c] and closing [/CELL] tags. Do not add, remove, or reorder [TABLE:N] or [CELL:r,c] markers. Keep each [TABLE:N]...[/TABLE] block WHOLE inside a SINGLE fragment — never split one table across several fragments, and never place any table or cell content in `discussion`.'
  }
  if (s.includes('[^scribe-fn-')) {
    out += ' Inside the fragment string(s) (never in `discussion`), preserve all [^scribe-fn-N] footnote reference markers exactly as-is. Do NOT add footnote definitions ([^N]: text). The footnote content is managed separately — only preserve the inline reference markers.'
  }
  if (s.includes('{{REF:')) {
    out += ' Inside the fragment string(s) (never in `discussion`), preserve all {{REF:scribe-ref-N:visible text}} cross-reference markers. Keep the {{REF:scribe-ref-N: and closing }} delimiters intact. You may modify the visible text inside the marker to match your changes (e.g. translation), but never remove or alter the scribe-ref-N identifier.'
  }
  return out
}

/**
 * Single source of truth for turning a document selection into the markdown the
 * model receives — shared by BOTH surfaces (inline popover + side-panel chat) so a
 * table/REF/footnote selection is encoded, and protected, identically wherever it
 * is triggered. Preference order: structured plugin `enrichedMd` (carries the
 * [TABLE:N]/[CELL:r,c] markers) > `htmlToMarkdown(html)` > plain `text`. The
 * marker-preservation clauses key off the SAME md it returns, so the two can never
 * drift apart per surface.
 *
 * @param {{enrichedMd?: string, html?: string, text?: string}} sel
 * @returns {{selectionMd: string, markerClauses: string}}
 */
export function encodeSelectionForPrompt(sel) {
  const enrichedMd = (sel && sel.enrichedMd) || ''
  const html = (sel && sel.html) || ''
  const text = (sel && sel.text) || ''
  const selectionMd = enrichedMd || (html ? htmlToMarkdown(html) : text)
  return { selectionMd, markerClauses: markerPreservationClauses(selectionMd) }
}

/**
 * D-05 (v3.2-02) — LIGHT additive context framing. A SHORT, conditional English
 * announcement of which context sources are actually included THIS turn, driven by
 * explicit per-source flags. This is the SEED only: it deliberately does NOT build
 * the full enumerated "1. history 2. selection 3. document + judge relevance" frame
 * (that is v3.2-03), does NOT incite meta-commentary, does NOT instruct the model to
 * mention/list the provided contexts in its reply, and MUST NOT weaken or contradict
 * RESPONSE_CONTRACT_CORE's JSON-only / separation imperative. One short sentence per
 * included source, each leading-space-prefixed so it appends cleanly AFTER the
 * contiguous contract block.
 *
 * @param {{ includeSelection?: boolean, includeDiscussion?: boolean }} flags
 * @returns {string} concatenated announcement (each leading-space-prefixed), or ''
 */
function contextSourceFraming({ includeSelection, includeDiscussion } = {}) {
  let out = ''
  if (includeSelection) {
    out +=
      ' The user may include a selection from the document in their message; ' +
      'use what is relevant to their request and ignore the rest.'
  }
  if (includeDiscussion) {
    out +=
      ' Earlier turns of this conversation are provided above for context.'
  }
  return out
}

/**
 * Build the chat system prompt: persona + shared hardened contract core + chat
 * cardinality + (conditional) marker-preservation for the current selection + the
 * (conditional) D-05 context-source framing.
 *
 * The framing is appended AFTER the contiguous RESPONSE_CONTRACT_CORE + CARDINALITY_CHAT
 * + marker-clauses block so the hard-gated contract stays intact. With no flags (or
 * both false) the output is BYTE-IDENTICAL to the pre-v3.2-02 prompt — existing call
 * sites/tests that pass only selectionMd keep their exact output (regression safety).
 *
 * @param {string} [selectionMd] - current turn's selection markdown (for marker clauses)
 * @param {{ includeSelection?: boolean, includeDiscussion?: boolean }} [flags]
 * @returns {string}
 */
export function buildChatSystemPrompt(selectionMd, flags) {
  return (
    CHAT_PERSONA +
    '\n\n' +
    RESPONSE_CONTRACT_CORE +
    CARDINALITY_CHAT +
    markerPreservationClauses(selectionMd) +
    contextSourceFraming(flags)
  )
}

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
  // Emit the shared response contract (D-01) plus the inline cardinality
  // sentence (D-02, inline side). The whole thing stays in the single user-role
  // prefix below — no system role is introduced.
  // Inline assembly: shared hardened contract CORE + inline cardinality + (when
  // the enriched selection carries them) the shared marker-preservation clauses.
  // Same single user-role prefix as before — no system role introduced.
  // Shared selection encoding + marker-preservation (same code the chat surface
  // uses via encodeSelectionForPrompt) — single source of truth so a structured
  // selection (e.g. a table) is framed identically on both surfaces.
  const { selectionMd, markerClauses } = encodeSelectionForPrompt({
    enrichedMd: extra?.enrichedMd,
    html: extra?.html,
    text: selectedText
  })
  const systemBase =
    SYSTEM_PROMPT +
    ' ' +
    RESPONSE_CONTRACT_CORE +
    CARDINALITY_INLINE +
    markerClauses
  const systemPrefix = systemBase + '\n\n'

  const textForPrompt = selectionMd

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
    { messages, temperature: 0.3, response_format: { type: 'json_object' } },
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
 * Corrective re-ask nudge (HARDEN-01, D-03). Appended as ONE extra user message
 * on the SECOND attempt when the first response failed the contract (illegible
 * JSON or split-table). It is a terse, English instruction-channel string (same
 * convention as SYSTEM_PROMPT / RESPONSE_CONTRACT_CORE — intentionally NOT i18n,
 * it is read by the model, not the user). It does NOT restate the whole contract;
 * it points the model back at the discussion/fragments JSON object it already
 * received and insists on JSON-only output, consistent with the SEPARATION
 * imperative of RESPONSE_CONTRACT_CORE.
 *
 * @type {string}
 */
export const REASK_CORRECTION_NUDGE =
  'Your previous reply was not valid contract output. Reply ONLY with a single ' +
  'JSON object with exactly the keys `discussion` (a string) and `fragments` ' +
  '(an array of strings) — no prose, no code fences, and no text outside the ' +
  'JSON. Put any insertable/transformed text ONLY inside `fragments`, never in ' +
  '`discussion`, and keep any [TABLE:N]/[CELL:r,c] markers balanced within a ' +
  'single fragment.'

/**
 * Shared re-ask wrapper (HARDEN-01). Single seam through which BOTH surfaces
 * (inline popover + side-panel chat) obtain their PARSED contract result, so the
 * re-ask policy can never diverge between them (D-04).
 *
 * Policy:
 *  1. Call callScribeAI once and parse with the caller's surface.
 *  2. If that first parse is clean (valid && !fellBack), return it — no 2nd call.
 *  3. Otherwise (fellBack OR !valid, D-01) issue EXACTLY ONE corrective re-ask:
 *     the original messages + one appended REASK_CORRECTION_NUDGE user message
 *     (non-mutating, D-03), and return its parse UNCONDITIONALLY — even if the
 *     second response is also invalid (hard cap of one retry, D-05; the caller's
 *     contextual fallback then applies to the returned object).
 *
 * The same `signal` is forwarded to BOTH transport calls (D-05): an AbortError
 * (or any FetchError) thrown by either callScribeAI propagates unchanged — never
 * swallowed, never retried after an abort. No loading/telemetry side effects live
 * here; the caller owns loading/probe/log so counts are never doubled.
 *
 * @param {Object} client - CozyClient instance from useClient()
 * @param {Array<{role: string, content: string}>} messages - System + user messages
 * @param {{ signal?: AbortSignal, surface?: string }} [options]
 * @returns {Promise<{ discussion: string, fragments: string[], valid: boolean,
 *                      fellBack: boolean, warnings: string[], raw: string }>}
 * @throws {DOMException} AbortError if either request was cancelled
 * @throws {FetchError} If either HTTP request fails
 * @throws {Error} 'Empty response from AI' if either response is empty
 */
export async function callScribeAIWithReask(
  client,
  messages,
  { signal, surface } = {}
) {
  const firstText = await callScribeAI(client, messages, { signal })
  const first = parseScribeResponse(firstText, { surface })

  if (first.valid && !first.fellBack) {
    return first
  }

  // D-03: corrective re-ask — append ONE nudge to a COPY of the messages.
  const retryMessages = messages.concat([
    { role: 'user', content: REASK_CORRECTION_NUDGE }
  ])
  const secondText = await callScribeAI(client, retryMessages, { signal })
  // D-05: hard cap of one retry — return the second parse unconditionally.
  return parseScribeResponse(secondText, { surface })
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
