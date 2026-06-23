import PropTypes from 'prop-types'
import React from 'react'

import { isSharingShortcutNew } from 'cozy-client/dist/models/file'
import Avatar from 'cozy-ui/transpiled/react/Avatar'
import { useI18n } from 'twake-i18n'

const SharingShortcutBadge = ({ file }) => {
  const { t } = useI18n()

  if (isSharingShortcutNew(file)) {
    return (
      <Avatar color="var(--errorColor)" textColor="var(--white)" size="xs">
        <span
          style={{ fontSize: '11px', lineHeight: '1rem' }}
          aria-label={t('table.row_sharing_shortcut_aria_label')}
        >
          1
        </span>
      </Avatar>
    )
  }

  return null
}

SharingShortcutBadge.propTypes = {
  file: PropTypes.object,
  isInSyncFromSharing: PropTypes.bool
}

export default SharingShortcutBadge
