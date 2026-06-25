import React from 'react'
import { useNavigate } from 'react-router-dom'

import flag from 'cozy-flags'
import { ShareModal } from 'cozy-sharing'

import { useDisplayedFolder } from '@/hooks'
import { makeRevokeSuccessRedirectPath } from '@/modules/views/Modal/revokeSuccessRedirect'

const ShareDisplayedFolderView = () => {
  const { displayedFolder } = useDisplayedFolder()
  const navigate = useNavigate()

  if (displayedFolder) {
    const onClose = () => {
      navigate('..', { replace: true })
    }

    const onRevokeSuccess = () => {
      navigate(makeRevokeSuccessRedirectPath({ document: displayedFolder }), {
        replace: true
      })
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
