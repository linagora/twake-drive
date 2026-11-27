import chunk from 'lodash/chunk'

import { DOCTYPE_FILES } from '@/lib/doctypes'
import { isReference } from '@/modules/services/uploadReference'

const MAX_LOOKUP_REFERENCES = 100
const MAX_PARALLEL_LOOKUPS = 5

function isLookupSize(references) {
  return (
    Array.isArray(references) &&
    references.length > 0 &&
    references.length <= MAX_LOOKUP_REFERENCES
  )
}

export function getLookupReferences(data) {
  const references = data?.references
  if (!isLookupSize(references)) {
    throw new Error(
      `references must hold 1 to ${MAX_LOOKUP_REFERENCES} references`
    )
  }
  if (!references.every(isReference)) throw new Error('Unsupported reference')
  const unique = new Map(references.map(({ type, id }) => [id, { type, id }]))
  return [...unique.values()]
}

// The caller learns nothing else about the files of the user: no path, no
// size, no sharing
function toFoundFile(files) {
  const file = files.find(({ trashed }) => !trashed) ?? files[0]
  if (!file) return null
  return {
    fileId: file._id,
    name: file.name,
    dirId: file.dir_id,
    trashed: file.trashed === true
  }
}

export async function lookupReferencedFiles(client, data) {
  const references = getLookupReferences(data)
  const collection = client.collection(DOCTYPE_FILES)
  const lookUp = async ({ type, id }) => {
    const { included } = await collection.findReferencedBy({
      _type: type,
      _id: id
    })
    return [id, toFoundFile(included)]
  }
  // Each lookup costs the Stack two CouchDB view reads: a few at a time
  const found = []
  for (const batch of chunk(references, MAX_PARALLEL_LOOKUPS)) {
    found.push(...(await Promise.all(batch.map(lookUp))))
  }
  return { files: Object.fromEntries(found) }
}
