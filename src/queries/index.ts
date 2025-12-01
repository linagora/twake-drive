import CozyClient, { Q, QueryDefinition } from 'cozy-client'
import { QueryOptions } from 'cozy-client/types/types'
import flag from 'cozy-flags'

import {
  SHARED_DRIVES_DIR_ID,
  TRASH_DIR_ID,
  SETTINGS_DIR_PATH
} from '@/constants/config'
import {
  DOCTYPE_FILES_ENCRYPTION,
  DOCTYPE_ALBUMS,
  DOCTYPE_FILES_SETTINGS
} from '@/lib/doctypes'
import { formatFolderQueryId } from '@/lib/queries'

export interface QueryConfig {
  definition: () => QueryDefinition
  options: QueryOptions
}

type QueryBuilder<T = void> = (params: T) => QueryConfig

interface buildDriveQueryParams {
  currentFolderId: string
  type: string
  sortAttribute: string
  sortOrder: string
}

// Needs to be less than 10 minutes, since "thumbnails" links
// are only valid for 10 minutes.
// cf https://github.com/cozy/cozy-doctypes/blob/master/docs/io.cozy.files.md#files
const DEFAULT_CACHE_TIMEOUT_QUERIES = 9 * 60 * 1000
const defaultFetchPolicy = CozyClient.fetchPolicies.olderThan(
  DEFAULT_CACHE_TIMEOUT_QUERIES
)

export const buildDriveQuery: QueryBuilder<buildDriveQueryParams> = ({
  currentFolderId,
  type,
  sortAttribute,
  sortOrder
}) => ({
  definition: (): QueryDefinition => {
    const shouldHideSettingsFolder = flag(
      'home.wallpaper-personalization.enabled'
    )
    const partialIndexFilters: {
      _id: { $nin: string[] }
      path?: Record<string, unknown>
    } = {
      // This is to avoid fetching shared drives
      // They are hidden clientside
      _id: {
        $nin: [TRASH_DIR_ID, 'io.cozy.files.shared-drives-dir']
      }
    }

    if (shouldHideSettingsFolder) {
      partialIndexFilters.path = {
        $or: [{ $exists: false }, { $nin: [SETTINGS_DIR_PATH] }]
      }
    }

    return Q('io.cozy.files')
      .where({
        dir_id: currentFolderId,
        type,
        [sortAttribute]: { $gt: null }
      })
      .partialIndex(partialIndexFilters)
      .indexFields(['dir_id', 'type', sortAttribute])
      .sortBy([
        { dir_id: sortOrder },
        { type: sortOrder },
        { [sortAttribute]: sortOrder }
      ])
      .include(['encryption'])
      .limitBy(100)
  },
  options: {
    as: formatFolderQueryId(type, currentFolderId, sortAttribute, sortOrder),
    fetchPolicy: defaultFetchPolicy
  }
})

export const buildRecentQuery: QueryBuilder = () => ({
  definition: () =>
    Q('io.cozy.files')
      .where({
        updated_at: {
          $gt: null
        }
      })
      .partialIndex({
        type: 'file',
        trashed: false,
        dir_id: { $nin: [SHARED_DRIVES_DIR_ID, TRASH_DIR_ID] }
      })
      .indexFields(['updated_at'])
      .sortBy([{ updated_at: 'desc' }])
      .limitBy(50),
  options: {
    as: 'recent-view-query',
    fetchPolicy: defaultFetchPolicy
  }
})

interface buildRecentWithMetadataAttributeQueryParams {
  attribute: string
}

// TODO: since this query is almost the same as buildRecentQuery
// we can probably refactor a bit
// see https://github.com/cozy/cozy-drive/pull/2193#pullrequestreview-553766674
/**
 * Returns one file with specific metadata for Recent view
 * Only one file is necessary because it allows us to know whether or not to display
 * the column for this specific metadata (like carbonCopy or electronicSafe).
 * @param {object} params - Params
 * @param {string} params.attribute - Metadata attribute
 */
export const buildRecentWithMetadataAttributeQuery: QueryBuilder<
  buildRecentWithMetadataAttributeQueryParams
