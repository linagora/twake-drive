import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const baseStyle = {
  position: 'fixed',
  bottom: 80,
  right: 40,
  zIndex: 100000,
  opacity: 0.4,
  transition: 'opacity 200ms ease',
  cursor: 'pointer',
  borderRadius: 20,
  padding: '8px 16px',
  background: 'white',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 14,
  fontFamily: 'inherit',
  color: '#333'
}

const tooltipStyle = {
  position: 'absolute',
  bottom: '100%',
  right: 0,
  marginBottom: 8,
  padding: '6px 10px',
  background: '#333',
  borderRadius: 6,
  fontSize: 12,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 4
}

/**
 * Floating "Scribe" button rendered in bottom-right of the viewport.
 * Translucent by default, opaque on hover. Rendered via portal on document.body.
 *
 * @param {{ visible: boolean, onClick: () => void }} props
 */
export const ScribeFloatingButton = ({ visible, onClick }) => {
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (visible) setHovered(false)
  }, [visible])

  if (!visible) return null

  return createPortal(
    <button
      style={{ ...baseStyle, opacity: hovered ? 1 : 0.4 }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      type="button"
    >
      {hovered && (
        <span style={tooltipStyle}>
          <span style={{ color: 'white' }}>Text AI</span>
          <span style={{ color: '#999' }}>(Ctrl+I)</span>
        </span>
      )}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8 1l1.796 4.204L14 7l-4.204 1.796L8 13l-1.796-4.204L2 7l4.204-1.796L8 1z"
          fill="#7C3AED"
          stroke="#7C3AED"
          strokeWidth="0.5"
        />
        <path
          d="M12.5 1l.898 2.102L15.5 4l-2.102.898L12.5 7l-.898-2.102L9.5 4l2.102-.898L12.5 1z"
          fill="#7C3AED"
          stroke="#7C3AED"
          strokeWidth="0.3"
        />
      </svg>
      Scribe
    </button>,
    document.body
  )
}
