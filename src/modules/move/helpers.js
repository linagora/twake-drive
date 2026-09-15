import { models } from 'cozy-client'

import { NEXTCLOUD_FILE_ID, ROOT_DIR_ID } from '@/constants/config'
import logger from '@/lib/logger'
import { getParentPath, joinPath } from '@/lib/path'
import { CozyFile } from '@/models'
import { isNextcloudFile } from '@/modules/nextcloud/helpers'

export function getItemId(item) {
  return item?._id ?? item?.id ?? null
}

function isSameOrDescendantPath(candidatePath, ancestorPath) {
  if (typeof candidatePath !== 'string' || typeof ancestorPath !== 'string') {
    return false
  }
  return (
    candidatePath === ancestorPath ||
    (ancestorPath !== '/' &&
      candidatePath.startsWith(joinPath(ancestorPath, '')))
  )
}

function isDirectoryItem(item) {
  return Boolean(item) && models.file.isDirectory(item)
}

function isCozyItem(item) {
  return (
    Boolean(item) &&
    !isNextcloudFile(item) &&
    item.cozyMetadata?.createdByApp !== 'nextcloud'
  )
}

function isLocalItem(item) {
  return isCozyItem(item) && !item.driveId
}

export function isLocalMoveDestination(item) {
  return isDirectoryItem(item) && isLocalItem(item)
}

export function isMoveDestinationFolder(item) {
  return (
    isDirectoryItem(item) &&
    isCozyItem(item) &&
    item.orgDrive !== true &&
    item.driveOwner !== true
  )
}

function isSameDrive(firstItem, secondItem) {
  return (firstItem?.driveId ?? null) === (secondItem?.driveId ?? null)
}

function isDescendantOfEntry(item, entry) {
  if (!isSameDrive(item, entry)) return false

  const itemId = getItemId(item)
  const entryId = getItemId(entry)
  if (itemId && entryId && itemId === entryId) return true
  if (!isCozyItem(item) || !isCozyItem(entry)) return false

  if (item.dir_id && entryId && item.dir_id === entryId) return true

  if (item.path && entry.path) {
    return isSameOrDescendantPath(item.path, entry.path)
  }

  return false
}

export function getMoveDestinationDisabledReason(
  item,
  entries,
  hasWriteAccess,
  allLoaded = true
) {
  if (!isMoveDestinationFolder(item)) return null

  const directoryEntries = entries.filter(isDirectoryItem)
  const sourceEntry = directoryEntries.find(entry =>
    isDescendantOfEntry(item, entry)
  )
  if (sourceEntry) {
    return getItemId(item) === getItemId(sourceEntry)
      ? 'Move.destinationSource'
      : 'Move.destinationDescendant'
  }

  if (allLoaded !== true) return 'Move.permissionsLoading'

  if (typeof hasWriteAccess === 'function') {
    const itemId = getItemId(item)
    if (itemId && !hasWriteAccess(itemId, item.driveId)) {
      return 'Move.destinationReadOnly'
    }
  }

  return null
}

export function isMoveDestination(
  item,
  entries,
  hasWriteAccess,
  allLoaded = true
) {
  return (
    isMoveDestinationFolder(item) &&
    !getMoveDestinationDisabledReason(item, entries, hasWriteAccess, allLoaded)
  )
}

function getEntryParentId(entry) {
  return (
    entry.dir_id ??
    (typeof entry.path === 'string' ? getParentPath(entry.path) : null)
  )
}

function isEntryInFolder(entry, folder) {
  if (!isSameDrive(entry, folder)) return false

  const folderId = getItemId(folder)
  if (entry.dir_id && folderId && entry.dir_id === folderId) return true
  if (!isCozyItem(entry) || !isCozyItem(folder)) return false
  return Boolean(
    entry.path && folder?.path && getParentPath(entry.path) === folder.path
  )
}

export function areAllEntriesInFolder(entries, folder) {
  return (
    entries.length > 0 && entries.every(entry => isEntryInFolder(entry, folder))
  )
}

export function hasUnknownEntryLocation(entries) {
  return entries.some(entry => !entry.dir_id && !entry.path)
}

