import { Icon, Share } from '@linagora/twake-icons'
import React, { useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { deconstructRedirectLink } from 'cozy-client'
import flag from 'cozy-flags'
import { ShareButton, ShareModal, SharedRecipients } from 'cozy-sharing'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { getSharingsRootRoute } from '@/modules/views/Sharings/routes'

const Sharing = ({ file }) => {
  const [showShareModal, setShowShareModal] = useState(false)
  const { isMobile } = useBreakpoints()
  const navigate = useNavigate()
  const { search } = useLocation()

  const toggleShareModal = useCallback(
    () => setShowShareModal(v => !v),
    [setShowShareModal]
  )

  const handleRevokeSuccess = () => {
    const redirectLink = new URLSearchParams(search).get('redirectLink')
    const { slug, hash } = redirectLink
      ? deconstructRedirectLink(redirectLink)
      : {}
    const fromPathname = slug === 'drive' ? hash : ''

    navigate(getSharingsRootRoute(fromPathname), { replace: true })
  }

  return (
    <>
      {isMobile ? (
        <IconButton
          data-testid="onlyoffice-sharing-icon"
          onClick={toggleShareModal}
          size="medium"
        >
          <Icon icon={Share} />
        </IconButton>
      ) : (
        <>
          <SharedRecipients
            docId={file._id}
            size={32}
            onClick={toggleShareModal}
          />
          <ShareButton
            data-testid="onlyoffice-sharing-button"
            docId={file._id}
            onClick={toggleShareModal}
          />
        </>
      )}
      {showShareModal && (
        <ShareModal
          document={file}
          documentType="Files"
          sharingDesc={file.name}
          onClose={toggleShareModal}
          onRevokeSuccess={handleRevokeSuccess}
          autoOpenShareRestriction={flag('sharing.auto-open-settings.enabled')}
          showGenerateLinkButton={flag('sharing.generate-link-button.enabled')}
        />
      )}
    </>
  )
}

export default React.memo(Sharing)
