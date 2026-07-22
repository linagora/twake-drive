import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { SharedRecipients } from 'cozy-sharing'

import { useDisplayedFolder } from '@/hooks'
import { makeDisplayedFolderShareLocation } from '@/modules/drive/Toolbar/share/helpers'

const SharedRecipientsComponent = () => {
  const { displayedFolder } = useDisplayedFolder()
  const navigate = useNavigate()
  const location = useLocation()

  const share = () => {
    navigate(makeDisplayedFolderShareLocation({ location }))
  }

  return (
    <SharedRecipients
      docId={displayedFolder && displayedFolder.id}
      onClick={share}
    />
  )
}

export default SharedRecipientsComponent
