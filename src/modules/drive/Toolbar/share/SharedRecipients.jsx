import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { SharedRecipients } from 'cozy-sharing'

import { useDisplayedFolder } from '@/hooks'
import { getPathToShareDisplayedFolder } from '@/modules/drive/Toolbar/share/helpers'

const SharedRecipientsComponent = () => {
  const { displayedFolder } = useDisplayedFolder()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()

  const share = () => {
    navigate({ pathname: getPathToShareDisplayedFolder(pathname), search })
  }

  return (
    <SharedRecipients
      docId={displayedFolder && displayedFolder.id}
      onClick={share}
    />
  )
}

export default SharedRecipientsComponent
