import { uploadFileWithConflictStrategy } from 'cozy-client/dist/models/file'

import { getLocalDirId } from '@/modules/services/uploadFromUrl'
import { getFolderIdFromSharing } from '@/modules/shareddrives/helpers'
import { buildSharedDriveIdQuery } from '@/queries'

export function isFilesUpload(data) {
  return !!data && typeof data === 'object' && 'files' in data
}

function isId(value) {
  return typeof value === 'string' && value.length > 0
}

function getFilesConfig(data) {
  const { driveId, folderId, files } = data
  if (isId(driveId) === isId(folderId)) {
    throw new Error('Exactly one of driveId and folderId is required')
  }
  if (!isFileList(files)) {
    throw new Error('files must be a non-empty list of files')
  }
  return { driveId, folderId, files }
}

function isFileList(files) {
  return (
    Array.isArray(files) &&
    files.length > 0 &&
    files.every(file => file instanceof File)
  )
}

async function getRootId(client, driveId) {
  const query = buildSharedDriveIdQuery({ driveId })
  const { data: sharing } = await client.fetchQueryAndGetFromState({
    definition: query.definition(),
    options: query.options
  })
  const dirId = sharing && getFolderIdFromSharing(sharing)
  if (!dirId) throw new Error('The destination is not a shared drive')
  return dirId
}

// One file at a time: two same-name files uploading together both find the
// name free, and one of them fails. The intent has no dialog, so a taken name
// keeps both files. A failed file does not stop the others; the intent still
// ends in error, carrying one result per file so the caller retries only the
// failed ones. The error crosses postMessage, so each result stays plain data.
export async function uploadFilesToDrive(client, data, signal) {
  const { driveId, folderId, files } = getFilesConfig(data)
  signal.throwIfAborted()
  const dirId = driveId
    ? await getRootId(client, driveId)
    : await getLocalDirId(client, folderId)
  const results = []
  let failure
  for (const file of files) {
    signal.throwIfAborted()
    try {
      const { data: document } = await uploadFileWithConflictStrategy(
        client,
        file,
        { name: file.name, dirId, driveId, conflictStrategy: 'rename' }
      )
      results.push({ document })
    } catch (error) {
      failure ??= error
      results.push({
        error: { message: error.message, status: error.status }
      })
    }
  }
  if (failure) throw Object.assign(failure, { results })
  return results.map(({ document }) => document)
}
