import cx from 'classnames'
import React, { useEffect, useState } from 'react'

import { useI18n } from 'twake-i18n'

import styles from './styles.styl'

export const ScribeResizeHandle = ({ onResize }) => {
  const { t } = useI18n()
  const [isDragging, setIsDragging] = useState(false)

  // The pointer crosses the editor and the assistant while it drags: their
  // text must not get selected, nor their cursor show
  useEffect(() => {
    if (!isDragging) return

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    return () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDragging])

  const handlePointerDown = event => {
    event.preventDefault()
    // Keeps the moves coming when the pointer is over a frame
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setIsDragging(true)
  }
  const handlePointerMove = event => {
    if (isDragging) onResize(event.clientX)
  }
  const handlePointerUp = () => {
    setIsDragging(false)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t('OnlyOffice.scribe.resizeHandle')}
      className={cx(
        'u-flex u-flex-items-center u-flex-justify-center u-flex-shrink-0',
        styles['scribe-resize-handle'],
        isDragging && styles['scribe-resize-handle--dragging']
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  )
}
