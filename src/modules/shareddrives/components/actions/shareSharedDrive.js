import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ShareIcon from 'cozy-ui/transpiled/react/Icons/Share'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { navigateToModal } from '@/modules/actions/helpers'
import { isFromSharedDriveRecipient } from '@/modules/shareddrives/helpers'
import { isFileRootSharedDrive } from '@/modules/shareddrives/rootFileNavigation'

// Only for sharing tabs. Handles folder-root shared drives; file-root shared
// drives are handled by `shareFileRootSharedDrive`. The two are mutually
// exclusive: this one hides itself when the doc is a file-root, and the
// file-root one only shows for file-roots.
export const shareSharedDrive = ({ navigate, t, isOwner }) => {
  const label = t('Files.share.cta')
  const icon = ShareIcon

  return {
    name: 'shareSharedDrive',
    label,
    icon,
    displayCondition: docs => {
      const [doc] = docs

      return (
        docs.length === 1 &&
        isFromSharedDriveRecipient(doc) &&
        !isFileRootSharedDrive(doc) &&
        isOwner?.(doc._id)
      )
    },
    action: docs => {
      const folderId = docs[0]._id
      const driveId = docs[0].driveId

      navigateToModal({
        navigate,
        pathname: `/shareddrive/${driveId}/${folderId}`,
        files: docs,
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
