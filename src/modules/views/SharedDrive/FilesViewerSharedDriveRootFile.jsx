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
import FilesViewer from '@/modules/viewer/FilesViewer'
import { buildSharedDriveFileOrFolderByIdQuery } from '@/queries'

const isViewerReady = ({ allLoaded, fileResult, file }) =>
  [allLoaded, hasQueryBeenLoaded(fileResult), file].every(Boolean)

const FilesViewerSharedDriveRootFile = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { driveId, fileId } = useParams()
  const { allLoaded } = useSharingContext()
  useHead()

  const pathScope = getSharedDriveRootFilePathScope(location.pathname)
  const closePath = location.state?.fromPathname || '/sharings'

  const fileQuery = buildSharedDriveFileOrFolderByIdQuery({ fileId, driveId })
  const fileResult = useQuery(fileQuery.definition, fileQuery.options)
  const file = fileResult.data ?? null

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

  if (isViewerReady({ allLoaded, fileResult, file })) {
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
            sharing: { disabled: true }
          }
        }}
      />
    )
  }

  return <FilesViewerLoading />
}

export default FilesViewerSharedDriveRootFile
