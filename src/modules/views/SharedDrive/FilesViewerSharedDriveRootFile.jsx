import React, { useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { hasQueryBeenLoaded, useQuery } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'

import { FilesViewerLoading } from '@/components/FilesViewerLoading'
import useHead from '@/components/useHead'
import {
  getSharedDriveRootFilePath,
  getSharedDriveRootFilePathScope
} from '@/modules/routeUtils'
import { useSharedDrives } from '@/modules/shareddrives/hooks/useSharedDrives'
import FilesViewer from '@/modules/viewer/FilesViewer'
import {
  findSharedDriveById,
  makeSharedDriveRootFileViewerFile
} from '@/modules/views/SharedDrive/rootFileViewer'
import { buildSharedDriveFileOrFolderByIdQuery } from '@/queries'

const isViewerReady = ({ allLoaded, sharedDrivesLoaded, fileResult, file }) =>
  [allLoaded, sharedDrivesLoaded, hasQueryBeenLoaded(fileResult), file].every(
    Boolean
  )

const FilesViewerSharedDriveRootFile = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { driveId, fileId } = useParams()
  const { allLoaded, isOwner } = useSharingContext()
  useHead()

  const pathScope = getSharedDriveRootFilePathScope(location.pathname)
  const closePath = location.state?.fromPathname || '/sharings'
  const { sharedDrives, isLoaded: sharedDrivesLoaded } = useSharedDrives()

  const fileQuery = buildSharedDriveFileOrFolderByIdQuery({ fileId, driveId })
  const fileResult = useQuery(fileQuery.definition, fileQuery.options)
  const sharedDrive = useMemo(
    () => findSharedDriveById({ sharedDrives, driveId }),
    [sharedDrives, driveId]
  )
  const file = useMemo(
    () =>
      fileResult.data
        ? makeSharedDriveRootFileViewerFile({
            file: fileResult.data,
            driveId,
            fileId,
            sharedDrive
          })
        : null,
    [driveId, fileId, fileResult.data, sharedDrive]
  )

  useEffect(() => {
    if (fileResult.fetchStatus === 'failed') {
      navigate('/sharings', { replace: true })
    }
  }, [fileResult.fetchStatus, navigate])

  const files = useMemo(() => (file ? [file] : []), [file])

  const filesQuery = useMemo(
    () => ({
      ...fileResult,
      data: files,
      hasMore: false
    }),
    [fileResult, files]
  )

  if (isViewerReady({ allLoaded, sharedDrivesLoaded, fileResult, file })) {
    return (
      <FilesViewer
        files={files}
        filesQuery={filesQuery}
        onClose={() => navigate(closePath)}
        onChange={nextFileId =>
          navigate(
            getSharedDriveRootFilePath({
              driveId,
              fileId: nextFileId,
              scope: pathScope
            }),
            { state: { fromPathname: closePath } }
          )
        }
        viewerProps={{
          panel: {
            sharing: {
              // Federated/transformed sharing docs may carry a canonical `_id`
              // that differs from the route `fileId` — `makeSharedDriveRootFileViewerFile`
              // normalises both to the route id, so ask the underlying fetched
              // doc for the id that the sharing context actually knows about.
              disabled: !isOwner(fileResult.data?._id ?? fileId)
            }
          }
        }}
      />
    )
  }

  return <FilesViewerLoading />
}

export default FilesViewerSharedDriveRootFile
