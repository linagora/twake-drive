import cx from 'classnames'
import Lottie from 'lottie-react'
import React, { useRef } from 'react'

import flag from 'cozy-flags'
import ButtonBase from 'cozy-ui/transpiled/react/ButtonBase'
import Portal from 'cozy-ui/transpiled/react/Portal'
import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import { useCozyTheme } from 'cozy-ui-plus/dist/providers/CozyTheme'
import { useI18n } from 'twake-i18n'

import buttonAnimation from './assets/scribeButtonAnimation.json'
import styles from './styles.styl'

import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'

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
  const { isPublic, isReadOnly } = useOnlyOfficeContext()
  const { isAvailable, isOpen, geometry, open, close } = useScribe()
  const lottieRef = useRef(null)

  if (!isAvailable || isPublic || isReadOnly) return null
  if (!flag('cozy.assistant.enabled')) return null

  const position = findButtonPosition(geometry)
  const label = t('OnlyOffice.scribe.panel')

  const handleMouseEnter = () => {
    if (!isMotionReduced()) lottieRef.current?.play()
  }
  const handleMouseLeave = () => {
    lottieRef.current?.goToAndStop(0)
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
            onClick={isOpen ? close : () => open({ source: 'floating' })}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div
              className={cx(
                'u-pos-relative u-ov-hidden',
                styles['scribe-floating-button-slot']
              )}
            >
              <Lottie
                className={cx(
                  'u-pos-absolute',
                  styles['scribe-floating-button-mark']
                )}
                lottieRef={lottieRef}
                animationData={buttonAnimation}
                autoplay={false}
                aria-hidden="true"
              />
            </div>
          </ButtonBase>
        </Tooltip>
      </div>
    </Portal>
  )
}
