import * as React from 'react'
import { useMemo } from 'react'

import { useClient } from 'cozy-client'
import { isDirectory } from 'cozy-client/dist/models/file'
import type { IOCozyFile } from 'cozy-client/types/types'
import List from 'cozy-ui/transpiled/react/List'

import { FolderPickerListItem } from './FolderPickerListItem'

import { FolderPickerAddFolderItem } from '@/components/FolderPicker/FolderPickerAddFolderItem'
import { FolderPickerContentLoader } from '@/components/FolderPicker/FolderPickerContentLoader'
import { isInvalidMoveTarget } from '@/components/FolderPicker/helpers'
import type { File, FolderPickerEntry } from '@/components/FolderPicker/types'
import { isEncryptedFolder } from '@/lib/encryption'
import { FolderUnlocker } from '@/modules/folder/components/FolderUnlocker'
import { useSharedDriveFolder } from '@/modules/shareddrives/hooks/useSharedDriveFolder'
import { buildFileOrFolderByIdQuery } from '@/queries'

interface FolderPickerContentSharedDriveProps {
  folder: IOCozyFile
  isFolderCreationDisplayed: boolean
  hideFolderCreation: () => void
  entries: FolderPickerEntry[]
  navigateTo: (folder: import('./types').File) => void
  showNextcloudFolder?: boolean
}

const FolderPickerContentSharedDrive: React.FC<
  FolderPickerContentSharedDriveProps
> = ({
  folder,
  isFolderCreationDisplayed,
  hideFolderCreation,
  entries,
  navigateTo
}) => {
  const client = useClient()
  const driveId = folder.driveId ?? ''
  const folderId = folder._id

  const { sharedDriveResult } = useSharedDriveFolder({
    driveId,
    folderId
  })

  const { fetchStatus, files } = useMemo(
    () =>
      sharedDriveResult.included || sharedDriveResult.data
        ? { fetchStatus: 'loaded', files: sharedDriveResult.included ?? [] }
        : { fetchStatus: 'loading', files: [] },
    [sharedDriveResult]
  )

  const isEncrypted = isEncryptedFolder(folder)

  const handleFolderUnlockerDismiss = async (): Promise<void> => {
    const parentFolderQuery = buildFileOrFolderByIdQuery(folder.dir_id)
    const parentFolder = (await client?.fetchQueryAndGetFromState({
      definition: parentFolderQuery.definition(),
      options: parentFolderQuery.options
    })) as {
      data?: IOCozyFile
    }
    if (!parentFolder.data) {
      throw new Error('Parent folder not found')
    }

    navigateTo(parentFolder.data)
  }

  const handleClick = (file: File): void => {
    if (isDirectory(file)) {
      navigateTo(file)
    }
  }

  return (
    <List>
      <FolderPickerAddFolderItem
        isEncrypted={isEncrypted}
        currentFolderId={folder._id}
        visible={isFolderCreationDisplayed}
        afterSubmit={hideFolderCreation}
        afterAbort={hideFolderCreation}
        driveId={folder.driveId}
      />
      <FolderPickerContentLoader
        fetchStatus={fetchStatus}
        hasNoData={files.length === 0}
      >
        <FolderUnlocker folder={folder} onDismiss={handleFolderUnlockerDismiss}>
          {files.map((file: IOCozyFile, index: number) => (
            <FolderPickerListItem
              key={file._id}
              file={file}
              disabled={isInvalidMoveTarget(entries, file)}
              onClick={handleClick}
              showDivider={index !== files.length - 1}
            />
          ))}
        </FolderUnlocker>
      </FolderPickerContentLoader>
    </List>
  )
}

export { FolderPickerContentSharedDrive }
