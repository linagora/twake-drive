import { Icon, Dots } from '@linagora/twake-icons'
import cx from 'classnames'
import React, { useState, useRef } from 'react'

import ActionsMenu from 'cozy-ui/transpiled/react/ActionsMenu'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { useMoreMenuActions } from '@/hooks/useMoreMenuActions'

const MoreMenu = ({ file, shouldHideSharingActions = false }) => {
  const [showMenu, setShowMenu] = useState(false)
  const { isDesktop } = useBreakpoints()
  const anchorRef = useRef()
  const actions = useMoreMenuActions(file, {
    shouldHideIfSharedDriveRecipient: shouldHideSharingActions
  })

  if (file.trashed) return null

  return (
    <>
      <IconButton
        ref={anchorRef}
        variant="secondary"
        className={cx({ 'u-white': isDesktop })}
        onClick={() => setShowMenu(v => !v)}
      >
        <Icon icon={Dots} />
      </IconButton>
      {showMenu && (
        <ActionsMenu
          open
          ref={anchorRef}
          docs={[file]}
          actions={actions}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right'
          }}
          autoClose
          onClose={() => setShowMenu(false)}
        />
      )}
    </>
  )
}

export default MoreMenu
