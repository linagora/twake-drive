import { combineReducers } from 'redux'

import { getFullpath } from 'cozy-client/dist/models/file'
import flag from 'cozy-flags'

import { MAX_PAYLOAD_SIZE } from '@/constants/config'
import { DOCTYPE_FILES } from '@/lib/doctypes'
import {
  encryptAndUploadNewFile,
  getEncryptionKeyFromDirId
} from '@/lib/encryption'
import logger from '@/lib/logger'
import { CozyFile } from '@/models'

const SLUG = 'upload'

export const ADD_TO_UPLOAD_QUEUE = 'ADD_TO_UPLOAD_QUEUE'
const RESOLVE_FOLDER_ITEMS = 'RESOLVE_FOLDER_ITEMS'
const UPLOAD_FILE = 'UPLOAD_FILE'
const UPLOAD_PROGRESS = 'UPLOAD_PROGRESS'
export const RECEIVE_UPLOAD_SUCCESS = 'RECEIVE_UPLOAD_SUCCESS'
export const RECEIVE_UPLOAD_ERROR = 'RECEIVE_UPLOAD_ERROR'
const PURGE_UPLOAD_QUEUE = 'PURGE_UPLOAD_QUEUE'

const CANCEL = 'cancel'
const PENDING = 'pending'
const LOADING = 'loading'
const CREATED = 'created'
const UPDATED = 'updated'
const FAILED = 'failed'
const CONFLICT = 'conflict'
const QUOTA = 'quota'
const NETWORK = 'network'
const ERR_MAX_FILE_SIZE =
  'The file is too big and exceeds the filesystem maximum file size' // ErrMaxFileSize is used when a file is larger than the filesystem's maximum file size

const DONE_STATUSES = [CREATED, UPDATED]
const ERROR_STATUSES = [CONFLICT, NETWORK, QUOTA]

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
  DONE_STATUSES,
  ERROR_STATUSES,
  ERR_MAX_FILE_SIZE
}

const CONFLICT_ERROR = 409

