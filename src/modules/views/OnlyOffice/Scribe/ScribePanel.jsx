import React from 'react'

import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Icon from 'cozy-ui/transpiled/react/Icon'
import CrossIcon from 'cozy-ui/transpiled/react/Icons/Cross'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useTheme } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'

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
  const { t } = useI18n()
  const theme = useTheme()
  const { closePanel } = useScribe()

  const isDark = (theme.palette.type || theme.palette.mode) === 'dark'

  return (
    <div
      data-scribe-panel
      style={{
        width: PANEL_WIDTH,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxShadow: isDark
          ? '-4px 0 12px rgba(0, 0, 0, 0.5)'
          : '-2px 0 8px rgba(0, 0, 0, 0.1)',
        background: theme.palette.background.paper,
        overflow: 'hidden',
        transition: 'width 200ms ease-out'
      }}
    >
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
        <IconButton size="small" onClick={closePanel}>
          <Icon icon={CrossIcon} size={16} />
        </IconButton>
      </div>

      {/* Body placeholder */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          opacity: 0.6
        }}
      >
        <SparkleSvg size={48} />
        <Typography
          variant="body2"
          color="textSecondary"
          style={{ marginTop: 16 }}
        >
          {t('Scribe.panel.tagline')}
        </Typography>
      </div>
    </div>
  )
}
