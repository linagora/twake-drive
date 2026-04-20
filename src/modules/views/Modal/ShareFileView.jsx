import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { hasQueryBeenLoaded, useQuery } from 'cozy-client'
import flag from 'cozy-flags'
import { ShareModal } from 'cozy-sharing'

import { LoaderModal } from '@/components/LoaderModal'
import {
  buildFileOrFolderByIdQuery,
  buildSharedDriveFileOrFolderByIdQuery
} from '@/queries'

const ShareFileView = () => {
  const navigate = useNavigate()
  const { fileId, driveId } = useParams()

  const fileQuery = driveId
    ? buildSharedDriveFileOrFolderByIdQuery({ fileId, driveId })
    : buildFileOrFolderByIdQuery(fileId)
  const fileResult = useQuery(fileQuery.definition, fileQuery.options)

  const handleExit = () => {
    navigate('..', { replace: true })
  }

  if (hasQueryBeenLoaded(fileResult) && fileResult.data) {
    return (
      <ShareModal
        document={fileResult.data}
        driveId={driveId}
        documentType="Files"
        sharingDesc={fileResult.data.name}
        onClose={handleExit}
        autoOpenShareRestriction={flag('sharing.auto-open-settings.enabled')}
        showGenerateLinkButton={flag('sharing.generate-link-button.enabled')}
      />
    )
  }

  // After successfully removing self from a shared file, the file is not found anymore but the query is considered loaded
  // We check if the data is null, meaning the sharing has been removed
  if (hasQueryBeenLoaded(fileResult) && !fileResult.data) {
    handleExit()
  }

  // Accessing the URL of a file that doesn't exist anymore (or never existed)
  // e.g. /folder/io.cozy.files.shared-with-me-dir/file/someidresolvingto404/share
  if (fileResult.fetchStatus === 'failed') {
    handleExit()
  }

  return <LoaderModal />
}

export { ShareFileView }
