import { combineReducers } from 'redux'

import { getFullpath } from 'cozy-client/dist/models/file'

import { MAX_PAYLOAD_SIZE } from '@/constants/config'
import { DOCTYPE_FILES } from '@/lib/doctypes'
import logger from '@/lib/logger'
import { CozyFile } from '@/models'

const SLUG = 'upload'

export const ADD_TO_UPLOAD_QUEUE = 'ADD_TO_UPLOAD_QUEUE'
const UPLOAD_FILE = 'UPLOAD_FILE'
const UPLOAD_PROGRESS = 'UPLOAD_PROGRESS'
export const RECEIVE_UPLOAD_SUCCESS = 'RECEIVE_UPLOAD_SUCCESS'
export const RECEIVE_UPLOAD_ERROR = 'RECEIVE_UPLOAD_ERROR'
const PURGE_UPLOAD_QUEUE = 'PURGE_UPLOAD_QUEUE'
const RESOLVE_FOLDER_ITEMS = 'RESOLVE_FOLDER_ITEMS'

const CANCEL = 'cancel'
const PENDING = 'pending'
const LOADING = 'loading'
const CREATED = 'created'
const UPDATED = 'updated'
const FAILED = 'failed'
const CONFLICT = 'conflict'
const QUOTA = 'quota'
const NETWORK = 'network'
const UNREADABLE = 'unreadable'
// Placeholder status for a top-level folder drop while its tree is
// being walked and folders are being created server-side. Replaced by
// real PENDING items once flattenEntries completes.
const RESOLVING = 'resolving'
// Mirrors cozy-stack's ErrMaxFileSize message so client-side pre-flight
// rejections look identical to server-side ones and funnel through the
// same classifier branch.
const ERR_MAX_FILE_SIZE =
  'The file is too big and exceeds the filesystem maximum file size'

const DONE_STATUSES = [CREATED, UPDATED]
const ERROR_STATUSES = [CONFLICT, NETWORK, QUOTA, FAILED, UNREADABLE]
const IN_PROGRESS_STATUSES = [PENDING, RESOLVING]

export const status = {
  CANCEL,
  PENDING,
  LOADING,
  CREATED,
  UPDATED,
  FAILED,
  CONFLICT,
  QUOTA,
  NETWORK,
  UNREADABLE,
  RESOLVING,
  DONE_STATUSES,
  ERROR_STATUSES,
  ERR_MAX_FILE_SIZE
}

const CONFLICT_ERROR = 409
const PAYLOAD_TOO_LARGE = 413

// `status` is preserved when set on the input (folder placeholder rows
// arrive with status: RESOLVING); real file items have no status and
// default to PENDING so processNextFile picks them up.
const itemInitialState = item => ({
  ...item,
  status: item.status || PENDING,
  progress: null
})

const getStatus = (state, action) => {
  switch (action.type) {
    case UPLOAD_FILE:
      return LOADING
    case RECEIVE_UPLOAD_SUCCESS:
      return action.isUpdate ? UPDATED : CREATED
    case RECEIVE_UPLOAD_ERROR:
      return action.status
    default:
      return state
  }
}

const getSpeed = (state, action) => {
  const lastLoaded = state.loaded
  const lastUpdated = state.lastUpdated
  const now = action.date
  const nowLoaded = action.loaded
  return ((nowLoaded - lastLoaded) / (now - lastUpdated)) * 1000
}

let remainingTimes = []
let averageRemainingTime = undefined
let timeout = undefined

const getProgress = (state, action) => {
  if (action.type == RECEIVE_UPLOAD_SUCCESS) {
    return null
  } else if (action.type === UPLOAD_PROGRESS) {
    const speed = state ? getSpeed(state, action) : null
    const loaded = action.loaded
    const total = action.total
    const instantRemainingTime =
      speed && total && loaded ? (total - loaded) / speed : null

    if (!averageRemainingTime) {
      averageRemainingTime = instantRemainingTime
    }

    if (instantRemainingTime) {
      remainingTimes.push(instantRemainingTime)
    }

    if (!timeout) {
      timeout = setTimeout(() => {
        averageRemainingTime =
          remainingTimes.reduce((a, b) => a + b, 0) / remainingTimes.length

        clearTimeout(timeout)
        timeout = undefined
        remainingTimes = []
      }, 3000)
    }

    return {
      loaded,
      total,
      lastUpdated: action.date,
      speed,
      remainingTime: averageRemainingTime
    }
  } else if (action.type === RECEIVE_UPLOAD_ERROR) {
    return null
  } else {
    return state
  }
}

