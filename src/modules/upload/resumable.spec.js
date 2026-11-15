import flag from 'cozy-flags'

import {
  RESUMABLE_MIN_SIZE,
  UPLOAD_CANCELLED,
  createFile,
  findResumableUpload,
  resumableStatus,
  sendResumableFile,
  updateFile
} from './resumable'

const KEY = 'queue-id'
const MiB = 1024 * 1024

const enableResumableUploads = (minSize = null) =>
  flag.mockImplementation(name => {
    if (name === 'drive.resumable-upload.enabled') return true
    if (name === 'drive.resumable-upload.min-size') return minSize
    return null
  })
const LOCATION = '/files/uploads/up1'
const fileJson = JSON.stringify({
  data: {
    type: 'io.cozy.files',
    id: 'file1',
    attributes: { name: 'big.bin' },
    meta: { rev: '1-a' }
  }
})

let xhrs
class FakeXHR extends EventTarget {
  constructor() {
    super()
    this.headers = {}
    this.upload = new EventTarget()
    this.responseHeaders = {}
    xhrs.push(this)
  }
  open(method, url) {
    this.method = method
    this.url = url
  }
  setRequestHeader(name, value) {
    this.headers[name] = value
  }
  send(body) {
    this.body = body
  }
  abort() {
    this.aborted = true
    this.onabort?.()
    this.dispatchEvent(new Event('loadend'))
  }
  getResponseHeader(name) {
    return this.responseHeaders[name] ?? null
  }
  respond(status, responseText = '', responseHeaders = {}) {
    this.status = status
    this.responseText = responseText
    this.responseHeaders = responseHeaders
    this.onload()
    this.dispatchEvent(new Event('loadend'))
  }
}

const fetchError = (status, headers = {}) => {
  const error = new Error(`HTTP ${status}`)
  error.status = status
  error.response = { headers: new Headers(headers) }
  return error
}

const response = headers => ({ headers: new Headers(headers) })

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

const setup = () => {
  const stack = {
    fetch: jest.fn(),
    fullpath: path => `https://alice.cozy.test${path}`,
    getAuthorizationHeader: () => 'Bearer token',
    refreshToken: jest.fn().mockResolvedValue(null)
  }
  const collection = {
    createFile: jest.fn().mockResolvedValue({ data: { id: 'classic' } })
  }
  const client = {
    capabilities: { resumable_uploads: true },
    getStackClient: () => stack,
    collection: jest.fn(() => collection)
  }
  return { client, stack, collection }
}

const file = new File(['0123456789'], 'big.bin', {
  type: 'application/octet-stream'
})

const start = (client, options = {}) => {
  const statuses = []
  const promise = sendResumableFile(
    client,
    file,
    '/files/dir?Name=big.bin',
    'POST',
    {
      resumableKey: KEY,
      onResumableStatus: status => statuses.push(status),
      ...options
    }
  )
  return { promise, statuses }
}

