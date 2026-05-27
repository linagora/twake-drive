import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ShareIcon from 'cozy-ui/transpiled/react/Icons/Share'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { navigateToModal } from '@/modules/actions/helpers'
import {
  getSharedDriveRootFileSharePath,
  SHARED_DRIVE_ROOT_FILE_PATH_SCOPE
} from '@/modules/routeUtils'
import { isFromSharedDriveRecipient } from '@/modules/shareddrives/helpers'
import { DRIVE_ROOT_TYPE } from '@/modules/shareddrives/types'

// Only for sharing tabs
export const shareSharedDrive = ({ navigate, t, isOwner }) => {
  const label = t('Files.share.cta')
  const icon = ShareIcon

  return {
    name: 'shareSharedDrive',
    label: label,
    icon,
    displayCondition: docs => {
      const [doc] = docs

      return (
        docs.length === 1 &&
        isFromSharedDriveRecipient(doc) &&
        isOwner?.(doc._id)
      )
    },
    action: docs => {
      const [doc] = docs
      const fileOrFolderId = doc._id
      const driveId = doc.driveId

      if (doc.drive_root_type === DRIVE_ROOT_TYPE.FILE) {
        navigate(
          getSharedDriveRootFileSharePath({
            driveId,
            fileId: fileOrFolderId,
            scope: SHARED_DRIVE_ROOT_FILE_PATH_SCOPE.SHARINGS
          })
        )
        return
      }

      navigateToModal({
        navigate,
        pathname: `/shareddrive/${driveId}/${fileOrFolderId}`,
        files: [{ ...doc, id: doc.id ?? doc._id }],
        path: 'share'
      })
    },
    Component: forwardRef(function ShareSharedDrive(props, ref) {
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
