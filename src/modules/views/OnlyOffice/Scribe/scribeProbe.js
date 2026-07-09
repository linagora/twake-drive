/**
 * scribeProbe.js — Pure conformance probe for the Scribe LLM response contract.
 *
 * This is the MEASUREMENT ENGINE of the HARD GATE (PROBE-01). It reads the
 * already-parsed `{ discussion, fragments, valid, fellBack, warnings, raw }`
 * payload produced by `parseScribeResponse` (it NEVER re-parses raw text) and
 * computes five conformance metrics, then persists/replays/aggregates a corpus
 * of samples for the go/no-go gate.
 *
 * Five metrics (all pure functions of stored text):
 *   - duplication  : 0..1 word-bigram Dice overlap between discussion and the
 *                    most-similar fragment (rate-based blocker, D-04)
 *   - preamble     : a fragment opens with a localized meta-preamble (D-04)
 *   - splitTable   : a table is split across channels/fragments (D-03 blocker)
 *   - refBroken    : a scribe-ref-N / scribe-fn-N identifier was dropped or
 *                    fabricated (D-03 zero-tolerance blocker)
 *   - fragCount    : 0/1/N fragment cardinality (D-05 indicative)
 *
 * The module is intentionally pure (mirrors scribeResponse.js): no React, no
 * network, no module-level side effects EXCEPT the two localStorage helpers
 * `readCorpus`/`writeCorpus`, which are isolated and never throw.
 *
 * Security guarantees (input is untrusted, attacker-influenceable LLM text):
 * - ReDoS-safe: every regex is linear/anchored (fixed literal + `\d+`, no nested
 *   quantifiers), mirroring scribeResponse.js's grammar. Input is already capped
 *   by the parser at MAX_RAW_LENGTH (512KB) upstream.
 * - DoS-bounded persistence: ring-buffer trim to MAX_SAMPLES + write wrapped in
 *   try/catch for QuotaExceededError; corrupt/oversized/version-stale corpus
 *   resets to an empty envelope on read, never crashing the dev session.
 * - Import is JSON.parse only (no eval/Function); shape + version are validated
 *   before replacing storage, and a bad import throws WITHOUT mutating storage.
 */

/* ------------------------------------------------------------------------- *
 * Exported-const grammar block (mirrors scribeResponse.js lines 40-53).
 * ------------------------------------------------------------------------- */

/**
 * localStorage key for the probe corpus envelope. Version-stamped in the key
 * AND in the envelope `v` field so a future schema change is unambiguous.
 * @type {string}
 */
export const PROBE_KEY = 'SCRIBE_PROBE_v1'

/**
 * Schema version of the corpus envelope. A stored corpus whose `v` differs is
 * reset to empty on read rather than crashing the dev session.
 * @type {number}
 */
export const PROBE_SCHEMA_VERSION = 1

/**
 * Ring-buffer cap. localStorage holds ~5MB; 200 samples comfortably fits while
 * making a 15% rate threshold (D-04) statistically meaningful. Oldest samples
 * are dropped first.
 * @type {number}
 */
export const MAX_SAMPLES = 200

/**
 * Per-response duplication threshold (word-bigram Dice). Above this, discussion
 * ↔ fragment overlap usually means substantive copying rather than shared stock
 * phrases. [ASSUMED] — proposed 0.6; frozen against real data in GATE.md (D-04).
 * @type {number}
 */
export const DUP_THRESHOLD = 0.6

/**
 * Per-locale preamble pattern table (fr/en/de/es/it). Each entry is a
 * meta-referential opener ("here is the …", "voici le …", …) anchored at the
 * fragment START (`^\s*`) so legitimate content rarely false-positives
 * (RESEARCH Pitfall 4). All regexes are linear (anchored alternations, no nested
 * quantifiers) — ReDoS-safe like FRAGMENT_MARKER_RE.
 *
 * [ASSUMED] — phrase coverage is a documented starting point per D-06b; refine
 * against the real curated corpus before freezing GATE.md.
 *
 * @type {Array<{ locale: string, re: RegExp }>}
 */