describe('sendResumableFile', () => {
  beforeEach(() => {
    xhrs = []
    global.XMLHttpRequest = FakeXHR
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true
    })
  })

  it('creates an empty upload, then sends the whole content with PATCH', async () => {
    const { client, stack } = setup()
    stack.fetch.mockResolvedValueOnce(response({ Location: LOCATION }))
    const progress = jest.fn()
    const { promise } = start(client, { onUploadProgress: progress })
    await flush()

    expect(stack.fetch).toHaveBeenCalledWith(
      'POST',
      '/files/dir?Name=big.bin',
      '',
      {
        throwFetchErrors: true,
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({
          'Upload-Complete': '?0',
          'Upload-Length': '10',
          'Upload-Draft-Interop-Version': '10'
        })
      }
    )
    const [patch] = xhrs
    expect(patch.method).toBe('PATCH')
    expect(patch.url).toBe(`https://alice.cozy.test${LOCATION}`)
    expect(patch.headers).toMatchObject({
      'Upload-Offset': '0',
      'Upload-Complete': '?1',
      'Content-Type': 'application/partial-upload',
      Authorization: 'Bearer token'
    })
    patch.upload.onprogress({ loaded: 4 })
    expect(progress).toHaveBeenCalledWith({ loaded: 4, total: 10 })
    patch.respond(201, fileJson, { 'Upload-Complete': '?1' })

    await expect(promise).resolves.toMatchObject({
      data: {
        _id: 'file1',
        _type: 'io.cozy.files',
        _rev: '1-a',
        name: 'big.bin'
      }
    })
    expect(findResumableUpload(KEY)).toBe(null)
  })

  it('pauses without cancelling, then resumes from the offset of the stack', async () => {
    const { client, stack } = setup()
    stack.fetch
      .mockResolvedValueOnce(response({ Location: LOCATION }))
      .mockResolvedValueOnce(response({ 'Upload-Offset': '6' }))
    const { promise, statuses } = start(client)
    await flush()

    findResumableUpload(KEY).pause()
    await flush()
    expect(statuses).toEqual([
      resumableStatus.UPLOADING,
      resumableStatus.PAUSED
    ])
    expect(stack.fetch).toHaveBeenCalledTimes(1)

    findResumableUpload(KEY).resume()
    await flush()
    expect(stack.fetch).toHaveBeenLastCalledWith('HEAD', LOCATION, undefined, {
      throwFetchErrors: true,
      signal: expect.any(AbortSignal),
      headers: { 'Upload-Draft-Interop-Version': '10' }
    })
    const resumed = xhrs[1]
    expect(resumed.headers['Upload-Offset']).toBe('6')
    expect(resumed.body.size).toBe(4)
    resumed.respond(201, fileJson, { 'Upload-Complete': '?1' })
    await expect(promise).resolves.toMatchObject({ data: { _id: 'file1' } })
  })

  it('waits for the network after a cut, then goes on from the offset', async () => {
    const { client, stack } = setup()
    stack.fetch
      .mockResolvedValueOnce(response({ Location: LOCATION }))
      .mockResolvedValueOnce(response({ 'Upload-Offset': '3' }))
    const { promise, statuses } = start(client)
    await flush()

    Object.defineProperty(navigator, 'onLine', { value: false })
    window.dispatchEvent(new Event('offline'))
    await flush()
    expect(statuses).toContain(resumableStatus.OFFLINE)
    expect(stack.fetch).toHaveBeenCalledTimes(1)

    Object.defineProperty(navigator, 'onLine', { value: true })
    window.dispatchEvent(new Event('online'))
    await flush()
    expect(xhrs[1].headers['Upload-Offset']).toBe('3')
    xhrs[1].respond(201, fileJson, { 'Upload-Complete': '?1' })
    await expect(promise).resolves.toMatchObject({ data: { _id: 'file1' } })
    expect(statuses[statuses.length - 1]).toBe(resumableStatus.UPLOADING)
  })

  it('does not send the content while the browser is offline', async () => {
    const { client, stack } = setup()
    stack.fetch
      .mockResolvedValueOnce(response({ Location: LOCATION }))
      .mockResolvedValueOnce(response({ 'Upload-Offset': '0' }))
    Object.defineProperty(navigator, 'onLine', { value: false })
    const { promise, statuses } = start(client)
    await flush()
    expect(xhrs).toHaveLength(0)
    expect(statuses).toContain(resumableStatus.OFFLINE)

    Object.defineProperty(navigator, 'onLine', { value: true })
    window.dispatchEvent(new Event('online'))
    await flush()
    xhrs[0].respond(201, fileJson, { 'Upload-Complete': '?1' })
    await expect(promise).resolves.toMatchObject({ data: { _id: 'file1' } })
  })

  it('tells when the upload has disappeared, and sends the file again on demand', async () => {
    const { client, stack } = setup()
    stack.fetch
      .mockResolvedValueOnce(response({ Location: LOCATION }))
      .mockRejectedValueOnce(fetchError(404))
      .mockResolvedValueOnce(response({ Location: '/files/uploads/up2' }))
    const { promise, statuses } = start(client)
    await flush()
    findResumableUpload(KEY).pause()
    await flush()
    findResumableUpload(KEY).resume()
    await flush()
    expect(statuses[statuses.length - 1]).toBe(resumableStatus.GONE)

    findResumableUpload(KEY).resume()
    await flush()
    expect(stack.fetch).toHaveBeenLastCalledWith(
      'POST',
      '/files/dir?Name=big.bin',
      '',
      expect.anything()
    )
    expect(xhrs[1].url).toBe('https://alice.cozy.test/files/uploads/up2')
    expect(xhrs[1].headers['Upload-Offset']).toBe('0')
    xhrs[1].respond(201, fileJson, { 'Upload-Complete': '?1' })
    await expect(promise).resolves.toMatchObject({ data: { _id: 'file1' } })
  })

  it('tells an expiry found by HEAD, with the error policy of the client', async () => {
    const { client, stack } = setup()
    // Like cozy-stack-client, which throws only when asked to
    stack.fetch.mockImplementation(async (method, path, body, options) => {
      if (method === 'POST') return response({ Location: LOCATION })
      const error = fetchError(404)
      if (options?.throwFetchErrors) throw error
      return { ok: false, status: 404, headers: new Headers({}) }
    })
    const { promise, statuses } = start(client)
    await flush()
    findResumableUpload(KEY).pause()
    await flush()
    findResumableUpload(KEY).resume()
    await flush()
    expect(statuses[statuses.length - 1]).toBe(resumableStatus.GONE)
    expect(xhrs).toHaveLength(1)
    findResumableUpload(KEY).cancel()
    await expect(promise).rejects.toMatchObject({ name: UPLOAD_CANCELLED })
  })

  it('cancels with DELETE', async () => {
    const { client, stack } = setup()
    stack.fetch
      .mockResolvedValueOnce(response({ Location: LOCATION }))
      .mockResolvedValueOnce(response({}))
    const { promise } = start(client)
    await flush()

    findResumableUpload(KEY).cancel()
    await expect(promise).rejects.toMatchObject({ name: UPLOAD_CANCELLED })
    expect(stack.fetch).toHaveBeenLastCalledWith('DELETE', LOCATION)
  })

  it('stops on a final error, so a name conflict reaches the conflict flow', async () => {
    const { client, stack } = setup()
    stack.fetch.mockResolvedValueOnce(response({ Location: LOCATION }))
    const { promise } = start(client)
    await flush()

    xhrs[0].respond(409, '{"errors":[]}', { 'Upload-Complete': '?1' })
    await expect(promise).rejects.toMatchObject({ status: 409 })
  })

  it('takes the offset again after an offset mismatch', async () => {
    const { client, stack } = setup()
    stack.fetch
      .mockResolvedValueOnce(response({ Location: LOCATION }))
      .mockResolvedValueOnce(response({ 'Upload-Offset': '8' }))
    const { promise } = start(client)
    await flush()

    xhrs[0].respond(409, '', { 'Upload-Complete': '?0' })
    await flush()
    expect(xhrs[1].headers['Upload-Offset']).toBe('8')
    xhrs[1].respond(201, fileJson, { 'Upload-Complete': '?1' })
    await expect(promise).resolves.toMatchObject({ data: { _id: 'file1' } })
  })

  it('retries a cut connection with a growing delay, from the offset', async () => {
    jest.useFakeTimers()
    try {
      const { client, stack } = setup()
      stack.fetch
        .mockResolvedValueOnce(response({ Location: LOCATION }))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(response({ 'Upload-Offset': '5' }))
      const { promise, statuses } = start(client)
      await jest.advanceTimersByTimeAsync(0)

      xhrs[0].onerror()
      await jest.advanceTimersByTimeAsync(0)
      expect(statuses[statuses.length - 1]).toBe(resumableStatus.OFFLINE)
      await jest.advanceTimersByTimeAsync(2000)
      expect(stack.fetch).toHaveBeenCalledTimes(2)
      expect(xhrs).toHaveLength(1)
      await jest.advanceTimersByTimeAsync(4000)
      expect(xhrs[1].headers['Upload-Offset']).toBe('5')
      xhrs[1].respond(201, fileJson, { 'Upload-Complete': '?1' })
      await expect(promise).resolves.toMatchObject({ data: { _id: 'file1' } })
    } finally {
      jest.useRealTimers()
    }
  })

  it('cuts a request whose body stops moving, then resumes from the stack', async () => {
    jest.useFakeTimers()
    try {
      const { client, stack } = setup()
      stack.fetch
        .mockResolvedValueOnce(response({ Location: LOCATION }))
        .mockResolvedValueOnce(response({ 'Upload-Offset': '7' }))
      const { promise } = start(client)
      await jest.advanceTimersByTimeAsync(0)

      await jest.advanceTimersByTimeAsync(20000)
      xhrs[0].upload.dispatchEvent(new Event('progress'))
      await jest.advanceTimersByTimeAsync(20000)
      expect(xhrs[0].aborted).toBeUndefined()
      await jest.advanceTimersByTimeAsync(10000)
      expect(xhrs[0].aborted).toBe(true)

      await jest.advanceTimersByTimeAsync(2000)
      expect(stack.fetch).toHaveBeenLastCalledWith(
        'HEAD',
        LOCATION,
        undefined,
        expect.anything()
      )
      expect(xhrs[1].headers['Upload-Offset']).toBe('7')
      xhrs[1].respond(201, fileJson, { 'Upload-Complete': '?1' })
      await expect(promise).resolves.toMatchObject({ data: { _id: 'file1' } })
    } finally {
      jest.useRealTimers()
    }
  })

  it('waits for the answer once the whole body is sent', async () => {
    jest.useFakeTimers()
    try {
      const { client, stack } = setup()
      stack.fetch.mockResolvedValueOnce(response({ Location: LOCATION }))
      const { promise } = start(client)
      await jest.advanceTimersByTimeAsync(0)
      xhrs[0].upload.dispatchEvent(new Event('loadend'))
      await jest.advanceTimersByTimeAsync(120000)
      expect(xhrs[0].aborted).toBeUndefined()
      xhrs[0].respond(201, fileJson, { 'Upload-Complete': '?1' })
      await expect(promise).resolves.toMatchObject({ data: { _id: 'file1' } })
    } finally {
      jest.useRealTimers()
    }
  })

  it('gives up after its retries, and deletes the upload on the stack', async () => {
    jest.useFakeTimers()
    try {
      const { client, stack } = setup()
      stack.fetch.mockImplementation(async method => {
        if (method === 'POST') return response({ Location: LOCATION })
        if (method === 'DELETE') return response({})
        throw new TypeError('Failed to fetch')
      })
      const { promise } = start(client)
      const outcome = expect(promise).rejects.toThrow(/Failed to fetch$/)
      await jest.advanceTimersByTimeAsync(0)
      xhrs[0].onerror()
      await jest.advanceTimersByTimeAsync(5 * 60 * 1000)
      await outcome
      expect(stack.fetch).toHaveBeenLastCalledWith('DELETE', LOCATION)
    } finally {
      jest.useRealTimers()
    }
  })

  it('tells a server error apart from a network cut', async () => {
    jest.useFakeTimers()
    try {
      const { client, stack } = setup()
      stack.fetch
        .mockResolvedValueOnce(response({ Location: LOCATION }))
        .mockResolvedValueOnce(response({ 'Upload-Offset': '0' }))
      const { promise, statuses } = start(client)
      await jest.advanceTimersByTimeAsync(0)
      xhrs[0].respond(503, 'Service Unavailable')
      await jest.advanceTimersByTimeAsync(0)
      expect(statuses[statuses.length - 1]).toBe(resumableStatus.RETRYING)
      expect(statuses).not.toContain(resumableStatus.OFFLINE)
      await jest.advanceTimersByTimeAsync(2000)
      xhrs[1].respond(201, fileJson, { 'Upload-Complete': '?1' })
      await expect(promise).resolves.toMatchObject({ data: { _id: 'file1' } })
    } finally {
      jest.useRealTimers()
    }
  })

  it('gives up on an error that cannot be retried, and deletes the upload', async () => {
    const { client, stack } = setup()
    stack.fetch
      .mockResolvedValueOnce(response({ Location: LOCATION }))
      .mockResolvedValueOnce(response({}))
    const { promise } = start(client)
    await flush()
    xhrs[0].respond(403, 'Forbidden')
    await expect(promise).rejects.toMatchObject({ status: 403 })
    expect(stack.fetch).toHaveBeenLastCalledWith('DELETE', LOCATION)
  })

  it('does not delete an upload that the stack has refused for good', async () => {
    const { client, stack } = setup()
    stack.fetch.mockResolvedValueOnce(response({ Location: LOCATION }))
    const { promise } = start(client)
    await flush()
    xhrs[0].respond(413, 'Too big', { 'Upload-Complete': '?1' })
    await expect(promise).rejects.toMatchObject({ status: 413 })
    expect(stack.fetch).not.toHaveBeenCalledWith('DELETE', LOCATION)
  })

  it('asks for a usual upload when the creation times out', async () => {
    const { client, stack } = setup()
    stack.fetch.mockRejectedValueOnce(
      new DOMException('The operation timed out', 'TimeoutError')
    )
    await expect(start(client).promise).resolves.toBe(null)
    expect(stack.fetch).toHaveBeenCalledTimes(1)
  })

  it('stops when the creation is refused', async () => {
    const { client, stack } = setup()
    stack.fetch.mockRejectedValueOnce(fetchError(404))
    await expect(start(client).promise).rejects.toMatchObject({ status: 404 })
  })

  it('refreshes an expired token once, then goes on', async () => {
    const { client, stack } = setup()
    stack.fetch
      .mockResolvedValueOnce(response({ Location: LOCATION }))
      .mockRejectedValueOnce(fetchError(400))
      .mockResolvedValueOnce(response({ 'Upload-Offset': '2' }))
    const { promise } = start(client)
    await flush()
    findResumableUpload(KEY).pause()
    await flush()
    findResumableUpload(KEY).resume()
    await flush()
    expect(stack.refreshToken).toHaveBeenCalledTimes(1)
    expect(xhrs[1].headers['Upload-Offset']).toBe('2')
    xhrs[1].respond(201, fileJson, { 'Upload-Complete': '?1' })
    await expect(promise).resolves.toMatchObject({ data: { _id: 'file1' } })
  })

  it.each([429, 501])(
    'asks for a usual upload when the stack answers %i to the creation',
    async status => {
      const { client, stack } = setup()
      stack.fetch.mockRejectedValueOnce(fetchError(status))
      await expect(start(client).promise).resolves.toBe(null)
    }
  )
})