const item = (state, action = { isUpdate: false }) => {
  const resolvedUploadedItem =
    action.uploadedItem !== undefined
      ? action.uploadedItem
      : state?.uploadedItem

  return {
    ...state,
    status: getStatus(state.status, action),
    progress: getProgress(state.progress, action),
    ...(resolvedUploadedItem !== undefined
      ? { uploadedItem: resolvedUploadedItem }
      : {})
  }
}

export const queue = (state = [], action) => {
  switch (action.type) {
    case ADD_TO_UPLOAD_QUEUE:
      return [
        ...state.filter(i => i.status !== CREATED),
        ...action.files.map(f => itemInitialState(f))
      ]
    case RESOLVE_FOLDER_ITEMS: {
      const placeholderIds = new Set(action.placeholderIds)
      const filtered = state.filter(i => !placeholderIds.has(i.fileId))
      // If purgeUploadQueue ran while flattenEntries was in flight, the
      // placeholders are gone — drop the resolved files too so a cancelled
      // drop doesn't silently re-fill the queue and resume uploading.
      if (filtered.length === state.length) return state
      return [...filtered, ...action.files.map(f => itemInitialState(f))]
    }
    case PURGE_UPLOAD_QUEUE:
      return []
    case UPLOAD_FILE:
    case RECEIVE_UPLOAD_SUCCESS:
    case RECEIVE_UPLOAD_ERROR:
    case UPLOAD_PROGRESS: {
      // No matching row (e.g. the queue was purged before a stale
      // dispatch landed): return the same reference so connected
      // consumers don't re-render needlessly.
      if (!state.some(i => i.fileId === action.fileId)) return state
      return state.map(i => (i.fileId !== action.fileId ? i : item(i, action)))
    }
    default:
      return state
  }
}

export default combineReducers({
  queue
})

export const uploadProgress = (fileId, event, date) => ({
  type: UPLOAD_PROGRESS,
  fileId,
  loaded: event.loaded,
  total: event.total,
  date: date || Date.now()
})

/**
 * Upload a single pending queue item: resolve its target directory
 * (server-side folder id if the item came from a flattened folder drop,
 * otherwise the caller-supplied `dirID`) and dispatch the upload
 * lifecycle actions.
 *
 * Kept separate from {@link processNextFile} so the outer thunk only
 * has the queue-draining loop and error funnel.
 *
 * @param {{file: File, fileId: string, folderId?: string}} pendingItem
 * @param {object} client - cozy-client instance
 * @param {string} dirID - Fallback directory when the item has no folderId
 * @param {string} [driveId]
 * @param {{dispatch: Function, safeCallback: Function}} io
 */
const uploadPendingItem = async (
  pendingItem,
  client,
  dirID,
  driveId,
  { dispatch, safeCallback }
) => {
  const { file, fileId, folderId } = pendingItem
  const targetDirId = folderId ?? dirID
  try {
    dispatch({ type: UPLOAD_FILE, fileId, file })
    const onUploadProgress = event => dispatch(uploadProgress(fileId, event))
    const { data: uploadedFile, isUpdate } = await uploadOrOverwriteFile(
      client,
      file,
      targetDirId,
      { onUploadProgress },
      driveId
    )
    safeCallback(uploadedFile)
    dispatch({
      type: RECEIVE_UPLOAD_SUCCESS,
      fileId,
      file,
      isUpdate,
      uploadedItem: uploadedFile
    })
  } catch (error) {
    logger.error(
      `Upload module catches an error when executing processNextFile(): ${error}`
    )
    dispatch({
      type: RECEIVE_UPLOAD_ERROR,
      fileId,
      file,
      status: classifyUploadError(error)
    })
  }
}

export const processNextFile =
  (
    fileUploadedCallback,
    queueCompletedCallback,
    dirID,
    sharingState,
    { client },
    driveId,
    addItems
  ) =>
  async (dispatch, getState) => {
    const safeCallback =
      typeof fileUploadedCallback === 'function'
        ? fileUploadedCallback
        : () => {}
    if (!client) {
      throw new Error(
        'Upload module needs a cozy-client instance to work. This instance should be made available by using the extraArgument function of redux-thunk'
      )
    }
    const pendingItem = getUploadQueue(getState()).find(
      i => i.status === PENDING
    )
    if (!pendingItem) {
      return dispatch(onQueueEmpty(queueCompletedCallback))
    }
    await uploadPendingItem(pendingItem, client, dirID, driveId, {
      dispatch,
      safeCallback
    })
    dispatch(
      processNextFile(
        fileUploadedCallback,
        queueCompletedCallback,
        dirID,
        sharingState,
        { client },
        driveId,
        addItems
      )
    )
  }

