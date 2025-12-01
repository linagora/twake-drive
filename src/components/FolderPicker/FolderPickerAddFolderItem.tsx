import React, { FC } from 'react'
import { useDispatch } from 'react-redux'

import { useClient } from 'cozy-client'
import { useVaultClient } from 'cozy-keys-lib'
import Divider from 'cozy-ui/transpiled/react/Divider'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconFolder from 'cozy-ui/transpiled/react/Icons/FileTypeFolder'
import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'cozy-ui/transpiled/react/providers/I18n'

import FilenameInput from '@/modules/filelist/FilenameInput'
import { createFolder } from '@/modules/navigation/duck'
import IconEncryptedFolder from '@/modules/views/Folder/EncryptedFolderIcon'

interface FolderPickerAddFolderItemProps {
  isEncrypted: boolean
  currentFolderId: string
  visible: boolean
  afterSubmit: () => void
  afterAbort: () => void
  driveId?: string
}

const FolderPickerAddFolderItem: FC<FolderPickerAddFolderItemProps> = ({
  isEncrypted,
  currentFolderId,
  visible,
  afterSubmit,
  afterAbort,
  driveId
}) => {
  const { isMobile } = useBreakpoints()
  const gutters = isMobile ? 'default' : 'double'
  const dispatch = useDispatch()
  const { showAlert } = useAlert()
  const { t } = useI18n()
  const vaultClient = useVaultClient()
  const client = useClient()

  const handleSubmit = (name: string): void => {
    dispatch(
      createFolder(
        client,
        vaultClient,
        name,
        currentFolderId,
        {
          isEncryptedFolder: isEncrypted,
          showAlert,
          t
        },
        driveId
      )
    )
    if (typeof afterSubmit === 'function') {
      afterSubmit()
    }
  }

  const handleAbort = (accidental: boolean): void => {
    if (accidental) {
      showAlert({
        message: t('alert.folder_abort'), //
        severity: 'secondary'
      })
    }
    if (typeof afterAbort === 'function') {
      afterAbort()
    }
  }

  if (visible) {
    return (
      <>
        <ListItem gutters={gutters}>
          <ListItemIcon>
            <Icon
              icon={isEncrypted ? IconEncryptedFolder : IconFolder}
              size={32}
            />
          </ListItemIcon>
          <FilenameInput onSubmit={handleSubmit} onAbort={handleAbort} />
        </ListItem>
        <Divider />
      </>
    )
  }

  return null
}

export { FolderPickerAddFolderItem }