describe('updateFile', () => {
  const bigFile = {
    name: 'big.bin',
    size: RESUMABLE_MIN_SIZE + 1,
    slice: () => new Blob(['content'])
  }

  beforeEach(() => {
    xhrs = []
    global.XMLHttpRequest = FakeXHR
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true
    })
  })

  afterEach(() => flag.mockReset())

  it('replaces a file in a shared drive through its routes', async () => {
    enableResumableUploads()
    const { client, stack } = setup()
    stack.fetch.mockResolvedValueOnce(response({ Location: LOCATION }))
    const promise = updateFile(client, bigFile, {
      fileId: 'f',
      driveId: 'drive1'
    })
    await flush()
    expect(stack.fetch).toHaveBeenCalledWith(
      'PUT',
      expect.stringMatching(/^\/sharings\/drives\/drive1\/f\?Name=big.bin/),
      '',
      expect.anything()
    )
    xhrs[0].respond(200, fileJson, { 'Upload-Complete': '?1' })
    await expect(promise).resolves.toMatchObject({ data: { _id: 'file1' } })
  })

  it('replaces a file of the instance with a resumable upload', async () => {
    enableResumableUploads()
    const { client, stack } = setup()
    stack.fetch.mockResolvedValueOnce(response({ Location: LOCATION }))
    const promise = updateFile(client, bigFile, { fileId: 'f' })
    await flush()
    expect(stack.fetch).toHaveBeenCalledWith(
      'PUT',
      expect.stringMatching(/^\/files\/f\?Name=big.bin/),
      '',
      expect.anything()
    )
    xhrs[0].respond(200, fileJson, { 'Upload-Complete': '?1' })
    await expect(promise).resolves.toMatchObject({ data: { _id: 'file1' } })
  })
})

