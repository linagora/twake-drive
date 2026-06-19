import React from 'react'

import { useTheme } from 'cozy-ui/transpiled/react/styles'

import { MarkdownPreview } from '@/modules/views/OnlyOffice/Scribe/MarkdownPreview'
import MessageActions from '@/modules/views/OnlyOffice/Scribe/MessageActions'

// Scribe accent (matches ChatMessageList SCRIBE_PURPLE / SCRIBE_PURPLE_08).
const SCRIBE_PURPLE = '#7C3AED'
const SCRIBE_PURPLE_08 = 'rgba(124, 58, 237, 0.08)'

/**
 * FragmentCard - a bordered Scribe-purple card for a single LLM response
 * fragment (FRAG-01/D-01). It renders the fragment as rich markdown via
 * MarkdownPreview and carries its own Copy / Insert / Replace actions.
 *
 * D-03 INVARIANT (the governing rule): the `raw` fragment string — markers
 * intact ({{REF:...}}, [TABLE:]/[CELL:], [^scribe-fn-N]) — is passed UNCHANGED
 * to BOTH consumers:
 *   - <MarkdownPreview> does cosmetic marker cleanup INTERNALLY (returns a new
 *     display string, never mutating the input) for display only.
 *   - <MessageActions content={raw}> routes Copy/Insert/Replace on the verbatim
 *     raw, which the OO rich-reinjection pipeline (FRAG-03) parses to restore
 *     tables/images/footnotes/cross-refs.
 * FragmentCard performs NO string cleaning of `raw` itself — stripping markers
 * here would silently break FRAG-03.
 *
 * Replace is gated on `hasSelection` (FRAG-04/D-07) inside MessageActions, and
 * each action button shows the accent focus ring (D-09) from MessageActions —
 * the focusable-<button> substrate the Plan 05 keyboard controller drives.
 */
const FragmentCard = ({ raw, hasSelection }) => {
  const theme = useTheme()
  const isDark = (theme.palette.type || theme.palette.mode) === 'dark'

  return (
    <div
      style={{
        border: `1px solid ${SCRIBE_PURPLE}`,
        background: isDark ? 'rgba(124, 58, 237, 0.12)' : SCRIBE_PURPLE_08,
        borderRadius: 8,
        padding: '8px 10px',
        margin: '4px 0'
      }}
    >
      <MarkdownPreview>{raw}</MarkdownPreview>
      <MessageActions content={raw} hasSelection={hasSelection} />
    </div>
  )
}

export { FragmentCard }
