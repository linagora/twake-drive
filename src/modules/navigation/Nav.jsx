import React from 'react'

import flag from 'cozy-flags'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ClockIcon from 'cozy-ui/transpiled/react/Icons/ClockOutline'
import CloudIcon from 'cozy-ui/transpiled/react/Icons/Cloud2'
import CloudSyncIcon from 'cozy-ui/transpiled/react/Icons/CloudSync'
import StarIcon from 'cozy-ui/transpiled/react/Icons/Star'
import TrashIcon from 'cozy-ui/transpiled/react/Icons/Trash'
import UINav from 'cozy-ui/transpiled/react/Nav'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { ExternalNavItem } from '@/modules/navigation/ExternalNavItem'
import { FavoriteList } from '@/modules/navigation/FavoriteList'
import { useNavContext } from '@/modules/navigation/NavContext'
import { NavItem } from '@/modules/navigation/NavItem'
import { SharingsNavItem } from '@/modules/navigation/SharingsNavItem'
import { ExternalDrives } from '@/modules/navigation/components/ExternalDrivesList'

export const Nav = () => {
  const clickState = useNavContext()
  const { isDesktop } = useBreakpoints()

  return (
    <UINav>
      <NavItem
        to="/folder"
        icon={<Icon icon={CloudIcon} />}
        label="drive"
        rx={/\/(folder|nextcloud)(\/.*)?/}
        clickState={clickState}
      />
      {!isDesktop ? (
        <NavItem
          to="/favorites"
          icon={<Icon icon={StarIcon} />}
          label="favorites"
          rx={/\/favorites(\/.*)?/}
          clickState={clickState}
        />
      ) : null}
      <NavItem
        to="/recent"
        icon={<Icon icon={ClockIcon} />}
        label="recent"
        rx={/\/recent(\/.*)?/}
        clickState={clickState}
      />
      <SharingsNavItem clickState={clickState} />
      <NavItem
        to="/trash"
        icon={<Icon icon={TrashIcon} />}
        label="trash"
        rx={/\/trash(\/.*)?/}
        clickState={clickState}
      />
      {flag('settings.migration.enabled') && (
        <ExternalNavItem
          slug="settings"
          icon={<Icon icon={CloudSyncIcon} />}
          label="migration"
          path="/migration"
          clickState={clickState}
        />
      )}
      {isDesktop ? <FavoriteList clickState={clickState} /> : null}
      {isDesktop ? (
        <ExternalDrives clickState={clickState} className="u-mt-half" />
      ) : null}
    </UINav>
  )
}

export default Nav
