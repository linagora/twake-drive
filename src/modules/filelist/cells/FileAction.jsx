import { Icon, Dots } from '@linagora/twake-icons'
import cx from 'classnames'
import React, { forwardRef } from 'react'

import IconButton from 'cozy-ui/transpiled/react/IconButton'
import { TableCell } from 'cozy-ui/transpiled/react/deprecated/Table'

import styles from '@/styles/filelist.styl'

const FileAction = forwardRef(function FileAction(
  { t, onClick, disabled, isInSyncFromSharing },
  ref
) {
  return (
    <TableCell
      className={cx(
        styles['fil-content-cell'],
        styles['fil-content-file-action'],
        { [styles['fil-content-file-action--disabled']]: isInSyncFromSharing }
      )}
    >
      <span ref={ref}>
        <IconButton
          disabled={disabled}
          onClick={onClick}
          size="small"
          aria-label={t('Toolbar.more')}
        >
          <Icon icon={Dots} size={17} />
        </IconButton>
      </span>
    </TableCell>
  )
})

export default FileAction
