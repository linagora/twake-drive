import React from 'react'
import { useNavigate } from 'react-router-dom'

import { useQuery } from 'cozy-client'

import { FilesViewerLoading } from '@/components/FilesViewerLoading'
import useHead from '@/components/useHead'
import { useCurrentFolderId, useFolderSort } from '@/hooks'
import FilesViewer from '@/modules/viewer/FilesViewer'
import { buildTrashQuery } from '@/queries'

const FilesViewerTrash = () => {
  const currentFolderId = useCurrentFolderId()
  const [sortOrder] = useFolderSort(currentFolderId)
  const navigate = useNavigate()
  useHead()

  const fileQuery = buildTrashQuery({
    currentFolderId,
    type: 'file',
    sortAttribute: sortOrder.attribute,
    sortOrder: sortOrder.order
  })

  const filesResult = useQuery(fileQuery.definition, fileQuery.options)
  if (filesResult.data) {
    const viewableFiles = filesResult.data
    return (
      <FilesViewer
        files={viewableFiles}
        filesQuery={filesResult}
        onClose={() => navigate(`/trash/${currentFolderId}`)}
        onChange={fileId =>
          navigate(`/trash/${currentFolderId}/file/${fileId}`)
        }
      />
    )
  } else {
    return <FilesViewerLoading />
  }
}

export default FilesViewerTrash
