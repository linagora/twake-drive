import { fetchPolicies, models } from 'cozy-client'

import { buildCurrentFolderQuery } from '@/components/FilePicker/queries'

export async function fetchPickerDocument(client, fileId, driveId = null) {
  const query = buildCurrentFolderQuery(fileId, driveId)
  const { data } = await client.fetchQueryAndGetFromState({
    definition: query.definition(),
    options: { ...query.options, fetchPolicy: fetchPolicies.olderThan(0) }
  })
  return data ?? null
}

function isLocalPickerDocument(item) {
  if (!item) return false
  if (item.driveId || item.trashed) return false
  return !item._type || item._type === 'io.cozy.files'
}

function hasAbsoluteDirectoryPath(folder) {
  if (!folder || !models.file.isDirectory(folder)) return false
  return typeof folder.path === 'string' && folder.path.startsWith('/')
}

export async function isWithinPickerRoot(client, item, rootId) {
  const visited = new Set()
  let current = item
  while (isLocalPickerDocument(current)) {
    const id = current._id ?? current.id
    if (id === rootId) return true
    if (!current.dir_id || visited.has(id)) return false
    visited.add(id)
    current = await fetchPickerDocument(client, current.dir_id)
    if (!current || !models.file.isDirectory(current)) return false
  }
  return false
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
