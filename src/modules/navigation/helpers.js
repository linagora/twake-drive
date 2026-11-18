import escapeRegExp from 'lodash/escapeRegExp'

/**
 * Returns true if `to` and `pathname` match
 * Supports `rx` for regex matches.
 */
export const navLinkMatch = (rx, to, pathname) => {
  return rx ? rx.test(pathname) : pathname.slice(1) === to
}

/**
 * Returns the id of the folder when it is inside the downloads folder,
 * whatever its depth.
 */
export const findDownloadsSubfolderId = (downloadsFolder, folder) => {
  if (!downloadsFolder || !folder?.path) return null

  const isInDownloads = folder.path.startsWith(`${downloadsFolder.path}/`)

  return isInDownloads ? folder._id : null
}

const makeFolderIdsPattern = folderIds =>
  folderIds.map(folderId => escapeRegExp(folderId)).join('|')

/**
 * Matches the paths of the drive, except the ones of the folders that have
 * their own navigation item.
 */
export const makeDriveNavRegExp = excludedFolderIds => {
  if (excludedFolderIds.length === 0) return /\/(folder|nextcloud)(\/.*)?/

  const excludedIdsPattern = makeFolderIdsPattern(excludedFolderIds)

  return new RegExp(
    `/(folder(?!/(${excludedIdsPattern})(/|$))|nextcloud)(/.*)?`
  )
}

export const makeFoldersNavRegExp = folderIds =>
  new RegExp(`/folder/(${makeFolderIdsPattern(folderIds)})(/|$)`)
