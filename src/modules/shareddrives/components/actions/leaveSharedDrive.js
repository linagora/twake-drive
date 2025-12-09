import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import LogoutIcon from 'cozy-ui/transpiled/react/Icons/Logout'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { isFolderFromSharedDriveRecipient } from '@/modules/shareddrives/helpers'

export const leaveSharedDrive = ({ sharedDrive, client, showAlert, t }) => {
  const label = t('toolbar.menu_leave_shared_drive')
  const icon = LogoutIcon

  return {
    name: 'leaveSharedDrive',
    label: label,
    icon,
    // This action can be triggered with an io.cozy.sharing when called from sidebar
    // or with an io.cozy.files when called from the sharing tab that's why we need to
    // manage two kind of data
    displayCondition: docs => {
      return sharedDrive
        ? !sharedDrive.owner
        : isFolderFromSharedDriveRecipient(docs[0])
    },
    action: async docs => {
      const sharedDriveId = sharedDrive ? sharedDrive.id : docs[0].driveId

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
          <ListItemText primary={label} />
        </ActionsMenuItem>
      )
    })
  }
}
