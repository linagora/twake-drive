import debounce from 'lodash/debounce'
import { memo, useEffect } from 'react'

import { useClient, Mutations } from 'cozy-client'
import { ensureFilePath } from 'cozy-client/dist/models/file'
import { receiveMutationResult } from 'cozy-client/dist/store'

import { buildFileOrFolderByIdQuery } from '@/queries'

const REALTIME_DEBOUNCE_TIME = 500

const bufferCreatedFiles = new Map()
const bufferUpdatedFiles = new Map()
const bufferDeletedFiles = new Map()

const getParentFolder = async (client, dirId) => {
  let parentDir = client.getDocumentFromState('io.cozy.files', dirId)
  if (!parentDir) {
    // Parent is not in the store: query it
    const parentQuery = buildFileOrFolderByIdQuery(dirId)
    const parentResult = await client.fetchQueryAndGetFromState({
      definition: parentQuery.definition(),
      options: parentQuery.options
    })
    parentDir = parentResult.data
  }
  return parentDir
}

export const ensureFileHasPath = async (doc, client) => {
  if (doc.path) return doc

  const parentDir = await getParentFolder(client, doc.dir_id)
  return ensureFilePath(doc, parentDir)
}

/**
 * This method process the bufferised files after debounced realtime events
 * It creates the related mutation and dispatch it to the store.
 * Once done, the buffer is emptied
 *
 * @param {CozyClient} client - The CozyClient instance
 * @param {string} mutationType - Either 'created', 'updated' or 'deleted'
 * @returns {Promise<void>}
 */
const processEvents = async (client, mutationType) => {
  let bufferFiles, mutationFn, multipleMutationFn
  if (mutationType === 'created') {
    bufferFiles = bufferCreatedFiles
    mutationFn = Mutations.createDocument
    multipleMutationFn = Mutations.createDocuments
  }
  if (mutationType === 'updated') {
    bufferFiles = bufferUpdatedFiles
    mutationFn = Mutations.updateDocument
    multipleMutationFn = Mutations.updateDocuments
  }
  if (mutationType === 'deleted') {
    bufferFiles = bufferDeletedFiles
    mutationFn = Mutations.deleteDocument
    multipleMutationFn = Mutations.deleteDocuments
  }
  if (bufferFiles.size === 0) return

  const fileIdsToProcess = bufferFiles.keys()
  let filesByFolder = {}
  if (mutationType == 'deleted') {
    filesByFolder['io.cozy.files.trash-dir'] = Array.from(
      bufferFiles.values()
    ).filter(file => file.dir_id === 'io.cozy.files.trash-dir')
  } else {
    filesByFolder = groupFilesByFolder(bufferFiles)
  }

  for (const folderId in filesByFolder) {
    const files = []
    const folder = await getParentFolder(client, folderId)
    for (const file of filesByFolder[folderId]) {
      const fileWithPath = ensureFilePath(file, folder)
      files.push(fileWithPath)
    }
    if (files.length < 1) {
      // No files to process, early return
      return
    }
    const mutation =
      files.length > 1 ? multipleMutationFn(files) : mutationFn(files[0])

    client.dispatch(
      receiveMutationResult(
        client.generateRandomId(),
        { data: files },
        {},
        mutation
      )
    )
  }
  // Remove processed files from buffer
  // Do not clear all at once in case pending events arrived during the processing
  for (const fileId of fileIdsToProcess) {
    bufferFiles.delete(fileId)
  }
}

const debouncedDispatchEvents = debounce(
  processEvents,
  REALTIME_DEBOUNCE_TIME,
  {
    leading: true, // Do not debounce first event
    trailing: true // Execute all at the end of debounce
  }
)

/**
 * Associate files to their parent folder
 *
 * @param {Map<string, import('cozy-client/types/types').IOCozyFile} files - The files to group
 * @returns {object} The grouped files
 */
const groupFilesByFolder = files => {
  const filesByFolder = {}
  files.forEach(file => {
    const folderId = file.dir_id
    if (!filesByFolder[folderId]) {
      filesByFolder[folderId] = []
    }
    filesByFolder[folderId].push(file)
  })
  return filesByFolder
}

/**
 * Normalizes an object representing a CouchDB document
 *
 * Ensures existence of `_type`
 *
 * @public
 * @param {CouchDBDocument} couchDBDoc - object representing the document
 * @returns {CozyClientDocument} full normalized document
 */
const normalizeDoc = (couchDBDoc, doctype) => {
  return {
    id: couchDBDoc._id,
    _type: doctype,
    ...couchDBDoc
  }
}

/**
 * Component that subscribes to io.cozy.files document changes and keep the
 * internal store updated. This is a copy of RealTimeQueries from cozy-client
 * with a tweak to merge the changes with the existing document from the store.
 * You can have more detail on the problematic we are solving here:
 * https://github.com/cozy/cozy-client/issues/1412
 *
 * @param {object} options
 * @param {string} options.doctype - The doctype to watch.
 * @param {Function} [options.computeDocBeforeDispatchCreate]
 * @param {Function} [options.computeDocBeforeDispatchUpdate]
 * @param {Function} [options.computeDocBeforeDispatchDelete]
 * @returns {null} The component does not render anything.
 */
const FilesRealTimeQueries = ({
  doctype = 'io.cozy.files',
  computeDocBeforeDispatchCreate = ensureFileHasPath,
  computeDocBeforeDispatchUpdate = ensureFileHasPath,
  computeDocBeforeDispatchDelete = (doc, client) =>
    ensureFileHasPath({ ...doc, _deleted: true }, client)
}) => {
  const client = useClient()

  useEffect(() => {
    const { realtime } = client.plugins || {}

    if (!realtime) {
      throw new Error(
        'You must include the realtime plugin to use RealTimeQueries'
      )
    }

    const makeHandler = (buffer, event) => couchDBDoc => {
      const normalized = normalizeDoc(couchDBDoc, doctype)

      buffer.set(couchDBDoc._id, normalized)
      debouncedDispatchEvents(client, event)
    }

    const eventHandlers = {
      created: makeHandler(bufferCreatedFiles, 'created'),
      updated: makeHandler(bufferUpdatedFiles, 'updated'),
      deleted: makeHandler(bufferDeletedFiles, 'deleted')
    }

    const subscribeToEvents = async () => {
      await Promise.all(
        Object.entries(eventHandlers).map(([event, handler]) =>
          realtime.subscribe(event, doctype, handler)
        )
      )
    }

    subscribeToEvents().catch(err =>
      console.error('Failed to subscribe to realtime events:', err)
    )

    return () => {
      Object.entries(eventHandlers).forEach(([event, handler]) =>
        realtime.unsubscribe(event, doctype, handler)
      )
    }
  }, [
    client,
    doctype,
    computeDocBeforeDispatchCreate,
    computeDocBeforeDispatchUpdate,
    computeDocBeforeDispatchDelete
  ])

  return null
}

export default memo(FilesRealTimeQueries)
