import { Icon, ClockOutline, Cloud2, Star, Trash } from '@linagora/twake-icons'
import React from 'react'

import flag from 'cozy-flags'
import { NavDesktopDropdown } from 'cozy-ui/transpiled/react/Nav'
import UINav from 'cozy-ui/transpiled/react/Nav'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import NextcloudIcon from '@/assets/icons/icon-nextcloud.svg'
import { ExternalNavItem } from '@/modules/navigation/ExternalNavItem'
import { FavoriteList } from '@/modules/navigation/FavoriteList'
import { useNavContext } from '@/modules/navigation/NavContext'
import { NavItem } from '@/modules/navigation/NavItem'
import { SharedDriveList } from '@/modules/navigation/SharedDriveList'
import { SharingsNavItem } from '@/modules/navigation/SharingsNavItem'
import { ExternalDrives } from '@/modules/navigation/components/ExternalDrivesList'

export const Nav = () => {
  const clickState = useNavContext()
  const { isDesktop } = useBreakpoints()
  const { t } = useI18n()

  return (
    <UINav>
      <NavItem
        to="/folder"
        icon={<Icon icon={Cloud2} />}
        label="drive"
        rx={/\/(folder|nextcloud)(\/.*)?/}
        clickState={clickState}
      />
      {!isDesktop ? (
        <NavItem
          to="/favorites"
          icon={<Icon icon={Star} />}
          label="favorites"
          rx={/\/favorites(\/.*)?/}
          clickState={clickState}
        />
      ) : null}
      <NavItem
        to="/recent"
        icon={<Icon icon={ClockOutline} />}
        label="recent"
        rx={/\/recent(\/.*)?/}
        clickState={clickState}
      />
      <SharingsNavItem clickState={clickState} />
      <NavItem
        to="/trash"
        icon={<Icon icon={Trash} />}
        label="trash"
        rx={/\/trash(\/.*)?/}
        clickState={clickState}
      />
      {flag('settings.migration.enabled') && (
        <NavDesktopDropdown label={t('Nav.item_migration')} limit={0}>
          <ExternalNavItem
            slug="settings"
            icon={<Icon icon={NextcloudIcon} />}
            label="nextcloud"
            path="/migration"
            clickState={clickState}
          />
        </NavDesktopDropdown>
      )}
      {isDesktop ? <FavoriteList clickState={clickState} /> : null}
      {isDesktop && flag('drive.shared-drive.enabled') ? (
        <SharedDriveList clickState={clickState} />
      ) : null}
      {isDesktop ? (
        <ExternalDrives clickState={clickState} className="u-mt-half" />
      ) : null}
    </UINav>
  )
}

export default Nav
