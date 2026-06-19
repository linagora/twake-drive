/**
 * prompt.mjs — Faithful replica of the UNIFIED Scribe prompt assembly (both
 * surfaces), post v3.1-03 gate. The measurement engine (parseScribeResponse +
 * scribeProbe) is loaded from the REAL production source at runtime (see
 * loadProdModules in run.mjs) so it never drifts. The prompt strings, however,
 * live in scribeAI.js which imports cozy-ui/turndown and can't be imported into
 * plain node — so the constants below are VERBATIM COPIES of:
 *   src/modules/views/OnlyOffice/Scribe/scribeAI.js
 *     SYSTEM_PROMPT, RESPONSE_CONTRACT_CORE, CARDINALITY_INLINE, CARDINALITY_CHAT,
 *     CHAT_PERSONA, markerPreservationClauses(), buildMessages(), buildChatSystemPrompt()
 *   src/modules/views/OnlyOffice/Scribe/scribeActions.js
 *     prompt templates (translate / correct-grammar / rewrite tones)
 *
 * run.mjs assertPromptInSync() checks these strings against the live source and
 * ABORTS on drift — copy-with-a-tripwire, not silent copy.
 */

// ── VERBATIM from scribeAI.js SYSTEM_PROMPT (inline persona + formatting rules) ─
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

// ── VERBATIM from scribeAI.js RESPONSE_CONTRACT_CORE (shared, hardened) ────────
export const RESPONSE_CONTRACT_CORE =
  'Return ONLY a JSON object with exactly two keys: `discussion` (a string) and ' +
  '`fragments` (an array of strings). No prose, no code fences, no text outside the JSON. ' +
  'Insertable/transformed text goes inside `fragments` and ONLY there — `discussion` ' +
  'MUST NOT contain or repeat it. Inside `discussion` you may place `{{fragment:N}}` ' +
  'position markers (0-indexed); marker `{{fragment:N}}` resolves to `fragments[N]`.'

// ── VERBATIM from scribeAI.js CARDINALITY_INLINE ───────────────────────────────
export const CARDINALITY_INLINE =
  ' `discussion` is a SHORT one-sentence note to the user. Return EXACTLY ONE ' +
  'fragment holding the complete transformed text. Never leave `fragments` empty, ' +
  'and never put the transformed text in `discussion`. ' +
  'Example: {"discussion":"Here is the result: {{fragment:0}}","fragments":["the transformed text"]}.'

// ── VERBATIM from scribeAI.js CARDINALITY_CHAT ─────────────────────────────────
export const CARDINALITY_CHAT =
  ' `discussion` is conversational markdown and may be free-form. You may return ' +
  '0..N fragments: put any insertable content in `fragments` (never duplicated in ' +
  '`discussion`); when nothing is meant to be inserted, return an empty `fragments` ' +
  'array and answer entirely in `discussion`. ' +
  'Example: {"discussion":"Sure — here is a tighter intro:\\n\\n{{fragment:0}}\\n\\nLet me know if you want it shorter.","fragments":["Our platform helps teams ship faster."]}'

// ── VERBATIM from scribeAI.js CHAT_PERSONA ─────────────────────────────────────
export const CHAT_PERSONA =
  'You are a helpful writing assistant. Help the user with their writing tasks. ' +
  "Respond in the same language as the user's message. Use Markdown formatting when appropriate."

// ── VERBATIM from scribeAI.js markerPreservationClauses() ──────────────────────
export function markerPreservationClauses(md) {
  const s = typeof md === 'string' ? md : ''
  let out = ''
  if (s.includes('[TABLE:') || s.includes('[CELL:')) {
    out += ' Inside the fragment string(s) (never in `discussion`), preserve all [TABLE:N]...[/TABLE] and [CELL:r,c]...[/CELL] markers exactly as-is. Only modify the text content between the opening [CELL:r,c] and closing [/CELL] tags. Do not add, remove, or reorder [TABLE:N] or [CELL:r,c] markers.'
  }
  if (s.includes('[^scribe-fn-')) {
    out += ' Inside the fragment string(s) (never in `discussion`), preserve all [^scribe-fn-N] footnote reference markers exactly as-is. Do NOT add footnote definitions ([^N]: text). The footnote content is managed separately — only preserve the inline reference markers.'
  }
  if (s.includes('{{REF:')) {
    out += ' Inside the fragment string(s) (never in `discussion`), preserve all {{REF:scribe-ref-N:visible text}} cross-reference markers. Keep the {{REF:scribe-ref-N: and closing }} delimiters intact. You may modify the visible text inside the marker to match your changes (e.g. translation), but never remove or alter the scribe-ref-N identifier.'
  }
  return out
}

// ── VERBATIM prompt templates from scribeActions.js (the ones we exercise) ─────
export const ACTION_TEMPLATES = {
  'correct-grammar':
    'Correct the grammar and spelling of the following text:\n\n{selectedText}',
  'translate-en': 'Translate the following text to English:\n\n{selectedText}',
  'translate-fr': 'Translate the following text to Français:\n\n{selectedText}',
  'translate-de': 'Translate the following text to Deutsch:\n\n{selectedText}',
  'translate-es': 'Translate the following text to Español:\n\n{selectedText}',
  'translate-it': 'Translate the following text to Italiano:\n\n{selectedText}',
  'rewrite-professional':
    'Rewrite the following text in a more professional tone:\n\n{selectedText}',
  'rewrite-casual':
    'Rewrite the following text in a more casual, friendly tone:\n\n{selectedText}',
  'rewrite-polite':
    'Rewrite the following text in a more polite and courteous tone:\n\n{selectedText}'
}

/** Inline (popover) assembly — mirrors scribeAI.buildMessages() (single user role). */
function buildInlineMessages(actionId, inputMd) {
  const systemPrefix =
    SYSTEM_PROMPT +
    ' ' +
    RESPONSE_CONTRACT_CORE +
    CARDINALITY_INLINE +
    markerPreservationClauses(inputMd) +
    '\n\n'
  const tpl = ACTION_TEMPLATES[actionId]
  if (!tpl) throw new Error(`prompt.mjs: unknown actionId "${actionId}"`)
  return [{ role: 'user', content: `${systemPrefix}${tpl.replace('{selectedText}', inputMd)}` }]
}

/** VERBATIM from scribeAI.buildChatSystemPrompt(). */
export function buildChatSystemPrompt(selectionMd) {
  return (
    CHAT_PERSONA +
    '\n\n' +
    RESPONSE_CONTRACT_CORE +
    CARDINALITY_CHAT +
    markerPreservationClauses(selectionMd)
  )
}

/** Chat assembly — mirrors ScribeContext.sendMessage (system + composite user). */
function buildChatMessages(chatPrompt, selectionMd) {
  const sys = buildChatSystemPrompt(selectionMd || '')
  const user = selectionMd
    ? `[Selected text from document]\n${selectionMd}\n[End of selected text]\n\n${chatPrompt}`
    : chatPrompt
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user }
  ]
}

/**
 * Build the message array for a fixture, dispatching on its surface.
 * - popover: inline transform (fx.action + fx.input)
 * - chat   : conversation (fx.chatPrompt + optional fx.input as selection)
 *
 * @param {{surface?:string, action?:string, input?:string, chatPrompt?:string}} fx
 * @returns {Array<{role:string, content:string}>}
 */
export function buildMessages(fx) {
  if (fx.surface === 'chat') {
    return buildChatMessages(fx.chatPrompt || fx.input || '', fx.input || '')
  }
  return buildInlineMessages(fx.action, fx.input)
}
