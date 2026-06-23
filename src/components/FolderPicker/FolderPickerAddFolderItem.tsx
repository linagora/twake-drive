import React, { FC } from 'react'
import { useDispatch } from 'react-redux'

import { useClient } from 'cozy-client'
import Divider from 'cozy-ui/transpiled/react/Divider'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconFolder from 'cozy-ui/transpiled/react/Icons/FileTypeFolder'
import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import FilenameInput from '@/modules/filelist/FilenameInput'
import { createFolder } from '@/modules/navigation/duck'

interface FolderPickerAddFolderItemProps {
  currentFolderId: string
  visible: boolean
  afterSubmit: () => void
  afterAbort: () => void
  driveId?: string
}

const FolderPickerAddFolderItem: FC<FolderPickerAddFolderItemProps> = ({
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
  const client = useClient()

  const handleSubmit = (name: string): void => {
    dispatch(
      createFolder(client, name, currentFolderId, { showAlert, t }, driveId)
    )
    if (typeof afterSubmit === 'function') {
      afterSubmit()
    }
  }

  const handleAbort = (accidental: boolean): void => {
    if (accidental) {
      showAlert({
        message: t('alert.folder_abort'),
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
            <Icon icon={IconFolder} size={32} />
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
