import { Q, fetchPolicies } from 'cozy-client'

const FILES_DOCTYPE = 'io.cozy.files'

const defaultFetchPolicy = fetchPolicies.olderThan(30 * 1000)
const TRASH_DIR_ID = `${FILES_DOCTYPE}.trash-dir`
const SHARED_DRIVES_DIR_ID = `${FILES_DOCTYPE}.shared-drives-dir`

export const buildCurrentFolderQuery = folderId => ({
  definition: () => Q(FILES_DOCTYPE).getById(folderId),
  options: {
    as: `onlyfolder-${folderId}`,
    fetchPolicy: defaultFetchPolicy
  }
})

export const buildContentFolderQuery = dirId => ({
  definition: () =>
    Q(FILES_DOCTYPE)
      .where({
        dir_id: dirId,
        type: { $gt: null },
        name: { $gt: null }
      })
      .partialIndex({
        _id: {
          $nin: [SHARED_DRIVES_DIR_ID, TRASH_DIR_ID]
        }
      })
      .indexFields(['dir_id', 'type', 'name'])
      .sortBy([{ dir_id: 'asc' }, { type: 'asc' }, { name: 'asc' }])
      .limitBy(20),
  options: {
    as: `buildContentFolderQuery-${dirId}`,
    fetchPolicy: defaultFetchPolicy
  }
})
