import cx from 'classnames'
import React, { Suspense, lazy, useRef } from 'react'

import ButtonBase from 'cozy-ui/transpiled/react/ButtonBase'
import Portal from 'cozy-ui/transpiled/react/Portal'
import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import { useCozyTheme } from 'cozy-ui-plus/dist/providers/CozyTheme'
import { useI18n } from 'twake-i18n'

import styles from './styles.styl'

import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'
import { isScribeAllowed } from '@/modules/views/OnlyOffice/Scribe/availability'

// lottie-web and the animation weigh about 85 kB gzip: they stay out of the
// entry chunks, for a button only an open text document shows
const ScribeButtonMark = lazy(async () => {
  const { ScribeButtonMark } = await import('./ScribeButtonMark')
  return { default: ScribeButtonMark }
})

const BUTTON_WIDTH = 48
const EDGE_MARGIN = 12

const isMotionReduced = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true

// At the top right of the viewer of the editor: below its ribbon and rulers,
// left of its own icon strip, and never past the left edge of the viewer
const findButtonPosition = geometry => {
  const { viewer, frame } = geometry ?? {}
  if (!viewer || !frame) return null

  const right = viewer.left + viewer.width
  return {
    left:
      frame.left +
      Math.max(right - EDGE_MARGIN - BUTTON_WIDTH, viewer.left + EDGE_MARGIN),
    top: frame.top + viewer.top + EDGE_MARGIN
  }
}

export const ScribeFloatingButton = () => {
  const { t } = useI18n()
  const { type: themeType } = useCozyTheme()
  const isAllowed = isScribeAllowed(useOnlyOfficeContext())
  const { isAvailable, isOpen, documentType, geometry, open, close } =
    useScribe()
  const lottieRef = useRef(null)

  if (!isAvailable || !isAllowed) return null
  // The plugin sends no geometry for a presentation: the button would stay
  // in the corner of the window, over the panel once open
  if (documentType !== 'word') return null

  const position = findButtonPosition(geometry)
  const label = t('OnlyOffice.scribe.panel')

  const handleMouseEnter = () => {
    if (!isMotionReduced()) lottieRef.current?.play()
  }
  const stopMark = () => {
    lottieRef.current?.goToAndStop(0)
  }
  // The panel resizes the viewer, so the button moves from under a still
  // pointer, which gets no mouseleave until it moves
  const handleClick = () => {
    stopMark()
    if (isOpen) close()
    else open({ source: 'floating' })
  }

  return (
    <Portal into="body">
      {/* Out of the element that holds the class of the theme: set it again,
          as the Dialog of cozy-ui does */}
      <div
        className={cx(
          'u-pos-fixed u-flex',
          `TwakeTheme--${themeType}`,
          styles['scribe-floating-button'],
          position === null && styles['scribe-floating-button--corner']
        )}
        // Follows the document area: the only values that cannot be static
        style={position}
        data-testid="scribe-floating-button"
      >
        <Tooltip title={label}>
          <ButtonBase
            aria-label={label}
            aria-pressed={isOpen}
            disableRipple
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={stopMark}
          >
            <div
              className={cx(
                'u-pos-relative u-ov-hidden',
                styles['scribe-floating-button-slot']
              )}
            >
              <Suspense fallback={null}>
                <ScribeButtonMark lottieRef={lottieRef} />
              </Suspense>
            </div>
          </ButtonBase>
        </Tooltip>
      </div>
    </Portal>
  )
}
