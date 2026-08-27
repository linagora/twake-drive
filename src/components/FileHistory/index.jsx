import React from 'react'
import { useParams } from 'react-router-dom'

import { useQuery } from 'cozy-client'

import { HistoryModal } from './HistoryModal'

import {
  buildFileOrFolderByIdQuery,
  buildFileVersionsQuery,
  buildSharedDriveFileOrFolderByIdQuery
} from '@/queries'

const FileHistory = () => {
  const { fileId, driveId } = useParams()

  const fileQuery = driveId
    ? buildSharedDriveFileOrFolderByIdQuery({ fileId, driveId })
    : buildFileOrFolderByIdQuery(fileId)
  const { data: file, fetchStatus: fileFetchStatus } = useQuery(
    fileQuery.definition,
    fileQuery.options
  )

  const revisionsQuery = buildFileVersionsQuery(fileId)
  const { data: revisions, fetchStatus: revisionsFetchStatus } = useQuery(
    revisionsQuery.definition,
    revisionsQuery.options
  )

  if (fileFetchStatus !== 'loaded') return null

  return (
    <HistoryModal
      file={file}
      revisions={revisions}
      revisionsFetchStatus={revisionsFetchStatus}
    />
  )
}

export default FileHistory
