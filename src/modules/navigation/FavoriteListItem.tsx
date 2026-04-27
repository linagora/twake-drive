import React, { FC } from 'react'

import {
  splitFilename,
  isDirectory,
  isNote,
  isOnlyOfficeFile
} from 'cozy-client/dist/models/file'
import type { IOCozyFile } from 'cozy-client/types/types'
import FileIcon from 'cozy-ui/transpiled/react/Icons/File'
import FileTypeServerIcon from 'cozy-ui/transpiled/react/Icons/FileTypeServer'
import FolderIcon from 'cozy-ui/transpiled/react/Icons/Folder'
import Typography from 'cozy-ui/transpiled/react/Typography'

import { FileLink } from './components/FileLink'

import { useFileLink } from '@/modules/navigation/hooks/useFileLink'
import { getNavComponents } from '@/modules/navigation/navComponents'
import { isNextcloudShortcut } from '@/modules/nextcloud/helpers'

interface FavoriteListItemProps {
  file: IOCozyFile
  clickState: [string, (value: string | undefined) => void]
}

const makeIcon = (file: IOCozyFile): string | React.ComponentType =>
  isNextcloudShortcut(file)
    ? FileTypeServerIcon
    : isDirectory(file)
      ? FolderIcon
      : FileIcon

const FavoriteListItem: FC<FavoriteListItemProps> = ({
  file,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  clickState: [lastClicked, setLastClicked]
}) => {
  const { NavIcon, NavLink, NavItem } = getNavComponents()
  const { link } = useFileLink(file, {
    forceFolderPath: isNote(file) || isOnlyOfficeFile(file) ? false : true
  })
  const { filename } = splitFilename(file)

  const ItemIcon = makeIcon(file)

  return (
    <NavItem key={file._id}>
      <FileLink
        link={link}
        className={NavLink.className}
        onClick={(): void => setLastClicked(undefined)}
      >
        <NavIcon icon={ItemIcon} />
        <Typography
          className="u-fz-small"
          variant="inherit"
          color="inherit"
          noWrap
        >
          {filename}
        </Typography>
      </FileLink>
    </NavItem>
  )
}

export { FavoriteListItem }
