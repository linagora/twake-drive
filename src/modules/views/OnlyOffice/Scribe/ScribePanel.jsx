import React, { useState, useRef } from 'react'

import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Icon from 'cozy-ui/transpiled/react/Icon'
import CrossIcon from 'cozy-ui/transpiled/react/Icons/Cross'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useTheme } from 'cozy-ui/transpiled/react/styles'

import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'
import { ResizeHandle } from '@/modules/views/OnlyOffice/Scribe/ResizeHandle'
import { ChatMessageList } from '@/modules/views/OnlyOffice/Scribe/ChatMessageList'
import { ChatInput } from '@/modules/views/OnlyOffice/Scribe/ChatInput'
import { isScribeDevMd } from '@/modules/views/OnlyOffice/Scribe/scribeDevMode'
import { ProbeMetricsPanel } from '@/modules/views/OnlyOffice/Scribe/ScribeResultPanel'

export const PANEL_WIDTH = 400

const SCRIBE_PURPLE = '#7C3AED'

const SparkleSvg = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 1l1.796 4.204L14 7l-4.204 1.796L8 13l-1.796-4.204L2 7l4.204-1.796L8 1z"
      fill={SCRIBE_PURPLE}
      stroke={SCRIBE_PURPLE}
      strokeWidth="0.5"
    />
    <path
      d="M12.5 1l.898 2.102L15.5 4l-2.102.898L12.5 7l-.898-2.102L9.5 4l2.102-.898L12.5 1z"
      fill={SCRIBE_PURPLE}
      stroke={SCRIBE_PURPLE}
      strokeWidth="0.3"
    />
  </svg>
)

export const ScribePanel = () => {
  const theme = useTheme()
  const { closePanel, panelWidth } = useScribe()
  // Dev-only: lets a dev open the conformance probe (corpus metrics) from the
  // chat side panel — the inline ScribeResultPanel is only reachable from the
  // popover flow, so chat-side usage had no way to see the gate metrics.
  const devMode = isScribeDevMd()
  const [showProbe, setShowProbe] = useState(false)

  // Cross-component keyboard wiring (Plan 05): the input's Up-from-empty hands
  // focus to the thread controller's most-recent card; the controller returns
  // focus to the input on Escape / Down-past-newest. ScribePanel owns both refs
  // because it renders the two as siblings.
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const isDark = (theme.palette.type || theme.palette.mode) === 'dark'

  return (
    <div
      data-scribe-panel
      style={{
        width: panelWidth,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        boxShadow: isDark
          ? '-4px 0 12px rgba(0, 0, 0, 0.5)'
          : '-2px 0 8px rgba(0, 0, 0, 0.1)',
        background: theme.palette.background.paper,
        overflow: 'hidden'
      }}
    >
      <ResizeHandle />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: `1px solid ${theme.palette.divider}`
          }}
        >
          <SparkleSvg size={20} />
          <Typography
            variant="h6"
            style={{ marginLeft: 8, flex: 1 }}
          >
            Scribe
          </Typography>
          {devMode && (
            <button
              type="button"
              onClick={() => setShowProbe(v => !v)}
              title="Sonde de conformité (dev)"
              style={{
                marginRight: 8,
                fontSize: 11,
                cursor: 'pointer',
                padding: '2px 8px',
                borderRadius: 4,
                border: `1px solid ${theme.palette.divider}`,
                background: showProbe ? theme.palette.action.selected : 'transparent',
                color: theme.palette.text.secondary
              }}
            >
              Sonde
            </button>
          )}
          <IconButton size="small" onClick={closePanel}>
            <Icon icon={CrossIcon} size={16} />
          </IconButton>
        </div>

        {/* Chat body (kept mounted; probe view overlays it so chat state is preserved) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
          <ChatMessageList
            ref={listRef}
            returnFocusToInput={() => inputRef.current && inputRef.current.focus()}
          />
          <ChatInput
            ref={inputRef}
            onArrowUp={() => listRef.current && listRef.current.focusMostRecentCardInsert()}
          />
          {devMode && showProbe && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 5,
                background: theme.palette.background.paper,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'auto',
                padding: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <Typography variant="subtitle2" style={{ flex: 1 }}>
                  Sonde de conformité
                </Typography>
                <IconButton size="small" onClick={() => setShowProbe(false)}>
                  <Icon icon={CrossIcon} size={14} />
                </IconButton>
              </div>
              <ProbeMetricsPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
