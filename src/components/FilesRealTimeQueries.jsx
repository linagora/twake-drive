import debounce from 'lodash/debounce'
import { memo, useEffect } from 'react'

import { useClient, Mutations } from 'cozy-client'
import { ensureFilePath } from 'cozy-client/dist/models/file'
import { receiveMutationResult } from 'cozy-client/dist/store'
import CozyRealtime from 'cozy-realtime'

import { buildFileOrFolderByIdQuery } from '@/queries'
import { useSharedDrives } from '@/modules/shareddrives/hooks/useSharedDrives'

const REALTIME_DEBOUNCE_TIME = 500

const bufferCreatedFiles = new Map()
const bufferUpdatedFiles = new Map()
const bufferDeletedFiles = new Map()

// Tracks which shared-drive ID a buffered file originated from.
// Populated by drive-socket handlers; absent (undefined) for own-instance files.
const driveIdByFileId = new Map()

const getParentFolder = async (client, dirId, driveId) => {
  let parentDir = client.getDocumentFromState('io.cozy.files', dirId)
  if (!parentDir) {
    if (driveId) {
      // Drive file: resolve the parent via the drive-scoped collection so the
      // request is authenticated against the correct shared drive.
      // statById returns { data: folderDoc, included: children, links }.
      const result = await client
        .collection('io.cozy.files', { driveId })
        .statById(dirId)
      parentDir = result.data
    } else {
      // Own-instance file: fall back to the standard store query path.
      const parentQuery = buildFileOrFolderByIdQuery(dirId)
      const parentResult = await client.fetchQueryAndGetFromState({
        definition: parentQuery.definition(),
        options: parentQuery.options
      })
      parentDir = parentResult.data
    }
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
    const filesInFolder = filesByFolder[folderId]
    // Derive the originating drive ID from the first file in the group.
    // All files sharing the same dir_id in a given processing cycle come from
    // the same drive (or from own-instance files which have no entry).
    const driveId =
      filesInFolder.length > 0
        ? driveIdByFileId.get(filesInFolder[0]._id)
        : undefined
    const files = []
    const folder = await getParentFolder(client, folderId, driveId)
    for (const file of filesInFolder) {
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
  // Remove processed files from buffer and clear drive-id tracking.
  // Do not clear all at once in case pending events arrived during the processing
  for (const fileId of fileIdsToProcess) {
    bufferFiles.delete(fileId)
    driveIdByFileId.delete(fileId)
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

  // ── Global own-file subscription (unchanged) ────────────────────────────────
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
      // eslint-disable-next-line no-console
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

  // ── Per-recipient-drive subscriptions ──────────────────────────────────────
  // NOTE: owner is typed as optional in the sharing type. The filter below uses
  // strict === false (as specified). If a drive has owner === undefined it will
  // not be subscribed; see phase3-report.md for details.
  const { sharedDrives } = useSharedDrives()
  // Build a stable string key from the sorted IDs of recipient drives so the
  // effect below only re-runs when the set of drives actually changes.
  const recipientDriveKey = sharedDrives
    .filter(d => d.owner === false)
    .map(d => d._id)
    .sort()
    .join(',')

  useEffect(() => {
    if (!recipientDriveKey) return

    const driveIds = recipientDriveKey.split(',').filter(Boolean)

    const realtimeInstances = driveIds.map(driveId => {
      const rt = new CozyRealtime({ client, sharedDriveId: driveId })

      rt.subscribe('created', 'io.cozy.files', couchDBDoc => {
        bufferCreatedFiles.set(
          couchDBDoc._id,
          normalizeDoc(couchDBDoc, 'io.cozy.files')
        )
        driveIdByFileId.set(couchDBDoc._id, driveId)
        debouncedDispatchEvents(client, 'created')
      })
      rt.subscribe('updated', 'io.cozy.files', couchDBDoc => {
        bufferUpdatedFiles.set(
          couchDBDoc._id,
          normalizeDoc(couchDBDoc, 'io.cozy.files')
        )
        driveIdByFileId.set(couchDBDoc._id, driveId)
        debouncedDispatchEvents(client, 'updated')
      })
      rt.subscribe('deleted', 'io.cozy.files', couchDBDoc => {
        bufferDeletedFiles.set(
          couchDBDoc._id,
          normalizeDoc(couchDBDoc, 'io.cozy.files')
        )
        driveIdByFileId.set(couchDBDoc._id, driveId)
        debouncedDispatchEvents(client, 'deleted')
      })

      return rt
    })

    return () => {
      realtimeInstances.forEach(rt => rt.stop())
    }
    // recipientDriveKey encodes all recipient-drive IDs as a sorted string;
    // re-opening sockets only when the set of drives changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, recipientDriveKey])

  return null
}

export default memo(FilesRealTimeQueries)
