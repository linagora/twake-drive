import React, { useState } from 'react'

import { FixedDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'

import { FolderPickerBody } from '@/components/FolderPicker/FolderPickerBody'
import { FolderPickerFooter } from '@/components/FolderPicker/FolderPickerFooter'
import { FolderPickerHeader } from '@/components/FolderPicker/FolderPickerHeader'
import { FolderPickerTopbar } from '@/components/FolderPicker/FolderPickerTopbar'
import { File, FolderPickerEntry } from '@/components/FolderPicker/types'

interface FolderPickerSlotProps {
  header?: {
    title?: string
    subTitle?: string
  }
  footer?: {
    confirmLabel?: string
    cancelLabel?: string
  }
}

interface FolderPickerProps {
  currentFolder: File
  entries: FolderPickerEntry[]
  onConfirm: (folder: File) => void
  onClose: () => void | Promise<void>
  isBusy: boolean
  canCreateFolder?: boolean
  slotProps?: FolderPickerSlotProps
  showNextcloudFolder?: boolean
  canPickEntriesParentFolder?: boolean
  isPublic?: boolean
  showSharedDriveFolder?: boolean
}

const useStyles = makeStyles({
  paper: {
    height: '100%',
    '& .MuiDialogContent-root': {
      padding: '0'
    },
    '& .MuiDialogTitle-root': {
      padding: '0'
    }
  }
})

const FolderPicker: React.FC<FolderPickerProps> = ({
  currentFolder,
  entries,
  onConfirm,
  onClose,
  isBusy,
  canCreateFolder = true,
  slotProps,
  showNextcloudFolder = false,
  canPickEntriesParentFolder = false,
  isPublic = false,
  showSharedDriveFolder = false
}) => {
  const [folder, setFolder] = useState<File>(currentFolder)

  const [isFolderCreationDisplayed, setFolderCreationDisplayed] =
    useState<boolean>(false)
  const classes = useStyles()

  const showFolderCreation = (): void => {
    setFolderCreationDisplayed(true)
  }

  const hideFolderCreation = (): void => {
    setFolderCreationDisplayed(false)
  }

  const navigateTo = (folder: File): void => {
    setFolder(folder)
    setFolderCreationDisplayed(false)
  }

  return (
    <FixedDialog
      open
      onClose={onClose}
      size="large"
      classes={{
        paper: classes.paper
      }}
      title={
        <>
          <FolderPickerHeader entries={entries} {...slotProps?.header} />
          <FolderPickerTopbar
            navigateTo={navigateTo}
            folder={folder}
            canCreateFolder={canCreateFolder}
            showFolderCreation={showFolderCreation}
          />
        </>
      }
      content={
        <FolderPickerBody
          folder={folder}
          navigateTo={navigateTo}
          entries={entries}
          isFolderCreationDisplayed={isFolderCreationDisplayed}
          hideFolderCreation={hideFolderCreation}
          showNextcloudFolder={showNextcloudFolder}
          isPublic={isPublic}
          showSharedDriveFolder={showSharedDriveFolder}
        />
      }
      actions={
        <FolderPickerFooter
          onConfirm={onConfirm}
          onClose={onClose}
          entries={entries}
          folder={folder}
          isBusy={isBusy}
          canPickEntriesParentFolder={canPickEntriesParentFolder}
          {...slotProps?.footer}
        />
      }
    />
  )
}

export { FolderPicker }
