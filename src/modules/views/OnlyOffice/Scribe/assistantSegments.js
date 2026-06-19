/**
 * assistantSegments.js — Pure placement helper for the Scribe chat bubble.
 *
 * Converts the `{ discussion, fragments[] }` contract model into an ordered array
 * of render segments that the chat layer maps to React nodes:
 *   - `{ type: 'prose', md: string }`           → rendered through MarkdownPreview
 *   - `{ type: 'card', index: number, raw: string }` → rendered as a <FragmentCard>
 *
 * This replaces the throwaway render-time text-substitution helper that used to
 * live in ChatMessageList.jsx: a <Card> is a React element, not text, so it cannot
 * be produced by string substitution. The exact placement semantics of the old
 * helper are preserved:
 *   - CONTRACT-02 / D-05: a 0-fragment response yields a single prose segment and
 *     NO card segment (no insertion UI).
 *   - FRAG-01: each in-document `{{fragment:N}}` marker produces a card at that
 *     marker's position (0-indexed: index 0 → fragments[0]).
 *   - D-04: orphan (unreferenced) fragments are appended as cards after all prose,
 *     in fragment order.
 *   - CONTRACT-04 / REF-safety: `{{REF:scribe-ref-N:…}}` cross-ref markers are never
 *     consumed or altered — marker LOCATION uses `extractChannelMarkers('fragment')`
 *     (REF-safe per-channel regex), never a greedy `\{\{.+?\}\}`.
 *   - Out-of-range markers (index < 0 || index >= fragments.length) are stripped
 *     from prose and never resolved to a card.
 *
 * D-03 INVARIANT: each card's `raw` is `fragments[index]` UNMODIFIED (markers
 * intact). Cosmetic cleanup is the MarkdownPreview render layer's job — never this
 * helper's. The downstream Copy/Insert/Replace pipeline (FRAG-03) depends on the
 * raw markers to restore tables/images/footnotes/cross-refs.
 *
 * The module is intentionally pure: no React, no network, no module-level side
 * effects.
 */

import { extractChannelMarkers } from '@/modules/views/OnlyOffice/Scribe/scribeResponse'

/**
 * Build the ordered segment array for an assistant turn.
 *
 * @param {string} discussion - markdown discussion; may contain {{fragment:N}} markers
 * @param {string[]} fragments - raw insertable fragments; element N matches {{fragment:N}}
 * @returns {Array<{type:'prose', md:string} | {type:'card', index:number, raw:string}>}
 */
export function buildAssistantSegments(discussion, fragments) {
  const disc = typeof discussion === 'string' ? discussion : ''
  const frags = Array.isArray(fragments) ? fragments : []

  // CONTRACT-02 / D-05: no fragments → discussion only, no cards.
  if (frags.length === 0) return [{ type: 'prose', md: disc }]

  // Locate ordered {{fragment:N}} hits (REF-safe, 0-indexed). Forward walk so we
  // can emit segments in document order.
  const hits = extractChannelMarkers(disc, 'fragment')
  const valid = hits.filter(h => h.index >= 0 && h.index < frags.length)
  const referenced = new Set(valid.map(h => h.index))

  const segments = []
  let cursor = 0
  for (const h of valid) {
    const marker = `{{fragment:${h.index}}}`
    const prose = disc.slice(cursor, h.position)
    if (prose) segments.push({ type: 'prose', md: prose })
    segments.push({ type: 'card', index: h.index, raw: frags[h.index] })
    cursor = h.position + marker.length
  }

  // Tail prose after the last marker: strip any dangling out-of-range
  // {{fragment:N}} markers (the only place a literal fragment regex is used —
  // matching the prior tail-strip behavior). This is a
  // strip-only operation; it can never consume {{REF:...}} markers because the
  // pattern is anchored on the literal `fragment` channel name.
  const cleanTail = disc.slice(cursor).replace(/\{\{fragment:(\d+)\}\}/g, (m, d) => {
    const i = parseInt(d, 10)
    return i < 0 || i >= frags.length ? '' : m
  })
  if (cleanTail) segments.push({ type: 'prose', md: cleanTail })

  // D-04: append orphan (unreferenced) fragments as cards at the end, in order.
  frags.forEach((raw, i) => {
    if (!referenced.has(i)) segments.push({ type: 'card', index: i, raw })
  })

  return segments
}
