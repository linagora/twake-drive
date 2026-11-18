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

/**
 * Matches the paths of the drive, except the ones of the folders that have
 * their own navigation item.
 */
export const makeDriveNavRegExp = excludedFolderIds =>
  excludedFolderIds.length > 0
    ? new RegExp(
        `/(folder(?!/(${excludedFolderIds.join('|')}))|nextcloud)(/.*)?`
      )
    : /\/(folder|nextcloud)(\/.*)?/

export const makeFoldersNavRegExp = folderIds =>
  new RegExp(`/folder/(${folderIds.join('|')})(/.*)?`)
