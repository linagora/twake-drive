import flag from 'cozy-flags'

/**
 * Collects the boolean flags the Public view needs to decide which optional
 * pieces of UI to render: the new vs old breadcrumb, the sharing banner,
 * and the "add to my cozy" FAB. Keeping them in one place keeps the view
 * body itself focused on layout.
 */
export const usePublicDisplayFlags = ({
  sharingInfos,
  isOnSharedFolder,
  isMobile
}) => {
  const showNewBreadcrumbFlag = flag(
    'drive.breadcrumb.showCompleteBreadcrumbOnPublicPage'
  )
  const isOldBreadcrumb = showNewBreadcrumbFlag !== true

  // The sharing shortcut has not been created (or has been but not yet synced)
  const isShareNotAdded =
    !sharingInfos.loading && !sharingInfos.isSharingShortcutCreated
  // Cozy-to-Cozy preview lives on the `/preview` route; link sharing on `/public`
  const isPreview = window.location.pathname === '/preview'

  return {
    isOldBreadcrumb,
    isShareNotAdded,
    isPreview,
    isSharingBannerPluginDisplayed:
      isShareNotAdded || (isOnSharedFolder && !isPreview),
    isAddToMyCozyFabDisplayed: isMobile && isPreview && isShareNotAdded
  }
}
