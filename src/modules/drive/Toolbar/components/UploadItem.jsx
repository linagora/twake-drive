import React from 'react'
import { useDispatch } from 'react-redux'

import { Folder, Icon, Upload } from '@linagora/twake-icons'
import { useClient } from 'cozy-client'
import withSharingState from 'cozy-sharing/dist/hoc/withSharingState'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import FileInput from 'cozy-ui/transpiled/react/FileInput'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { useDisplayedFolder } from '@/hooks'
import { uploadFiles } from '@/modules/navigation/duck'
import { isDirectoryPickerAvailable } from '@/modules/upload'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

const UploadItem = ({
  onClick,
  isReadOnly,
  displayedFolder,
  sharingState,
  onUploaded,
  isDirectory
}) => {
  const client = useClient()
  const { showAlert } = useAlert()
  const { initialDirId } = useDisplayedFolder()
  const { addItems } = useNewItemHighlightContext()
  const { t } = useI18n()
  const dispatch = useDispatch()

  const onUpload = (
    client,
    files,
    initialDirId,
    showAlert,
    driveId,
    addItems
  ) => {
    dispatch(
      uploadFiles(
        files,
        initialDirId,
        sharingState,
        onUploaded,
        { client, showAlert, t },
        driveId,
        addItems
      )
    )
  }

  const handleMenuItemClick = evt => {
    if (isReadOnly) {
      evt.preventDefault()
      evt.stopPropagation()

      showAlert({
        message: t(
          'AddMenu.readOnlyFolder',
          'This is a read-only folder. You cannot perform this action.'
        ),
        severity: 'warning',
        duration: 4000
      })
      onClick()
      return
    }
  }

  const handleChange = files => {
    if (isReadOnly || !files) return

    // A picked folder holding no file at all comes back as an empty list.
    if (files.length > 0) {
      onUpload(
        client,
        files,
        initialDirId,
        showAlert,
        displayedFolder?.driveId,
        addItems
      )
    }
    onClick()
  }

  if (isDirectory && (isReadOnly || !isDirectoryPickerAvailable())) return null

  const label = t(
    isDirectory ? 'toolbar.menu_upload_folder' : 'toolbar.menu_upload'
  )

  return (
    <FileInput
      label={label}
      multiple
      onChange={handleChange}
      data-testid={isDirectory ? 'upload-folder-btn' : 'upload-btn'}
      value={[]}
      {...(isDirectory && { webkitdirectory: '' })}
    >
      <ActionsMenuItem onClick={handleMenuItemClick}>
        <ListItemIcon>
          <Icon icon={isDirectory ? Folder : Upload} />
        </ListItemIcon>
        <ListItemText primary={label} />
      </ActionsMenuItem>
    </FileInput>
  )
}

export default withSharingState(UploadItem)
