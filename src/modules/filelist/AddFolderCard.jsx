import cx from 'classnames'
import React from 'react'

import styles from '@/styles/filelist.styl'

import FilenameInput from '@/modules/filelist/FilenameInput'
import FileThumbnail from '@/modules/filelist/icons/FileThumbnail'

const AddFolderCard = ({ onSubmit, onAbort }) => {
  return (
    <div className={cx(styles['fil-content-column'])}>
      <div
        className={cx(
          styles['fil-content-cell'],
          styles['fil-file-thumbnail'],
          styles['fil-content-grid-view']
        )}
      >
        <FileThumbnail file={{ type: 'directory' }} size={96} />
      </div>
      <FilenameInput onSubmit={onSubmit} onAbort={onAbort} />
    </div>
  )
}

export { AddFolderCard }
