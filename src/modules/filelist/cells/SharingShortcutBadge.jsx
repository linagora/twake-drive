import cx from 'classnames'
import PropTypes from 'prop-types'
import React from 'react'
import { useI18n } from 'twake-i18n'

import { isSharingShortcutNew } from 'cozy-client/dist/models/file'
import Circle from 'cozy-ui/transpiled/react/Circle'
import { TableCell } from 'cozy-ui/transpiled/react/deprecated/Table'

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
        <Circle size="xsmall" backgroundColor="var(--errorColor)">
          <span
            style={{ fontSize: '11px', lineHeight: '1rem' }}
            aria-label={t('table.row_sharing_shortcut_aria_label')}
          >
            1
          </span>
        </Circle>
      ) : null}
    </TableCell>
  )
}

SharingShortcutBadge.propTypes = {
  file: PropTypes.object,
  isInSyncFromSharing: PropTypes.bool
}

export { SharingShortcutBadge }