export function isDestinationAllowed(
  destination,
  entries,
  hasWriteAccess,
  allLoaded,
  initialFolderId
) {
  if (!isMoveDestination(destination, entries, hasWriteAccess, allLoaded)) {
    return false
  }
  const isInitialFolder = getItemId(destination) === initialFolderId
  return !(
    isInitialFolder &&
    (areAllEntriesInFolder(entries, destination) ||
      hasUnknownEntryLocation(entries))
  )
}

export function getInitialFolderId(currentFolder, entries) {
  const sourceFolderIds = new Set(entries.map(getEntryParentId).filter(Boolean))
  const isLocalFolder =
    currentFolder?._type === 'io.cozy.files' && !currentFolder.driveId

  if (!isLocalFolder || sourceFolderIds.size > 1) return ROOT_DIR_ID
  return currentFolder?._id ?? ROOT_DIR_ID
}

/**
 * Cancel file movement function
 * @param {object} client - The CozyClient instance
 * @param {import('cozy-client/types').IOCozyFile[]} entries - List of files moved
 * @param {import('cozy-client/types').IOCozyFile[]} trashedFiles - List of ids for files moved to the trash
 * @param {Function} registerCancelable - Function to register the promise
 * @param {Functione} refreshSharing - Function refresh sharing state
 */
export const cancelMove = async ({
  client,
  entries,
  trashedFiles,
  registerCancelable,
  showAlert,
  t,
  refreshSharing
}) => {
  try {
    await Promise.all(
      entries.map(entry =>
        registerCancelable(CozyFile.move(entry._id, { folderId: entry.dir_id }))
      )
    )
    const fileCollection = client.collection(CozyFile.doctype)
    let restoreErrorsCount = 0
    await Promise.all(
      trashedFiles.map(id => {
        try {
          registerCancelable(fileCollection.restore(id))
        } catch {
          restoreErrorsCount++
        }
      })
    )
    if (restoreErrorsCount) {
      showAlert({
        message: t('Move.cancelledWithRestoreErrors', {
          subject: entries.length === 1 ? entries[0].name : '',
          smart_count: entries.length,
          restoreErrorsCount
        }),
        severity: 'secondary'
      })
    } else {
      showAlert({
        message: t('Move.cancelled', {
          subject: entries.length === 1 ? entries[0].name : '',
          smart_count: entries.length
        }),
        severity: 'secondary'
      })
    }
  } catch (e) {
    logger.warn(e)
    showAlert({
      message: t('Move.cancelled_error', { smart_count: entries.length }),
      severity: 'error'
    })
  } finally {
    if (refreshSharing) refreshSharing()
  }
}

/**
 * Gets a name for the entry if there is only one, or a sentence with the number of elements if there are several
 * @param {import('cozy-client/types').IOCozyFile[]} entries - List of files moved
 * @param {Function} t - Translation function
 * @returns {string} - Name for entries
 */
export const getEntriesName = (entries, t) => {
  return entries.length !== 1
    ? t('Move.multipleEntries', {
        smart_count: entries.length
      })
    : entries[0].name
}

export function computeNextcloudMoveDirections(folder, sourceEntry) {
  const isMovingInsideNextcloud = folder?._type === NEXTCLOUD_FILE_ID
  const isMovingOutsideNextcloud =
    !isMovingInsideNextcloud && sourceEntry?._type === NEXTCLOUD_FILE_ID

  return { isMovingInsideNextcloud, isMovingOutsideNextcloud }
}

export function isSharedDriveMove(folder, sourceEntries, sourceDriveId) {
  return Boolean(
    sourceDriveId ||
    folder?.driveId ||
    sourceEntries.some(entry => entry.driveId)
  )
}

/**
 * @typedef {Object} SharedDoc
 * @property {string[]} permissions - List of permissions
 * @property {string[]} sharings - List of sharings
 */

/**
 * Returns whether one of the entries that is shared not only by link
 * @param {import('cozy-client/types').IOCozyFile[]} entries - List of files moved
 * @param {Object<string, SharedDoc>} byDocId - Object with shared files by id from cozy-sharing
 * @returns {boolean} - Whether one of the entries that is shared not only by link
 */
export const hasOneOfEntriesShared = (entries, byDocId) => {
  const sharedEntries = entries.filter(({ _id }) => {
    const doc = byDocId[_id]
    if (doc === undefined) return false

    const onlySharedByLink =
      doc.permissions.length > 0 && doc.sharings.length === 0

    if (onlySharedByLink) return false

    return true
  })
  return sharedEntries.length > 0
}
