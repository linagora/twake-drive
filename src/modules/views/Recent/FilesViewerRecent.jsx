import React from 'react'
import { useNavigate } from 'react-router-dom'

import { useQuery } from 'cozy-client'

import { FilesViewerLoading } from '@/components/FilesViewerLoading'
import useHead from '@/components/useHead'
import useVisibleRecentFiles from '@/hooks/useVisibleRecentFiles'
import FilesViewer from '@/modules/viewer/FilesViewer'
import { buildRecentQuery } from '@/queries'

const FilesViewerRecent = () => {
  const filesQuery = buildRecentQuery()
  const results = useVisibleRecentFiles(
    useQuery(filesQuery.definition, filesQuery.options)
  )
  const navigate = useNavigate()
  useHead()

  // Wait for the hidden Settings folders before showing any file
  const isLoading = results.fetchStatus === 'loading' && !results.data?.length
  if (results.data && !isLoading) {
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
