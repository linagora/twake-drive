import cx from 'classnames'
import React, { useEffect, useState } from 'react'

import IntentIframe from 'cozy-ui-plus/dist/Intent/IntentIframe'
import { useCozyTheme } from 'cozy-ui-plus/dist/providers/CozyTheme'
import { useI18n } from 'twake-i18n'

import styles from './styles.styl'

import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'
import { ScribeResizeHandle } from '@/modules/views/OnlyOffice/Scribe/ScribeResizeHandle'
import {
  makeCapabilities,
  makeSuggestions
} from '@/modules/views/OnlyOffice/Scribe/capabilities'
import {
  PANEL_DEFAULT_WIDTH,
  clampPanelWidth
} from '@/modules/views/OnlyOffice/Scribe/panelState'

export const ScribePanel = () => {
  const { t } = useI18n()
  const { type: themeType } = useCozyTheme()
  const {
    isOpen,
    content,
    target,
    canReplace,
    documentType,
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

  // A selection that holds what an answer cannot give back, as an image or a
  // note, is not offered to be replaced. An older plugin does not tell.
  const answerActions =
    target === 'selection' && canReplace !== false
      ? ['insert', 'replace']
      : ['insert']
  const capabilities = makeCapabilities({ documentType, t })
  const suggestions = makeSuggestions({ documentType, t })
  const data = {
    content,
    answerActions: answerActions.map(name => ({
      name,
      label: t(`OnlyOffice.scribe.${name}`)
    })),
    // Left out when empty: the assistant then shows its own chips
    ...(capabilities.length > 0 && { capabilities }),
    ...(suggestions.length > 0 && { suggestions }),
    theme: { type: themeType }
  }

  // The panel ends at the right edge of the window
  const handleResize = clientX => {
    setPanelWidth(
      clampPanelWidth(window.innerWidth - clientX, window.innerWidth)
    )
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
      <ScribeResizeHandle onResize={handleResize} />
      <div
        className={cx('u-flex-grow-1 u-ov-hidden', styles['scribe-panel-card'])}
      >
        <IntentIframe
          action="OPEN"
          type="io.cozy.ai.chat.conversations"
          data={data}
          onResult={applyResult}
          onCancel={close}
          onTerminate={close}
        />
      </div>
    </aside>
  )
}
