import React from 'react'

import { FolderPickerContentSharedDriveRoot } from './FolderPickerContentSharedDriveRoot'

import { FolderPickerContentCozy } from '@/components/FolderPicker/FolderPickerContentCozy'
import { FolderPickerContentNextcloud } from '@/components/FolderPicker/FolderPickerContentNextcloud'
import { FolderPickerContentPublic } from '@/components/FolderPicker/FolderPickerContentPublic'
import { FolderPickerContentSharedDrive } from '@/components/FolderPicker/FolderPickerContentSharedDrive'
import { File, FolderPickerEntry } from '@/components/FolderPicker/types'
import { ROOT_DIR_ID, SHARED_DRIVES_DIR_ID } from '@/constants/config'

interface FolderPickerBodyProps {
  folder: File
  entries: FolderPickerEntry[]
  navigateTo: (folder: File) => void
  isFolderCreationDisplayed: boolean
  hideFolderCreation: () => void
  showNextcloudFolder?: boolean
  isPublic?: boolean
  showSharedDriveFolder?: boolean
}

const FolderPickerBody: React.FC<FolderPickerBodyProps> = ({
  folder,
  entries,
  navigateTo,
  isFolderCreationDisplayed,
  hideFolderCreation,
  showNextcloudFolder,
  isPublic,
  showSharedDriveFolder
}) => {
  if (folder._type === 'io.cozy.remote.nextcloud.files') {
    return (
      <FolderPickerContentNextcloud
        folder={folder}
        entries={entries}
        navigateTo={navigateTo}
      />
    )
  }

  if (isPublic) {
    return (
      <FolderPickerContentPublic
        folder={folder}
        isFolderCreationDisplayed={isFolderCreationDisplayed}
        hideFolderCreation={hideFolderCreation}
        entries={entries}
        navigateTo={navigateTo}
        showNextcloudFolder={showNextcloudFolder}
      />
    )
  }

  // Display content of recipient's shared drive folder
  if (folder.driveId) {
    return (
      <FolderPickerContentSharedDrive
        folder={folder}
        isFolderCreationDisplayed={isFolderCreationDisplayed}
        hideFolderCreation={hideFolderCreation}
        entries={entries}
        navigateTo={navigateTo}
      />
    )
  }

  if (
    folder.dir_id === ROOT_DIR_ID &&
    folder._id === SHARED_DRIVES_DIR_ID &&
    showSharedDriveFolder
  ) {
    return (
      <FolderPickerContentSharedDriveRoot
        folder={folder}
        isFolderCreationDisplayed={isFolderCreationDisplayed}
        hideFolderCreation={hideFolderCreation}
        entries={entries}
        navigateTo={navigateTo}
        showNextcloudFolder={showNextcloudFolder}
      />
    )
  }

  return (
    <FolderPickerContentCozy
      folder={folder}
      isFolderCreationDisplayed={isFolderCreationDisplayed}
      hideFolderCreation={hideFolderCreation}
      entries={entries}
      navigateTo={navigateTo}
      showNextcloudFolder={showNextcloudFolder}
      showSharedDriveFolder={showSharedDriveFolder}
    />
  )
}

export { FolderPickerBody }
