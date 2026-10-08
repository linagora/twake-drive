import { connectToTwakeSpace, embedRoute } from '@linagora/twake-embed'
import React, { useEffect, useRef } from 'react'
import { Navigate, Outlet, useNavigate, useParams } from 'react-router-dom'

import { hasQueryBeenLoaded, useQuery } from 'cozy-client'
import { Layout as LayoutUI } from 'cozy-ui/transpiled/react/Layout'

import FilesRealTimeQueries from '@/components/FilesRealTimeQueries'
import FileListRowsPlaceholder from '@/modules/filelist/FileListRowsPlaceholder'
import { SPACE_EMBED_PREFIX } from '@/modules/routeUtils'
import { SelectionProvider } from '@/modules/selection/SelectionProvider'
import { getFolderIdFromSharing } from '@/modules/shareddrives/helpers'
import { NewItemHighlightProvider } from '@/modules/upload/NewItemHighlightProvider'
import UploadQueue from '@/modules/upload/UploadQueue'
import FolderView from '@/modules/views/Folder/FolderView'
import { buildSharedDriveIdQuery } from '@/queries'

let space = null
const filesByDrive = new Map()

const filesMetadata = () =>
  Array.from(filesByDrive, ([resourceId, value]) => ({
    resourceId,
    name: 'files.count',
    value
  }))

const reportSpaceFiles = (driveId, count) => {
  if (space === null || filesByDrive.get(driveId) === count) return
  filesByDrive.set(driveId, count)
  space.reportMetadata(filesMetadata())
}

const useTwakeSpace = () => {
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])

  useEffect(() => {
    space = connectToTwakeSpace({
      embedPrefix: SPACE_EMBED_PREFIX,
      hashRouting: true
    })
    if (!space) return

    const show = (driveId, path) =>
      navigateRef.current(embedRoute(SPACE_EMBED_PREFIX, driveId) + path, {
        replace: true
      })
    space.syncHistory({ onLoad: show, onNavigate: show })
    if (filesByDrive.size > 0) space.reportMetadata(filesMetadata())
    const { disconnect } = space
    return () => {
      disconnect()
      space = null
    }
  }, [])
}

const SpaceLayout = () => {
  useTwakeSpace()

  return (
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
}

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

export { SpaceLayout, SpaceRootRedirect, reportSpaceFiles, useTwakeSpace }
