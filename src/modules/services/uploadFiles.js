import { uploadFileWithConflictStrategy } from 'cozy-client/dist/models/file'

import { getFolderIdFromSharing } from '@/modules/shareddrives/helpers'
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
  if (
    !Array.isArray(files) ||
    files.length === 0 ||
    !files.every(file => file instanceof File)
  ) {
    throw new Error('files must be a non-empty list of files')
  }
  return { driveId, files }
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

// The intent has no dialog, so a taken name keeps both files. A failed file
// does not stop the others; the intent still ends in error.
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
        uploadFileWithConflictStrategy(client, file, {
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
