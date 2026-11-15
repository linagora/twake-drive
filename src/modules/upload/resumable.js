import flag from 'cozy-flags'
import { normalizeDoc } from 'cozy-stack-client'

import { DOCTYPE_FILES } from '@/lib/doctypes'
import logger from '@/lib/logger'

// Resumable uploads of cozy-stack (draft-ietf-httpbis-resumable-upload).
// A browser does not see the 104 interim response, so the upload is created
// empty with `Upload-Complete: ?0`, then the content is sent with PATCH.

const INTEROP_VERSION = '10'
// A file over it is sent with a resumable upload, created with
// `Upload-Complete: ?0` whatever its size, so that the stack does not take a
// file under its part size for a usual upload. The
// drive.resumable-upload.min-size flag, in bytes, overrides it.
export const RESUMABLE_MIN_SIZE = 5 * 1024 * 1024
const CAPABILITY = 'resumable_uploads'
const MAX_RETRIES = 8
const MAX_RETRY_DELAY = 30000
// Time given to a request without any byte moving before it is cut
const STALL_TIMEOUT = 30000

export const resumableStatus = {
  UPLOADING: 'uploading',
  PAUSED: 'paused',
  OFFLINE: 'offline',
  RETRYING: 'retrying',
  GONE: 'gone'
}
const { UPLOADING, PAUSED, OFFLINE, RETRYING, GONE } = resumableStatus
const PARKED = [PAUSED, GONE]

export const UPLOAD_CANCELLED = 'UploadCancelledError'

const uploads = new Map()

/**
 * @param {string} key - Upload queue id of the file
 * @returns {{pause: Function, resume: Function, cancel: Function}|null}
 */
export const findResumableUpload = key => uploads.get(key) ?? null

const isEnabled = client =>
  Boolean(flag('drive.resumable-upload.enabled')) &&
  client.capabilities?.[CAPABILITY] === true

// The stack imports a note when it is created, before any content arrives
const isNote = file => file.name.endsWith('.cozy-note')

export const isResumableUpload = (client, file) =>
  isEnabled(client) &&
  !isNote(file) &&
  file.size > (flag('drive.resumable-upload.min-size') ?? RESUMABLE_MIN_SIZE)

const makeHttpError = (status, isFinal, message) => {
  const error = new Error(message || `HTTP ${status}`)
  error.status = status
  // A response with `Upload-Complete: ?1` is the final answer for the upload.
  error.isFinal = isFinal
  return error
}

// An expired token is a 400, and a HEAD response has no body to tell it apart
const isTokenError = error => error.status === 400 || error.status === 401

// The message of a fetch cut by the network, which the upload queue looks for
const NETWORK_ERROR = 'Failed to fetch'

const isRetryable = error =>
  !error.status ||
  error.status >= 500 ||
  error.status === 408 ||
  error.status === 429

const canRetry = error => error.status === 409 || isRetryable(error)

// The stack asks for a usual upload: too many uploads in progress (429), or no
// resumable upload for this request (501)
const USUAL_UPLOAD_STATUSES = [429, 501]

// A refused creation is final, unless the stack asks for a retry, a new token
// or a usual upload. A creation that times out may exist on the stack with a
// Location the client never saw: a usual upload leaves at most this one behind.
const handleCreationError = error => {
  if (USUAL_UPLOAD_STATUSES.includes(error.status)) return null
  if (error.name === 'TimeoutError') return null
  error.isFinal = !isRetryable(error) && !isTokenError(error)
  throw error
}

// A failed refresh lets the next round give up on the same error
const refreshToken = async stack => {
  try {
    await stack.refreshToken()
  } catch (error) {
    logger.warn(`Resumable upload cannot refresh its token: ${error}`)
  }
}

// A browser can leave a request pending when a proxy closes its connection
// while the body is still sent: a body that stops moving is cut, then resumed
// from the offset of the stack. Once the body is sent, the stack may take long
// to answer for a large file.
const cutWhenStalled = xhr => {
  let timer = null
  const arm = () => {
    clearTimeout(timer)
    timer = setTimeout(() => xhr.abort(), STALL_TIMEOUT)
  }
  const disarm = () => clearTimeout(timer)
  xhr.upload.addEventListener('progress', arm)
  xhr.upload.addEventListener('loadend', disarm)
  xhr.addEventListener('loadend', disarm)
  arm()
}