const getFileFromEntry = entry =>
  new Promise((resolve, reject) => entry.file(resolve, reject))

const readNextBatch = dirReader =>
  new Promise((resolve, reject) => dirReader.readEntries(resolve, reject))

/**
 * Read all entries from a directory upfront so file entries can be
 * converted to File objects before uploads start. This prevents
 * NotFoundError when the browser discards stale FileSystemEntry
 * references during long sequential uploads of large directories.
 */
const readAllEntries = async dirReader => {
  const entries = []
  let batch
  while ((batch = await readNextBatch(dirReader)).length > 0) {
    entries.push(...batch)
  }
  return entries
}

const resolveFullpath = (client, dirID, name, driveId) =>
  driveId
    ? getFullpath(client, dirID, name, driveId)
    : CozyFile.getFullpath(dirID, name)

const getExistingDirectory = async (client, dirID, name, driveId) => {
  const path = await resolveFullpath(client, dirID, name, driveId)
  const statResp = await client
    .collection(DOCTYPE_FILES, { driveId })
    .statByPath(path)
  if (statResp.data.type !== 'directory') {
    throw new Error(`"${path}" already exists and is not a directory`)
  }
  return statResp.data
}

/**
 * Map an upload failure to one of the queue item error statuses.
 *
 * Precedence matters: the Chrome pre-flight in `uploadFile` throws an
 * `Error` whose message is a JSON blob carrying `status: 413` (no such
 * property on the error itself), so the `ERR_MAX_FILE_SIZE` message
 * match has to run before the `PAYLOAD_TOO_LARGE` status check. The
 * plain disk-usage guard in the same function throws with
 * `error.status = PAYLOAD_TOO_LARGE`, which the later branch catches.
 *
 * @param {Error} error
 * @returns {string} One of the values exported in `status`.
 */
const classifyUploadError = error => {
  if (error.name === 'NotFoundError') return UNREADABLE
  if (error.message?.includes(ERR_MAX_FILE_SIZE)) return ERR_MAX_FILE_SIZE
  if (error.status === CONFLICT_ERROR) return CONFLICT
  if (error.status === PAYLOAD_TOO_LARGE) return QUOTA
  if (/Failed to fetch$/.test(error.toString())) return NETWORK
  return FAILED
}

/**
 * Upload a file, or silently overwrite the existing version on 409.
 *
 * @param {object} client - cozy-client instance
 * @param {File} file
 * @param {string} dirID
 * @param {{onUploadProgress?: Function}} options
 * @param {string} [driveId]
 * @returns {Promise<{data: object, isUpdate: boolean}>} The created
 *   (`isUpdate: false`) or overwritten (`isUpdate: true`) file document.
 */
const uploadOrOverwriteFile = async (client, file, dirID, options, driveId) => {
  try {
    const data = await uploadFile(client, file, dirID, options, driveId)
    return { data, isUpdate: false }
  } catch (err) {
    if (err.status !== CONFLICT_ERROR) throw err
    const path = await resolveFullpath(client, dirID, file.name, driveId)
    const data = await overwriteFile(client, file, path, options, driveId)
    return { data, isUpdate: true }
  }
}

/**
 * Create a folder, or return the existing one on 409.
 *
 * Used by the flatten helpers when walking a dropped folder tree: we
 * reuse an existing same-name directory instead of failing.
 * `getExistingDirectory` throws a plain `Error` (no `status`) if a
 * non-directory sits at that name, which bubbles up as a normal upload
 * failure rather than being silently overwritten.
 *
 * @param {object} client - cozy-client instance
 * @param {string} name
 * @param {string} dirID - Parent directory id
 * @param {string} [driveId]
 * @returns {Promise<object>} The `io.cozy.files` document of the created
 *   or existing directory.
 */
const createFolderOrGetExisting = async (client, name, dirID, driveId) => {
  try {
    return await createFolder(client, name, dirID, driveId)
  } catch (err) {
    if (err.status !== CONFLICT_ERROR) throw err
    return getExistingDirectory(client, dirID, name, driveId)
  }
}

const createFolder = async (client, name, dirID, driveId) => {
  const resp = await client
    .collection(DOCTYPE_FILES, { driveId })
    .createDirectory({ name, dirId: dirID })
  return resp.data
}

