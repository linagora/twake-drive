import React from 'react'

import { useTheme } from 'cozy-ui/transpiled/react/styles'

const SCRIBE_PURPLE = '#7C3AED'

// Deterministic fixed height so the chip slot never shifts the discussion
// (live UX review 2026-06-24). Single line, vertically centred via lineHeight;
// full selection text is available on hover via the native `title` tooltip
// (the old click-to-expand grew the chip and broke the fixed height).
export const CHIP_BODY_HEIGHT = 24

/**
 * Compact chip showing the truncated selected text from the OO editor.
 * Single fixed-height line (full text on hover). Inclusion is controlled by the
 * « sélection » checkbox in ScribeIncludeZone — unchecking the box hides the
 * chip (the old inline × dismiss button and click-to-expand were removed in
 * v3.2-01).
 */
export const SelectionChip = ({ selection }) => {
  const theme = useTheme()

  if (!selection) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 0'
      }}
    >
      <div
        title={selection.text}
        style={{
          flex: 1,
          minWidth: 0,
          height: CHIP_BODY_HEIGHT,
          lineHeight: `${CHIP_BODY_HEIGHT}px`,
          borderLeft: `3px solid ${SCRIBE_PURPLE}`,
          background: theme.palette.action.hover,
          borderRadius: '0 4px 4px 0',
          padding: '0 8px',
          fontSize: 12,
          color: theme.palette.text.secondary,
          fontStyle: 'italic',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        aria-label="Selected text"
      >
        {selection.text}
      </div>
    </div>
  )
}
