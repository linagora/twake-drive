import React, { useMemo } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'

import { hasQueryBeenLoaded, useQuery } from 'cozy-client'
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
  getSharingsRootRoute,
  getSharingsSharedDriveRootFilePath,
  getSharingsTabFromPath
} from '@/modules/views/Sharings/routes'
import { findEditorForFile } from '@/modules/views/editor/registry'
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

  // A file shared as a shared-drive root is materialized on the recipient as
  // a `.url` shortcut, so list-level dispatch can't recognize the document
  // (and direct links/reloads land here without going through it). Now that
  // the real file is resolved, send editor documents to their editor; an
  // Excalidraw drawing has no inline viewer, so this is the only way it opens.
  const editor = findEditorForFile(file, { isDesktop })
  if (editor) {
    return (
      <Navigate
        to={editor.makeRoute(file._id, {
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
