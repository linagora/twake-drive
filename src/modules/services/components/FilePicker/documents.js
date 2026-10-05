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

export async function isWithinPickerRoot(client, item, rootId) {
  const visited = new Set()
  let current = item
  while (
    current &&
    !current.driveId &&
    !current.trashed &&
    (!current._type || current._type === 'io.cozy.files')
  ) {
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
    if (typeof item.path !== 'string' || !item.path.startsWith('/')) {
      throw new Error('Missing folder path')
    }
    return { ...item }
  }
  const parent = await fetchPickerDocument(client, item.dir_id, item.driveId)
  if (
    !parent ||
    !models.file.isDirectory(parent) ||
    typeof parent.path !== 'string' ||
    !parent.path.startsWith('/')
  ) {
    throw new Error('Missing parent folder path')
  }
  // File paths are computed response data, never a field to save in CouchDB.
  return { ...item, path: `${parent.path.replace(/\/+$/, '')}/${item.name}` }
}
