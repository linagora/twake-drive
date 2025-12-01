import PropTypes from 'prop-types'
import React from 'react'

import { isDirectory } from 'cozy-client/dist/models/file'
import flag from 'cozy-flags'
import Icon from 'cozy-ui/transpiled/react/Icon'

import { isEncryptedFolder } from '@/lib/encryption'
import getMimeTypeIcon from '@/lib/getMimeTypeIcon'
import { CustomizedIcon } from '@/modules/views/Folder/CustomizedIcon'

const FileIconMime = ({ file, size = 32, isEncrypted = false }) => {
  const isDir = isDirectory(file)
  const isDirEncrypted = isEncrypted || (isDirectory && isEncryptedFolder(file)) // use file.ref + file.type

  if (
    isDir &&
    flag('drive.folder-personalization.enabled') &&
    (file.metadata?.decorations?.color || file.metadata?.decorations?.icon)
  ) {
    return (
      <CustomizedIcon
        selectedColor={file.metadata.decorations.color}
        selectedIcon={file.metadata.decorations.icon}
        selectedIconColor={file.metadata.decorations.icon_color}
        size={size}
      />
    )
  } else {
    return (
      <Icon
        icon={getMimeTypeIcon(isDir, file.name, file.mime, {
          isEncrypted: isDirEncrypted
        })}
        size={size}
      />
    )
  }
}

FileIconMime.propTypes = {
  file: PropTypes.shape({
    type: PropTypes.string,
    mime: PropTypes.string,
    name: PropTypes.string
  }).isRequired,
  size: PropTypes.number
}

export default FileIconMime