const uploadFile = async (client, file, dirID, options = {}, driveId) => {
  /** We have a bug with Chrome returning SPDY_ERROR_PROTOCOL.
   * This is certainly caused by the couple HTTP2 / HAProxy / CozyStack
   * when something cut the HTTP connexion before the Stack
   *
   * We can not intercept this error since Chrome only returns
   * `Failed to fetch` as if we were offline. The only workaround for
   * now, is to check if we'll have enough size on the Cozy before
   * trying to upload the file to detect if we'll go out of quota
   * before connexion being cut by something.
   *
   * We don't need to do that work on other browser (window.chrome
   * should be available on new Edge, Chrome, Chromium, Brave, Opera...)
   */
  if (window.chrome) {
    const fileSize = parseInt(file.size, 10)

    if (fileSize > MAX_PAYLOAD_SIZE) {
      // Match cozy-stack error format
      throw new Error(
        JSON.stringify({
          status: PAYLOAD_TOO_LARGE,
          title: 'Request Entity Too Large',
          detail: ERR_MAX_FILE_SIZE
        })
      )
    }

    const { data: diskUsage } = await client
      .getStackClient()
      .fetchJSON('GET', '/settings/disk-usage')
    if (diskUsage.attributes.quota) {
      const usedSpace = parseInt(diskUsage.attributes.used, 10)
      const totalQuota = parseInt(diskUsage.attributes.quota, 10)
      const availableSpace = totalQuota - usedSpace

      if (fileSize > availableSpace) {
        const error = new Error('Insufficient Disk Space')
        error.status = PAYLOAD_TOO_LARGE
        throw error
      }
    }
  }

  const { onUploadProgress } = options

  const resp = await client
    .collection(DOCTYPE_FILES, { driveId })
    .createFile(file, { dirId: dirID, onUploadProgress })

  return resp.data
}

/**
 * @param {object} client - A CozyClient instance
 * @param {File} file - The javascript File object to upload
 * @param {string} path - The target file's path in the cozy
 * @param {{onUploadProgress: Function}} [options]
 * @param {string} [driveId] - Shared drive id
 * @returns {Promise<object>} The updated io.cozy.files document
 */
export const overwriteFile = async (
  client,
  file,
  path,
  options = {},
  driveId = null
) => {
  const statResp = await client
    .collection(DOCTYPE_FILES, { driveId })
    .statByPath(path)
  const { id: fileId } = statResp.data
  // updateFile destructures known param keys (fileId, name, …) and
  // treats the rest as upload options (onUploadProgress, etc.) — so
  // they must sit at the top level of the second argument, not nested
  // under an `options` key.
  const resp = await client
    .collection(DOCTYPE_FILES, { driveId })
    .updateFile(file, { fileId, ...options })

  return resp.data
}

/**
 * Build a flat queue item.
 *
 * `fileId` is the identity the reducer uses for progress/success/error
 * updates, so it must be unique per item. The relative path (or bare
 * filename for loose files) makes two `img.jpg`s in different folders
 * distinct, but the same drop can be made twice in a row — the nonce
 * scopes the id to one drop so two `photos/img.jpg` items from two
 * drops don't collide and have a single dispatch flip both rows.
 *
 * @param {File} file
 * @param {string} folderId - Server id of the folder the file goes into
 * @param {string|null} relativePath - `"photos/2024/img.jpg"` when the
 *   file came from a dropped folder, `null` for loose files
 * @param {string} nonce - Per-drop nonce; `''` keeps the legacy id
 *   shape for callers that don't care about cross-drop uniqueness.
 * @returns {{fileId: string, file: File, relativePath: string|null, folderId: string}}
 */
const makeFlatItem = (file, folderId, relativePath = null, nonce = '') => {
  const base = relativePath ?? file.name
  return {
    fileId: nonce ? `${nonce}_${base}` : base,
    file,
    relativePath,
    folderId
  }
}

/**
 * Build a queue item representing an entry we couldn't read locally.
 *
 * The status is preset (via {@link classifyUploadError}) so the reducer
 * keeps it instead of promoting the row to PENDING. A `NotFoundError`
 * lands on UNREADABLE (firing the unreadable-files alert downstream);
 * permission / generic I/O errors land on FAILED rather than being
 * silently mislabelled. The synthetic `file` shim carries the entry's
 * display name so the upload tray can render the row even though we
 * never obtained a real `File` object. `isDirectory` is propagated so
 * the queue UI renders the folder glyph for unreadable directories,
 * making them visually distinct from unreadable files.
 *
 * @param {string} name - Local entry name (file or folder)
 * @param {string|null} relativePath - Path of the failed entry relative
 *   to the drop root (e.g. `"a/b/c/d/e"`), or `null` for top-level
 *   loose entries
 * @param {string} nonce - Per-drop nonce, same shape as in {@link makeFlatItem}
 * @param {Error} error - The rejection from `readEntries` or `entry.file()`
 * @param {boolean} [isDirectory=false] - `true` when the failed entry
 *   was a directory (its `readEntries` rejected); `false` for a file
 *   whose `entry.file()` rejected
 * @returns {{fileId: string, file: {name: string, type: string},
 *   relativePath: string|null, folderId: null, status: string,
 *   isDirectory: boolean}}
 */
