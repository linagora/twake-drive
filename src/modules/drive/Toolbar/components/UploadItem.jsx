import React from 'react'
import { useDispatch } from 'react-redux'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import { useVaultClient } from 'cozy-keys-lib'
import withSharingState from 'cozy-sharing/dist/hoc/withSharingState'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import FileInput from 'cozy-ui/transpiled/react/FileInput'
import Icon from 'cozy-ui/transpiled/react/Icon'
import UploadIcon from 'cozy-ui/transpiled/react/Icons/Upload'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { useDisplayedFolder } from '@/hooks'
import { uploadFiles } from '@/modules/navigation/duck'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

const UploadItem = ({
  onClick,
  isReadOnly,
  displayedFolder,
  sharingState,
  onUploaded
}) => {
  const client = useClient()
  const vaultClient = useVaultClient()
  const { showAlert } = useAlert()
  const { initialDirId } = useDisplayedFolder()
  const { addItems } = useNewItemHighlightContext()
  const { t } = useI18n()
  const dispatch = useDispatch()

  const onUpload = (
    client,
    vaultClient,
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
        {
          client,
          vaultClient,
          showAlert,
          t
        },
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
        severity: 'warning'
      })
      onClick()
      return
    }
  }

  const handleChange = files => {
    if (isReadOnly || !files || files.length === 0) return

    onUpload(
      client,
      vaultClient,
      files,
      initialDirId,
      showAlert,
      displayedFolder?.driveId,
      addItems
    )
    onClick()
  }

  return (
    <FileInput
      label={t('toolbar.menu_upload')}
      multiple
      onChange={handleChange}
      data-testid="upload-btn"
      value={[]}
    >
      <ActionsMenuItem onClick={handleMenuItemClick}>
        <ListItemIcon>
          <Icon icon={UploadIcon} />
        </ListItemIcon>
        <ListItemText primary={t('toolbar.menu_upload')} />
      </ActionsMenuItem>
    </FileInput>
  )
}

export default withSharingState(UploadItem)