> = ({ attribute }) => ({
  definition: () =>
    Q('io.cozy.files')
      .where({
        type: 'file',
        trashed: false,
        [`metadata.${attribute}`]: true,
        updated_at: {
          $gt: null
        }
      })
      .indexFields([`metadata.${attribute}`, 'type', 'trashed', 'updated_at'])
      .limitBy(1),
  options: {
    as: `recent-view-query-with-${attribute}`,
    fetchPolicy: defaultFetchPolicy
  }
})

export const buildParentsByIdsQuery: QueryBuilder<string[]> = ids => ({
  definition: () => Q('io.cozy.files').getByIds(ids),
  options: {
    as: `parents-by-ids-${ids.join('')}`,
    fetchPolicy: defaultFetchPolicy
  }
})

interface buildSharingsQueryParams {
  ids: string[]
  enabled?: boolean
}

export const buildSharingsQuery: QueryBuilder<buildSharingsQueryParams> = ({
  ids,
  enabled = true
}) => ({
  definition: () =>
    Q('io.cozy.files')
      .getByIds(ids)
      .sortBy([{ type: 'asc' }, { name: 'asc' }]),
  options: {
    as: `sharings-by-ids-${ids.join('')}`,
    enabled,
    fetchPolicy: defaultFetchPolicy
  }
})

interface buildSharingsWithMetadataAttributeQueryParams {
  sharedDocumentIds: string[]
  attribute: string
}

// TODO: since this query is almost the same as buildSharingsQuery
// we can probably refactor a bit
// see https://github.com/cozy/cozy-drive/pull/2193#pullrequestreview-553766674
/**
 * Returns one file with specific metadata for Sharing view.
 * Only one file is necessary because it allows us to know whether or not to display
 * the column for this specific metadata (like carbonCopy or electronicSafe).
 * @param {object} params - Params
 * @param {array} params.sharedDocumentsIds - Ids of shared documents
 * @param {string} params.attribute - Metadata attribute
 */
export const buildSharingsWithMetadataAttributeQuery: QueryBuilder<
  buildSharingsWithMetadataAttributeQueryParams
> = ({ sharedDocumentIds, attribute }) => ({
  definition: () =>
    Q('io.cozy.files')
      .getByIds(sharedDocumentIds)
      .where({ [`metadata.${attribute}`]: true })
      .limitBy(1),
  options: {
    as: `sharings-by-ids-${sharedDocumentIds.join('')}-with-${attribute}`,
    fetchPolicy: defaultFetchPolicy
  }
})

interface buildTrashQueryParams {
  currentFolderId: string
  sortAttribute: string
  sortOrder: string
  type: string
  limit?: number
}

export const buildTrashQuery: QueryBuilder<buildTrashQueryParams> = ({
  currentFolderId,
  sortAttribute,
  sortOrder,
  type,
  limit
}) => ({
  definition: () =>
    Q('io.cozy.files')
      .where({
        dir_id: currentFolderId,
        type,
        [sortAttribute]: { $gt: null }
      })
      .indexFields(['dir_id', 'type', sortAttribute])
      .sortBy([
        { dir_id: sortOrder },
        { type: sortOrder },
        { [sortAttribute]: sortOrder }
      ])
      .limitBy(limit ? limit : 100),
  options: {
    as: `trash-${formatFolderQueryId(
      type,
      currentFolderId,
      sortAttribute,
      sortOrder
    )}`,
    fetchPolicy: CozyClient.fetchPolicies.olderThan(
      DEFAULT_CACHE_TIMEOUT_QUERIES
    )
  }
})

interface buildSharedDriveQueryParams {
  currentFolderId: string
  type: string
  sortAttribute: string
  sortOrder: string
  driveId: string
  fileId: string
}

export const buildSharedDriveQuery: QueryBuilder<
  buildSharedDriveQueryParams
> = ({ currentFolderId, type, sortAttribute, sortOrder, driveId }) => ({
  definition: () =>
    Q('io.cozy.files')
      .where({
        dir_id: currentFolderId,
        driveId,
        type,
        [sortAttribute]: { $gt: null }
      })
      .indexFields(['dir_id', 'type', 'driveId', sortAttribute])
      .sortBy([
        { dir_id: sortOrder },
        { driveId: sortOrder },
        { type: sortOrder },
        { [sortAttribute]: sortOrder }
      ])
      .include(['encryption'])
      .limitBy(100),
  options: {
    as: formatFolderQueryId(
      type,
      currentFolderId,
      sortAttribute,
      sortOrder,
      driveId
    ),
    fetchPolicy: defaultFetchPolicy
  }
})

