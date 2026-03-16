import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ShareIcon from 'cozy-ui/transpiled/react/Icons/Share'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { navigateToModal } from '@/modules/actions/helpers'
import { isFromSharedDriveRecipient } from '@/modules/shareddrives/helpers'

// Only for sharing tabs
export const shareSharedDrive = ({ navigate, t }) => {
  const label = t('Files.share.cta')
  const icon = ShareIcon

  return {
    name: 'shareSharedDrive',
    label: label,
    icon,
    displayCondition: docs => {
      return docs.length === 1 && isFromSharedDriveRecipient(docs[0])
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
