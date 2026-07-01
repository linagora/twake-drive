import React, { FC } from 'react'

import FileTypeSharedDriveIcon from 'cozy-ui/transpiled/react/Icons/FileTypeSharedDrive'
import { NavIcon, NavItem } from 'cozy-ui/transpiled/react/Nav'
import Typography from 'cozy-ui/transpiled/react/Typography'

import { NavLink } from './NavLink'

import { useSharedDriveLink } from '@/modules/navigation/hooks/useSharedDriveLink'
import type { SharedDrive } from '@/modules/shareddrives/helpers'

interface SharedDriveListItemProps {
  sharing: SharedDrive
  clickState: [string, (value: string | undefined) => void]
}

const SharedDriveListItem: FC<SharedDriveListItemProps> = ({
  sharing,
  clickState
}) => {
  const { link } = useSharedDriveLink(sharing)

  return (
    <NavItem key={sharing._id}>
      <NavLink
        to={link.to.pathname}
        rx={new RegExp(`^\\/shareddrive\\/${sharing._id}(\\/.*|$)`)}
        clickState={clickState}
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
      </NavLink>
    </NavItem>
  )
}

export { SharedDriveListItem }
