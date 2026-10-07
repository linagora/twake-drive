import { Cross, Icon } from '@linagora/twake-icons'
import React from 'react'

import { useClient } from 'cozy-client'
import { splitFilename } from 'cozy-client/dist/models/file'
import { useSharingContext } from 'cozy-sharing'
import { getDisplayName } from 'cozy-sharing/dist/models'
import Alert from 'cozy-ui/transpiled/react/Alert'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import MidEllipsis from 'cozy-ui/transpiled/react/MidEllipsis'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { declineInvitation, saveInvitationAsSeen } from './helpers'

import { SharingShortcutIcon } from '@/modules/filelist/icons/SharingShortcutIcon'
import { useFileLink } from '@/modules/navigation/hooks/useFileLink'

// Polyglot only interpolates strings, so the translated sentence is split
// around this marker to render the name through MidEllipsis
const NAME_MARKER = '\u0000'

const SharingInvitation = ({ file }) => {
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  const client = useClient()
  const { showAlert } = useAlert()
  const { getOwner } = useSharingContext()
  const { openLink } = useFileLink(file)

  const owner = getOwner(file._id)
  const { filename } = splitFilename({ name: file.name, type: 'file' })
  const ownerName = owner ? getDisplayName(owner) : ''
  const [textBeforeName, textAfterName] = t('SharingInvitations.text', {
    name: NAME_MARKER,
    owner: ownerName
  }).split(NAME_MARKER)

  const handleAccept = evt => {
    openLink(evt)
    saveInvitationAsSeen({ client, file, showAlert, t })
  }

  return (
    <Alert
      square
      block={isMobile}
      color="var(--defaultBackgroundColor)"
      classes={isMobile ? undefined : { message: 'u-ov-hidden' }}
      icon={<SharingShortcutIcon file={file} size={16} />}
      action={
        <>
          <Buttons
            size="small"
            variant="ghost"
            label={t('SharingInvitations.accept')}
            onClick={handleAccept}
          />
          <Buttons
            size="small"
            variant="text"
            color="default"
            label={t('SharingInvitations.decline')}
            onClick={() => declineInvitation({ client, file, showAlert, t })}
          />
          <IconButton
            size="small"
            aria-label={t('SharingInvitations.close')}
            onClick={() => saveInvitationAsSeen({ client, file, showAlert, t })}
          >
            <Icon icon={Cross} color="var(--primaryTextColor)" />
          </IconButton>
        </>
      }
    >
      <div className="u-flex u-flex-items-center u-ov-hidden">
        <span className="u-flex-shrink-0">{textBeforeName}</span>
        <MidEllipsis className="u-ov-hidden" text={filename} />
        <span className="u-flex-shrink-0">{textAfterName}</span>
      </div>
    </Alert>
  )
}

export default SharingInvitation
