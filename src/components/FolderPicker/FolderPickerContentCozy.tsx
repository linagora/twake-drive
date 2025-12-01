import React, { useMemo } from 'react'

import { useQuery, useClient } from 'cozy-client'
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
import { ROOT_DIR_ID } from '@/constants/config'
import { isEncryptedFolder } from '@/lib/encryption'
import { FolderUnlocker } from '@/modules/folder/components/FolderUnlocker'
import {
  buildMoveOrImportQuery,
  buildFileOrFolderByIdQuery,
  buildMagicFolderQuery
} from '@/queries'

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
  navigateTo,
  showNextcloudFolder,
  showSharedDriveFolder
}) => {
  const client = useClient()
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

  const sharedFolderQuery = buildMagicFolderQuery({
    id: 'io.cozy.files.shared-drives-dir',
    enabled: folder._id === ROOT_DIR_ID
  })
  const sharedFolderResult = useQuery(
    sharedFolderQuery.definition,
    sharedFolderQuery.options
  ) as unknown as {
    fetchStatus: string
    data?: IOCozyFile[]
  }

  const isEncrypted = isEncryptedFolder(folder)

  const files: IOCozyFile[] = useMemo(() => {
    if (
      folder._id === ROOT_DIR_ID &&
      (showNextcloudFolder || showSharedDriveFolder)
    ) {
      return [
        ...(sharedFolderResult.fetchStatus === 'loaded'
          ? sharedFolderResult.data ?? []
          : []),
        ...(filesData ?? [])
      ]
    }
    return [...(filesData ?? [])]
  }, [
    folder._id,
    showNextcloudFolder,
    showSharedDriveFolder,
    filesData,
    sharedFolderResult.fetchStatus,
    sharedFolderResult.data
  ])

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
        isEncrypted={isEncrypted}
        currentFolderId={folder._id}
        visible={isFolderCreationDisplayed}
        afterSubmit={hideFolderCreation}
        afterAbort={hideFolderCreation}
      />
      <FolderPickerContentLoader
        fetchStatus={fetchStatus}
        hasNoData={files.length === 0}
      >
        <FolderUnlocker folder={folder} onDismiss={handleFolderUnlockerDismiss}>
          {files.map((file, index) => (
            <FolderPickerListItem
              key={file._id}
              file={file}
              disabled={isInvalidMoveTarget(entries, file)}
              onClick={handleClick}
              showDivider={index !== files.length - 1}
            />
          ))}
        </FolderUnlocker>
        <FolderPickerContentLoadMore hasMore={hasMore} fetchMore={fetchMore} />
      </FolderPickerContentLoader>
    </List>
  )
}

export { FolderPickerContentCozy }