export const buildMoveOrImportQuery: QueryBuilder<string> = dirId => ({
  definition: () =>
    Q('io.cozy.files')
      .where({
        dir_id: dirId,
        type: { $gt: null },
        name: { $gt: null }
      })
      .partialIndex({
        // This is to avoid fetching shared drives and trash
        // They are hidden clientside
        _id: {
          $nin: [SHARED_DRIVES_DIR_ID, TRASH_DIR_ID]
        }
      })
      .indexFields(['dir_id', 'type', 'name'])
      .sortBy([{ dir_id: 'asc' }, { type: 'asc' }, { name: 'asc' }])
      .limitBy(100),
  options: {
    as: `moveOrImport-${dirId}`,
    fetchPolicy: CozyClient.fetchPolicies.olderThan(
      DEFAULT_CACHE_TIMEOUT_QUERIES
    )
  }
})

interface buildFileWithSpecificMetadataAttributeQueryParams {
  currentFolderId: string
  attribute: string
}

// TODO: since this query is almost the same as buildDriveQuery
// we can probably refactor a bit
// see https://github.com/cozy/cozy-drive/pull/2193#pullrequestreview-553766674
/**
 * Returns one file with specific metadata.
 * Only one file is necessary because it allows us to know whether or not to display
 * the column for this specific metadata (like carbonCopy or electronicSafe).
 * @param {string} currentFolderId - Id of the current folder
 * @param {string} attribute - Metadata
 */
export const buildFileWithSpecificMetadataAttributeQuery: QueryBuilder<
  buildFileWithSpecificMetadataAttributeQueryParams
> = ({ currentFolderId, attribute }) => ({
  definition: () =>
    Q('io.cozy.files')
      .where({
        dir_id: currentFolderId,
        [`metadata.${attribute}`]: true,
        type: 'file'
      })
      .indexFields(['dir_id', `metadata.${attribute}`, 'type'])
      .limitBy(1),
  options: {
    as: `specific-metadata-${attribute}-for-${currentFolderId}`,
    fetchPolicy: defaultFetchPolicy
  }
})

export const buildFileOrFolderByIdQuery: QueryBuilder<string> = fileId => ({
  definition: () => Q('io.cozy.files').getById(fileId),
  options: {
    as: `io.cozy.files/${fileId}`,
    fetchPolicy: defaultFetchPolicy,
    singleDocData: true,
    enabled: !!fileId
  }
})

interface BuildSharedDriveFileOrFolderByIdQuery {
  fileId: string
  driveId: string
}

export const buildSharedDriveFileOrFolderByIdQuery: QueryBuilder<
  BuildSharedDriveFileOrFolderByIdQuery
> = ({ fileId, driveId }) => ({
  definition: () => Q('io.cozy.files').getById(fileId).sharingById(driveId),
  options: {
    as: `io.cozy.files/${driveId}/${fileId}`,
    fetchPolicy: defaultFetchPolicy,
    singleDocData: true,
    enabled: !!fileId && !!driveId
  }
})

// this query should use `getById` instead of `where` as `buildFileOrFolderByIdQuery` does.
// But in this case, due to a stack limitation, the `file.path` is not returned.
// As we need the `file.path` we do this trick until the stack is updated
export const buildFileWhereByIdQuery: QueryBuilder<string> = fileId => ({
  definition: () =>
    Q('io.cozy.files').where({ _id: fileId }).indexFields(['_id']).limitBy(1),
  options: {
    as: `io.cozy.files/whereById/${fileId}`,
    fetchPolicy: defaultFetchPolicy,
    enabled: !!fileId
  }
})

export const buildAppsQuery: QueryBuilder = () => ({
  definition: () => Q('io.cozy.apps'),
  options: {
    as: `io.cozy.apps`,
    fetchPolicy: defaultFetchPolicy
  }
})

export const buildSettingsByIdQuery: QueryBuilder<string> = id => ({
  definition: () => Q('io.cozy.settings').getById(id),
  options: {
    as: `io.cozy.settings/${id}`,
    fetchPolicy: defaultFetchPolicy,
    singleDocData: true
  }
})

