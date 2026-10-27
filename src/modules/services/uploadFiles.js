import { uploadFileWithConflictStrategy } from 'cozy-client/dist/models/file'

import { getFolderIdFromSharing } from '@/modules/shareddrives/helpers'
import { buildSharedDriveIdQuery } from '@/queries'

export function isFilesUpload(data) {
  return !!data && typeof data === 'object' && 'files' in data
}

function getFilesConfig(data) {
  const { driveId, files } = data
  if (typeof driveId !== 'string' || !driveId) {
    throw new Error('driveId is required')
  }
  if (!isFileList(files)) {
    throw new Error('files must be a non-empty list of files')
  }
  return { driveId, files }
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
// ends in error.
export async function uploadFilesToDrive(client, data, signal) {
  const { driveId, files } = getFilesConfig(data)
  signal.throwIfAborted()
  const dirId = await getRootId(client, driveId)
  const documents = []
  let failure
  for (const file of files) {
    signal.throwIfAborted()
    try {
      const { data: document } = await uploadFileWithConflictStrategy(
        client,
        file,
        { name: file.name, dirId, driveId, conflictStrategy: 'rename' }
      )
      documents.push(document)
    } catch (error) {
      failure ??= error
    }
  }
  if (failure) throw failure
  return documents
}