const makeFailedItem = (
  name,
  relativePath,
  nonce,
  error,
  isDirectory = false
) => {
  const base = relativePath ?? name
  return {
    fileId: nonce ? `${nonce}_${base}` : base,
    file: { name, type: '' },
    relativePath,
    folderId: null,
    isDirectory,
    status: classifyUploadError(error)
  }
}

/**
 * @typedef {object} WalkedNode
 * @property {string} name - Local entry name
 * @property {true} [readFailed] - Set when `readEntries` rejected; the
 *   node has no children and `error` carries the rejection
 * @property {Error} [error] - Present iff `readFailed` is true
 * @property {File[]} [files] - Successfully extracted `File` objects
 * @property {Array<{name: string, error: Error}>} [failedFiles] -
 *   Child file entries whose `entry.file()` rejected
 * @property {WalkedNode[]} [subdirs] - Recursively-walked subdirectories
 */

/**
 * Walk a `FileSystemDirectoryEntry` locally without touching the
 * server. Read failures (long-path `NotFoundError` on Windows, vanished
 * entries) are captured per-node instead of thrown, so the materialize
 * step can finish creating the surrounding tree and surface failed
 * reads as queue rows.
 *
 * Files within a directory are extracted via `Promise.all` (parallel),
 * matching the original code's concurrency. Subdirs are recursed into
 * sequentially to keep the parallelism bounded on wide trees.
 *
 * @param {FileSystemDirectoryEntry} dirEntry
 * @returns {Promise<WalkedNode>}
 */
const walkDirectoryEntry = async dirEntry => {
  let childEntries
  try {
    childEntries = await readAllEntries(dirEntry.createReader())
  } catch (error) {
    return { name: dirEntry.name, readFailed: true, error }
  }
  const fileEntries = childEntries.filter(c => c.isFile)
  const subdirEntries = childEntries.filter(c => c.isDirectory)
  const files = []
  const failedFiles = []
  const filePromises = fileEntries.map(c =>
    getFileFromEntry(c).then(
      f => files.push(f),
      error => failedFiles.push({ name: c.name, error })
    )
  )
  await Promise.all(filePromises)
  const subdirs = []
  for (const sub of subdirEntries) {
    subdirs.push(await walkDirectoryEntry(sub))
  }
  return { name: dirEntry.name, files, failedFiles, subdirs }
}

/**
 * @typedef {{fileId: string, file: File, relativePath: string|null, folderId: string}} ReadableFlatItem
 * @typedef {{fileId: string, file: {name: string, type: string},
 *   relativePath: string|null, folderId: null, status: string,
 *   isDirectory: boolean}} FailedFlatItem
 */

/**
 * Materialize a walked tree: create the server folder for every node
 * we visited (including empty ones and ones whose `readEntries` failed
 * locally), emit a flat queue item per readable file, and emit one
 * error row per failed read (folder or file).
 *
 * Folders are created unconditionally so the resulting tree in Drive
 * matches the shape that was dropped. Empty folders survive the round
 * trip; folders whose contents couldn't be read appear empty AND carry
 * a queue row pointing at the missing subtree so the user can drop the
 * files back in by hand.
 *
 * @param {WalkedNode} node - A node returned by {@link walkDirectoryEntry}
 * @param {string} parentDirId - Server id of the enclosing directory
 *   (i.e. the dir into which this node will be created)
 * @param {string} pathPrefix - Relative path accumulated so far,
 *   without a trailing slash; `''` at the drop root
 * @param {{client: object, driveId?: string, nonce: string}} ctx -
 *   Drop-invariant deps grouped to keep the recursion-changing args
 *   (`node`, `parentDirId`, `pathPrefix`) positional and short
 * @returns {Promise<Array<ReadableFlatItem|FailedFlatItem>>}
 */
