import cx from 'classnames'
import React from 'react'

import { SharedStatus } from 'cozy-sharing'

import styles from '@/styles/filelist.styl'

import { useFileShareNavigate } from '@/modules/filelist/useFileShareNavigate'

const ShareContent = ({ file, disabled }) => {
  const handleClick = useFileShareNavigate({ file, disabled })

  return (
    <div
      className={cx(styles['fil-content-sharestatus'], {
        [styles['fil-content-sharestatus--disabled']]: disabled
      })}
    >
      <SharedStatus onClick={handleClick} docId={file.id} />
    </div>
  )
}

export default ShareContent
