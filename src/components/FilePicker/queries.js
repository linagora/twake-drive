import { Q, fetchPolicies } from 'cozy-client'

import { filePickerItemTypes } from './constants'

const FILES_DOCTYPE = 'io.cozy.files'

const defaultFetchPolicy = fetchPolicies.olderThan(30 * 1000)
const TRASH_DIR_ID = `${FILES_DOCTYPE}.trash-dir`
const SHARED_DRIVES_DIR_ID = `${FILES_DOCTYPE}.shared-drives-dir`

const buildFolderQuery = (dirId, type, as, limit) => ({
  definition: () =>
    Q(FILES_DOCTYPE)
      .where({
        dir_id: dirId,
        type,
        name: { $gt: null }
      })
      .partialIndex({
        _id: {
          $nin: [SHARED_DRIVES_DIR_ID, TRASH_DIR_ID]
        }
      })
      .indexFields(['dir_id', 'type', 'name'])
      .sortBy([{ dir_id: 'asc' }, { type: 'asc' }, { name: 'asc' }])
      .limitBy(limit),
  options: {
    as,
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

export const buildContentFolderQuery = dirId =>
  buildFolderQuery(
    dirId,
    { $gt: null },
    `buildContentFolderQuery-${dirId}`,
    100
  )

export const buildDisplayedContentFolderQuery = (dirId, displayedTypes) => {
  if (displayedTypes.length !== 1) return buildContentFolderQuery(dirId)

  const itemType = displayedTypes[0]
  const documentType =
    itemType === filePickerItemTypes.FOLDER ? 'directory' : 'file'

  return buildFolderQuery(
    dirId,
    documentType,
    `filePicker-${itemType}s-${dirId}`,
    100
  )
}