const materializeNode = async (node, parentDirId, pathPrefix, ctx) => {
  const newPrefix = pathPrefix ? `${pathPrefix}/${node.name}` : node.name
  const newDir = await createFolderOrGetExisting(
    ctx.client,
    node.name,
    parentDirId,
    ctx.driveId
  )
  if (node.readFailed) {
    return [makeFailedItem(node.name, newPrefix, ctx.nonce, node.error, true)]
  }

  const items = node.failedFiles.map(ff =>
    makeFailedItem(
      ff.name,
      `${newPrefix}/${ff.name}`,
      ctx.nonce,
      ff.error,
      false
    )
  )
  for (const file of node.files) {
    items.push(
      makeFlatItem(file, newDir.id, `${newPrefix}/${file.name}`, ctx.nonce)
    )
  }
  for (const sub of node.subdirs) {
    const subItems = await materializeNode(sub, newDir.id, newPrefix, ctx)
    items.push(...subItems)
  }
  return items
}

/**
 * Build a memoised `ensureFolder(path)` function that creates (or
 * reuses) nested folders under `rootDirId`, one server call per unique
 * path segment.
 *
 * @param {string} rootDirId
 * @param {object} client - cozy-client instance
 * @param {string} [driveId]
 * @returns {(folderPath: string) => Promise<string>} Resolves to the
 *   server id of the folder at `folderPath` (relative to root).
 */
const makeFolderResolver = (rootDirId, client, driveId) => {
  const cache = new Map([['', rootDirId]])
  const ensure = async folderPath => {
    if (cache.has(folderPath)) return cache.get(folderPath)
    const lastSlash = folderPath.lastIndexOf('/')
    const parentPath = lastSlash > 0 ? folderPath.slice(0, lastSlash) : ''
    const name = lastSlash > 0 ? folderPath.slice(lastSlash + 1) : folderPath
    const parentId = await ensure(parentPath)
    const folder = await createFolderOrGetExisting(
      client,
      name,
      parentId,
      driveId
    )
    cache.set(folderPath, folder.id)
    return folder.id
  }
  return ensure
}

/**
 * Flatten a mixed list of dropped entries into per-file queue items.
 *
 * Three entry shapes are handled in a single pass:
 * - `{isDirectory: true, entry}` — a `FileSystemEntry` from drag-and-drop;
 *   walked locally first via {@link walkDirectoryEntry}, then realized
 *   server-side via {@link materializeNode}. Read failures along the
 *   walk become per-entry UNREADABLE rows instead of throwing, so a
 *   long-path NotFoundError on Windows doesn't leave orphan folders
 *   server-side.
 * - `{file}` whose `file.path` contains a `/` — a react-dropzone /
 *   file-selector File with a relative path; folders are created on the
 *   fly via the path-based resolver.
 * - `{file}` with no folder structure — placed directly under `rootDirId`.
 *
 * Intermediate folders are created (or reused on 409) server-side
 * before any file upload starts, so `processNextFile` only ever handles
 * single-file items and there is exactly one place in the module that
 * resolves folder conflicts.
 *
 * @param {Array<{file: File|null, isDirectory?: boolean, entry?: FileSystemEntry|null}>} entries
 * @param {string} rootDirId - Directory id where the drop happened
 * @param {object} client - cozy-client instance
 * @param {string} [driveId]
 * @returns {Promise<Array<{fileId: string, file: File, relativePath: string|null, folderId: string}>>}
 */
export const flattenEntries = async (
  entries,
  rootDirId,
  client,
  driveId,
  nonce = ''
) => {
  const ensureFolder = makeFolderResolver(rootDirId, client, driveId)
  const result = []
  for (const entry of entries) {
    if (entry.isDirectory && entry.entry) {
      const tree = await walkDirectoryEntry(entry.entry)
      const subItems = await materializeNode(tree, rootDirId, '', {
        client,
        driveId,
        nonce
      })
      result.push(...subItems)
      continue
    }
    const file = entry.file
    if (!file) continue
    const raw = file.path || ''
    const cleanPath = raw.startsWith('/') ? raw.slice(1) : raw
    if (!cleanPath.includes('/')) {
      result.push(makeFlatItem(file, rootDirId, null, nonce))
    } else {
      const folderPath = cleanPath.slice(0, cleanPath.lastIndexOf('/'))
      const folderId = await ensureFolder(folderPath)
      result.push(makeFlatItem(file, folderId, cleanPath, nonce))
    }
  }
  return result
}

export const removeFileToUploadQueue = file => async dispatch => {
  dispatch({
    type: RECEIVE_UPLOAD_SUCCESS,
    fileId: file.name,
    file,
    isUpdate: true
  })
}

/**
 * An entry is "deferred" if it needs flattening — either a directory
 * drag-drop or a react-dropzone file with a folder structure encoded
 * in its `path`. Loose top-level files are NOT deferred and can be
 * queued immediately as PENDING items.
 */
