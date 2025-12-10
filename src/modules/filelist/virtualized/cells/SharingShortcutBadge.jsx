import PropTypes from 'prop-types'
import React from 'react'
import { useI18n } from 'twake-i18n'

import { isSharingShortcutNew } from 'cozy-client/dist/models/file'
import Circle from 'cozy-ui/transpiled/react/Circle'

const SharingShortcutBadge = ({ file }) => {
  const { t } = useI18n()

  if (isSharingShortcutNew(file)) {
    return (
      <Circle size="xsmall" backgroundColor="var(--errorColor)">
        <span
          style={{ fontSize: '11px', lineHeight: '1rem' }}
          aria-label={t('table.row_sharing_shortcut_aria_label')}
        >
          1
        </span>
      </Circle>
    )
  }

  return null
}

SharingShortcutBadge.propTypes = {
  file: PropTypes.object,
  isInSyncFromSharing: PropTypes.bool
}

export default SharingShortcutBadge
