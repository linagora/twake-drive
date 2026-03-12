import React from 'react'
import { useParams, Outlet } from 'react-router-dom'

import Dialog from 'cozy-ui/transpiled/react/Dialog'

import useHead from '@/components/useHead'
import Editor from '@/modules/views/OnlyOffice/Editor'
import { OnlyOfficeProvider } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { ScribeProvider } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'

const OnlyOffice = ({
  isPublic,
  isReadOnly = false,
  isFromSharing,
  username,
  isInSharedFolder
}) => {
  const { fileId, driveId } = useParams()
  useHead()

  return (
    <Dialog open={true} fullScreen transitionDuration={0}>
      <OnlyOfficeProvider
        fileId={fileId}
        driveId={driveId}
        isPublic={isPublic}
        isReadOnly={isReadOnly}
        isFromSharing={isFromSharing}
        username={username}
        isInSharedFolder={isInSharedFolder}
      >
        <ScribeProvider>
          <Editor />
          <Outlet />
        </ScribeProvider>
      </OnlyOfficeProvider>
    </Dialog>
  )
}

export default OnlyOffice
