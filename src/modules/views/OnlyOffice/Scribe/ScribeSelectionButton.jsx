import { Icon } from '@linagora/twake-icons'
import cx from 'classnames'
import React from 'react'

import flag from 'cozy-flags'
import ButtonBase from 'cozy-ui/transpiled/react/ButtonBase'
import Portal from 'cozy-ui/transpiled/react/Portal'
import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import { useI18n } from 'twake-i18n'

import SparkleIcon from './assets/sparkle.svg'
import styles from './styles.styl'

import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'

const ASSET_SIZE = 48
// The asset holds its white disc and the shadow around it: the disc is
// 12 px inside its left edge and 9 px inside its top edge
const DISC_SIZE = 24
const DISC_INSET_LEFT = 12
const DISC_INSET_TOP = 9
// Between the end of the selection and the disc
const GAP = 4
const TOOLTIP_DELAY = 500
// The tooltip goes under the disc, not under the shadow of the asset, and
// stays there: above, the offset would put it on the disc
const TOOLTIP_POPPER_PROPS = {
  modifiers: {
    flip: { enabled: false },
    offset: { offset: `0,${DISC_INSET_TOP + DISC_SIZE - ASSET_SIZE}` }
  }
}

const isInBox = (disc, box) =>
  disc.left >= box.left &&
  disc.top >= box.top &&
  disc.left + DISC_SIZE <= box.left + box.width &&
  disc.top + DISC_SIZE <= box.top + box.height

// The disc goes below and right of the end of the selection, and is not
// shown once it would leave the viewer of the editor, as when the selection
// is scrolled out of it
const findButtonPosition = geometry => {
  const { selection, viewer, frame } = geometry ?? {}
  const end = selection?.rect?.corners?.[3]
  if (!selection?.hasText || !end || !viewer || !frame) return null

  const disc = { left: end[0] + GAP, top: end[1] + GAP }
  if (!isInBox(disc, viewer)) return null
  return {
    left: frame.left + disc.left - DISC_INSET_LEFT,
    top: frame.top + disc.top - DISC_INSET_TOP
  }
}

export const ScribeSelectionButton = () => {
  const { t } = useI18n()
  const { isPublic, isReadOnly } = useOnlyOfficeContext()
  const { isAvailable, geometry, open } = useScribe()

  if (!isAvailable || isPublic || isReadOnly) return null
  if (!flag('cozy.assistant.enabled')) return null
  const position = findButtonPosition(geometry)
  if (position === null) return null

  const label = t('OnlyOffice.scribe.selectionMenu')

  return (
    <Portal into="body">
      {/* ButtonBase sets its own position: the placement goes on a wrapper */}
      <div
        className={cx('u-pos-fixed u-flex', styles['scribe-selection-button'])}
        // Follows the selection: the only values that cannot be static
        style={position}
        data-testid="scribe-selection-button"
      >
        <Tooltip
          title={label}
          enterDelay={TOOLTIP_DELAY}
          PopperProps={TOOLTIP_POPPER_PROPS}
        >
          <ButtonBase
            aria-label={label}
            disableRipple
            onClick={() => open({ source: 'selection' })}
          >
            <Icon icon={SparkleIcon} size={ASSET_SIZE} preserveColor />
          </ButtonBase>
        </Tooltip>
      </div>
    </Portal>
  )
}
