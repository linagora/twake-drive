import React from 'react'
import { useNavigate } from 'react-router-dom'

import { useQuery } from 'cozy-client'

import { FilesViewerLoading } from '@/components/FilesViewerLoading'
import { useCurrentFolderId, useFolderSort } from '@/hooks'
import { getFolderPath, getViewerPath } from '@/modules/routeUtils'
import FilesViewer from '@/modules/viewer/FilesViewer'
import { buildDriveQuery } from '@/queries'

const FilesViewerDrive = () => {
  const navigate = useNavigate()
  const [sortOrder] = useFolderSort()
  const folderId = useCurrentFolderId()

  const buildedFilesQuery = buildDriveQuery({
    currentFolderId: folderId,
    type: 'file',
    sortAttribute: sortOrder.attribute,
    sortOrder: sortOrder.order
  })

  const filesQuery = useQuery(
    buildedFilesQuery.definition,
    buildedFilesQuery.options
  )

  const viewableFiles = filesQuery.data

  if (viewableFiles) {
    return (
      <FilesViewer
        files={viewableFiles}
        filesQuery={filesQuery}
        onClose={() => navigate(getFolderPath(folderId))}
        onChange={fileId => navigate(`${getViewerPath(folderId, fileId)}`)}
      />
    )
  }

  return <FilesViewerLoading />
}

export default FilesViewerDrive
