import cx from 'classnames'
import React from 'react'

import { TableRow, TableCell } from 'cozy-ui/transpiled/react/deprecated/Table'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import styles from '@/styles/filelist.styl'

import FilenameInput from '@/modules/filelist/FilenameInput'
import { Empty as EmptyCell, LastUpdate } from '@/modules/filelist/cells'
import FileThumbnail from '@/modules/filelist/icons/FileThumbnail'

const AddFolderRow = ({ onSubmit, onAbort, extraColumns }) => {
  const { isMobile } = useBreakpoints()

  return (
    <TableRow className={styles['fil-content-row']}>
      <TableCell
        className={cx(
          styles['fil-content-cell'],
          styles['fil-content-file-select']
        )}
      />
      <TableCell
        className={cx(
          styles['fil-content-cell'],
          styles['fil-file-thumbnail'],
          {
            'u-pl-0': !isMobile
          }
        )}
      >
        <FileThumbnail file={{ type: 'directory' }} />
      </TableCell>
      <TableCell
        className={cx(styles['fil-content-cell'], styles['fil-content-file'])}
      >
        <FilenameInput onSubmit={onSubmit} onAbort={onAbort} />
      </TableCell>
      {!isMobile && (
        <>
          <LastUpdate />
          <EmptyCell className={styles['fil-content-size']} />
          {extraColumns &&
            extraColumns.map(column => (
              <EmptyCell
                key={column.label}
                className={styles['fil-content-narrow']}
              />
            ))}
          <EmptyCell className={styles['fil-content-status']} />
        </>
      )}
      <TableCell
        className={cx(
          styles['fil-content-cell'],
          styles['fil-content-file-action']
        )}
      />
    </TableRow>
  )
}

export { AddFolderRow }
