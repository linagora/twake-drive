/**
 * prompt.mjs — Faithful replica of the Scribe inline prompt assembly.
 *
 * The measurement engine (parseScribeResponse + scribeProbe metrics) is loaded
 * from the REAL production source at runtime (see loadProdModules in run.mjs), so
 * it can never drift. The prompt *prefix*, however, lives in scribeAI.js, which
 * imports cozy-ui/turndown and therefore cannot be imported into plain node.
 *
 * So the three constant strings below are VERBATIM COPIES of:
 *   src/modules/views/OnlyOffice/Scribe/scribeAI.js
 *     SYSTEM_PROMPT          (lines 24-33)
 *     RESPONSE_CONTRACT_BLOCK(lines 44-50)
 *     buildMessages()        (lines 101-161, inline-only path)
 *   src/modules/views/OnlyOffice/Scribe/scribeActions.js
 *     prompt templates       (translate / correct-grammar / rewrite tones)
 *
 * run.mjs runs assertPromptInSync() against the live source files and ABORTS if
 * any of these strings has drifted — copy-with-a-tripwire instead of silent copy.
 */

// ── VERBATIM from scribeAI.js SYSTEM_PROMPT ────────────────────────────────
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

// ── VERBATIM from scribeAI.js RESPONSE_CONTRACT_BLOCK ──────────────────────
export const RESPONSE_CONTRACT_BLOCK =
  'Return ONLY a JSON object with two keys: `discussion` (a string, conversational ' +
  'markdown shown to the user) and `fragments` (an array of strings, each an ' +
  'insertable piece of markdown). No prose, no code fences, no text outside the JSON. ' +
  'Inside `discussion` you may place `{{fragment:N}}` position markers (0-indexed) to ' +
  'show where each fragment belongs; marker `{{fragment:N}}` resolves to `fragments[N]`. ' +
  'Example: {"discussion":"Here is the rewrite: {{fragment:0}}","fragments":["the rewritten text"]}.'

// ── VERBATIM conditional format clauses from buildMessages() ───────────────
const TABLE_CLAUSE =
  ' Inside the fragment string(s) (never in `discussion`), preserve all [TABLE:N]...[/TABLE] and [CELL:r,c]...[/CELL] markers exactly as-is. Only modify the text content between the opening [CELL:r,c] and closing [/CELL] tags. Do not add, remove, or reorder [TABLE:N] or [CELL:r,c] markers.'
const FOOTNOTE_CLAUSE =
  ' Inside the fragment string(s) (never in `discussion`), preserve all [^scribe-fn-N] footnote reference markers exactly as-is. Do NOT add footnote definitions ([^N]: text). The footnote content is managed separately — only preserve the inline reference markers.'
const REF_CLAUSE =
  ' Inside the fragment string(s) (never in `discussion`), preserve all {{REF:scribe-ref-N:visible text}} cross-reference markers. Keep the {{REF:scribe-ref-N: and closing }} delimiters intact. You may modify the visible text inside the marker to match your changes (e.g. translation), but never remove or alter the scribe-ref-N identifier.'

// ── VERBATIM prompt templates from scribeActions.js (the ones we exercise) ─
// Keyed by the action id used in fixtures. {selectedText}/{language} placeholders
// mirror the production interpolation in buildMessages().
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

/**
 * EXPERIMENTAL v2 contract block — candidate prod replacement.
 *
 * Targets the two off-contract modes the v1 (baseline) prompt produces on
 * Mistral-Small-24B: full discussion↔fragment duplication, and empty `fragments`
 * with the transformed text dumped into `discussion`. The fix is to assert, in
 * imperative terms, the SEPARATION the v1 contract only implies.
 */
export const RESPONSE_CONTRACT_BLOCK_V2 =
  'Return ONLY a JSON object with exactly two keys: `discussion` (a string) and ' +
  '`fragments` (an array of strings). No prose, no code fences, no text outside the JSON. ' +
  'The transformed text goes inside `fragments` and ONLY there. ' +
  '`discussion` is a SHORT one-sentence note to the user (e.g. "Here is the translation:") — ' +
  'it MUST NOT contain or repeat the transformed text. ' +
  'Inside `discussion` you may place `{{fragment:N}}` position markers (0-indexed); ' +
  'marker `{{fragment:N}}` resolves to `fragments[N]`. ' +
  'Return EXACTLY ONE fragment holding the complete transformed text. ' +
  'Never leave `fragments` empty, and never put the transformed text in `discussion`. ' +
  'Example: {"discussion":"Here is the result: {{fragment:0}}","fragments":["the transformed text"]}.'

const VARIANTS = { v1: RESPONSE_CONTRACT_BLOCK, v2: RESPONSE_CONTRACT_BLOCK_V2 }

/**
 * Faithful replica of scribeAI.buildMessages() for the inline surface.
 * Returns the single user-role message array sent to /ai/v1/chat/completions.
 *
 * @param {string} actionId
 * @param {string} inputMd - the selection markdown (plays the role of enrichedMd)
 * @param {'v1'|'v2'} [variant] - contract block variant ('v1' = verbatim prod baseline)
 * @returns {Array<{role:'user', content:string}>}
 */
export function buildMessages(actionId, inputMd, variant = 'v1') {
  const contractBlock = VARIANTS[variant]
  if (!contractBlock) throw new Error(`prompt.mjs: unknown variant "${variant}"`)
  let systemBase =
    SYSTEM_PROMPT + ' ' + contractBlock + ' Return **exactly ONE** fragment.'
  if (inputMd.includes('[TABLE:') || inputMd.includes('[CELL:')) systemBase += TABLE_CLAUSE
  if (inputMd.includes('[^scribe-fn-')) systemBase += FOOTNOTE_CLAUSE
  if (inputMd.includes('{{REF:')) systemBase += REF_CLAUSE
  const systemPrefix = systemBase + '\n\n'

  const tpl = ACTION_TEMPLATES[actionId]
  if (!tpl) throw new Error(`prompt.mjs: unknown actionId "${actionId}"`)
  const prompt = tpl.replace('{selectedText}', inputMd)
  return [{ role: 'user', content: `${systemPrefix}${prompt}` }]
}
