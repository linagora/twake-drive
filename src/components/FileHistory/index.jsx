import React from 'react'
import { useParams } from 'react-router-dom'

import { useQuery } from 'cozy-client'

import { HistoryModal } from './HistoryModal'

import {
  buildFileOrFolderByIdQuery,
  buildFileVersionsQuery,
  buildSharedDriveFileWithVersionsQuery
} from '@/queries'

const sortByMostRecent = versions =>
  [...versions].sort((a, b) => b.updated_at.localeCompare(a.updated_at))

const FileHistory = () => {
  const { fileId, driveId } = useParams()

  const fileQuery = driveId
    ? buildSharedDriveFileWithVersionsQuery({ fileId, driveId })
    : buildFileOrFolderByIdQuery(fileId)
  const { data: file, fetchStatus: fileFetchStatus } = useQuery(
    fileQuery.definition,
    fileQuery.options
  )

  // The versions of a drive file live on the owner's instance: they come
  // with the file fetched through the drive, not from the member's database.
  const revisionsQuery = buildFileVersionsQuery(fileId)
  const { data: instanceRevisions, fetchStatus: instanceRevisionsFetchStatus } =
    useQuery(revisionsQuery.definition, {
      ...revisionsQuery.options,
      enabled: revisionsQuery.options.enabled && !driveId
    })

  if (fileFetchStatus !== 'loaded') return null

  return (
    <HistoryModal
      file={file}
      revisions={
        driveId
          ? sortByMostRecent(file.old_versions?.data ?? [])
          : instanceRevisions
      }
      revisionsFetchStatus={
        driveId ? fileFetchStatus : instanceRevisionsFetchStatus
      }
    />
  )
}

export default FileHistory
