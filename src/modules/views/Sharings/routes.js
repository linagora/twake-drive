import {
  DEFAULT_SHARINGS_VIEW_ROUTE,
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES,
  SHARING_TAB_WITH_ME,
  SHARINGS_VIEW_ROUTE
} from '@/constants/config'

const LEGACY_ROOT_SEGMENTS = new Set(['file', 'move', 'shareddrive'])
const SHARINGS_TABS = new Set([
  SHARING_TAB_WITH_ME,
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES
])

export function getSharingsTabRoute(tab) {
  return `${SHARINGS_VIEW_ROUTE}/${tab}`
}

export function getSharingsRouteForTab(pathname, tab) {
  const currentTab = getSharingsTabFromPath(pathname)
  const nestedPath = currentTab
    ? pathname.slice(getSharingsTabRoute(currentTab).length)
    : ''

  return `${getSharingsTabRoute(tab)}${nestedPath}`
}

export function getSharingsTabFromPath(pathname) {
  const sharingsPrefix = `${SHARINGS_VIEW_ROUTE}/`
  if (!pathname.startsWith(sharingsPrefix)) {
    return null
  }

  const [tab] = pathname.slice(sharingsPrefix.length).split('/')
  return SHARINGS_TABS.has(tab) ? tab : null
}

export function getSharingsRootRoute(pathname) {
  const tab = getSharingsTabFromPath(pathname)
  return tab ? getSharingsTabRoute(tab) : DEFAULT_SHARINGS_VIEW_ROUTE
}

export function isSharingsTabRootRoute(pathname) {
  return pathname === getSharingsRootRoute(pathname)
}

export function getSharingsSharedDrivePath(pathname, driveId, folderId) {
  return `${getSharingsRootRoute(pathname)}/shareddrive/${driveId}/${folderId}`
}

export function getSharingsSharedDriveViewerPath(
  pathname,
  driveId,
  folderId,
  fileId
) {
  return `${getSharingsSharedDrivePath(
    pathname,
    driveId,
    folderId
  )}/file/${fileId}`
}

export function getSharingsSharedDriveRootFilePath(pathname, driveId, fileId) {
  return `${getSharingsRootRoute(
    pathname
  )}/shareddrive/${driveId}/file/${fileId}`
}

export function getLegacySharingsRoute(pathname) {
  const legacyPath = pathname
    .slice(SHARINGS_VIEW_ROUTE.length)
    .replace(/^\/+/, '')

  if (legacyPath === '') {
    return DEFAULT_SHARINGS_VIEW_ROUTE
  }

  const [firstSegment] = legacyPath.split('/')
  if (SHARINGS_TABS.has(firstSegment)) {
    return getSharingsTabRoute(firstSegment)
  }
  if (LEGACY_ROOT_SEGMENTS.has(firstSegment)) {
    return `${DEFAULT_SHARINGS_VIEW_ROUTE}/${legacyPath}`
  }

  return `${DEFAULT_SHARINGS_VIEW_ROUTE}/folder/${legacyPath}`
}
