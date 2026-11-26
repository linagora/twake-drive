import { DOCTYPE_FILES } from '@/lib/doctypes'
import logger from '@/lib/logger'

// Only the doctypes of the sources of uploads, with the shape of their ids:
// any other one would let an app put files in a list it does not own, such
// as a photo album
const REFERENCE_ID_SHAPES = {
  // <accountId>:<emailId>:<blobId>
  'io.cozy.mails.attachments': /^[^:/]+:[^:/]+:[^:/]+$/
}
const MAX_REFERENCE_ID_LENGTH = 256

function isReferenceType(type) {
  return Object.hasOwn(REFERENCE_ID_SHAPES, type)
}

function isReferenceId(type, id) {
  return (
    typeof id === 'string' &&
    id.length <= MAX_REFERENCE_ID_LENGTH &&
    REFERENCE_ID_SHAPES[type].test(id)
  )
}

function isReference(reference) {
  return (
    typeof reference === 'object' &&
    isReferenceType(reference.type) &&
    isReferenceId(reference.type, reference.id)
  )
}

export function getUploadReference(reference) {
  if (reference === undefined || reference === null) return null
  if (!isReference(reference)) throw new Error('Unsupported reference')
  return { type: reference.type, id: reference.id }
}

// The file is stored already: a reference that fails is logged, the upload
// still succeeds with the document as created. Once referenced, the
// document takes the revision and the references of that write, so that a
// caller does not reuse a stale _rev
export async function addUploadReference(client, document, reference) {
  if (!reference) return document
  try {
    const { data, meta } = await client
      .collection(DOCTYPE_FILES)
      .addReferencedBy(document, [{ _id: reference.id, _type: reference.type }])
    return {
      ...document,
      _rev: meta?.rev ?? document._rev,
      relationships: {
        ...document.relationships,
        referenced_by: {
          ...document.relationships?.referenced_by,
          data: data.map(({ _id, _type }) => ({ id: _id, type: _type }))
        }
      }
    }
  } catch (error) {
    logger.warn('Upload intent could not reference a stored file', error)
    return document
  }
}