const normalizeFile = doc => ({
  ...normalizeDoc(doc, DOCTYPE_FILES),
  ...doc.attributes,
  _rev: doc.meta?.rev
})

const makeUploadPath = (driveId, id, file, name) => {
  const prefix = driveId
    ? `/sharings/drives/${encodeURIComponent(driveId)}`
    : '/files'
  const query = new URLSearchParams({ Name: name.trim(), Type: 'file' })
  if (file.lastModified) {
    const date = new Date(file.lastModified).toISOString()
    query.set('UpdatedAt', date)
    query.set('CreatedAt', date)
  }
  return `${prefix}/${encodeURIComponent(id)}?${query}`
}

const waitFor = (ms, setWake) =>
  new Promise(resolve => {
    const done = () => {
      clearTimeout(timer)
      window.removeEventListener('online', done)
      resolve()
    }
    const timer = ms === null ? null : setTimeout(done, ms)
    window.addEventListener('online', done)
    setWake(done)
  })

/**
 * Send a file with a resumable upload. The upload goes on after a network
 * cut, and can be paused, resumed and cancelled through
 * {@link findResumableUpload}.
 *
 * @returns {Promise<{data: object}|null>} The file, or null when the stack asks
 *   for a usual upload
 */
export const sendResumableFile = async (
  client,
  file,
  path,
  method,
  { onUploadProgress, resumableKey, onResumableStatus } = {}
) => {
  const stack = client.getStackClient()
  const protocolHeaders = { 'Upload-Draft-Interop-Version': INTEROP_VERSION }
  let status = UPLOADING
  let cancelled = false
  let location = null
  let xhr = null
  let retries = 0
  let refreshed = false
  let wake = () => {}

  const setStatus = next => {
    status = next
    onResumableStatus?.(next)
  }

  const create = async () => {
    try {
      const resp = await stack.fetch(method, path, '', {
        throwFetchErrors: true,
        signal: AbortSignal.timeout(STALL_TIMEOUT),
        headers: {
          ...protocolHeaders,
          'Content-Type': file.type || 'application/octet-stream',
          'Upload-Complete': '?0',
          'Upload-Length': String(file.size)
        }
      })
      return resp.headers.get('Location')
    } catch (error) {
      return handleCreationError(error)
    }
  }

  const fetchOffset = async () => {
    // Without it, a 404 would give an offset of 0 instead of the expiry
    const resp = await stack.fetch('HEAD', location, undefined, {
      throwFetchErrors: true,
      signal: AbortSignal.timeout(STALL_TIMEOUT),
      headers: protocolHeaders
    })
    return Number(resp.headers.get('Upload-Offset'))
  }

  const append = offset =>
    new Promise((resolve, reject) => {
      xhr = new XMLHttpRequest()
      xhr.open('PATCH', stack.fullpath(location))
      xhr.withCredentials = true
      const headers = {
        ...protocolHeaders,
        Authorization: stack.getAuthorizationHeader(),
        'Content-Type': 'application/partial-upload',
        'Upload-Offset': String(offset),
        'Upload-Complete': '?1'
      }
      for (const [name, value] of Object.entries(headers)) {
        xhr.setRequestHeader(name, value)
      }
      xhr.upload.onprogress = event => {
        retries = 0
        refreshed = false
        onUploadProgress?.({ loaded: offset + event.loaded, total: file.size })
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ data: normalizeFile(JSON.parse(xhr.responseText).data) })
        } else {
          const isFinal = xhr.getResponseHeader('Upload-Complete') === '?1'
          reject(makeHttpError(xhr.status, isFinal, xhr.responseText))
        }
      }
      xhr.onerror = xhr.onabort = () =>
        reject(makeHttpError(0, false, NETWORK_ERROR))
      cutWhenStalled(xhr)
      xhr.send(file.slice(offset))
    })

  const deleteUpload = async () => {
    if (location) await stack.fetch('DELETE', location).catch(() => null)
  }

  const waitBeforeRetry = async error => {
    setStatus(error.status ? RETRYING : OFFLINE)
    await waitFor(
      navigator.onLine ? Math.min(1000 * 2 ** retries, MAX_RETRY_DELAY) : null,
      fn => (wake = fn)
    )
    if (status === OFFLINE || status === RETRYING) setStatus(UPLOADING)
  }

  // Retries are not counted while the browser is offline
  const hasRetriesLeft = () => !navigator.onLine || retries++ < MAX_RETRIES

  const needsNewToken = error => isTokenError(error) && !refreshed

  const mustGiveUp = error => !canRetry(error) || !hasRetriesLeft()

  const giveUp = async error => {
    // Without it, the upload would hold its storage and its place in the
    // limit of uploads in progress until it expires.
    await deleteUpload()
    throw error
  }

  // Expired, cancelled elsewhere, or removed by a storage migration
  const expire = () => {
    location = null
    setStatus(GONE)
  }

  const refreshOnce = async () => {
    refreshed = true
    await refreshToken(stack)
  }

  // Prepares the next round after a failed one, or throws to give up
  const recover = async error => {
    if (error.isFinal) throw error
    if (error.status === 404) return expire()
    if (needsNewToken(error)) return refreshOnce()
    if (mustGiveUp(error)) return giveUp(error)
    // Offset mismatch or another request took the upload over: the HEAD of
    // the next round gives the offset to resume from, with no delay.
    if (error.status !== 409) await waitBeforeRetry(error)
  }

  const controller = {
    pause: () => {
      if (![UPLOADING, OFFLINE, RETRYING].includes(status)) return
      setStatus(PAUSED)
      xhr?.abort()
      wake()
    },
    resume: () => {
      if (!PARKED.includes(status)) return
      setStatus(UPLOADING)
      wake()
    },
    cancel: () => {
      cancelled = true
      xhr?.abort()
      wake()
    }
  }

  // A request cut by a lost network can hang instead of failing
  const onOffline = () => xhr?.abort()
  window.addEventListener('offline', onOffline)
  uploads.set(resumableKey, controller)
  setStatus(UPLOADING)
  try {
    for (;;) {
      if (cancelled) {
        await deleteUpload()
        const error = new Error('Upload cancelled')
        error.name = UPLOAD_CANCELLED
        throw error
      }
      if (PARKED.includes(status)) {
        await waitFor(null, fn => (wake = fn))
        continue
      }
      try {
        let offset = 0
        if (location) {
          offset = await fetchOffset()
        } else {
          location = await create()
          if (!location) return null
        }
        if (cancelled || status === PAUSED) continue
        if (!navigator.onLine) throw makeHttpError(0, false, NETWORK_ERROR)
        return await append(offset)
      } catch (error) {
        if (!cancelled && status !== PAUSED) await recover(error)
      }
    }
  } finally {
    window.removeEventListener('offline', onOffline)
    uploads.delete(resumableKey)
  }
}

