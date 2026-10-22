import cx from 'classnames'
import React, { useEffect, useState } from 'react'

import { useI18n } from 'twake-i18n'

import styles from './styles.styl'

import { clampPanelWidth } from '@/modules/views/OnlyOffice/Scribe/panelState'

const KEY_STEP = 16
const KEY_LARGE_STEP = 64
const MAIN_BUTTON = 0

/**
 * The gutter on the left of the panel. `onResize` gets the x where the left
 * edge of the panel goes, in the window.
 */
export const ScribeResizeHandle = ({ width, onResize }) => {
  const { t } = useI18n()
  // How far into the handle the pointer grabbed it, while it drags
  const [grabOffset, setGrabOffset] = useState(null)
  const isDragging = grabOffset !== null

  // The pointer crosses the editor and the assistant while it drags: their
  // text must not get selected, nor their cursor show
  useEffect(() => {
    if (!isDragging) return

    const endDrag = () => setGrabOffset(null)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    // Without the capture, the release may come outside of the handle
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    return () => {
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDragging])

  const handlePointerDown = event => {
    if (event.button !== MAIN_BUTTON) return

    event.preventDefault()
    // Keeps the moves coming when the pointer is over a frame
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setGrabOffset(
      event.clientX - event.currentTarget.getBoundingClientRect().left
    )
  }
  const handlePointerMove = event => {
    if (isDragging) onResize(event.clientX - grabOffset)
  }
  const handleLostPointerCapture = () => {
    setGrabOffset(null)
  }

  const edge = window.innerWidth - width
  const handleKeyDown = event => {
    const step = event.shiftKey ? KEY_LARGE_STEP : KEY_STEP
    // Home and End put the edge past either side: the clamp stops the panel
    // at its smallest and largest width
    const edgeByKey = {
      ArrowLeft: edge - step,
      ArrowRight: edge + step,
      Home: window.innerWidth,
      End: 0
    }
    const nextEdge = edgeByKey[event.key]
    if (nextEdge === undefined) return

    event.preventDefault()
    onResize(nextEdge)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t('OnlyOffice.scribe.resizeHandle')}
      aria-valuenow={Math.round(width)}
      aria-valuemin={Math.round(clampPanelWidth(0, window.innerWidth))}
      aria-valuemax={Math.round(clampPanelWidth(Infinity, window.innerWidth))}
      tabIndex={0}
      className={cx(
        'u-flex u-flex-items-center u-flex-justify-center u-flex-shrink-0',
        styles['scribe-resize-handle'],
        isDragging && styles['scribe-resize-handle--dragging']
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onLostPointerCapture={handleLostPointerCapture}
      onKeyDown={handleKeyDown}
    />
  )
}
