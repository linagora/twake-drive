import React, { useEffect, useMemo } from 'react'
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
import { findEditorForFile } from '@/modules/views/editor/registry'
import { buildSharedDriveFileOrFolderByIdQuery } from '@/queries'

const isViewerReady = ({ allLoaded, fileResult, file }) =>
  [allLoaded, hasQueryBeenLoaded(fileResult), file].every(Boolean)

const FilesViewerSharedDriveRootFile = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDesktop } = useBreakpoints()
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

  const filesQuery = useMemo(
    () => ({
      ...fileResult,
      data: file ? [file] : [],
      hasMore: false
    }),
    [fileResult, file]
  )

  const files = filesQuery.data

  if (isViewerReady({ allLoaded, fileResult, file })) {
    // A file shared as a shared-drive root is materialized on the recipient as
    // a `.url` shortcut, so list-level dispatch can't recognize the document
    // (and direct links/reloads land here without going through it). Now that
    // the real file is resolved, send editor documents to their editor; an
    // Excalidraw drawing has no inline viewer, so this is the only way it opens.
    const editor = findEditorForFile(file, { isDesktop })
    if (editor) {
      return (
        <Navigate
          replace
          to={editor.makeRoute(file._id, {
            driveId,
            fromPathname: closePath
          })}
        />
      )
    }

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