describe('createFile', () => {
  const bigFile = { name: 'big.bin', size: RESUMABLE_MIN_SIZE + 1 }

  afterEach(() => flag.mockReset())

  it('uses the usual upload when the flag is off', async () => {
    const { client, collection } = setup()
    await createFile(client, bigFile, { dirId: 'dir' })
    expect(collection.createFile).toHaveBeenCalledWith(bigFile, {
      dirId: 'dir'
    })
  })

  it('uses the usual upload when the stack does not announce the capability', async () => {
    enableResumableUploads()
    const { client, collection } = setup()
    client.capabilities = {}
    await createFile(client, bigFile, { dirId: 'dir' })
    expect(collection.createFile).toHaveBeenCalled()
  })

  it('uses the usual upload for a file of 4 MiB', async () => {
    enableResumableUploads()
    const { client, collection, stack } = setup()
    await createFile(
      client,
      { name: 'small.bin', size: 4 * MiB },
      {
        dirId: 'dir'
      }
    )
    expect(collection.createFile).toHaveBeenCalled()
    expect(stack.fetch).not.toHaveBeenCalled()
  })

  it('creates a file of 6 MiB with an empty resumable upload', async () => {
    enableResumableUploads()
    const { client, collection, stack } = setup()
    stack.fetch.mockRejectedValueOnce(fetchError(429))
    await createFile(
      client,
      { name: 'medium.bin', size: 6 * MiB },
      {
        dirId: 'dir'
      }
    )
    expect(stack.fetch).toHaveBeenCalledWith(
      'POST',
      expect.stringMatching(/^\/files\/dir\?Name=medium.bin/),
      '',
      {
        throwFetchErrors: true,
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({
          'Upload-Complete': '?0',
          'Upload-Length': String(6 * MiB)
        })
      }
    )
    expect(collection.createFile).toHaveBeenCalled()
  })

  it('never sends a note with a resumable upload', async () => {
    enableResumableUploads()
    const { client, collection, stack } = setup()
    const note = { name: 'big.cozy-note', size: 6 * MiB }
    await createFile(client, note, { dirId: 'dir' })
    expect(stack.fetch).not.toHaveBeenCalled()
    expect(collection.createFile).toHaveBeenCalledWith(note, { dirId: 'dir' })
  })

  it('takes its threshold from the drive.resumable-upload.min-size flag', async () => {
    enableResumableUploads(8 * MiB)
    const { client, collection, stack } = setup()
    await createFile(
      client,
      { name: 'medium.bin', size: 6 * MiB },
      {
        dirId: 'dir'
      }
    )
    expect(stack.fetch).not.toHaveBeenCalled()
    expect(collection.createFile).toHaveBeenCalled()
  })

  it('falls back to the usual upload on 429, without the resumable options', async () => {
    enableResumableUploads()
    const { client, collection, stack } = setup()
    stack.fetch.mockRejectedValueOnce(fetchError(429))
    await createFile(client, bigFile, {
      dirId: 'dir',
      driveId: 'drive1',
      resumableKey: KEY,
      onResumableStatus: jest.fn()
    })
    expect(stack.fetch).toHaveBeenCalledWith(
      'POST',
      expect.stringMatching(/^\/sharings\/drives\/drive1\/dir\?Name=big.bin/),
      '',
      expect.anything()
    )
    expect(client.collection).toHaveBeenCalledWith('io.cozy.files', {
      driveId: 'drive1'
    })
    expect(collection.createFile).toHaveBeenCalledWith(bigFile, {
      dirId: 'dir'
    })
  })
})