const itemInitialState = item => ({
  ...item,
  fileId: item.fileId ?? item.file?.name ?? item.entry?.name,
  status: PENDING,
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

/**
 * Merge resolved folder items into the queue: update existing items
 * by fileId, and append new ones discovered by flattenEntries
 * (DropzoneDnD drops where directory entries have file=null).
 */
const mergeResolvedItems = (state, resolvedItems) => {
  const resolvedMap = new Map(resolvedItems.map(r => [r.fileId, r]))
  const existingIds = new Set(state.map(i => i.fileId))
  const updated = state.map(i => {
    const update = resolvedMap.get(i.fileId)
    return update ? { ...i, ...update } : i
  })
  const newItems = resolvedItems
    .filter(r => !existingIds.has(r.fileId))
    .map(r => itemInitialState(r))
  return [...updated, ...newItems]
}

const updateQueueItem = (state, action) => {
  const matchId = action.fileId ?? action.file?.name
  return state.map(i => (i.fileId !== matchId ? i : item(i, action)))
}

export const queue = (state = [], action) => {
  switch (action.type) {
    case ADD_TO_UPLOAD_QUEUE:
      return [
        ...state.filter(i => i.status !== CREATED),
        ...action.files.map(f => itemInitialState(f))
      ]
    case PURGE_UPLOAD_QUEUE:
      return []
    case RESOLVE_FOLDER_ITEMS:
      return mergeResolvedItems(state, action.resolvedItems)
    case UPLOAD_FILE:
    case RECEIVE_UPLOAD_SUCCESS:
    case RECEIVE_UPLOAD_ERROR:
    case UPLOAD_PROGRESS:
      return updateQueueItem(state, action)
    default:
      return state
  }
}

export default combineReducers({
  queue
})

export const uploadProgress = (fileId, file, event, date) => ({
  type: UPLOAD_PROGRESS,
  fileId,
  file,
  loaded: event.loaded,
  total: event.total,
  date: date || Date.now()
})

const getUploadErrorStatus = error => {
  const statusError = {
    409: CONFLICT,
    413: QUOTA
  }

  if (error.message?.includes(ERR_MAX_FILE_SIZE)) {
    return ERR_MAX_FILE_SIZE
  } else if (error.status in statusError) {
    return statusError[error.status]
  } else if (/Failed to fetch$/.exec(error.toString())) {
    return NETWORK
  }
  return FAILED
}

const handleConflictOverwrite = async (
  client,
  file,
  fileId,
  dirID,
  driveId,
  dispatch
) => {
  const path = driveId
    ? await getFullpath(client, dirID, file.name, driveId)
    : await CozyFile.getFullpath(dirID, file.name)

  const uploadedFile = await overwriteFile(
    client,
    file,
    path,
    {
      onUploadProgress: event => {
        dispatch(uploadProgress(fileId, file, event))
      }
    },
    driveId
  )
  dispatch({
    type: RECEIVE_UPLOAD_SUCCESS,
    fileId,
    file,
    isUpdate: true,
    uploadedItem: uploadedFile
  })
  return uploadedFile
}

const handleUploadError = async (
  uploadError,
  { client, file, fileId, dirID, driveId, dispatch, safeCallback }
) => {
  let error = uploadError
  if (uploadError.status === CONFLICT_ERROR) {
    try {
      const uploaded = await handleConflictOverwrite(
        client,
        file,
        fileId,
        dirID,
        driveId,
        dispatch
      )
      safeCallback(uploaded)
      return
    } catch (updateError) {
      error = updateError
    }
  }
  logger.error(
    `Upload module catches an error when executing processNextFile(): ${error}`
  )
  dispatch({
    type: RECEIVE_UPLOAD_ERROR,
    fileId,
    file,
    status: getUploadErrorStatus(error)
  })
}

const ensureCallback = fn => (typeof fn === 'function' ? fn : () => {})

const uploadSingleFile = async (
  { file, fileId, folderId },
  { client, vaultClient, dirID, driveId, dispatch, safeCallback }
) => {
  const targetDirId = folderId ?? dirID
  const encryptionKey = flag('drive.enable-encryption')
    ? await getEncryptionKeyFromDirId(client, targetDirId)
    : null

  try {
    dispatch({ type: UPLOAD_FILE, fileId, file })
    const uploadedFile = await uploadFile(
      client,
      file,
      targetDirId,
      {
        vaultClient,
        encryptionKey,
        onUploadProgress: event => {
          dispatch(uploadProgress(fileId, file, event))
        }
      },
      driveId
    )
    safeCallback(uploadedFile)
    dispatch({
      type: RECEIVE_UPLOAD_SUCCESS,
      fileId,
      file,
      uploadedItem: uploadedFile
    })
  } catch (uploadError) {
    await handleUploadError(uploadError, {
      client,
      file,
      fileId,
      dirID: targetDirId,
      driveId,
      dispatch,
      safeCallback
    })
  }
}

export const processNextFile =
  (
    fileUploadedCallback,
    queueCompletedCallback,
    dirID,
    sharingState,
    { client, vaultClient },
    driveId,
    addItems
  ) =>
  async (dispatch, getState) => {
    const safeCallback = ensureCallback(fileUploadedCallback)
    if (!client) {
      throw new Error(
        'Upload module needs a cozy-client instance to work. This instance should be made available by using the extraArgument function of redux-thunk'
      )
    }
    const item = getUploadQueue(getState()).find(i => i.status === PENDING)
    if (!item) {
      return dispatch(onQueueEmpty(queueCompletedCallback))
    }

    await uploadSingleFile(item, {
      client,
      vaultClient,
      dirID,
      driveId,
      dispatch,
      safeCallback
    })
    dispatch(
      processNextFile(
        fileUploadedCallback,
        queueCompletedCallback,
        dirID,
        sharingState,
        { client, vaultClient },
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

/**
 * Recursively flatten FileSystemEntry-based directory entries into
 * individual file items. Used by DropzoneDnD where webkitGetAsEntry()
 * is still valid (react-dnd calls drop() synchronously).
 */
export const flattenEntries = async (
  entries,
  rootDirId,
  client,
  driveId,
  pathPrefix = '',
  folderName = null
) => {
  const result = []

  for (const item of entries) {
    if (item.isDirectory && item.entry) {
      const dirEntry = item.entry
      const dirName = dirEntry.name
      const newDir = await createFolder(client, dirName, rootDirId, driveId)
      const topFolderName = folderName ?? dirName
      const newPrefix = pathPrefix ? `${pathPrefix}/${dirName}` : dirName

      const dirReader = dirEntry.createReader()
      const childEntries = await readAllEntries(dirReader)
      const fileEntries = childEntries.filter(e => e.isFile)
      const dirEntries = childEntries.filter(e => e.isDirectory)

      const files = await Promise.all(fileEntries.map(e => getFileFromEntry(e)))

      for (const file of files) {
        const relativePath = `${newPrefix}/${file.name}`
        result.push({
          fileId: relativePath,
          file,
          relativePath,
          folderId: newDir.id,
          folderName: topFolderName,
          isDirectory: false,
          entry: null
        })
      }

      const subEntries = dirEntries.map(e => ({
        file: null,
        isDirectory: true,
        entry: e
      }))
      if (subEntries.length > 0) {
        const subItems = await flattenEntries(
          subEntries,
          newDir.id,
          client,
          driveId,
          newPrefix,
          topFolderName
        )
        result.push(...subItems)
      }
    } else if (!item.isDirectory) {
      result.push({
        fileId: item.file.name,
        file: item.file,
        relativePath: null,
        folderId: rootDirId,
        folderName: null,
        isDirectory: false,
        entry: null
      })
    }
  }

  return result
}

const cleanFilePath = filePath => {
  if (!filePath) return null
  const cleaned = filePath.startsWith('/') ? filePath.slice(1) : filePath
  return cleaned && cleaned.includes('/') ? cleaned : null
}

const makeFlatItem = (file, folderId) => ({
  fileId: file.name,
  file,
  relativePath: null,
  folderId,
  folderName: null,
  isDirectory: false,
  entry: null
})

const makeFolderItem = (file, cleanPath, folderId) => ({
  fileId: cleanPath,
  file,
  relativePath: cleanPath,
  folderId,
  folderName: cleanPath.split('/')[0],
  isDirectory: false,
  entry: null
})

/**
 * Flatten file entries using file.path (set by react-dropzone/file-selector).
 * Creates server-side folders based on the path structure.
 * file.path looks like "/fichiers/dossier 1/103.txt".
 */
export const flattenEntriesFromPaths = async (
  entries,
  rootDirId,
  client,
  driveId
) => {
  const folderCache = { '': rootDirId }

  const ensureFolder = async folderPath => {
    if (folderCache[folderPath] != null) {
      return folderCache[folderPath]
    }
    const lastSlash = folderPath.lastIndexOf('/')
    const parentPath = lastSlash > 0 ? folderPath.slice(0, lastSlash) : ''
    const name = lastSlash > 0 ? folderPath.slice(lastSlash + 1) : folderPath
    const parentId = await ensureFolder(parentPath)

    const folder = await createFolder(client, name, parentId, driveId)
    folderCache[folderPath] = folder.id
    return folder.id
  }

  const result = []
  for (const entry of entries) {
    if (!entry.file) continue

    const cleanPath = cleanFilePath(entry.file.path)
    if (!cleanPath) {
      result.push(makeFlatItem(entry.file, rootDirId))
    } else {
      const folderPath = cleanPath.slice(0, cleanPath.lastIndexOf('/'))
      const folderId = await ensureFolder(folderPath)
      result.push(makeFolderItem(entry.file, cleanPath, folderId))
    }
  }

  return result
}

const createFolder = async (client, name, dirID, driveId) => {
  try {
    const resp = await client
      .collection(DOCTYPE_FILES, { driveId })
      .createDirectory({ name, dirId: dirID })
    return resp.data
  } catch (error) {
    if (error.status === 409) {
      const parentResp = await client
        .collection(DOCTYPE_FILES, { driveId })
        .statById(dirID)
      const parentPath =
        parentResp.data.path || parentResp.data.attributes?.path
      const folderPath = `${parentPath}/${name}`
      const existingResp = await client
        .collection(DOCTYPE_FILES, { driveId })
        .statByPath(folderPath)
      return existingResp.data
    }
    throw error
  }
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

  // Check if running in a Chrome browser
  if (window.chrome) {
    // Convert file size to integer for comparison
    const fileSize = parseInt(file.size, 10)

    // Check if the file size exceeds the server's maximum payload size
    if (fileSize > MAX_PAYLOAD_SIZE) {
      // Create a new error for exceeding the maximum payload size
      // Match cozy-stack error format
      throw new Error(
        JSON.stringify({
          status: 413,
          title: 'Request Entity Too Large',
          detail: ERR_MAX_FILE_SIZE
        })
      )
    }

    // Proceed to check disk usage
    const { data: diskUsage } = await client
      .getStackClient()
      .fetchJSON('GET', '/settings/disk-usage')
    if (diskUsage.attributes.quota) {
      const usedSpace = parseInt(diskUsage.attributes.used, 10)
      const totalQuota = parseInt(diskUsage.attributes.quota, 10)
      const availableSpace = totalQuota - usedSpace

      if (fileSize > availableSpace) {
        const error = new Error('Insufficient Disk Space')
        error.status = 413
        throw error
      }
    }
  }

  const { onUploadProgress, encryptionKey, vaultClient } = options

  if (encryptionKey && vaultClient) {
    // TODO: use web worker
    const fr = new FileReader()
    fr.onloadend = async () => {
      return encryptAndUploadNewFile(client, vaultClient, {
        file: fr.result,
        encryptionKey,
        fileOptions: {
          name: file.name,
          dirID,
          onUploadProgress,
          driveId
        }
      })
    }
    fr.readAsArrayBuffer(file)
  } else {
    const resp = await client
      .collection(DOCTYPE_FILES, { driveId })
      .createFile(file, { dirId: dirID, onUploadProgress })

    return resp.data
  }
}

/*
 * @function
 * @param {Object} client - A CozyClient instance
 * @param {Object} file - The uploaded javascript File object
 * @param {string} path - The file's path in the cozy
 * @param {{onUploadProgress}} options
 * @param {string} driveId - The drive ID for shared drives
 * @return {Object} - The updated io.cozy.files
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
  const { id: fileId, dir_id: dirId } = statResp.data
  const resp = await client
    .collection(DOCTYPE_FILES, { driveId })
    .updateFile(file, { dirId, fileId, options })

  return resp.data
}

/**
 * Build preliminary queue items from raw entries for immediate display.
 * Extracts relativePath from file.path when available and creates
 * placeholder items for dropped directories while their contents are resolved.
 */
const buildPreliminaryItems = (entries, dirID) =>
  entries
    .map(e => {
      if (e.file) {
        const filePath = e.file.path || ''
        const cleanPath = filePath.startsWith('/')
          ? filePath.slice(1)
          : filePath
        const hasPath = cleanPath && cleanPath.includes('/')
        return {
          fileId: hasPath ? cleanPath : e.file.name,
          file: e.file,
          relativePath: hasPath ? cleanPath : null,
          folderId: dirID,
          folderName: hasPath ? cleanPath.split('/')[0] : null,
          isDirectory: false,
          entry: null
        }
      }

      if (e.entry?.isDirectory) {
        const entryPath = e.entry.fullPath || e.entry.name || ''
        const cleanPath = entryPath.startsWith('/')
          ? entryPath.slice(1)
          : entryPath

        return {
          fileId: cleanPath || e.entry.name,
          file: null,
          relativePath: cleanPath || null,
          folderId: dirID,
          folderName: cleanPath
            ? cleanPath.split('/')[0]
            : e.entry.name || null,
          isDirectory: true,
          entry: e.entry
        }
      }

      return null
    })
    .filter(Boolean)

/**
 * Resolve folder structure server-side and return updated queue items.
 * Uses file.path (react-dropzone) or FileSystemEntry (react-dnd).
 */
const resolveServerFolders = async (entries, dirID, client, driveId) => {
  const hasFilePaths = entries.some(
    e => e.file?.path && e.file.path.includes('/')
  )
  if (hasFilePaths) {
    return flattenEntriesFromPaths(entries, dirID, client, driveId)
  }
  return flattenEntries(entries, dirID, client, driveId)
}

const hasFolderEntries = entries =>
  entries.some(e => e.file?.path && e.file.path.includes('/')) ||
  entries.some(e => e.isDirectory && e.entry)

const notifyFolderError = () => {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert('The folder upload could not be prepared. Please try again.')
  }
}

export const addToUploadQueue =
  (
    entries,
    dirID,
    sharingState,
    fileUploadedCallback,
    queueCompletedCallback,
    { client, vaultClient },
    driveId,
    addItems
  ) =>
  async dispatch => {
    dispatch({
      type: ADD_TO_UPLOAD_QUEUE,
      files: buildPreliminaryItems(entries, dirID)
    })

    if (hasFolderEntries(entries)) {
      try {
        const resolvedItems = await resolveServerFolders(
          entries,
          dirID,
          client,
          driveId
        )
        dispatch({ type: RESOLVE_FOLDER_ITEMS, resolvedItems })
      } catch (error) {
        logger.error(`Upload module: folder resolution failed: ${error}`)
        notifyFolderError()
        dispatch({ type: PURGE_UPLOAD_QUEUE })
        return
      }
    }

    dispatch(
      processNextFile(
        fileUploadedCallback,
        queueCompletedCallback,
        dirID,
        sharingState,
        { client, vaultClient },
        driveId,
        addItems
      )
    )
  }

export const purgeUploadQueue = () => ({ type: PURGE_UPLOAD_QUEUE })

export const onQueueEmpty = callback => (dispatch, getState) => {
  const safeCallback = ensureCallback(callback)
  const queue = getUploadQueue(getState())
  const quotas = getQuotaErrors(queue)
  const conflicts = getConflicts(queue)
  const created = getCreated(queue)
  const updated = getUpdated(queue)
  const networkErrors = getNetworkErrors(queue)
  const errors = getErrors(queue)
  const fileTooLargeErrors = getfileTooLargeErrors(queue)

  // Extract complete uploaded items (with _id) from the queue
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
const getCreated = queue => filterByStatus(queue, CREATED)
const getUpdated = queue => filterByStatus(queue, UPDATED)
const getfileTooLargeErrors = queue => filterByStatus(queue, ERR_MAX_FILE_SIZE)

export const getUploadQueue = state => state[SLUG].queue

export const getProcessed = state =>
  getUploadQueue(state).filter(f => f.status !== PENDING)

export const getSuccessful = state => {
  const queue = getUploadQueue(state)
  return queue.filter(f => [CREATED, UPDATED].includes(f.status))
}

export const selectors = {
  getConflicts,
  getErrors,
  getQuotaErrors,
  getNetworkErrors,
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
    const entry = item.webkitGetAsEntry?.()
    if (entry) {
      results.push({
        file: item.getAsFile(),
        fileId: entry.fullPath,
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
