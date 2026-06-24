import React, { useState } from 'react'

import { useTheme } from 'cozy-ui/transpiled/react/styles'

const SCRIBE_PURPLE = '#7C3AED'

/**
 * Compact chip showing truncated selected text from the OO editor.
 * Click chip body to expand/collapse full text. Inclusion is controlled by the
 * « sélection » checkbox in ScribeIncludeZone (the old inline × dismiss button
 * was removed in v3.2-01 — unchecking the box hides the chip instead).
 */
export const SelectionChip = ({ selection }) => {
  const [expanded, setExpanded] = useState(false)
  const theme = useTheme()

  if (!selection) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 4,
        padding: '4px 0',
        marginBottom: 4
      }}
    >
      <div
        onClick={() => setExpanded(prev => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(prev => !prev)
          }
        }}
        style={{
          flex: 1,
          minWidth: 0,
          borderLeft: `3px solid ${SCRIBE_PURPLE}`,
          paddingLeft: 8,
          background: theme.palette.action.hover,
          borderRadius: '0 4px 4px 0',
          padding: '4px 8px 4px 8px',
          cursor: 'pointer',
          fontSize: 12,
          lineHeight: 1.4,
          color: theme.palette.text.secondary,
          fontStyle: 'italic',
          ...(expanded
            ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
            : {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              })
        }}
        aria-label="Selected text"
      >
        {selection.text}
      </div>
    </div>
  )
}
