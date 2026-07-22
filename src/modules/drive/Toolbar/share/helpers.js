import { joinPath } from '@/lib/path'
import { makeSharingsTabLocation } from '@/modules/navigation/sharingsTabNavigation'

/**
 * Get the path to share the displayed folder
 * @param {string} pathname Current path
 * @returns Next path
 */
export function getPathToShareDisplayedFolder(pathname) {
  return joinPath(pathname, 'share')
}

export function makeDisplayedFolderShareLocation({ location }) {
  return makeSharingsTabLocation({
    currentLocation: location,
    targetPathname: getPathToShareDisplayedFolder(location.pathname)
  })
}
