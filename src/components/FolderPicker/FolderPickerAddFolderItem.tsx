import React, { FC } from 'react'

import { Icon, FileTypeFolder } from '@linagora/twake-icons'
import { useClient } from 'cozy-client'
import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import FilenameInput from '@/modules/filelist/FilenameInput'

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
  const { showAlert } = useAlert()
  const { t } = useI18n()
  const client = useClient()

  const handleSubmit = async (name: string): Promise<void> => {
    if (onSubmit) {
      await onSubmit(name)
      return
    }
    try {
      await client.create(
        'io.cozy.files',
        { type: 'directory', name, dirId: currentFolderId },
        null,
        { driveId: driveId ?? null, forceLink: 'stack' }
      )
      afterSubmit?.()
    } catch (error: unknown) {
      const isConflict =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        (error.response as { status?: number })?.status === 409
      showAlert({
        message: isConflict
          ? t('alert.folder_name', { folderName: name })
          : t('alert.folder_generic'),
        severity: 'error'
      })
      throw error
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
      </>
    )
  }

  return null
}

export { FolderPickerAddFolderItem }