const isDeferredEntry = entry => {
  if (entry.isDirectory && entry.entry) return true
  const path = entry.file?.path
  if (!path) return false
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return cleanPath.includes('/')
}

/**
 * Identify the top-level folder names a drop will create. Used to seed
 * "resolving" placeholder rows so the upload tray appears immediately,
 * before the (potentially slow) tree walk creates folders server-side.
 *
 * @param {Array<{file: File|null, isDirectory?: boolean, entry?: object|null}>} entries
 * @returns {string[]} Unique top-level folder names
 */
const collectFolderRoots = entries => {
  const roots = new Set()
  for (const e of entries) {
    if (e.isDirectory && e.entry) {
      roots.add(e.entry.name)
      continue
    }
    const path = e.file?.path
    if (!path) continue
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    if (cleanPath.includes('/')) {
      roots.add(cleanPath.split('/')[0])
    }
  }
  return [...roots]
}

// Placeholder ids include a per-drop nonce so two `photos` folders
// dropped back-to-back can't collide on the same queue identity, and
// an index so two same-named folders inside one drop stay distinct.
const placeholderId = (name, index, nonce) =>
  `__pending_${nonce}_${index}_${name}__`

const buildFolderPlaceholder = (name, index, nonce) => ({
  fileId: placeholderId(name, index, nonce),
  file: { name, type: '' },
  relativePath: null,
  folderId: null,
  isDirectory: true,
  status: RESOLVING
})

export const addToUploadQueue =
  (
    entries,
    dirID,
    sharingState,
    fileUploadedCallback,
    queueCompletedCallback,
    { client, maxFileCount, onLimitExceeded },
    driveId,
    addItems
  ) =>
  async dispatch => {
    const folderRoots = collectFolderRoots(entries)
    const dropNonce = `${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`
    const placeholders = folderRoots.map((name, i) =>
      buildFolderPlaceholder(name, i, dropNonce)
    )
    const placeholderIds = placeholders.map(p => p.fileId)

    const deferredEntries = entries.filter(isDeferredEntry)
    const looseItems = entries
      .filter(e => !isDeferredEntry(e) && e.file)
      .map(e => makeFlatItem(e.file, dirID, null, dropNonce))
    const allDropIds = [...placeholderIds, ...looseItems.map(i => i.fileId)]

    const kickProcessing = () =>
      dispatch(
        processNextFile(
          fileUploadedCallback,
          queueCompletedCallback,
          dirID,
          sharingState,
          { client },
          driveId,
          addItems
        )
      )

    const failDrop = errStatus => {
      for (const fileId of allDropIds) {
        dispatch({ type: RECEIVE_UPLOAD_ERROR, fileId, status: errStatus })
      }
    }

    // Mark every row for this drop failed and kick so processNextFile
    // hits an empty PENDING set and runs onQueueEmpty → the upstream
    // queueCompletedCallback surfaces the right toast.
    const failAndKick = error => {
      failDrop(classifyUploadError(error))
      kickProcessing()
    }

    const initialItems = [...placeholders, ...looseItems]
    if (initialItems.length > 0) {
      dispatch({ type: ADD_TO_UPLOAD_QUEUE, files: initialItems })
    }

    try {
      if (
        typeof maxFileCount === 'number' &&
        (await exceedsFileLimit(entries, maxFileCount))
      ) {
        // Modal is the user-facing feedback; the dropped rows stay in
        // the tray as FAILED so the user sees what was rejected. We
        // run the limit check before kicking processing, so loose
        // files don't quietly get uploaded behind the modal. No
        // kickProcessing here keeps queueCompletedCallback silent and
        // avoids a redundant toast over the modal.
        failDrop(FAILED)
        if (typeof onLimitExceeded === 'function') onLimitExceeded()
        return
      }
    } catch (error) {
      failAndKick(error)
      return
    }

    if (looseItems.length > 0) kickProcessing()
    if (deferredEntries.length === 0) return

    try {
      const flatItems = await flattenEntries(
        deferredEntries,
        dirID,
        client,
        driveId,
        dropNonce
      )
      dispatch({ type: RESOLVE_FOLDER_ITEMS, placeholderIds, files: flatItems })
      kickProcessing()
    } catch (error) {
      failAndKick(error)
    }
  }

export const purgeUploadQueue = () => ({ type: PURGE_UPLOAD_QUEUE })

