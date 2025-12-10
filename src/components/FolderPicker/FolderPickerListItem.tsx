import { filesize } from 'filesize'
import React, { FC } from 'react'
import { useI18n } from 'twake-i18n'

import { isDirectory } from 'cozy-client/dist/models/file'
import Divider from 'cozy-ui/transpiled/react/Divider'
import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import styles from '@/styles/folder-picker.styl'

import type { File } from '@/components/FolderPicker/types'
import { getFileNameAndExtension } from '@/modules/filelist/helpers'
import FileThumbnail from '@/modules/filelist/icons/FileThumbnail'

interface FolderPickerListItemProps {
  file: File
  disabled?: boolean
  onClick: (file: File) => void
  showDivider?: boolean
}

const FolderPickerListItem: FC<FolderPickerListItemProps> = ({
  file,
  disabled = false,
  onClick,
  showDivider = false
}) => {
  const { f, t } = useI18n()
  const { isMobile } = useBreakpoints()
  const gutters = isMobile ? 'default' : 'double'

  const handleClick = (): void => {
    onClick(file)
  }

  const formattedUpdatedAt = f(
    new Date(file.updated_at),
    t('table.row_update_format')
  )
  const formattedSize = file.size
    ? filesize(file.size, { base: 10 })
    : undefined
  const secondaryText = !isDirectory(file)
    ? `${formattedUpdatedAt}${formattedSize ? ` - ${formattedSize}` : ''}`
    : undefined

  const { title } = getFileNameAndExtension(file, t)

  return (
    <>
      <ListItem
        button
        onClick={handleClick}
        disabled={disabled}
        gutters={gutters}
      >
        <ListItemIcon className="u-pos-relative">
          <FileThumbnail
            file={file}
            showSharedBadge
            componentsProps={{
              sharedBadge: {
                className: styles['icon-shared']
              }
            }}
          />
        </ListItemIcon>
        <ListItemText primary={title} secondary={secondaryText} />
      </ListItem>
      {showDivider && <Divider />}
    </>
  )
}

export { FolderPickerListItem }