export const buildEncryptionByIdQuery: QueryBuilder<string> = id => ({
  definition: () => Q(DOCTYPE_FILES_ENCRYPTION).getById(id),
  options: {
    as: id,
    fetchPolicy: defaultFetchPolicy
  }
})

export const buildAlbumByIdQuery: QueryBuilder<string> = id => ({
  definition: () => Q(DOCTYPE_ALBUMS).getById(id),
  options: {
    as: `io.cozy.photos.albums/${id}`,
    fetchPolicy: defaultFetchPolicy,
    singleDocData: true
  }
})

export const buildFolderByPathQuery: QueryBuilder<string> = path => ({
  definition: () =>
    Q('io.cozy.files')
      .where({
        type: 'directory',
        path
      })
      .indexFields(['type', ' path']),
  options: {
    as: `io.cozy.files/path${path}`,
    fetchPolicy: defaultFetchPolicy
  }
})

export const buildNewSharingShortcutQuery: QueryBuilder = () => ({
  definition: () =>
    Q('io.cozy.files')
      .where({
        'metadata.sharing.status': 'new',
        class: 'shortcut',
        trashed: false
      })
      .indexFields(['metadata.sharing.status', 'class', 'trashed']),
  options: {
    as: 'io.cozy.files/metadata.sharing.status/new/class/shortcut',
    fetchPolicy: defaultFetchPolicy
  }
})

export const buildTriggersQueryByAccountId: QueryBuilder<
  string
> = accountId => ({
  definition: () =>
    Q('io.cozy.triggers')
      .where({
        'message.account': accountId
      })
      .indexFields(['message.account']),
  options: {
    as: `${'io.cozy.triggers'}/accounts/${accountId}`,
    enabled: Boolean(accountId),
    fetchPolicy: defaultFetchPolicy
  }
})

interface buildKonnectorsQueryByIdParams {
  id: string
  enabled?: boolean
}

export const buildKonnectorsQueryById: QueryBuilder<
  buildKonnectorsQueryByIdParams
> = ({ id, enabled = true }) => ({
  definition: () => Q('io.cozy.konnectors').getById(id),
  options: {
    as: `io.cozy.konnectors/${id}`,
    fetchPolicy: defaultFetchPolicy,
    enabled
  }
})

export const buildTriggersQueryByKonnectorSlug: QueryBuilder<
  string
> = slug => ({
  definition: () =>
    Q('io.cozy.triggers')
      .where({
        'message.konnector': slug
      })
      .indexFields(['message.konnector']),
  options: {
    as: `io.cozy.triggers/slug/${slug}`,
    fetchPolicy: defaultFetchPolicy,
    enabled: Boolean(slug)
  }
})

interface buildNextcloudFolderQueryParams {
  sourceAccount?: string
  path: string
}

export const buildNextcloudFolderQuery: QueryBuilder<
  buildNextcloudFolderQueryParams
> = ({ sourceAccount, path }) => ({
  definition: () =>
    Q('io.cozy.remote.nextcloud.files')
      .where({
        'cozyMetadata.sourceAccount': sourceAccount,
        parentPath: path
      })
      .indexFields(['cozyMetadata.sourceAccount', 'parentPath']),
  options: {
    as: `io.cozy.remote.nextcloud.files/sourceAccount/${
      sourceAccount ?? 'unknown'
    }/path${path}`,
    fetchPolicy: defaultFetchPolicy,
    enabled: !!sourceAccount && !!path
  }
})

interface buildNextcloudShortcutQueryParams {
  sourceAccount: string
}

export const buildNextcloudShortcutQuery: QueryBuilder<
  buildNextcloudShortcutQueryParams
> = ({ sourceAccount }) => ({
  definition: () =>
    Q('io.cozy.files')
      .where({
        'cozyMetadata.sourceAccount': sourceAccount
      })
      .partialIndex({
        'cozyMetadata.createdByApp': 'nextcloud'
      })
      .indexFields(['cozyMetadata.sourceAccount'])
      .limitBy(1),
  options: {
    as: `io.cozy.files/createdByApp/nextcloud/sourceAccount/${sourceAccount}`,
    fetchPolicy: defaultFetchPolicy,
    enabled: !!sourceAccount,
    singleDocData: true
  }
})

