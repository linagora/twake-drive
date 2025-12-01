import React from 'react'
import { useNavigate } from 'react-router-dom'

import { useQuery } from 'cozy-client'

import { FilesViewerLoading } from '@/components/FilesViewerLoading'
import useHead from '@/components/useHead'
import FilesViewer from '@/modules/viewer/FilesViewer'
import { buildRecentQuery } from '@/queries'

const FilesViewerRecent = () => {
  const filesQuery = buildRecentQuery()
  const results = useQuery(filesQuery.definition, filesQuery.options)
  const navigate = useNavigate()
  useHead()

  if (results.data) {
    const viewableFiles = results.data
    return (
      <FilesViewer
        files={viewableFiles}
        filesQuery={results}
        onClose={() => navigate('/recent')}
        onChange={fileId => navigate(`/recent/file/${fileId}`)}
      />
    )
  } else {
    return <FilesViewerLoading />
  }
}

export default FilesViewerRecent
