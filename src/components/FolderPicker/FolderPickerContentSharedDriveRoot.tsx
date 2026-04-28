import React, { useMemo } from 'react'

import { useQuery } from 'cozy-client'
import { isDirectory } from 'cozy-client/dist/models/file'
import { IOCozyFile } from 'cozy-client/types/types'
import { useSharingContext } from 'cozy-sharing'
import List from 'cozy-ui/transpiled/react/List'

import { FolderPickerListItem } from './FolderPickerListItem'

import { FolderPickerAddFolderItem } from '@/components/FolderPicker/FolderPickerAddFolderItem'
import { FolderPickerContentLoadMore } from '@/components/FolderPicker/FolderPickerContentLoadMore'
import { FolderPickerContentLoader } from '@/components/FolderPicker/FolderPickerContentLoader'
import { isInvalidMoveTarget } from '@/components/FolderPicker/helpers'
import { computeNextcloudRootFolder } from '@/components/FolderPicker/helpers'
import type { File, FolderPickerEntry } from '@/components/FolderPicker/types'
import { useTransformFolderListHasSharedDriveShortcuts } from '@/hooks/useTransformFolderListHasSharedDriveShortcuts'
import { buildMoveOrImportQuery } from '@/queries'

interface FolderPickerContentSharedDriveRootProps {
  folder: IOCozyFile
  isFolderCreationDisplayed: boolean
  hideFolderCreation: () => void
  entries: FolderPickerEntry[]
  navigateTo: (folder: import('./types').File) => void
  showNextcloudFolder?: boolean
}

const FolderPickerContentSharedDriveRoot: React.FC<
  FolderPickerContentSharedDriveRootProps
> = ({
  folder,
  isFolderCreationDisplayed,
  hideFolderCreation,
  entries,
  navigateTo,
  showNextcloudFolder
}) => {
  const { hasWriteAccess } = useSharingContext() as unknown as {
    hasWriteAccess: (folderId: string, driveId?: string) => boolean
  }
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

  const { sharedDrives, nonSharedDriveList } =
    useTransformFolderListHasSharedDriveShortcuts(
      filesData,
      showNextcloudFolder
    ) as {
      sharedDrives: IOCozyFile[]
      nonSharedDriveList: IOCozyFile[]
    }

  const files: IOCozyFile[] = useMemo(() => {
    return [...sharedDrives, ...nonSharedDriveList]
  }, [sharedDrives, nonSharedDriveList])

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
            disabled={
              isInvalidMoveTarget(entries, file) ||
              !hasWriteAccess(file._id, file.driveId)
            }
            onClick={handleClick}
            showDivider={index !== files.length - 1}
          />
        ))}
        <FolderPickerContentLoadMore hasMore={hasMore} fetchMore={fetchMore} />
      </FolderPickerContentLoader>
    </List>
  )
}

export { FolderPickerContentSharedDriveRoot }
