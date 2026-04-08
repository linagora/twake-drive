import cx from 'classnames'
import PropTypes from 'prop-types'
import React from 'react'

import { isSharingShortcutNew } from 'cozy-client/dist/models/file'
import Avatar from 'cozy-ui/transpiled/react/Avatar'
import { TableCell } from 'cozy-ui/transpiled/react/deprecated/Table'
import { useI18n } from 'twake-i18n'

import styles from '@/styles/filelist.styl'

const SharingShortcutBadge = ({ file }) => {
  const { t } = useI18n()

  return (
    <TableCell
      className={cx(
        styles['fil-content-cell'],
        styles['fil-content-sharing-shortcut']
      )}
    >
      {isSharingShortcutNew(file) ? (
        <Avatar color="var(--errorColor)" textColor="var(--white)" size="xs">
          <span
            style={{ fontSize: '11px', lineHeight: '1rem' }}
            aria-label={t('table.row_sharing_shortcut_aria_label')}
          >
            1
          </span>
        </Avatar>
      ) : null}
    </TableCell>
  )
}

SharingShortcutBadge.propTypes = {
  file: PropTypes.object,
  isInSyncFromSharing: PropTypes.bool
}

export { SharingShortcutBadge }
