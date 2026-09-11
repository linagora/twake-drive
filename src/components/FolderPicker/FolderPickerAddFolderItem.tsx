import { Icon, FileTypeFolder } from '@linagora/twake-icons'
import React, { FC } from 'react'
import { useDispatch } from 'react-redux'

import { useClient } from 'cozy-client'
import Divider from 'cozy-ui/transpiled/react/Divider'
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
  afterSubmit?: () => void
  afterAbort: () => void
  driveId?: string
  onSubmit?: (name: string) => Promise<void>
  inputAriaLabel?: string
  errorMessage?: string
  disableGutters?: boolean
}

const FolderPickerAddFolderItem: FC<FolderPickerAddFolderItemProps> = ({
  currentFolderId,
  visible,
  afterSubmit,
  afterAbort,
  driveId,
  onSubmit,
  inputAriaLabel,
  errorMessage,
  disableGutters = false
}) => {
  const { isMobile } = useBreakpoints()
  const gutters = disableGutters ? 'disabled' : isMobile ? 'default' : 'double'
  const dispatch = useDispatch()
  const { showAlert } = useAlert()
  const { t } = useI18n()
  const client = useClient()

  const handleSubmit = async (name: string): Promise<void> => {
    if (onSubmit) {
      await onSubmit(name)
      return
    }
    dispatch(
      createFolder(client, name, currentFolderId, { showAlert, t }, driveId)
    )
    afterSubmit?.()
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
        <ListItem gutters={gutters} data-testid="folder-picker-add-folder-item">
          <ListItemIcon>
            <Icon icon={FileTypeFolder} size={32} />
          </ListItemIcon>
          <FilenameInput
            inputAriaLabel={inputAriaLabel}
            errorMessage={errorMessage}
            onSubmit={handleSubmit}
            onAbort={handleAbort}
          />
        </ListItem>
        <Divider />
      </>
    )
  }

  return null
}

export { FolderPickerAddFolderItem }