interface buildFavoritesQueryParams {
  sortAttribute: string
  sortOrder: string
}

export const buildFavoritesQuery: QueryBuilder<buildFavoritesQueryParams> = ({
  sortAttribute,
  sortOrder
}) => ({
  definition: () =>
    Q('io.cozy.files')
      .where({
        [sortAttribute]: { $gt: null }
      })
      .partialIndex({
        'cozyMetadata.favorite': true,
        path: { $or: [{ $exists: false }, { $regex: '^(?!/.cozy_trash)' }] },
        trashed: { $or: [{ $exists: false }, { $eq: false }] }
      })
      .indexFields([sortAttribute])
      .sortBy([{ [sortAttribute]: sortOrder }]),
  options: {
    as: 'io.cozy.files/metadata.favorite/true',
    fetchPolicy: defaultFetchPolicy
  }
})

export const buildExternalDrivesQuery: QueryBuilder<
  buildFavoritesQueryParams
> = ({ sortAttribute, sortOrder }) => ({
  definition: () =>
    Q('io.cozy.files')
      .where({
        [sortAttribute]: { $gt: null }
      })
      .partialIndex({
        'cozyMetadata.createdByApp': 'nextcloud'
      })
      .indexFields([sortAttribute])
      .sortBy([{ [sortAttribute]: sortOrder }]),
  options: {
    as: 'io.cozy.files/metadata.createdByApp/nextcloud',
    fetchPolicy: defaultFetchPolicy
  }
})

interface buildMagicFolderQueryParams {
  id: string
  enabled?: boolean
}

export const buildMagicFolderQuery: QueryBuilder<
  buildMagicFolderQueryParams
> = ({ id, enabled = false }) => ({
  definition: () => Q('io.cozy.files').getById(id),
  options: {
    as: 'io.cozy.files/' + id,
    fetchPolicy: defaultFetchPolicy,
    singleDocData: false,
    enabled
  }
})

interface buildNextcloudTrashFolderQueryParams {
  sourceAccount?: string
  path: string
}

export const buildNextcloudTrashFolderQuery: QueryBuilder<
  buildNextcloudTrashFolderQueryParams
> = ({ sourceAccount, path }) => ({
  definition: () =>
    Q('io.cozy.remote.nextcloud.files')
      .where({
        'cozyMetadata.sourceAccount': sourceAccount,
        parentPath: path,
        trashed: true
      })
      .indexFields(['cozyMetadata.sourceAccount', 'parentPath', 'trashed']),
  options: {
    as: `io.cozy.remote.nextcloud.files/sourceAccount/${
      sourceAccount ?? 'unknown'
    }/path${path}/trashed`,
    fetchPolicy: defaultFetchPolicy,
    enabled: !!sourceAccount && !!path
  }
})

export const getAppSettingQuery: QueryConfig = {
  definition: () => Q(DOCTYPE_FILES_SETTINGS),
  options: {
    as: DOCTYPE_FILES_SETTINGS
  }
}

interface buildSharedDriveFolderQueryParams {
  driveId: string
  folderId: string
}

interface buildSharedDriveIdQueryParams {
  driveId: string
}

export const buildSharedDriveFolderQuery: QueryBuilder<
  buildSharedDriveFolderQueryParams
> = ({ driveId, folderId }) => ({
  definition: () => Q('io.cozy.files').getById(folderId).sharingById(driveId),
  options: {
    as: `io.cozy.files/driveId/${driveId}/folderId/${folderId}`,
    // fetchPolicy: defaultFetchPolicy, // FIXME we do not use cache here to get the "included" part of the result of the query
    // see https://github.com/cozy/cozy-client/issues/1620
    enabled: !!driveId && !!folderId
  }
})

export const buildSharedDriveIdQuery: QueryBuilder<
  buildSharedDriveIdQueryParams
> = ({ driveId }) => ({
  definition: () => Q('io.cozy.sharings').getById(driveId),
  options: {
    as: `io.cozy.sharings/driveId/${driveId}`,
    fetchPolicy: defaultFetchPolicy,
    singleDocData: true,
    enabled: !!driveId
  }
})
