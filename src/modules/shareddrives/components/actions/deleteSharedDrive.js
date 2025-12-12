import React, { forwardRef } from 'react'

import { Q } from 'cozy-client'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import TrashIcon from 'cozy-ui/transpiled/react/Icons/Trash'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { showModal } from '@/lib/react-cozy-helpers'
import DeleteConfirm from '@/modules/drive/DeleteConfirm'
import { getFolderIdFromSharing } from '@/modules/shareddrives/helpers'
import { isFolderFromSharedDriveOwner } from '@/modules/shareddrives/helpers'

export const deleteSharedDrive = ({
  sharedDrive,
  client,
  dispatch,
  showAlert,
  t
}) => {
  const label = t('toolbar.delete_shared_drive')
  const icon = TrashIcon

  return {
    name: 'deleteSharedDrive',
    label: label,
    icon,
    // This action can be triggered with an io.cozy.sharing when called from sidebar
    // or with an io.cozy.files when called from the sharing tab that's why we need to
    // manage two kind of data
    displayCondition: docs =>
      sharedDrive ? sharedDrive.owner : isFolderFromSharedDriveOwner(docs[0]),
    action: async docs => {
      const sharedDriveFolderId = sharedDrive
        ? getFolderIdFromSharing(sharedDrive)
        : docs[0]._id

      if (!sharedDriveFolderId) {
        showAlert({
          message: t('alert.folder_generic'),
          severity: 'error'
        })
        return
      }

      const { data: folder } = await client.query(
        Q('io.cozy.files').getById(sharedDriveFolderId)
      )

      if (!folder) {
        showAlert({
          message: t('alert.folder_generic'),
          severity: 'error'
        })
        return
      }

      dispatch(
        showModal(
          <DeleteConfirm
            files={[folder]}
            afterConfirmation={() =>
              showAlert({
                message: t('alert.trash_shared_drive_success'),
                severity: 'success'
              })
            }
          />
        )
      )
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
