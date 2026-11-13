import React, { forwardRef } from 'react'

import { Icon, Moveto } from '@linagora/twake-icons'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { navigateToModalWithMultipleFile } from '@/modules/actions/helpers'
import { isSharedDriveDoc } from '@/modules/shareddrives/helpers'

const moveTo = ({
  t,
  canMove,
  pathname,
  navigate,
  isMobile,
  search,
  shouldHideIfSharedDriveRecipient,
  withDriveIdInModalPath
}) => {
  const icon = Moveto
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
        ? docs.every(doc => !isSharedDriveDoc(doc))
        : true
      // The move modal of shared drive items opens in their drive folder, so
      // they must all come from the same folder of the same drive.
      const isFromSameFolder =
        !withDriveIdInModalPath ||
        docs.every(
          doc =>
            doc.driveId === docs[0].driveId &&
            (!isSharedDriveDoc(doc) || doc.dir_id === docs[0].dir_id)
        )
      return (
        docs.length > 0 &&
        canMove &&
        isAllowedForSharedDrive &&
        isFromSameFolder
      )
    },
    action: async files => {
      navigateToModalWithMultipleFile({
        files,
        pathname,
        navigate,
        path: 'move',
        search,
        withDriveIdInModalPath
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