/**
 * Same as FileCollection.createFile, with a resumable upload when the stack
 * and the flag allow it.
 *
 * @returns {Promise<{ data: import('./conflictResolution').FileDoc }>}
 */
export const createFile = async (client, file, options = {}) => {
  const { dirId, driveId, resumableKey, onResumableStatus, ...uploadOptions } =
    options
  if (isResumableUpload(client, file)) {
    const path = makeUploadPath(driveId, dirId, file, options.name ?? file.name)
    const result = await sendResumableFile(client, file, path, 'POST', {
      onUploadProgress: options.onUploadProgress,
      resumableKey,
      onResumableStatus
    })
    if (result) return result
  }
  return client
    .collection(DOCTYPE_FILES, { driveId })
    .createFile(file, { dirId, ...uploadOptions })
}

/**
 * Same as FileCollection.updateFile, with a resumable upload when the stack
 * and the flag allow it.
 *
 * @returns {Promise<{ data: import('./conflictResolution').FileDoc }>}
 */
export const updateFile = async (client, file, options = {}) => {
  const { driveId, resumableKey, onResumableStatus, ...uploadOptions } = options
  if (isResumableUpload(client, file)) {
    const path = makeUploadPath(driveId, options.fileId, file, file.name)
    const result = await sendResumableFile(client, file, path, 'PUT', {
      onUploadProgress: options.onUploadProgress,
      resumableKey,
      onResumableStatus
    })
    if (result) return result
  }
  return client
    .collection(DOCTYPE_FILES, { driveId })
    .updateFile(file, uploadOptions)
}
