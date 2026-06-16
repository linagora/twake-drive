/**
 * scribeResponse.js — Pure contract layer for Scribe LLM responses.
 *
 * Transforms any raw LLM response string into a normalized result object:
 *   {
 *     discussion: string,   // markdown; may contain {{fragment:N}} markers
 *     fragments:  string[], // [] when none; element N matches marker {{fragment:N}}
 *     valid:      boolean,  // passed home-grown validation
 *     fellBack:   boolean,  // true if raw was treated as a fallback
 *     warnings:   string[], // non-fatal validation notes
 *     raw:        string    // original input, coerced to string, always preserved
 *   }
 *
 * parseScribeResponse NEVER throws — every failure path returns a context-aware
 * fallback parameterized by the `surface` argument ('chat' | 'popover').
 *
 * The module is intentionally pure: no React, no network, no module-level side
 * effects. It is the single home for all contract validation + fallback logic.
 * Marker grammar, MCP helpers, and the JSON-Schema artifact live alongside this
 * core (added in plan 02).
 *
 * Security guarantees (raw input is untrusted, attacker-influenceable LLM text):
 * - Prototype-pollution safe: the validated result is staged on an
 *   Object.create(null) object and only the allow-listed channels (`discussion`,
 *   `fragments`) are copied; attacker-controlled `__proto__`/`constructor`/
 *   `prototype` keys are never assigned, so Object.prototype is never mutated.
 * - DoS-bounded: input longer than MAX_RAW_LENGTH short-circuits to the surface
 *   fallback ('input-too-large') before any parse work.
 * - ReDoS-safe: fence-strip and trailing-comma regexes are linear (no nested
 *   quantifiers) and brace matching is a single-pass character loop.
 */

/**
 * Maximum raw input length (bytes/chars) accepted before short-circuiting to a
 * fallback. A few hundred KB comfortably exceeds any legitimate contract reply
 * while bounding parse/regex work on adversarial input.
 *
 * @type {number}
 */
export const MAX_RAW_LENGTH = 512 * 1024

/**
 * Strip a single leading ```/```json fence and matching trailing ``` fence.
 * Linear-time, anchored regexes (no nested quantifiers).
 *
 * @param {string} str
 * @returns {string}
 */
function stripFence(str) {
  let s = str.trim()
  const leadingFence = /^```[a-zA-Z0-9_-]*[ \t]*\r?\n?/
  const trailingFence = /\r?\n?[ \t]*```$/
  if (leadingFence.test(s)) {
    s = s.replace(leadingFence, '').replace(trailingFence, '')
  }
  return s
}

/**
 * Extract the first balanced `{...}` object from a string, ignoring braces that
 * appear inside JSON string literals and respecting backslash escapes.
 * Single-pass character loop — inherently linear (ReDoS-safe).
 *
 * @param {string} str
 * @returns {string|null} the balanced substring, or null if none is balanced
 */
function extractFirstBalancedObject(str) {
  const start = str.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < str.length; i++) {
    const ch = str[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
    } else if (ch === '{') {
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) return str.slice(start, i + 1)
    }
  }
  return null
}

/**
 * Repair trailing commas before a closing `}` or `]`. Linear-time regex.
 *
 * @param {string} str
 * @returns {string}
 */
function repairTrailingCommas(str) {
  return str.replace(/,(\s*[}\]])/g, '$1')
}

/**
 * Run the tolerant parse pipeline: fence-strip → JSON.parse → first balanced
 * object → trailing-comma repair → JSON.parse. Throws if nothing parses; the
 * caller is responsible for catching and falling back.
 *
 * @param {string} str
 * @returns {*} the parsed JSON value
 */
function tolerantParse(str) {
  const text = stripFence(str)

  try {
    return JSON.parse(text)
  } catch (e) {
    // fall through to balanced-object extraction
  }

  const extracted = extractFirstBalancedObject(text)
  if (extracted !== null) {
    try {
      return JSON.parse(extracted)
    } catch (e) {
      return JSON.parse(repairTrailingCommas(extracted))
    }
  }

  return JSON.parse(repairTrailingCommas(text))
}

