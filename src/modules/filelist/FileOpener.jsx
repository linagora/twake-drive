import cx from 'classnames'
import React, { useRef } from 'react'

import styles from './fileopener.styl'

import { useLongPress } from '@/hooks/useOnLongPress'
import { FileLink } from '@/modules/navigation/components/FileLink'
import { useFileLink } from '@/modules/navigation/hooks/useFileLink'

const FileOpener = ({
  file,
  toggle,
  disabled,
  isRenaming,
  onInteractWithFile,
  fillHeight,
  children
}) => {
  const rowRef = useRef()
  const { link, openLink } = useFileLink(file)
  const handlers = useLongPress({
    file,
    disabled,
    isRenaming,
    openLink,
    toggle,
    onInteractWithFile
  })

  if (isRenaming) {
    return children
  }

  return (
    <FileLink
      ref={rowRef}
      link={link}
      className={cx(styles['file-opener'], styles['file-opener__a'], {
        [styles['file-opener--fill-height']]: fillHeight
      })}
      {...handlers}
    >
      {children}
    </FileLink>
  )
}

export default FileOpener
