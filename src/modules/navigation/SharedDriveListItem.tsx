import React, { FC } from 'react'

import FileTypeSharedDriveIcon from 'cozy-ui/transpiled/react/Icons/FileTypeSharedDrive'
import { NavIcon, NavLink, NavItem } from 'cozy-ui/transpiled/react/Nav'
import Typography from 'cozy-ui/transpiled/react/Typography'

import { FileLink } from './components/FileLink'

import { useSharedDriveLink } from '@/modules/navigation/hooks/useSharedDriveLink'
import type { SharedDrive } from '@/modules/shareddrives/helpers'

interface SharedDriveListItemProps {
  sharing: SharedDrive
  clickState: [string, (value: string | undefined) => void]
}

const SharedDriveListItem: FC<SharedDriveListItemProps> = ({
  sharing,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  clickState: [lastClicked, setLastClicked]
}) => {
  const { link } = useSharedDriveLink(sharing)

  return (
    <NavItem key={sharing._id}>
      <FileLink
        link={link}
        className={NavLink.className}
        onClick={(): void => setLastClicked(undefined)}
      >
        <NavIcon icon={FileTypeSharedDriveIcon} />
        <Typography
          className="u-fz-small"
          variant="inherit"
          color="inherit"
          noWrap
        >
          {sharing.description}
        </Typography>
      </FileLink>
    </NavItem>
  )
}

export { SharedDriveListItem }
