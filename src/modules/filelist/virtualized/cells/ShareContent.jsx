import cx from 'classnames'
import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

import { SharedStatus } from 'cozy-sharing'

import styles from '@/styles/filelist.styl'

import { joinPath } from '@/lib/path'
import { isFromSharedDriveRecipient } from '@/modules/shareddrives/helpers'

const ShareContent = ({ file, disabled }) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const handleClick = e => {
    // Avoid to trigger row click from FileOpener
    e.preventDefault()
    e.stopPropagation()

    if (!disabled) {
      const sharePath = isFromSharedDriveRecipient(file)
        ? `/shareddrive/${file.driveId}/${file._id}/file/${file.id}/share`
        : joinPath(pathname, `file/${file.id}/share`)

      navigate(sharePath)
    }
  }

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
