import React from 'react'

import { useQuery } from 'cozy-client'
import { isDirectory } from 'cozy-client/dist/models/file'
import { IOCozyFile } from 'cozy-client/types/types'
import List from 'cozy-ui/transpiled/react/List'

import { FolderPickerListItem } from './FolderPickerListItem'

import { FolderPickerAddFolderItem } from '@/components/FolderPicker/FolderPickerAddFolderItem'
import { FolderPickerContentLoadMore } from '@/components/FolderPicker/FolderPickerContentLoadMore'
import { FolderPickerContentLoader } from '@/components/FolderPicker/FolderPickerContentLoader'
import { isInvalidMoveTarget } from '@/components/FolderPicker/helpers'
import { computeNextcloudRootFolder } from '@/components/FolderPicker/helpers'
import type { File, FolderPickerEntry } from '@/components/FolderPicker/types'
import { buildMoveOrImportQuery } from '@/queries'

interface FolderPickerContentCozyProps {
  folder: IOCozyFile
  isFolderCreationDisplayed: boolean
  hideFolderCreation: () => void
  entries: FolderPickerEntry[]
  navigateTo: (folder: import('./types').File) => void
  showNextcloudFolder?: boolean
  showSharedDriveFolder?: boolean
}

const FolderPickerContentCozy: React.FC<FolderPickerContentCozyProps> = ({
  folder,
  isFolderCreationDisplayed,
  hideFolderCreation,
  entries,
  navigateTo
}) => {
  const contentQuery = buildMoveOrImportQuery(folder._id)
  const {
    fetchStatus,
    data: filesData,
    hasMore,
    fetchMore
  } = useQuery(contentQuery.definition, contentQuery.options) as unknown as {
    fetchStatus: string
    data?: IOCozyFile[]
    hasMore: boolean
    fetchMore: () => void
  }

  // The "Drives" folder (shared-drives-dir) is hidden from the normal file
  // list, so it must not appear as a destination in the move/copy picker.
  // buildMoveOrImportQuery already excludes it via partialIndex, so the list
  // is used as-is with no manual injection.
  const files: IOCozyFile[] = filesData ?? []

  const handleClick = (file: File): void => {
    if (isDirectory(file)) {
      navigateTo(file)
    }

    if (
      file._type === 'io.cozy.files' &&
      file.cozyMetadata?.createdByApp === 'nextcloud' &&
      file.cozyMetadata.sourceAccount
    ) {
      const nextcloudRootFolder = computeNextcloudRootFolder({
        sourceAccount: file.cozyMetadata.sourceAccount,
        instanceName: file.metadata.instanceName
      })
      navigateTo(nextcloudRootFolder)
    }
  }

  return (
    <List>
      <FolderPickerAddFolderItem
        currentFolderId={folder._id}
        visible={isFolderCreationDisplayed}
        afterSubmit={hideFolderCreation}
        afterAbort={hideFolderCreation}
      />
      <FolderPickerContentLoader
        fetchStatus={fetchStatus}
        hasNoData={files.length === 0}
      >
        {files.map((file, index) => (
          <FolderPickerListItem
            key={file._id}
            file={file}
            disabled={isInvalidMoveTarget(entries, file)}
            onClick={handleClick}
            showDivider={index !== files.length - 1}
          />
        ))}
        <FolderPickerContentLoadMore hasMore={hasMore} fetchMore={fetchMore} />
      </FolderPickerContentLoader>
    </List>
  )
}

export { FolderPickerContentCozy }
