import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { useTheme } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

const getButtonStyle = isDark => ({
  cursor: 'pointer',
  borderRadius: 20,
  padding: '8px 16px',
  background: isDark ? '#2d2d2d' : 'white',
  boxShadow: isDark
    ? '0 2px 8px rgba(0,0,0,0.4)'
    : '0 2px 8px rgba(0,0,0,0.15)',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 14,
  fontFamily: 'inherit',
  color: isDark ? '#e0e0e0' : '#333',
  transition: 'opacity 200ms ease'
})

const getTooltipStyle = isDark => ({
  position: 'absolute',
  bottom: '100%',
  right: 0,
  marginBottom: 8,
  padding: '6px 10px',
  background: isDark ? '#555' : '#333',
  borderRadius: 6,
  fontSize: 12,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 4
})

const SparkleIcon = () => (
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
)

const PanelIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="1.5"
      y="2.5"
      width="13"
      height="11"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    <line
      x1="10"
      y1="2.5"
      x2="10"
      y2="13.5"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
)

/**
 * Floating zone with two buttons rendered in bottom-right of the viewport.
 * - Top button (inline Scribe): only visible when text is selected
 * - Bottom button (panel toggle): always visible
 * Both are translucent by default, opaque on hover. Rendered via portal on document.body.
 *
 * @param {{ visible: boolean, showInlineButton: boolean, onTriggerScribe: () => void, onTogglePanel: () => void }} props
 */
export const ScribeFloatingZone = ({
  visible,
  showInlineButton,
  onTriggerScribe,
  onTogglePanel
}) => {
  const { t } = useI18n()
  const theme = useTheme()
  const isDark = (theme.palette.type || theme.palette.mode) === 'dark'
  const [hoveredInline, setHoveredInline] = useState(false)
  const [hoveredPanel, setHoveredPanel] = useState(false)

  useEffect(() => {
    if (visible) {
      setHoveredInline(false)
      setHoveredPanel(false)
    }
  }, [visible])

  if (!visible) return null

  const buttonStyle = getButtonStyle(isDark)
  const tooltipStyle = getTooltipStyle(isDark)

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        right: 40,
        zIndex: 100000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}
    >
      {showInlineButton && (
        <button
          style={{
            ...buttonStyle,
            opacity: hoveredInline ? 1 : 0.4,
            position: 'relative'
          }}
          onClick={onTriggerScribe}
          onMouseEnter={() => setHoveredInline(true)}
          onMouseLeave={() => setHoveredInline(false)}
          type="button"
        >
          {hoveredInline && (
            <span style={tooltipStyle}>
              <span style={{ color: 'white' }}>
                {t('Scribe.button.text_ai')}
              </span>
              <span style={{ color: '#999' }}>(Ctrl+I)</span>
            </span>
          )}
          <SparkleIcon />
          Scribe
        </button>
      )}
      <button
        style={{
          ...buttonStyle,
          opacity: hoveredPanel ? 1 : 0.4,
          position: 'relative'
        }}
        onClick={onTogglePanel}
        onMouseEnter={() => setHoveredPanel(true)}
        onMouseLeave={() => setHoveredPanel(false)}
        type="button"
      >
        {hoveredPanel && (
          <span style={tooltipStyle}>
            <span style={{ color: 'white' }}>
              {t('Scribe.button.open_panel')}
            </span>
            <span style={{ color: '#999' }}>(Ctrl+Shift+I x2)</span>
          </span>
        )}
        <PanelIcon />
      </button>
    </div>,
    document.body
  )
}

// Backward-compatible alias
export const ScribeFloatingButton = ScribeFloatingZone
