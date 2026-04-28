import React from 'react'

import Avatar from 'cozy-ui/transpiled/react/Avatar'
import Icon from 'cozy-ui/transpiled/react/Icon'
import DriveIcon from 'cozy-ui/transpiled/react/Icons/FileTypeFolder'

import { FolderPickerEntry } from '@/components/FolderPicker/types'
import getMimeTypeIcon from '@/lib/getMimeTypeIcon'
import FileThumbnail from '@/modules/filelist/icons/FileThumbnail'

interface FolderPickerHeaderIllustrationProps {
  entries: FolderPickerEntry[]
}

const FolderPickerHeaderIllustration: React.FC<
  FolderPickerHeaderIllustrationProps
> = ({ entries }) => {
  if (entries.length === 1) {
    const firstItem = entries[0]

    // this is a cozy files
    if (firstItem.class) {
      return <FileThumbnail file={firstItem} isInSyncFromSharing={false} />
    }

    // this is a cozy-flagship file, doesn't have a class yet
    if (firstItem.name && firstItem.mime) {
      return (
        <Icon
          icon={getMimeTypeIcon(false, firstItem.name, firstItem.mime)}
          size={32}
        />
      )
    }

    return <Icon icon={DriveIcon} size={32} />
  }
  if (entries.length > 1) {
    return (
      <Avatar color="var(--dodgerBlue)" textColor="var(--white)">
        <span>{entries.length > 99 ? '99+' : entries.length}</span>
      </Avatar>
    )
  }
  return null
}

export { FolderPickerHeaderIllustration }
