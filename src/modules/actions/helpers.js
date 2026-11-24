import { joinPath } from '@/lib/path'
import { isSharedDriveDoc } from '@/modules/shareddrives/helpers'

// Views whose routes carry no driveId (Recents) list shared drive items next to
// local ones. Their modals then open under a `shareddrive/:driveId` segment, so
// that they read the item through its drive.
const shouldOpenInDrive = (file, withDriveIdInModalPath) =>
  withDriveIdInModalPath && isSharedDriveDoc(file)

export const navigateToModal = ({
  navigate,
  pathname,
  search = '',
  files,
  path,
  withDriveIdInModalPath = false
}) => {
  const file = Array.isArray(files) ? files[0] : files
  const drivePrefix = shouldOpenInDrive(file, withDriveIdInModalPath)
    ? `shareddrive/${file.driveId}/`
    : ''
  const targetPathname = pathname
    ? joinPath(pathname, `${drivePrefix}file/${file.id}/${path}`)
    : `v/${path}`
  const targetLocation = search
    ? { pathname: targetPathname, search }
    : targetPathname

  return navigate(targetLocation)
}

export const navigateToModalWithMultipleFile = ({
  navigate,
  pathname,
  files,
  path,
  search,
  withDriveIdInModalPath = false
}) => {
  const [firstFile] = files
  const drivePrefix = shouldOpenInDrive(firstFile, withDriveIdInModalPath)
    ? `shareddrive/${firstFile.driveId}/${firstFile.dir_id}/`
    : ''
  return navigate(
    {
      pathname: pathname
        ? joinPath(pathname, `${drivePrefix}${path}`)
        : `v/${path}`,
      search: search ? `?${search}` : ''
    },
    {
      state: { fileIds: files.map(file => file.id) }
    }
  )
}

/**
 * Returns the context menu visible actions
 *
 * @param {Object[]} actions - the list of actions
 * @returns {Object[]} - the list of actions to be displayed
 */
export const getContextMenuActions = (actions = []) =>
  actions.filter(
    action => Object.values(action)[0]?.displayInContextMenu !== false
  )

/**
 * Whether the user can write every item, each in its own drive.
 *
 * @param {Object[]} items - The items to check
 * @param {Function} [hasItemWriteAccess] - `hasWriteAccess(docId, driveId)` of the sharing context; without it, every item is writable
 * @returns {boolean}
 */
export const hasWriteAccessToItems = (items, hasItemWriteAccess) =>
  !hasItemWriteAccess ||
  items.every(item => hasItemWriteAccess(item._id, item.driveId))
