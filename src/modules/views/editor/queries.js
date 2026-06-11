import {
  buildFileOrFolderByIdQuery,
  buildFileWhereByIdQuery,
  buildSharedDriveFileOrFolderByIdQuery
} from '@/queries'

/**
 * Builds the query that loads the file opened in an editor.
 *
 * - Public: the by-id query (the where-query returns 403 over a sharecode).
 * - Shared drive: the drive-scoped query.
 * - Otherwise: the where-query, so the toolbar gets file.path.
 *
 * @param {string} fileId
 * @param {string} [driveId]
 * @param {boolean} [isPublic]
 */
export const makeEditorFileQuery = (fileId, driveId, isPublic) => {
  if (isPublic) {
    return buildFileOrFolderByIdQuery(fileId)
  }
  if (driveId) {
    return buildSharedDriveFileOrFolderByIdQuery({ fileId, driveId })
  }
  return buildFileWhereByIdQuery(fileId)
}
