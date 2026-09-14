import { Q, fetchPolicies } from 'cozy-client'

import { filePickerItemTypes } from './constants'

import { DEFAULT_SORT } from '@/config/sort'

const FILES_DOCTYPE = 'io.cozy.files'

const defaultFetchPolicy = fetchPolicies.olderThan(30 * 1000)
const TRASH_DIR_ID = `${FILES_DOCTYPE}.trash-dir`
const SHARED_DRIVES_DIR_ID = `${FILES_DOCTYPE}.shared-drives-dir`

const getQueryAlias = (as, sortOrder) =>
  sortOrder.attribute === DEFAULT_SORT.attribute &&
  sortOrder.order === DEFAULT_SORT.order
    ? as
    : `${as}-${sortOrder.attribute}-${sortOrder.order}`

const buildFolderQuery = (
  dirId,
  type,
  as,
  limit,
  sortOrder = DEFAULT_SORT
) => ({
  definition: () =>
    Q(FILES_DOCTYPE)
      .where({
        dir_id: dirId,
        type,
        [sortOrder.attribute]: { $gt: null }
      })
      .partialIndex({
        _id: {
          $nin: [SHARED_DRIVES_DIR_ID, TRASH_DIR_ID]
        }
      })
      .indexFields(['dir_id', 'type', sortOrder.attribute])
      .sortBy([
        { dir_id: sortOrder.order },
        { type: sortOrder.order },
        { [sortOrder.attribute]: sortOrder.order }
      ])
      .limitBy(limit),
  options: {
    as: getQueryAlias(as, sortOrder),
    fetchPolicy: defaultFetchPolicy
  }
})

export const buildCurrentFolderQuery = (folderId, driveId = null) => ({
  definition: () => {
    const query = Q(FILES_DOCTYPE).getById(folderId)
    return driveId ? query.sharingById(driveId) : query
  },
  options: {
    as: driveId
      ? `${FILES_DOCTYPE}/${driveId}/${folderId}`
      : `${FILES_DOCTYPE}/${folderId}`,
    fetchPolicy: defaultFetchPolicy,
    singleDocData: true,
    enabled: Boolean(folderId)
  }
})

export const buildContentFolderQuery = (dirId, sortOrder = DEFAULT_SORT) =>
  buildFolderQuery(
    dirId,
    { $gt: null },
    `buildContentFolderQuery-${dirId}`,
    100,
    sortOrder
  )

export const buildDisplayedContentFolderQuery = (
  dirId,
  displayedTypes,
  sortOrder = DEFAULT_SORT
) => {
  if (displayedTypes.length !== 1) {
    return buildContentFolderQuery(dirId, sortOrder)
  }

  const itemType = displayedTypes[0]
  const documentType =
    itemType === filePickerItemTypes.FOLDER ? 'directory' : 'file'

  return buildFolderQuery(
    dirId,
    documentType,
    `filePicker-${itemType}s-${dirId}`,
    100,
    sortOrder
  )
}
