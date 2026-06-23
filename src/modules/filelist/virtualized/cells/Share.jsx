import React from 'react'

import ShareContent from './ShareContent'
import SharingShortcutBadge from './SharingShortcutBadge'

import styles from '@/styles/filelist.styl'

const Share = ({ row, isRowDisabledOrInSyncFromSharing }) => {
  return (
    <div className={styles['fil-content-share']}>
      <SharingShortcutBadge file={row} />
      <ShareContent file={row} disabled={isRowDisabledOrInSyncFromSharing} />
    </div>
  )
}

export default Share
