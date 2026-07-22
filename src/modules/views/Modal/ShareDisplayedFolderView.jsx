import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import flag from 'cozy-flags'
import { ShareModal } from 'cozy-sharing'

import { useDisplayedFolder } from '@/hooks'
import {
  makeSharingsTabLocation,
  makeSharingsViewLocation
} from '@/modules/navigation/sharingsTabNavigation'

const ShareDisplayedFolderView = () => {
  const { displayedFolder } = useDisplayedFolder()
  const location = useLocation()
  const navigate = useNavigate()

  if (displayedFolder) {
    const handleClose = () => {
      navigate(
        makeSharingsTabLocation({
          currentLocation: location,
          targetPathname: '..'
        }),
        { replace: true }
      )
    }

    const handleRevokeSuccess = () => {
      navigate(makeSharingsViewLocation({ currentLocation: location }), {
        replace: true
      })
    }

    return (
      <ShareModal
        document={displayedFolder}
        documentType="Files"
        sharingDesc={displayedFolder.name}
        onClose={handleClose}
        onRevokeSuccess={handleRevokeSuccess}
        autoOpenShareRestriction={flag('sharing.auto-open-settings.enabled')}
        showGenerateLinkButton={flag('sharing.generate-link-button.enabled')}
      />
    )
  }

  return null
}

export { ShareDisplayedFolderView }
