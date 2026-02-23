import React from 'react'

import FileImageLoader from 'cozy-ui-plus/dist/FileImageLoader'

import styles from '@/styles/filelist.styl'

import FileIconMime from '@/modules/filelist/icons/FileIconMime'
import FileIconShortcut from '@/modules/filelist/icons/FileIconShortcut'

const FileIcon = ({ file, size, isEncrypted, viewType = 'list' }) => {
  const isImage = file.class === 'image'
  const isShortcut = file.class === 'shortcut' && !file.driveId
  if (isImage || file.class === 'pdf')
    return (
      <FileImageLoader
        key={file._id}
        file={file}
        linkType={viewType === 'grid' ? 'small' : 'tiny'}
        render={src => (
          <img
            src={src}
            width={size || 32}
            height={size || 32}
            className={styles['fil-file-thumbnail-image']}
          />
        )}
        renderFallback={() => <FileIconMime file={file} size={size} />}
      />
    )
  else if (isShortcut) return <FileIconShortcut file={file} size={size} />
  else return <FileIconMime file={file} size={size} isEncrypted={isEncrypted} />
}

export default FileIcon
