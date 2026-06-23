import React from 'react'
import { useParams } from 'react-router-dom'

import { useSharingContext } from 'cozy-sharing'
import Dialog from 'cozy-ui/transpiled/react/Dialog'

import useHead from '@/components/useHead'
import Editor from '@/modules/views/Excalidraw/Editor'

const Excalidraw = ({ isPublic = false, isReadOnly = false }) => {
  const { fileId, driveId } = useParams()
  const { hasWriteAccess } = useSharingContext()
  useHead()

  // In public the share code already determines read-only (passed in as
  // isReadOnly). In private, follow the sharing permissions: a recipient with
  // read-only access must open the drawing in view mode, otherwise every
  // autosave 403s in a loop and the edits are silently lost.
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

export default Excalidraw
