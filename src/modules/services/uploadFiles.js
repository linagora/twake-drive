import { uploadFileWithConflictStrategy } from 'cozy-client/dist/models/file'

import { getFolderIdFromSharing } from '@/modules/shareddrives/helpers'
import { isConflictError } from '@/modules/upload/conflictResolution'
import { buildSharedDriveIdQuery } from '@/queries'

const PARALLEL_UPLOADS = 3

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

// The intent has no dialog, so a taken name keeps both files. Two files with
// the same name uploading at once can both find the name free, and the second
// to land gets a conflict: a retry sees the first and renames.
async function uploadFile(client, file, options) {
  try {
    return await uploadFileWithConflictStrategy(client, file, options)
  } catch (error) {
    if (!isConflictError(error)) throw error
    return uploadFileWithConflictStrategy(client, file, options)
  }
}

// A failed file does not stop the others; the intent still ends in error.
export async function uploadFilesToDrive(client, data, signal) {
  const { driveId, files } = getFilesConfig(data)
  signal.throwIfAborted()
  const dirId = await getRootId(client, driveId)
  const documents = []
  let failure
  for (let i = 0; i < files.length; i += PARALLEL_UPLOADS) {
    signal.throwIfAborted()
    const results = await Promise.allSettled(
      files.slice(i, i + PARALLEL_UPLOADS).map(file =>
        uploadFile(client, file, {
          name: file.name,
          dirId,
          driveId,
          conflictStrategy: 'rename'
        })
      )
    )
    for (const result of results) {
      if (result.status === 'fulfilled') documents.push(result.value.data)
      else failure ??= result.reason
    }
  }
  if (failure) throw failure
  return documents
}
