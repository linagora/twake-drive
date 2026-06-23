import React, { useState, useCallback } from 'react'

import flag from 'cozy-flags'
import { ShareButton, ShareModal, SharedRecipients } from 'cozy-sharing'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import ShareIcon from 'cozy-ui/transpiled/react/Icons/Share'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

const Sharing = ({ file }) => {
  const [showShareModal, setShowShareModal] = useState(false)
  const { isMobile } = useBreakpoints()

  const toggleShareModal = useCallback(
    () => setShowShareModal(v => !v),
    [setShowShareModal]
  )

  return (
    <>
      {isMobile ? (
        <IconButton
          data-testid="onlyoffice-sharing-icon"
          onClick={toggleShareModal}
          size="medium"
        >
          <Icon icon={ShareIcon} />
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
          autoOpenShareRestriction={flag('sharing.auto-open-settings.enabled')}
          showGenerateLinkButton={flag('sharing.generate-link-button.enabled')}
        />
      )}
    </>
  )
}

export default React.memo(Sharing)
