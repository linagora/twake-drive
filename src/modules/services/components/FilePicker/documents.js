import { fetchPolicies, models } from 'cozy-client'

import { buildCurrentFolderQuery } from '@/components/FilePicker/queries'
import { TRASH_DIR_ID } from '@/constants/config'
import { isInTrashDir } from '@/modules/trash/helpers'

export async function fetchPickerDocument(client, fileId, driveId = null) {
  const query = buildCurrentFolderQuery(fileId, driveId)
  const { data } = await client.fetchQueryAndGetFromState({
    definition: query.definition(),
    options: { ...query.options, fetchPolicy: fetchPolicies.olderThan(0) }
  })
  return data ?? null
}

export function isTrashedDocument(item) {
  if (!item) return false
  const id = item._id ?? item.id
  if (id === TRASH_DIR_ID) return true
  if (item.dir_id === TRASH_DIR_ID) return true
  if (item.trashed === true) return true
  if (typeof item.path === 'string' && isInTrashDir(item.path)) {
    return true
  }
  return false
}

function isLocalPickerDocument(item) {
  if (!item) return false
  if (item.driveId || isTrashedDocument(item)) return false
  return !item._type || item._type === 'io.cozy.files'
}

function hasAbsoluteDirectoryPath(folder) {
  if (!folder || !models.file.isDirectory(folder)) return false
  return typeof folder.path === 'string' && folder.path.startsWith('/')
}

export async function isWithinPickerRoot(client, item, rootId) {
  if (!isLocalPickerDocument(item)) return false
  if (!models.file.isDirectory(item) && !item.dir_id) return false

  // The restricted root can move or be renamed while the picker is open.
  const root = await fetchPickerDocument(client, rootId)
  if (!isLocalPickerDocument(root) || !hasAbsoluteDirectoryPath(root)) {
    return false
  }

  const folder = models.file.isDirectory(item)
    ? item
    : item.dir_id === rootId
      ? root
      : await fetchPickerDocument(client, item.dir_id)
  if (!isLocalPickerDocument(folder) || !hasAbsoluteDirectoryPath(folder)) {
    return false
  }

  const rootPrefix = root.path.endsWith('/') ? root.path : `${root.path}/`
  return folder.path === root.path || folder.path.startsWith(rootPrefix)
}

export async function fetchPickerDocumentWithPath(client, item) {
  if (models.file.isDirectory(item)) {
    if (!hasAbsoluteDirectoryPath(item)) {
      throw new Error('Missing folder path')
    }
    return { ...item }
  }
  const parent = await fetchPickerDocument(client, item.dir_id, item.driveId)
  if (!hasAbsoluteDirectoryPath(parent)) {
    throw new Error('Missing parent folder path')
  }
  // File paths are computed response data, never a field to save in CouchDB.
  return { ...item, path: `${parent.path.replace(/\/+$/, '')}/${item.name}` }
}