export const onQueueEmpty = callback => (dispatch, getState) => {
  const safeCallback = typeof callback === 'function' ? callback : () => {}
  const queue = getUploadQueue(getState())
  // While folder placeholders are still being resolved, the queue isn't
  // really empty; suppress the completion callback so the per-drop alert
  // doesn't fire mid-flatten. The chain ends silently here; the
  // addToUploadQueue thunk re-kicks processNextFile after the matching
  // RESOLVE_FOLDER_ITEMS dispatch.
  if (queue.some(i => i.status === RESOLVING)) return
  const quotas = getQuotaErrors(queue)
  const conflicts = getConflicts(queue)
  const created = getCreated(queue)
  const updated = getUpdated(queue)
  const networkErrors = getNetworkErrors(queue)
  const errors = getErrors(queue)
  const unreadableErrors = getUnreadableErrors(queue)
  const fileTooLargeErrors = getfileTooLargeErrors(queue)

  const createdItems = created
    .map(item => item.uploadedItem)
    .filter(item => item && item._id)
  const updatedItems = updated
    .map(item => item.uploadedItem)
    .filter(item => item && item._id)

  return safeCallback({
    createdItems,
    quotas,
    conflicts,
    networkErrors,
    errors,
    unreadableErrors,
    updatedItems,
    fileTooLargeErrors
  })
}

// selectors
const filterByStatus = (queue, status) => queue.filter(f => f.status === status)
const getConflicts = queue => filterByStatus(queue, CONFLICT)
const getErrors = queue => filterByStatus(queue, FAILED)
const getQuotaErrors = queue => filterByStatus(queue, QUOTA)
const getNetworkErrors = queue => filterByStatus(queue, NETWORK)
const getUnreadableErrors = queue => filterByStatus(queue, UNREADABLE)
const getCreated = queue => filterByStatus(queue, CREATED)
const getUpdated = queue => filterByStatus(queue, UPDATED)
const getfileTooLargeErrors = queue => filterByStatus(queue, ERR_MAX_FILE_SIZE)

export const getUploadQueue = state => state[SLUG].queue

export const getProcessed = state =>
  getUploadQueue(state).filter(f => !IN_PROGRESS_STATUSES.includes(f.status))

export const getSuccessful = state => {
  const queue = getUploadQueue(state)
  return queue.filter(f => [CREATED, UPDATED].includes(f.status))
}

export const selectors = {
  getConflicts,
  getErrors,
  getQuotaErrors,
  getNetworkErrors,
  getUnreadableErrors,
  getCreated,
  getUpdated,
  getProcessed,
  getSuccessful
}

// DOM helpers
export const extractFilesEntries = items => {
  let results = []
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    if (item.webkitGetAsEntry != null && item.webkitGetAsEntry()) {
      const entry = item.webkitGetAsEntry()
      results.push({
        file: item.getAsFile(),
        isDirectory: entry.isDirectory === true,
        entry
      })
    } else {
      results.push({ file: item, isDirectory: false, entry: null })
    }
  }

  if (results.length === 0) {
    logger.warn('Upload module files entries extraction: no file entry')
  }

  return results
}

/**
 * Recursively count all files inside a directory entry.
 *
 * @param {FileSystemDirectoryEntry} directoryEntry - A directory obtained from the drag-and-drop FileSystem API
 * @returns {Promise<number>} Total number of files (excluding sub-directories themselves)
 */
const countDirectoryFiles = async directoryEntry => {
  const reader = directoryEntry.createReader()
  const childEntries = await readAllEntries(reader)
  let count = 0
  for (const entry of childEntries) {
    if (entry.isFile) {
      count += 1
    } else if (entry.isDirectory) {
      count += await countDirectoryFiles(entry)
    }
  }
  return count
}

/**
 * Check whether the total number of files in the given entries exceeds
 * the provided limit. Directories are counted in parallel for speed.
 * Flat files are checked first to avoid directory traversal when possible.
 *
 * @param {Array<{file: File, isDirectory: boolean, entry: FileSystemEntry|null}>} entries - Extracted entries from {@link extractFilesEntries}
 * @param {number} limit - Maximum number of files allowed
 * @returns {Promise<boolean>} `true` if the file count exceeds the limit
 */
export const exceedsFileLimit = async (entries, limit) => {
  const fileCount = entries.filter(e => !e.isDirectory || !e.entry).length
  const directories = entries.filter(e => e.isDirectory && e.entry)

  if (fileCount > limit) return true

  const dirCounts = await Promise.all(
    directories.map(e => countDirectoryFiles(e.entry))
  )

  let count = fileCount
  for (const dirCount of dirCounts) {
    count += dirCount
    if (count > limit) return true
  }

  return false
}
