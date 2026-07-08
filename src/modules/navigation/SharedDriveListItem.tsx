import { FileTypeSharedDrive } from '@linagora/twake-icons'
import React, { FC } from 'react'

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
        <NavIcon icon={FileTypeSharedDrive} />
        <Typography
          className="u-fz-small"
          variant="button"
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
