import React, { useState } from 'react'

import { useTheme } from 'cozy-ui/transpiled/react/styles'

const SCRIBE_PURPLE = '#7C3AED'

/**
 * Compact chip showing truncated selected text from the OO editor.
 * Click chip body to expand/collapse full text. Dismiss button clears it.
 */
export const SelectionChip = ({ selection, onDismiss }) => {
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
      <button
        onClick={onDismiss}
        aria-label="Dismiss selection"
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          border: 'none',
          background: 'transparent',
          color: theme.palette.text.secondary,
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          lineHeight: 1,
          borderRadius: '50%',
          marginTop: 2
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M3 3l6 6M9 3l-6 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}
