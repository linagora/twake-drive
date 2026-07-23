import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import flag from 'cozy-flags'
import { ShareModal } from 'cozy-sharing'

import { useDisplayedFolder } from '@/hooks'
import { getSharingsRootRoute } from '@/modules/views/Sharings/routes'

const ShareDisplayedFolderView = () => {
  const { displayedFolder } = useDisplayedFolder()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (displayedFolder) {
    const onClose = () => {
      navigate('..', { replace: true })
    }

    const onRevokeSuccess = () => {
      navigate(getSharingsRootRoute(pathname), { replace: true })
    }

    return (
      <ShareModal
        document={displayedFolder}
        documentType="Files"
        sharingDesc={displayedFolder.name}
        onClose={onClose}
        onRevokeSuccess={onRevokeSuccess}
        autoOpenShareRestriction={flag('sharing.auto-open-settings.enabled')}
        showGenerateLinkButton={flag('sharing.generate-link-button.enabled')}
      />
    )
  }

  return null
}

export { ShareDisplayedFolderView }
