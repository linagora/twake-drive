import { Icon } from '@linagora/twake-icons'
import React from 'react'

import {
  getSharingShortcutTargetMime,
  getSharingShortcutTargetDoctype
} from 'cozy-client/dist/models/file'

import { DOCTYPE_FILES } from '@/lib/doctypes'
import getMimeTypeIcon from '@/lib/getMimeTypeIcon'
import FileIconShortcut from '@/modules/filelist/icons/FileIconShortcut'

const SharingShortcutIcon = ({ file, size }) => {
  const targetMimeType = getSharingShortcutTargetMime(file)
  const targetDoctype = getSharingShortcutTargetDoctype(file)
  const isShortcut = targetMimeType === 'application/internet-shortcut'
  const targetIsDirectory =
    targetMimeType === '' && targetDoctype === DOCTYPE_FILES

  return isShortcut ? (
    <FileIconShortcut file={file} size={size} />
  ) : (
    <Icon
      icon={getMimeTypeIcon(targetIsDirectory, file.name, targetMimeType)}
      size={size}
    />
  )
}

export { SharingShortcutIcon }
