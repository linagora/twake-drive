import cx from 'classnames'
import React, { useEffect, useState } from 'react'

import { useCozyTheme } from 'cozy-ui-plus/dist/providers/CozyTheme'
import { useI18n } from 'twake-i18n'

import styles from './styles.styl'

import { ScribeIntent } from '@/modules/views/OnlyOffice/Scribe/ScribeIntent'
import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'
import { ScribeResizeHandle } from '@/modules/views/OnlyOffice/Scribe/ScribeResizeHandle'
import {
  PANEL_DEFAULT_WIDTH,
  clampPanelWidth
} from '@/modules/views/OnlyOffice/Scribe/panelState'

export const ScribePanel = () => {
  const { t } = useI18n()
  const { type: themeType } = useCozyTheme()
  const {
    isOpen,
    source,
    draft,
    conversation,
    handOverId,
    close,
    applyResult
  } = useScribe()
  const [panelWidth, setPanelWidth] = useState(() =>
    clampPanelWidth(PANEL_DEFAULT_WIDTH, window.innerWidth)
  )

  useEffect(() => {
    const handleWindowResize = () => {
      setPanelWidth(width => clampPanelWidth(width, window.innerWidth))
    }

    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [])

  if (!isOpen) return null

  // The panel ends at the right edge of the window
  const handleResize = edge => {
    setPanelWidth(clampPanelWidth(window.innerWidth - edge, window.innerWidth))
  }

  return (
    <aside
      className={cx(
        'u-flex u-flex-shrink-0',
        styles['scribe-panel'],
        themeType === 'dark' && styles['scribe-panel--dark']
      )}
      // Dragged by the handle: the only value that cannot be static
      style={{ width: panelWidth }}
      aria-label={t('OnlyOffice.scribe.open')}
    >
      <ScribeResizeHandle width={panelWidth} onResize={handleResize} />
      <div
        className={cx('u-flex-grow-1 u-ov-hidden', styles['scribe-panel-card'])}
      >
        <ScribeIntent
          key={handOverId}
          layout="panel"
          source={source}
          draft={draft}
          conversation={conversation}
          onResult={applyResult}
          onCancel={close}
        />
      </div>
    </aside>
  )
}
