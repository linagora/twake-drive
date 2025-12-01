import React, { useMemo } from 'react'

import { useClient } from 'cozy-client'
import { isDirectory } from 'cozy-client/dist/models/file'
import { IOCozyFile } from 'cozy-client/types/types'
import List from 'cozy-ui/transpiled/react/List'

import { FolderPickerListItem } from './FolderPickerListItem'

import { FolderPickerAddFolderItem } from '@/components/FolderPicker/FolderPickerAddFolderItem'
import { FolderPickerContentLoadMore } from '@/components/FolderPicker/FolderPickerContentLoadMore'
import { FolderPickerContentLoader } from '@/components/FolderPicker/FolderPickerContentLoader'
import { isInvalidMoveTarget } from '@/components/FolderPicker/helpers'
import type { File, FolderPickerEntry } from '@/components/FolderPicker/types'
import { isEncryptedFolder } from '@/lib/encryption'
import { FolderUnlocker } from '@/modules/folder/components/FolderUnlocker'
import usePublicFilesQuery from '@/modules/views/Public/usePublicFilesQuery'
import { buildFileOrFolderByIdQuery } from '@/queries'

interface FolderPickerContentPublicProps {
  folder: IOCozyFile
  isFolderCreationDisplayed: boolean
  hideFolderCreation: () => void
  entries: FolderPickerEntry[]
  navigateTo: (folder: import('./types').File) => void
  showNextcloudFolder?: boolean
}

const FolderPickerContentPublic: React.FC<FolderPickerContentPublicProps> = ({
  folder,
  isFolderCreationDisplayed,
  hideFolderCreation,
  entries,
  navigateTo
}) => {
  const client = useClient()
  const filesResult = usePublicFilesQuery(folder._id)
  const {
    data: filesData,
    fetchStatus,
    hasMore,
    fetchMore
  } = filesResult as unknown as {
    fetchStatus: string
    data?: IOCozyFile[]
    hasMore: boolean
    fetchMore: () => void
  }

  const isEncrypted = isEncryptedFolder(folder)

  const files: IOCozyFile[] = useMemo(() => {
    return [...(filesData ?? [])]
  }, [filesData])

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

export { FolderPickerContentPublic }
