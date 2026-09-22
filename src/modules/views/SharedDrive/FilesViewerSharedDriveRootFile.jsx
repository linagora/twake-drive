import React, { useMemo } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'

import { hasQueryBeenLoaded, useQuery } from 'cozy-client'
import { shouldBeOpenedByOnlyOffice } from 'cozy-client/dist/models/file'
import { useSharingContext } from 'cozy-sharing'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { FilesViewerLoading } from '@/components/FilesViewerLoading'
import useHead from '@/components/useHead'
import {
  getSharedDriveRootFilePath,
  getSharedDriveRootFilePathScope
} from '@/modules/routeUtils'
import FilesViewer from '@/modules/viewer/FilesViewer'
import {
  isOfficeEnabled,
  makeOnlyOfficeFileRoute
} from '@/modules/views/OnlyOffice/helpers'
import {
  getSharingsRootRoute,
  getSharingsSharedDriveRootFilePath,
  getSharingsTabFromPath
} from '@/modules/views/Sharings/routes'
import { buildSharedDriveFileOrFolderByIdQuery } from '@/queries'

const FilesViewerSharedDriveRootFile = ({ file, fileResult, driveId }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const pathScope = getSharedDriveRootFilePathScope(location.pathname)
  const sharingsTab = getSharingsTabFromPath(location.pathname)
  const sharingsRootRoute = getSharingsRootRoute(location.pathname)
  const closePath = location.state?.fromPathname || sharingsRootRoute

  const filesQuery = useMemo(
    () => ({
      ...fileResult,
      data: [file],
      hasMore: false
    }),
    [fileResult, file]
  )

  return (
    <FilesViewer
      files={filesQuery.data}
      filesQuery={filesQuery}
      onClose={() => navigate(closePath)}
      onChange={nextFileId =>
        navigate(
          sharingsTab
            ? getSharingsSharedDriveRootFilePath(
                location.pathname,
                driveId,
                nextFileId
              )
            : getSharedDriveRootFilePath({
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

const FilesViewerSharedDriveRootFileWrapper = () => {
  const { pathname } = useLocation()
  const { driveId, fileId } = useParams()
  const { allLoaded } = useSharingContext()
  const { isDesktop } = useBreakpoints()
  useHead()

  const sharingsRootRoute = getSharingsRootRoute(pathname)

  const fileQuery = buildSharedDriveFileOrFolderByIdQuery({ fileId, driveId })
  const fileResult = useQuery(fileQuery.definition, fileQuery.options)
  const file = fileResult.data ?? null

  if (fileResult.fetchStatus === 'failed') {
    return <Navigate to={sharingsRootRoute} replace />
  }

  if (!allLoaded || !hasQueryBeenLoaded(fileResult) || !file) {
    return <FilesViewerLoading />
  }

  if (isOfficeEnabled(isDesktop) && shouldBeOpenedByOnlyOffice(file)) {
    return (
      <Navigate
        to={makeOnlyOfficeFileRoute(file._id, {
          driveId,
          fromPathname: sharingsRootRoute
        })}
        replace
      />
    )
  }

  return (
    <FilesViewerSharedDriveRootFile
      file={file}
      fileResult={fileResult}
      driveId={driveId}
    />
  )
}

export default FilesViewerSharedDriveRootFileWrapper
