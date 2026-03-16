import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import MovetoIcon from 'cozy-ui/transpiled/react/Icons/Moveto'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { navigateToModalWithMultipleFile } from '@/modules/actions/helpers'
import { isFromSharedDriveRecipient } from '@/modules/shareddrives/helpers'

const moveTo = ({
  t,
  canMove,
  pathname,
  navigate,
  isMobile,
  search,
  shouldHideIfSharedDriveRecipient
}) => {
  const icon = MovetoIcon
  const label = isMobile
    ? t('SelectionBar.moveto_mobile')
    : t('SelectionBar.moveto')

  return {
    name: 'moveTo',
    label,
    icon,
    allowInfectedFiles: false,
    displayCondition: docs => {
      // special case for rename in sharings tab
      const isAllowedForSharedDrive = shouldHideIfSharedDriveRecipient
        ? docs.every(doc => !isFromSharedDriveRecipient(doc))
        : true
      return docs.length > 0 && canMove && isAllowedForSharedDrive
    },
    action: async files => {
      navigateToModalWithMultipleFile({
        files,
        pathname,
        navigate,
        path: 'move',
        search
      })
    },
    Component: forwardRef(function MoveTo(props, ref) {
      return (
        <ActionsMenuItem {...props} ref={ref}>
          <ListItemIcon>
            <Icon icon={icon} />
          </ListItemIcon>
          <ListItemText primary={label} />
        </ActionsMenuItem>
      )
    })
  }
}

export { moveTo }