/**
 * Detect unmatched table/cell structure markers within a single fragment.
 * A fragment is "split" when its opening `[TABLE:N]` / `[CELL:r,c]` markers do
 * not balance against their closing `[/TABLE]` / `[/CELL]` markers (in either
 * direction). All regexes are linear (fixed literal + `\d+`).
 *
 * @param {string} str
 * @returns {boolean} true if structure markers are unbalanced
 */
function hasUnbalancedStructureMarkers(str) {
  const openTable = (str.match(/\[TABLE:\d+\]/g) || []).length
  const closeTable = (str.match(/\[\/TABLE\]/g) || []).length
  const openCell = (str.match(/\[CELL:\d+,\d+\]/g) || []).length
  const closeCell = (str.match(/\[\/CELL\]/g) || []).length
  return openTable !== closeTable || openCell !== closeCell
}

/**
 * Build the surface-specific fallback result. popover → raw becomes a single
 * fragment; any other surface (chat, unknown, undefined) → raw becomes the
 * discussion with no fragments.
 *
 * @param {string} rawStr
 * @param {string} surface
 * @param {string[]} warnings
 * @returns {object}
 */
function buildFallback(rawStr, surface, warnings) {
  if (surface === 'popover') {
    return {
      discussion: '',
      fragments: [rawStr],
      valid: false,
      fellBack: true,
      warnings,
      raw: rawStr
    }
  }
  return {
    discussion: rawStr,
    fragments: [],
    valid: false,
    fellBack: true,
    warnings,
    raw: rawStr
  }
}

/**
 * Parse a raw LLM response into the normalized Scribe contract result.
 * Never throws.
 *
 * @param {*} raw - raw model output (any type; coerced to string)
 * @param {{ surface?: string }} [opts] - 'chat' (default) or 'popover'
 * @returns {{ discussion: string, fragments: string[], valid: boolean,
 *             fellBack: boolean, warnings: string[], raw: string }}
 */
export function parseScribeResponse(raw, { surface } = {}) {
  const rawStr = typeof raw === 'string' ? raw : String(raw)

  // DoS guard: bound work before any parse/regex on oversized input.
  if (rawStr.length > MAX_RAW_LENGTH) {
    return buildFallback(rawStr, surface, ['input-too-large'])
  }

  try {
    const parsed = tolerantParse(rawStr)

    // Shape gate: must be a plain (non-array) object.
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return buildFallback(rawStr, surface, [])
    }

    const warnings = []

    // discussion: coerce null/undefined → ''.
    let discussion = parsed.discussion
    if (discussion === null || discussion === undefined) {
      discussion = ''
    } else if (typeof discussion !== 'string') {
      discussion = String(discussion)
    }

    // fragments: absent → []; present → array with non-string elements dropped.
    let fragments = []
    if (parsed.fragments !== null && parsed.fragments !== undefined) {
      if (Array.isArray(parsed.fragments)) {
        const kept = parsed.fragments.filter(el => typeof el === 'string')
        if (kept.length !== parsed.fragments.length) {
          warnings.push('non-string-fragment-dropped')
        }
        fragments = kept
      }
    }

    let valid = true

    // Split-structure guard: unmatched table/cell markers inside any fragment.
    const split = fragments.some(hasUnbalancedStructureMarkers)
    if (split) {
      valid = false
      warnings.push('split-table')
    }

    // Prototype-pollution guard: stage only the allow-listed channels on a
    // null-prototype object. We never assign attacker-controlled keys
    // (__proto__/constructor/prototype) from `parsed` — only the validated,
    // freshly-rebuilt `discussion` (string) and `fragments` (string[]).
    const safe = Object.create(null)
    safe.discussion = discussion
    safe.fragments = fragments

    return {
      discussion: safe.discussion,
      fragments: safe.fragments,
      valid,
      fellBack: false,
      warnings,
      raw: rawStr
    }
  } catch (e) {
    return buildFallback(rawStr, surface, [])
  }
}
