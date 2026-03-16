import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import LogoutIcon from 'cozy-ui/transpiled/react/Icons/Logout'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { isFromSharedDriveRecipient } from '@/modules/shareddrives/helpers'

// Only for sharing tabs
export const leaveSharedDrive = ({ client, showAlert, t }) => {
  const label = t('toolbar.menu_leave_shared_drive')
  const icon = LogoutIcon

  return {
    name: 'leaveSharedDrive',
    label: label,
    icon,
    displayCondition: docs => {
      return docs.length === 1 && isFromSharedDriveRecipient(docs[0])
    },
    action: async docs => {
      const sharedDriveId = docs[0].driveId

      await client
        .collection('io.cozy.sharings')
        .revokeSelf({ _id: sharedDriveId })

      showAlert({
        message: t('Files.share.revokeSelf.success'),
        severity: 'success'
      })
    },
    Component: forwardRef(function deleteSharedDrive(props, ref) {
      return (
        <ActionsMenuItem {...props} ref={ref}>
          <ListItemIcon>
            <Icon icon={icon} className="u-error" />
          </ListItemIcon>
          <ListItemText primary={label} className="u-error" />
        </ActionsMenuItem>
      )
    })
  }
}