export const PREAMBLE_PATTERNS = [
  // fr
  { locale: 'fr', re: /^\s*(voici|voilà)\s+(le|la|les|votre|une?)\b/i },
  { locale: 'fr', re: /^\s*je vous (propose|présente)\b/i },
  // en
  { locale: 'en', re: /^\s*here(?:'s| is| are)\s+(the|your|a|an)\b/i },
  { locale: 'en', re: /^\s*sure[,!]?\s+here\b/i },
  { locale: 'en', re: /^\s*(below is|i('ve| have) (written|prepared))\b/i },
  // de
  { locale: 'de', re: /^\s*hier (ist|sind|ist ihr|haben sie)\b/i },
  { locale: 'de', re: /^\s*(nachfolgend|im folgenden)\b/i },
  // es
  { locale: 'es', re: /^\s*(aquí (tienes|está|están)|este es|esta es)\b/i },
  // it
  { locale: 'it', re: /^\s*(ecco (il|la|i|le|un|una)|di seguito)\b/i }
]

/**
 * REF identifier grammar (authoritative, from
 * plugins/onlyoffice-scribe/scripts/code.js:179). Only the `scribe-ref-N`
 * IDENTIFIER is immutable; the visible text may legitimately change (translation
 * / edit), so we set-diff identifiers ONLY (RESEARCH Pitfall 3). Linear regex.
 * @type {RegExp}
 */
const REF_ID_RE = /\{\{REF:(scribe-ref-\d+):[^}]*\}\}/g

/**
 * Footnote marker grammar (same family as REF). Linear regex.
 * @type {RegExp}
 */
const FOOTNOTE_ID_RE = /\[\^(scribe-fn-\d+)\]/g

/**
 * Derive coverage tags (`hasTable` / `hasRef`) from the input markdown by the
 * SAME marker-presence test production uses to inject the conditional prompt
 * clauses (scribeAI.js buildMessages / gate-harness prompt.mjs): table iff a
 * `[TABLE:` or `[CELL:` marker is present; ref iff a `{{REF:scribe-ref-` or
 * `[^scribe-fn-` marker is present (footnotes share the REF-integrity set-diff).
 *
 * Used by recordProbeSample so live IHM captures self-tag for the GATE coverage
 * preconditions (#8/#9) instead of always landing at 0. String `.includes` (not
 * regex) — order-independent and mirrors the production clause guard exactly.
 *
 * @param {string} inputMd
 * @returns {{ hasTable: boolean, hasRef: boolean }}
 */
export function deriveContentTags(inputMd) {
  const s = typeof inputMd === 'string' ? inputMd : ''
  return {
    hasTable: s.includes('[TABLE:') || s.includes('[CELL:'),
    hasRef: s.includes('{{REF:scribe-ref-') || s.includes('[^scribe-fn-')
  }
}

/* ------------------------------------------------------------------------- *
 * Metric 1 — preamble detection.
 * ------------------------------------------------------------------------- */

/**
 * Detect a localized meta-preamble at the start of a fragment.
 *
 * @param {string} fragment
 * @returns {string|null} the matched locale ('fr'|'en'|'de'|'es'|'it') or null
 */
export function detectPreamble(fragment) {
  const s = typeof fragment === 'string' ? fragment : ''
  for (const p of PREAMBLE_PATTERNS) if (p.re.test(s)) return p.locale
  return null
}

/* ------------------------------------------------------------------------- *
 * Metric 2 — duplication (normalized word-bigram Dice coefficient, zero-dep).
 * ------------------------------------------------------------------------- */

/**
 * Normalize text for duplication scoring: lowercase, drop `{{...}}` and `[...]`
 * markers (so they do not inflate overlap), strip punctuation, collapse
 * whitespace. Linear regexes only (RESEARCH Pitfall 1).
 *
 * @param {string} s
 * @returns {string}
 */
function normalizeForDup(s) {
  return (typeof s === 'string' ? s : '')
    .toLowerCase()
    .replace(/\{\{[^}]*\}\}/g, ' ') // drop fragment/REF markers
    .replace(/\[[^\]]*\]/g, ' ') // drop [TABLE:..]/[CELL:..] markers
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Build a multiset of word bigrams from a token list.
 *
 * @param {string[]} tokens
 * @returns {Map<string, number>}
 */
function bigrams(tokens) {
  const out = new Map()
  for (let i = 0; i < tokens.length - 1; i++) {
    const g = tokens[i] + ' ' + tokens[i + 1]
    out.set(g, (out.get(g) || 0) + 1)
  }
  return out
}

/**
 * Sørensen–Dice coefficient over word-bigram multisets. Returns 0..1.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function diceCoefficient(a, b) {
  const A = bigrams(normalizeForDup(a).split(' ').filter(Boolean))
  const B = bigrams(normalizeForDup(b).split(' ').filter(Boolean))
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const [g, ca] of A) {
    const cb = B.get(g)
    if (cb) inter += Math.min(ca, cb)
  }
  let total = 0
  for (const v of A.values()) total += v
  for (const v of B.values()) total += v
  return total === 0 ? 0 : (2 * inter) / total
}

/**
 * Per-response duplication = the MAX bigram-Dice overlap between `discussion`
 * and any single fragment.
 *
 * @param {string} discussion
 * @param {string[]} fragments
 * @returns {number} 0..1
 */
export function maxFragmentDuplication(discussion, fragments) {
  const frags = Array.isArray(fragments) ? fragments : []
  return frags.reduce((m, f) => Math.max(m, diceCoefficient(discussion, f)), 0)
}

/* ------------------------------------------------------------------------- *
 * Metric 3 — split table (cross-channel, extends the parser's intra-fragment
 * check). Marker grammar reused EXACTLY from scribeResponse.js (lines 186-192).
 * ------------------------------------------------------------------------- */

const TABLE_OPEN_RE = /\[TABLE:\d+\]/g
const TABLE_CLOSE_RE = /\[\/TABLE\]/g
const CELL_OPEN_RE = /\[CELL:\d+,\d+\]/g
const CELL_CLOSE_RE = /\[\/CELL\]/g

/**
 * Count structure-marker opens/closes in a string (linear, ReDoS-safe).
 *
 * @param {string} str
 * @returns {{ openTable: number, closeTable: number, openCell: number, closeCell: number }}
 */
function countStructureMarkers(str) {
  const s = typeof str === 'string' ? str : ''
  return {
    openTable: (s.match(TABLE_OPEN_RE) || []).length,
    closeTable: (s.match(TABLE_CLOSE_RE) || []).length,
    openCell: (s.match(CELL_OPEN_RE) || []).length,
    closeCell: (s.match(CELL_CLOSE_RE) || []).length
  }
}

/**
 * Detect unmatched table/cell markers WITHIN a single fragment (identical to
 * scribeResponse.js hasUnbalancedStructureMarkers — the intra-fragment case).
 *
 * @param {string} str
 * @returns {boolean}
 */
function hasUnbalancedStructureMarkers(str) {
  const c = countStructureMarkers(str)
  return c.openTable !== c.closeTable || c.openCell !== c.closeCell
}

/**
 * True if `str` contains ANY table/cell structure marker. Used to detect
 * markers leaking into `discussion` (which the schema forbids).
 *
 * @param {string} str
 * @returns {boolean}
 */
function hasAnyStructureMarker(str) {
  const c = countStructureMarkers(str)
  return c.openTable + c.closeTable + c.openCell + c.closeCell > 0
}

/**
 * Detect a split table across channels/fragments. Returns true if ANY of:
 *  (a) the parser already set the 'split-table' warning (intra-fragment), OR
 *  (b) any structure marker appears in `discussion` (markers must live in
 *      fragments only, per SCRIBE_OUTPUT_SCHEMA), OR
 *  (c) a structure marker is unbalanced inside a single fragment, OR
 *  (d) markers balance globally but NOT per-fragment — i.e. a table opens in one
 *      fragment and its close lives in another (spread across fragments).
 *
 * @param {{ discussion?: string, fragments?: string[], warnings?: string[] }} parsed
 * @returns {boolean}
 */
export function hasSplitTable(parsed) {
  const p = parsed || {}
  const discussion = typeof p.discussion === 'string' ? p.discussion : ''
  const fragments = Array.isArray(p.fragments) ? p.fragments : []
  const warnings = Array.isArray(p.warnings) ? p.warnings : []

  // (a) parser already flagged it.
  if (warnings.indexOf('split-table') !== -1) return true

  // (b) structure markers leaking into discussion.
  if (hasAnyStructureMarker(discussion)) return true

  // (c) intra-fragment imbalance.
  if (fragments.some(hasUnbalancedStructureMarkers)) return true

  // (d) global balance but per-fragment imbalance ⇒ spread across fragments.
  const global = { openTable: 0, closeTable: 0, openCell: 0, closeCell: 0 }
  let perFragmentImbalanced = false
  for (const f of fragments) {
    const c = countStructureMarkers(f)
    global.openTable += c.openTable
    global.closeTable += c.closeTable
    global.openCell += c.openCell
    global.closeCell += c.closeCell
    if (c.openTable !== c.closeTable || c.openCell !== c.closeCell) {
      perFragmentImbalanced = true
    }
  }
  const globalBalanced =
    global.openTable === global.closeTable &&
    global.openCell === global.closeCell
  if (globalBalanced && perFragmentImbalanced) return true

  return false
}

/* ------------------------------------------------------------------------- *
 * Metric 4 — REF / footnote integrity (identifier set-diff).
 * ------------------------------------------------------------------------- */

/**
 * Collect the set of REF + footnote identifiers present in `text`. Builds fresh
 * per-call regexes so global-regex lastIndex state never leaks across calls.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
function refIds(text) {
  const ids = new Set()
  const s = typeof text === 'string' ? text : ''
  let m
  const refRe = new RegExp(REF_ID_RE.source, 'g')
  while ((m = refRe.exec(s)) !== null) ids.add(m[1])
  const fnRe = new RegExp(FOOTNOTE_ID_RE.source, 'g')
  while ((m = fnRe.exec(s)) !== null) ids.add(m[1])
  return ids
}

/**
 * Compare the REF/footnote identifier SET in the input markdown against the set
 * across all fragment bodies. Visible text is IGNORED — only identifiers matter
 * (RESEARCH Pitfall 3).
 *
 * @param {string} inputMd
 * @param {string[]} fragments
 * @returns {{ broken: boolean, missing: string[], fabricated: string[] }}
 */
export function refIntegrity(inputMd, fragments) {
  const inIds = refIds(inputMd)
  const outIds = new Set()
  const frags = Array.isArray(fragments) ? fragments : []
  for (const f of frags) for (const id of refIds(f)) outIds.add(id)
  const missing = [...inIds].filter(id => !outIds.has(id)) // dropped REF
  const fabricated = [...outIds].filter(id => !inIds.has(id)) // invented REF
  return { broken: missing.length > 0 || fabricated.length > 0, missing, fabricated }
}

/* ------------------------------------------------------------------------- *
 * Composite — computeSampleMetrics.
 * ------------------------------------------------------------------------- */

/**
 * Compose the five metrics over a parsed sample + its input markdown.
 * Every field is read defensively (the sample may be untrusted/corrupt).
 *
 * @param {{ discussion?: string, fragments?: string[], warnings?: string[] }} parsed
 * @param {string} inputMd
 * @returns {{ fragCount: number, duplication: number, preamble: boolean,
 *             splitTable: boolean, refBroken: boolean }}
 */
export function computeSampleMetrics(parsed, inputMd) {
  const p = parsed || {}
  const fragments = Array.isArray(p.fragments) ? p.fragments : []
  const discussion = typeof p.discussion === 'string' ? p.discussion : ''
  return {
    fragCount: fragments.length,
    duplication: maxFragmentDuplication(discussion, fragments),
    preamble: fragments.some(f => detectPreamble(f) !== null),
    splitTable: hasSplitTable(p),
    refBroken: refIntegrity(inputMd, fragments).broken
  }
}

/* ------------------------------------------------------------------------- *
 * Corpus persistence — versioned localStorage envelope (mirrors
 * loadDevPanelPrefs/saveDevPanelPrefs try/catch shape).
 * ------------------------------------------------------------------------- */

/**
 * Read the corpus envelope from localStorage. Returns a fresh empty envelope on
 * missing / corrupt / version-mismatched / wrong-shape storage — never throws
 * (RESEARCH Pitfall 5).
 *
 * @returns {{ v: number, samples: object[] }}
 */
function readCorpus() {
  const empty = () => ({ v: PROBE_SCHEMA_VERSION, samples: [] })
  try {
    const raw = localStorage.getItem(PROBE_KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw)
    if (
      !parsed ||
      parsed.v !== PROBE_SCHEMA_VERSION ||
      !Array.isArray(parsed.samples)
    ) {
      return empty()
    }
    return parsed
  } catch {
    return empty()
  }
}

/**
 * Write the corpus envelope to localStorage. Swallows QuotaExceededError (the
 * caller has already ring-buffer-trimmed to MAX_SAMPLES).
 *
 * @param {{ v: number, samples: object[] }} corpus
 * @returns {void}
 */
function writeCorpus(corpus) {
  try {
    localStorage.setItem(PROBE_KEY, JSON.stringify(corpus))
  } catch {
    /* QuotaExceededError or unavailable storage — non-fatal for the dev tool */
  }
}

/**
 * Append one parsed sample to the corpus and persist. Ring-buffer-trims to
 * MAX_SAMPLES (oldest dropped) before writing.
 *
 * @param {{ discussion?: string, fragments?: string[], valid?: boolean,
 *           fellBack?: boolean, warnings?: string[] }} parsed
 * @param {{ ts?: number, surface?: string, inputMd?: string, tags?: object }} [meta]
 * @returns {number} the new sample count
 */
export function recordProbeSample(parsed, meta) {
  const p = parsed || {}
  const m = meta || {}
  const corpus = readCorpus()
  // D-07/D-09 coverage tags. hasTable/hasRef are auto-derived from inputMd so
  // live IHM captures populate the GATE coverage preconditions (#8/#9); any
  // explicit tag (e.g. locale, or a deliberate override) wins via spread order.
  const tags = { ...deriveContentTags(m.inputMd), ...(m.tags || {}) }
  corpus.samples.push({
    ts: m.ts || Date.now(),
    surface: m.surface, // 'popover' | 'chat'
    inputMd: m.inputMd || '', // for REF/dup input comparison + replay
    discussion: typeof p.discussion === 'string' ? p.discussion : '',
    fragments: Array.isArray(p.fragments) ? p.fragments : [],
    valid: p.valid,
    fellBack: p.fellBack,
    warnings: Array.isArray(p.warnings) ? p.warnings : [],
    tags
  })
  if (corpus.samples.length > MAX_SAMPLES) {
    corpus.samples.splice(0, corpus.samples.length - MAX_SAMPLES)
  }
  writeCorpus(corpus)
  return corpus.samples.length
}

/**
 * Export the current corpus envelope as pretty JSON (pasteable GATE.md evidence).
 *
 * @returns {string}
 */
export function exportCorpus() {
  return JSON.stringify(readCorpus(), null, 2)
}

/**
 * Replace the stored corpus from a JSON string. Validates version + shape BEFORE
 * writing; throws on mismatch WITHOUT mutating existing storage (T-v3.1-03-01).
 * JSON.parse only — no eval/Function.
 *
 * @param {string} json
 * @returns {number} the imported sample count
 */
export function importCorpus(json) {
  const parsed = JSON.parse(json)
  if (
    !parsed ||
    parsed.v !== PROBE_SCHEMA_VERSION ||
    !Array.isArray(parsed.samples)
  ) {
    throw new Error('probe-corpus: unsupported shape/version')
  }
  writeCorpus(parsed)
  return parsed.samples.length
}

/**
 * Recompute metrics over stored samples — LLM-free, idempotent vs record-time
 * (D-06/D-08). Each returned sample is augmented with a `.metrics` field.
 *
 * @param {{ samples: object[] }} [corpus] - defaults to the stored corpus
 * @returns {Array<object>} samples each with a `.metrics` field
 */
export function replay(corpus) {
  const c = corpus || readCorpus()
  const samples = Array.isArray(c.samples) ? c.samples : []
  return samples.map(s => ({ ...s, metrics: computeSampleMetrics(s, s.inputMd) }))
}

/* ------------------------------------------------------------------------- *
 * Aggregation — rates + counts + distribution + coverage for the panel/GATE.md.
 * ------------------------------------------------------------------------- */

/**
 * Count occurrences keyed by a selector, skipping null/undefined keys.
 *
 * @param {object[]} items
 * @param {(item: object) => (string|undefined)} keyFn
 * @returns {Object<string, number>}
 */
function countBy(items, keyFn) {
  const out = {}
  for (const it of items) {
    const k = keyFn(it)
    if (k === undefined || k === null) continue
    out[k] = (out[k] || 0) + 1
  }
  return out
}

/**
 * Aggregate a sample array into gate-ready statistics:
 *  - dupRate / preambleRate : fractions over threshold (D-04 rate-based)
 *  - splitTableCount / refBrokenCount : raw counts (D-03 zero-tolerance)
 *  - fragDist : 0/1/N cardinality distribution (D-05 indicative)
 *  - coverage : per-locale + table + REF case counters (D-09 precondition)
 *
 * Each sample is expected to carry `.metrics` (from replay); falls back to
 * computing them inline so aggregate works on a raw corpus too.
 *
 * @param {object[]} samples
 * @returns {object}
 */
export function aggregate(samples) {
  const list = Array.isArray(samples) ? samples : []
  const n = list.length
  const metrics = list.map(s => s.metrics || computeSampleMetrics(s, s.inputMd))
  const rate = pred => (n ? metrics.filter(pred).length / n : 0)
  return {
    total: n,
    dupRate: rate(x => x.duplication >= DUP_THRESHOLD), // D-04 quantitative
    preambleRate: rate(x => x.preamble), // D-04 quantitative
    splitTableCount: metrics.filter(x => x.splitTable).length, // D-03 hard
    refBrokenCount: metrics.filter(x => x.refBroken).length, // D-03 hard
    fragDist: {
      0: metrics.filter(x => x.fragCount === 0).length, // D-05 indicative
      1: metrics.filter(x => x.fragCount === 1).length,
      N: metrics.filter(x => x.fragCount >= 2).length
    },
    coverage: {
      perLocale: countBy(list, s => s.tags && s.tags.locale), // D-09 precondition
      tableCases: list.filter(s => s.tags && s.tags.hasTable).length,
      refCases: list.filter(s => s.tags && s.tags.hasRef).length
    }
  }
}
