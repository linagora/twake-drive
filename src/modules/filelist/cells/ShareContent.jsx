import cx from 'classnames'
import React from 'react'

import { SharedStatus, useSharingContext } from 'cozy-sharing'

import styles from '@/styles/filelist.styl'

import { useViewSwitcherContext } from '@/lib/ViewSwitcherContext'
import { useFileShareNavigate } from '@/modules/filelist/useFileShareNavigate'

const ShareContent = ({ file, disabled, isInSyncFromSharing }) => {
  const { byDocId } = useSharingContext()
  const { viewType } = useViewSwitcherContext()
  const handleClick = useFileShareNavigate({ file, disabled })

  const isShared = byDocId[file.id] !== undefined

  return (
    <div
      className={cx(styles['fil-content-sharestatus'], {
        [styles['fil-content-sharestatus--disabled']]: disabled
      })}
    >
      {isInSyncFromSharing || !isShared ? (
        viewType === 'list' ? (
          <span data-testid="fil-content-sharestatus--noAvatar">—</span>
        ) : null
      ) : (
        <SharedStatus onClick={handleClick} docId={file.id} />
      )}
    </div>
  )
}

export { ShareContent }
