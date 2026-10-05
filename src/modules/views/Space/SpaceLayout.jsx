import React from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'

import { hasQueryBeenLoaded, useQuery } from 'cozy-client'
import { Layout as LayoutUI } from 'cozy-ui/transpiled/react/Layout'

import FilesRealTimeQueries from '@/components/FilesRealTimeQueries'
import FileListRowsPlaceholder from '@/modules/filelist/FileListRowsPlaceholder'
import { SelectionProvider } from '@/modules/selection/SelectionProvider'
import { getFolderIdFromSharing } from '@/modules/shareddrives/helpers'
import { NewItemHighlightProvider } from '@/modules/upload/NewItemHighlightProvider'
import UploadQueue from '@/modules/upload/UploadQueue'
import FolderView from '@/modules/views/Folder/FolderView'
import { buildSharedDriveIdQuery } from '@/queries'

const SpaceLayout = () => (
  <LayoutUI monoColumn>
    <NewItemHighlightProvider>
      <UploadQueue />
      <FilesRealTimeQueries />
      <SelectionProvider>
        <Outlet />
      </SelectionProvider>
    </NewItemHighlightProvider>
  </LayoutUI>
)

const SpaceRootRedirect = () => {
  const { driveId } = useParams()
  const sharingQuery = buildSharedDriveIdQuery({ driveId })
  const sharingResult = useQuery(sharingQuery.definition, sharingQuery.options)

  if (!hasQueryBeenLoaded(sharingResult)) {
    return (
      <FolderView>
        <FileListRowsPlaceholder />
      </FolderView>
    )
  }

  const folderId =
    sharingResult.data && getFolderIdFromSharing(sharingResult.data)
  if (!folderId) {
    return <FolderView isNotFound />
  }

  return <Navigate to={folderId} replace />
}

export { SpaceLayout, SpaceRootRedirect }
