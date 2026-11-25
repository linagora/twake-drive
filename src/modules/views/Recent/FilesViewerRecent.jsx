import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { useQuery } from 'cozy-client'
import flag from 'cozy-flags'
import { useSharingContext } from 'cozy-sharing'

import { FilesViewerLoading } from '@/components/FilesViewerLoading'
import useHead from '@/components/useHead'
import { useCurrentFileId } from '@/hooks'
import { usePersonalRecents } from '@/hooks/usePersonalRecents'
import {
  isTrashedDriveItem,
  isUnreadableRecent
} from '@/modules/filelist/helpers'
import FilesViewer from '@/modules/viewer/FilesViewer'
import { buildRecentQuery } from '@/queries'

const isViewableRecent = item =>
  !isUnreadableRecent(item) && item.type === 'file' && !isTrashedDriveItem(item)

const RecentFilesViewer = ({ files, filesQuery, viewerProps }) => {
  const navigate = useNavigate()

  return (
    <FilesViewer
      files={files}
      filesQuery={filesQuery}
      onClose={() => navigate('/recent')}
      onChange={fileId => navigate(`/recent/file/${fileId}`)}
      viewerProps={viewerProps}
    />
  )
}

const PersonalFilesViewerRecent = () => {
  const fileId = useCurrentFileId()
  const { hasWriteAccess } = useSharingContext()
  const recents = usePersonalRecents({ isVisible: isViewableRecent })
  const { data, hasMore, fetchStatus, fetchMore, lastUpdate } = recents
  const currentFile = data.find(file => file._id === fileId)

  // FilesViewer looks a missing file up once, with the drive of the route,
  // which /recent has not: find the file in the next pages first.
  const isLookingForFile = !currentFile && hasMore

  useEffect(() => {
    if (isLookingForFile && fetchStatus === 'loaded') fetchMore()
  }, [isLookingForFile, fetchStatus, fetchMore])

  // A fetchMore puts the query back in loading: keep the viewer meanwhile.
  if (!lastUpdate || isLookingForFile) return <FilesViewerLoading />

  // As in the shared drive viewer, a member who cannot write does not share.
  const isSharingDisabled = Boolean(
    currentFile?.driveId &&
    !hasWriteAccess(currentFile.dir_id, currentFile.driveId)
  )

  return (
    <RecentFilesViewer
      files={data}
      filesQuery={recents}
      viewerProps={{ panel: { sharing: { disabled: isSharingDisabled } } }}
    />
  )
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
