import flag from 'cozy-flags'
import NavOld, {
  NavDesktopDropdown as NavDesktopDropdownOld,
  NavIcon as NavIconOld,
  NavItem as NavItemOld,
  NavLink as NavLinkOld,
  NavText as NavTextOld
} from 'cozy-ui/transpiled/react/Nav'
import NavNew, {
  NavDesktopDropdown as NavDesktopDropdownNew,
  NavIcon as NavIconNew,
  NavItem as NavItemNew,
  NavLink as NavLinkNew,
  NavText as NavTextNew
} from 'cozy-ui/transpiled/react/NavNext'

type NavComponents = {
  Nav: typeof NavNew
  NavDesktopDropdown: typeof NavDesktopDropdownNew
  NavIcon: typeof NavIconNew
  NavItem: typeof NavItemNew
  NavLink: typeof NavLinkNew
  NavText: typeof NavTextNew
}

const isNewSidebarEnabled = (): boolean =>
  Boolean(flag('drive.new-sidebar.enabled'))

export const getNavComponents = (): NavComponents => {
  const useNewSidebar = isNewSidebarEnabled()

  return {
    Nav: useNewSidebar ? NavNew : (NavOld as typeof NavNew),
    NavDesktopDropdown: useNewSidebar
      ? NavDesktopDropdownNew
      : (NavDesktopDropdownOld as typeof NavDesktopDropdownNew),
    NavIcon: useNewSidebar ? NavIconNew : (NavIconOld as typeof NavIconNew),
    NavItem: useNewSidebar ? NavItemNew : (NavItemOld as typeof NavItemNew),
    NavLink: useNewSidebar ? NavLinkNew : (NavLinkOld as typeof NavLinkNew),
    NavText: useNewSidebar ? NavTextNew : (NavTextOld as typeof NavTextNew)
  }
}
