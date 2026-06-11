import React from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { useSharingContext } from 'cozy-sharing'
import Dialog from 'cozy-ui/transpiled/react/Dialog'

import Loader from '@/components/Loader'
import useHead from '@/components/useHead'
import Editor from '@/modules/views/Pdf/Editor'

const Pdf = ({ isPublic = false, isReadOnly = false }) => {
  const { fileId, driveId } = useParams()
  const { hasWriteAccess, allLoaded } = useSharingContext()
  useHead()

  // The editor is for editing only. A private recipient with read-only access
  // must not reach it, even by typing the URL (the Edit button is already hidden
  // for them). Wait for the sharing permissions to load, then bounce them back
  // to the drive. Public read-only shares are blocked upstream in the route.
  if (!isPublic) {
    if (!allLoaded) {
      return <Loader />
    }
    if (!hasWriteAccess(fileId, driveId)) {
      return <Navigate to="/" replace />
    }
  }

  // In public the share code already determines read-only (passed in as
  // isReadOnly). In private, the user always has write access at this point.
  const readOnly = isPublic ? isReadOnly : !hasWriteAccess(fileId, driveId)

  return (
    <Dialog open={true} fullScreen transitionDuration={0}>
      <Editor
        fileId={fileId}
        driveId={driveId}
        isPublic={isPublic}
        isReadOnly={readOnly}
      />
    </Dialog>
  )
}

export default Pdf
