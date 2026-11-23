import React from 'react'
import { useNavigate } from 'react-router-dom'

import { useQuery } from 'cozy-client'
import flag from 'cozy-flags'

import { FilesViewerLoading } from '@/components/FilesViewerLoading'
import useHead from '@/components/useHead'
import { usePersonalRecents } from '@/hooks/usePersonalRecents'
import { isUnreadableRecent } from '@/modules/filelist/helpers'
import { isTrashedDocument } from '@/modules/services/components/FilePicker/documents'
import FilesViewer from '@/modules/viewer/FilesViewer'
import { buildRecentQuery } from '@/queries'

const isViewableRecent = item =>
  !isUnreadableRecent(item) && item.type === 'file' && !isTrashedDocument(item)

const RecentFilesViewer = ({ files, filesQuery }) => {
  const navigate = useNavigate()

  return (
    <FilesViewer
      files={files}
      filesQuery={filesQuery}
      onClose={() => navigate('/recent')}
      onChange={fileId => navigate(`/recent/file/${fileId}`)}
    />
  )
}

const PersonalFilesViewerRecent = () => {
  const recents = usePersonalRecents({ isVisible: isViewableRecent })

  // A fetchMore puts the query back in loading: keep the viewer meanwhile.
  if (!recents.lastUpdate) return <FilesViewerLoading />

  return <RecentFilesViewer files={recents.data} filesQuery={recents} />
}

const LocalFilesViewerRecent = () => {
  const filesQuery = buildRecentQuery()
  const results = useQuery(filesQuery.definition, filesQuery.options)

  if (!results.data) return <FilesViewerLoading />

  return <RecentFilesViewer files={results.data} filesQuery={results} />
}

const FilesViewerRecent = () => {
  useHead()

  return flag('drive.recents.enabled') ? (
    <PersonalFilesViewerRecent />
  ) : (
    <LocalFilesViewerRecent />
  )
}

export default FilesViewerRecent
