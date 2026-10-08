import {
  fetchPickerDocument,
  fetchPickerDocumentWithPath
} from '../FilePicker/documents'

function hasMovedFileMetadata(document) {
  return Boolean(
    typeof document.name === 'string' &&
    document.dir_id &&
    document.mime &&
    document.size !== null &&
    document.size !== undefined
  )
}

function isCompleteMovedFile(document) {
  return Boolean(
    document &&
    document._id &&
    document._rev &&
    document._type === 'io.cozy.files' &&
    document.type === 'file' &&
    hasMovedFileMetadata(document) &&
    !document.trashed &&
    !document._deleted
  )
}

function getFinalDocumentId(result, driveId) {
  // A local metadata move preserves its ID; cross-drive moves may assign a new one.
  return (
    result.moved?._id ??
    result.moved?.id ??
    (driveId || result.source.driveId ? null : result.source._id)
  )
}

async function fetchCompleteMovedFile(client, result, driveId) {
  if (isCompleteMovedFile(result.moved)) return result.moved
  const id = getFinalDocumentId(result, driveId)
  if (!id) throw new Error('The move response has no final document ID')
  const document = await fetchPickerDocument(client, id, driveId)
  if (!isCompleteMovedFile(document))
    throw new Error('Incomplete moved document')
  return document
}

async function fetchMoveIntentResult(client, result, destination) {
  const driveId = destination.driveId ?? null
  const document = await fetchCompleteMovedFile(client, result, driveId)
  if (document.dir_id !== destination._id)
    throw new Error('Unexpected moved document location')
  const moved = driveId ? { ...document, driveId } : document
  return fetchPickerDocumentWithPath(client, moved)
}

export async function fetchMoveIntentResults(client, moveResults, destination) {
  const deletedIds = new Set(
    moveResults.flatMap(result => result.deleted || [])
  )
  const survivingResults = moveResults.filter(result => {
    const id = result.moved?._id ?? result.moved?.id ?? result.source._id
    return !deletedIds.has(id)
  })
  return Promise.all(
    survivingResults.map(result =>
      fetchMoveIntentResult(client, result, destination)
    )
  )
}
