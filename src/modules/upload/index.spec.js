import {
  processNextFile,
  selectors,
  queue,
  overwriteFile,
  uploadProgress,
  extractFilesEntries,
  exceedsFileLimit,
  flattenEntries,
  addToUploadQueue,
  onQueueEmpty
} from './index'

import logger from '@/lib/logger'
import { CozyFile } from '@/models'

jest.mock('cozy-doctypes')

const createFileSpy = jest.fn().mockName('createFile')
const createDirectorySpy = jest.fn().mockName('createDirectory')
const statByPathSpy = jest.fn().mockName('statByPath')
const updateFileSpy = jest.fn().mockName('updateFile')
const fakeClient = {
  collection: () => ({
    createFile: createFileSpy,
    createDirectory: createDirectorySpy,
    statByPath: statByPathSpy,
    updateFile: updateFileSpy
  }),
  query: jest.fn()
}

CozyFile.getFullpath.mockResolvedValue('/my-dir/mydoc.odt')

describe('processNextFile function', () => {
  const fileUploadedCallbackSpy = jest.fn()
  const queueCompletedCallbackSpy = jest.fn()
  const dirId = 'my-dir'
  const dispatchSpy = jest.fn(x => x)
  const file = new File(['foo'], 'my-doc.odt')
  const sharingState = {
    sharedPaths: []
  }
  fakeClient.query.mockResolvedValueOnce(null)

  it('should handle an empty queue', async () => {
    const getState = () => ({
      upload: {
        queue: []
      }
    })
    const asyncProcess = processNextFile(
      fileUploadedCallbackSpy,
      queueCompletedCallbackSpy,
      dirId,
      sharingState,
      { client: fakeClient }
    )
    const result = await asyncProcess(dispatchSpy, getState, {
      client: fakeClient
    })
    result(dispatchSpy, getState)
    expect(queueCompletedCallbackSpy).toHaveBeenCalledWith({
      createdItems: [],
      quotas: [],
      conflicts: [],
      networkErrors: [],
      errors: [],
      unreadableErrors: [],
      updatedItems: [],
      fileTooLargeErrors: []
    })
  })

  it('should process files in the queue', async () => {
    const getState = () => ({
      upload: {
        queue: [
          {
            status: 'pending',
            file,
            entry: '',
            isDirectory: false
          }
        ]
      }
    })
    createFileSpy.mockResolvedValue({
      data: {
        file
      }
    })
    const asyncProcess = processNextFile(
      fileUploadedCallbackSpy,
      queueCompletedCallbackSpy,
      dirId,
      sharingState,
      { client: fakeClient }
    )
    await asyncProcess(dispatchSpy, getState)
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'UPLOAD_FILE',
      file
    })
    expect(createFileSpy).toHaveBeenCalledWith(file, {
      dirId: 'my-dir',
      onUploadProgress: expect.any(Function)
    })
  })

  it('should process a file in conflict', async () => {
    const getState = () => ({
      upload: {
        queue: [
          {
            status: 'pending',
            file,
            entry: '',
            isDirectory: false
          }
        ]
      }
    })
    createFileSpy.mockRejectedValue({
      status: 409,
      title: 'Conflict',
      detail: 'file already exists',
      source: {}
    })

    statByPathSpy.mockResolvedValue({
      data: {
        dir_id: 'my-dir',
        id: 'b552a167-1aa4'
      }
    })

    updateFileSpy.mockResolvedValue({ data: file })

    const asyncProcess = processNextFile(
      fileUploadedCallbackSpy,
      queueCompletedCallbackSpy,
      dirId,
      sharingState,
      { client: fakeClient }
    )
    await asyncProcess(dispatchSpy, getState)

    expect(dispatchSpy).toHaveBeenNthCalledWith(1, {
      type: 'UPLOAD_FILE',
      file
    })
    expect(createFileSpy).toHaveBeenCalledWith(file, {
      dirId: 'my-dir',
      onUploadProgress: expect.any(Function)
    })

    expect(updateFileSpy).toHaveBeenCalledWith(file, {
      fileId: 'b552a167-1aa4',
      onUploadProgress: expect.any(Function)
    })

    expect(fileUploadedCallbackSpy).toHaveBeenCalledWith(file)

    expect(dispatchSpy).toHaveBeenNthCalledWith(2, {
      type: 'RECEIVE_UPLOAD_SUCCESS',
      file,
      isUpdate: true,
      uploadedItem: file
    })
  })

  it('should handle an error during overwrite', async () => {
    logger.error = jest.fn()
    const getState = () => ({
      upload: {
        queue: [
          {
            status: 'pending',
            file,
            entry: '',
            isDirectory: false
          }
        ]
      }
    })
    createFileSpy.mockRejectedValue({
      status: 409,
      title: 'Conflict',
      detail: 'file already exists',
      source: {}
    })

    statByPathSpy.mockResolvedValue({
      data: {
        id: 'b552a167-1aa4'
      }
    })

    updateFileSpy.mockRejectedValue({ status: 413 })

    const asyncProcess = processNextFile(
      fileUploadedCallbackSpy,
      queueCompletedCallbackSpy,
      dirId,
      sharingState,
      { client: fakeClient }
    )
    await asyncProcess(dispatchSpy, getState, { client: fakeClient })

    expect(fileUploadedCallbackSpy).not.toHaveBeenCalled()

    expect(dispatchSpy).toHaveBeenNthCalledWith(2, {
      file,
      status: 'quota',
      type: 'RECEIVE_UPLOAD_ERROR'
    })
  })

  it('should handle an error during upload', async () => {
    logger.warn = jest.fn()
    const getState = () => ({
      upload: {
        queue: [
          {
            status: 'pending',
            file,
            entry: '',
            isDirectory: false
          }
        ]
      }
    })
    createFileSpy.mockRejectedValue({
      status: 413,
      title: 'QUOTA',
      detail: 'QUOTA',
      source: {}
    })

    const asyncProcess = processNextFile(
      fileUploadedCallbackSpy,
      queueCompletedCallbackSpy,
      dirId,
      sharingState,
      { client: fakeClient }
    )
    await asyncProcess(dispatchSpy, getState, { client: fakeClient })

    expect(fileUploadedCallbackSpy).not.toHaveBeenCalled()

    expect(dispatchSpy).toHaveBeenNthCalledWith(2, {
      file,
      status: 'quota',
      type: 'RECEIVE_UPLOAD_ERROR'
    })
  })

  it('should classify NotFoundError (browser FileSystem API) as unreadable', async () => {
    logger.warn = jest.fn()
    const getState = () => ({
      upload: {
        queue: [
          {
            status: 'pending',
            file,
            entry: '',
            isDirectory: false
          }
        ]
      }
    })
    const notFoundError = new Error(
      'A requested file or directory could not be found at the time an operation was processed.'
    )
    notFoundError.name = 'NotFoundError'
    createFileSpy.mockRejectedValue(notFoundError)

    const asyncProcess = processNextFile(
      fileUploadedCallbackSpy,
      queueCompletedCallbackSpy,
      dirId,
      sharingState,
      { client: fakeClient }
    )
    await asyncProcess(dispatchSpy, getState, { client: fakeClient })

    expect(fileUploadedCallbackSpy).not.toHaveBeenCalled()
    expect(dispatchSpy).toHaveBeenNthCalledWith(2, {
      file,
      status: 'unreadable',
      type: 'RECEIVE_UPLOAD_ERROR'
    })
  })
})

describe('selectors', () => {
  const queue = [
    { status: 'created' },
    { status: 'updated' },
    { status: 'conflict' },
    { status: 'failed' },
    { status: 'quota' },
    { status: 'network' },
    { status: 'pending' }
  ]

  describe('getCreated selector', () => {
    it('should return all uploaded items', () => {
      const result = selectors.getCreated(queue)
      expect(result).toEqual([
        {
          status: 'created'
        }
      ])
    })
  })

  describe('getUpdated selector', () => {
    it('should return all updated items', () => {
      const result = selectors.getUpdated(queue)
      expect(result).toEqual([
        {
          status: 'updated'
        }
      ])
    })
  })

  describe('getSuccessful selector', () => {
    it('should return all successful items', () => {
      const queue = [
        { id: '1', status: 'created' },
        { id: '2', status: 'quota' },
        { id: '3', status: 'conflict' },
        { id: '4', status: 'updated' },
        { id: '5', status: 'failed' },
        { id: '6', status: 'updated' }
      ]
      const state = {
        upload: {
          queue
        }
      }
      const result = selectors.getSuccessful(state)
      expect(result).toEqual([
        { id: '1', status: 'created' },
        { id: '4', status: 'updated' },
        { id: '6', status: 'updated' }
      ])
    })
  })
})

describe('queue reducer', () => {
  const buildItem = name => ({
    fileId: name,
    status: 'pending',
    file: { name },
    progress: null
  })
  const state = [
    buildItem('doc1.odt'),
    buildItem('doc2.odt'),
    buildItem('doc3.odt')
  ]
  it('should be empty (initial state)', () => {
    const result = queue(undefined, {})
    expect(result).toEqual([])
  })

  it('should handle PURGE_UPLOAD_QUEUE action type', () => {
    const action = {
      type: 'PURGE_UPLOAD_QUEUE'
    }
    const state = [{ status: 'created', id: '1' }]
    const result = queue(state, action)
    expect(result).toEqual([])
  })

  it('drops RESOLVE_FOLDER_ITEMS files when no placeholder remains in state', () => {
    const stateIn = [buildItem('unrelated.odt')]
    const result = queue(stateIn, {
      type: 'RESOLVE_FOLDER_ITEMS',
      placeholderIds: ['__pending_abc_0_photos__'],
      files: [
        { fileId: 'photos/a.jpg', file: { name: 'a.jpg' }, folderId: 'dir-1' }
      ]
    })
    // Same-reference return so connected components don't re-render.
    expect(result).toBe(stateIn)
  })

  it('replaces matched placeholders with files on RESOLVE_FOLDER_ITEMS', () => {
    const placeholder = {
      fileId: '__pending_abc_0_photos__',
      status: 'resolving',
      file: { name: 'photos' },
      progress: null
    }
    const result = queue([placeholder], {
      type: 'RESOLVE_FOLDER_ITEMS',
      placeholderIds: ['__pending_abc_0_photos__'],
      files: [
        { fileId: 'photos/a.jpg', file: { name: 'a.jpg' }, folderId: 'dir-1' }
      ]
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      fileId: 'photos/a.jpg',
      status: 'pending'
    })
  })

  it('should handle UPLOAD_FILE action type', () => {
    const action = {
      type: 'UPLOAD_FILE',
      fileId: 'doc1.odt'
    }
    const result = queue(state, action)
    expect(result[0]).toMatchObject({ fileId: 'doc1.odt', status: 'loading' })
    expect(result[1]).toMatchObject({ fileId: 'doc2.odt', status: 'pending' })
    expect(result[2]).toMatchObject({ fileId: 'doc3.odt', status: 'pending' })
  })

  it('should handle RECEIVE_UPLOAD_SUCCESS action type', () => {
    const action = {
      type: 'RECEIVE_UPLOAD_SUCCESS',
      fileId: 'doc3.odt'
    }
    const result = queue(state, action)
    expect(result[2]).toMatchObject({ fileId: 'doc3.odt', status: 'created' })
  })

  it('should handle RECEIVE_UPLOAD_SUCCESS action type (update)', () => {
    const action = {
      type: 'RECEIVE_UPLOAD_SUCCESS',
      fileId: 'doc3.odt',
      isUpdate: true
    }
    const result = queue(state, action)
    expect(result[2]).toMatchObject({ fileId: 'doc3.odt', status: 'updated' })
  })

  it('should handle RECEIVE_UPLOAD_ERROR action type', () => {
    const action = {
      type: 'RECEIVE_UPLOAD_ERROR',
      fileId: 'doc2.odt',
      status: 'conflict'
    }
    const result = queue(state, action)
    expect(result[1]).toMatchObject({ fileId: 'doc2.odt', status: 'conflict' })
  })

  describe('progress action', () => {
    const fileId = 'doc1.odt'
    const date1 = 1000
    const date2 = 2000
    const event1 = { loaded: 100, total: 400 }
    const event2 = { loaded: 200, total: 400 }

    it('should handle UPLOAD_PROGRESS', () => {
      const result = queue(state, uploadProgress(fileId, event1, date1))
      expect(result[0].progress).toEqual({
        lastUpdated: date1,
        remainingTime: null,
        speed: null,
        loaded: event1.loaded,
        total: event1.total
      })
      expect(result[1].progress).toBe(null)
    })

    it('should compute speed and remaining time', () => {
      const result = queue(state, uploadProgress(fileId, event1, date1))
      expect(result[0].progress.remainingTime).toBe(null)
      const result2 = queue(result, uploadProgress(fileId, event2, date2))
      expect(result2[0].progress).toEqual({
        lastUpdated: expect.any(Number),
        loaded: 200,
        remainingTime: 2,
        speed: 100,
        total: 400
      })
    })

    it('should handle upload error', () => {
      const result = queue(state, uploadProgress(fileId, event1, date1))
      const result2 = queue(result, uploadProgress(fileId, event2, date2))
      const result3 = queue(result2, {
        type: 'RECEIVE_UPLOAD_ERROR',
        fileId
      })
      expect(result3[0].progress).toEqual(null)
    })
  })
})

// Helpers to mock browser FileSystem API objects
const createMockFileEntry = (name, content = '') => ({
  isFile: true,
  isDirectory: false,
  name,
  file: resolve => resolve(new File([content], name))
})

const createMockDirEntry = (name, children) => ({
  isFile: false,
  isDirectory: true,
  name,
  createReader: () => {
    let read = false
    return {
      readEntries: resolve => {
        if (!read) {
          read = true
          resolve(children)
        } else {
          resolve([])
        }
      }
    }
  }
})

describe('extractFilesEntries', () => {
  it('should extract plain File objects', () => {
    const files = [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]
    const result = extractFilesEntries(files)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      file: files[0],
      isDirectory: false,
      entry: null
    })
  })

  it('should extract DataTransferItem with file entry', () => {
    const file = new File(['a'], 'a.txt')
    const fileEntry = { isFile: true, isDirectory: false }
    const items = [
      {
        webkitGetAsEntry: () => fileEntry,
        getAsFile: () => file
      }
    ]
    const result = extractFilesEntries(items)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      file,
      isDirectory: false,
      entry: fileEntry
    })
  })

  it('should extract DataTransferItem with directory entry', () => {
    const dirEntry = { isFile: false, isDirectory: true }
    const items = [
      {
        webkitGetAsEntry: () => dirEntry,
        getAsFile: () => null
      }
    ]
    const result = extractFilesEntries(items)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      file: null,
      isDirectory: true,
      entry: dirEntry
    })
  })

  it('should handle empty items', () => {
    const result = extractFilesEntries([])
    expect(result).toHaveLength(0)
  })
})

describe('exceedsFileLimit', () => {
  it('should return false when flat files are under the limit', async () => {
    const entries = [
      { file: new File(['a'], 'a.txt'), isDirectory: false, entry: null },
      { file: new File(['b'], 'b.txt'), isDirectory: false, entry: null },
      { file: new File(['c'], 'c.txt'), isDirectory: false, entry: null }
    ]
    expect(await exceedsFileLimit(entries, 500)).toBe(false)
  })

  it('should return false when total including directories is under the limit', async () => {
    const dirEntry = createMockDirEntry('photos', [
      createMockFileEntry('img1.jpg'),
      createMockFileEntry('img2.jpg')
    ])
    const entries = [
      { file: null, isDirectory: true, entry: dirEntry },
      { file: new File(['a'], 'doc.txt'), isDirectory: false, entry: null }
    ]
    expect(await exceedsFileLimit(entries, 500)).toBe(false)
  })

  it('should count files in nested directories', async () => {
    const subDir = createMockDirEntry('sub', [createMockFileEntry('deep.txt')])
    const topDir = createMockDirEntry('top', [
      createMockFileEntry('shallow.txt'),
      subDir
    ])
    const entries = [{ file: null, isDirectory: true, entry: topDir }]
    expect(await exceedsFileLimit(entries, 1)).toBe(true)
    expect(await exceedsFileLimit(entries, 2)).toBe(false)
  })

  it('should return false for empty directories', async () => {
    const emptyDir = createMockDirEntry('empty', [])
    const entries = [
      { file: null, isDirectory: true, entry: emptyDir },
      { file: new File(['a'], 'a.txt'), isDirectory: false, entry: null }
    ]
    expect(await exceedsFileLimit(entries, 500)).toBe(false)
  })

  it('should return false for empty entries', async () => {
    expect(await exceedsFileLimit([], 500)).toBe(false)
  })

  it('should return true when flat files alone exceed the limit', async () => {
    const entries = Array.from({ length: 600 }, (_, i) => ({
      file: new File([''], `file${i}.txt`),
      isDirectory: false,
      entry: null
    }))
    expect(await exceedsFileLimit(entries, 500)).toBe(true)
  })

  it('should return false when files across multiple directories are under the limit', async () => {
    const dir1 = createMockDirEntry(
      'dir1',
      Array.from({ length: 10 }, (_, i) => createMockFileEntry(`a${i}.txt`))
    )
    const dir2 = createMockDirEntry(
      'dir2',
      Array.from({ length: 15 }, (_, i) => createMockFileEntry(`b${i}.txt`))
    )
    const entries = [
      { file: null, isDirectory: true, entry: dir1 },
      { file: null, isDirectory: true, entry: dir2 },
      { file: new File([''], 'root.txt'), isDirectory: false, entry: null }
    ]
    expect(await exceedsFileLimit(entries, 500)).toBe(false)
  })

  it('should return true when cumulative count across directories exceeds the limit', async () => {
    const dir1 = createMockDirEntry(
      'dir1',
      Array.from({ length: 300 }, (_, i) => createMockFileEntry(`a${i}.txt`))
    )
    const dir2 = createMockDirEntry(
      'dir2',
      Array.from({ length: 300 }, (_, i) => createMockFileEntry(`b${i}.txt`))
    )
    const entries = [
      { file: null, isDirectory: true, entry: dir1 },
      { file: null, isDirectory: true, entry: dir2 }
    ]
    expect(await exceedsFileLimit(entries, 500)).toBe(true)
  })
})

describe('overwriteFile function', () => {
  beforeEach(() => {
    statByPathSpy.mockReset()
    updateFileSpy.mockReset()
  })
  it('should update the io.cozy.files', async () => {
    updateFileSpy.mockResolvedValue({
      data: {
        id: 'b7cb22be72d2',
        type: 'io.cozy.files',
        attributes: {
          type: 'file',
          name: 'mydoc.odt'
        }
      }
    })
    statByPathSpy.mockResolvedValue({
      data: {
        id: 'b7cb22be72d2',
        dir_id: '972bc693-f015'
      }
    })
    const file = new File([''], 'mydoc.odt')
    const onUploadProgress = jest.fn()
    const result = await overwriteFile(fakeClient, file, '/parent/mydoc.odt', {
      onUploadProgress
    })
    expect(updateFileSpy).toHaveBeenCalledWith(file, {
      fileId: 'b7cb22be72d2',
      onUploadProgress
    })
    expect(result).toEqual({
      id: 'b7cb22be72d2',
      type: 'io.cozy.files',
      attributes: {
        type: 'file',
        name: 'mydoc.odt'
      }
    })
  })
})

describe('flattenEntries', () => {
  beforeEach(() => {
    createDirectorySpy.mockReset()
    createFileSpy.mockReset()
    statByPathSpy.mockReset()
    updateFileSpy.mockReset()
    CozyFile.getFullpath.mockReset()
    createDirectorySpy.mockImplementation(async ({ name }) => ({
      data: { id: `dir-${name}`, name, type: 'directory' }
    }))
  })

  it('should flatten a dropped directory entry into per-file items with relative paths', async () => {
    const directoryEntry = createMockDirEntry('photos', [
      createMockFileEntry('img1.jpg'),
      createMockFileEntry('img2.jpg')
    ])
    const entries = [{ file: null, isDirectory: true, entry: directoryEntry }]

    const result = await flattenEntries(entries, 'root', fakeClient, null)

    expect(createDirectorySpy).toHaveBeenCalledWith({
      name: 'photos',
      dirId: 'root'
    })
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      fileId: 'photos/img1.jpg',
      relativePath: 'photos/img1.jpg',
      folderId: 'dir-photos'
    })
  })

  it('should reuse an existing folder when createDirectory returns 409', async () => {
    createDirectorySpy.mockReset()
    createDirectorySpy.mockRejectedValueOnce({ status: 409 })
    CozyFile.getFullpath.mockResolvedValueOnce('/root/photos')
    statByPathSpy.mockResolvedValueOnce({
      data: { type: 'directory', id: 'existing-photos' }
    })

    const directoryEntry = createMockDirEntry('photos', [
      createMockFileEntry('img.jpg')
    ])
    const entries = [{ file: null, isDirectory: true, entry: directoryEntry }]

    const result = await flattenEntries(entries, 'root', fakeClient, null)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      fileId: 'photos/img.jpg',
      relativePath: 'photos/img.jpg',
      folderId: 'existing-photos'
    })
  })

  it('should recurse into nested directories and carry the relative path', async () => {
    const innerDir = createMockDirEntry('2024', [
      createMockFileEntry('ski.jpg')
    ])
    const directoryEntry = createMockDirEntry('photos', [innerDir])
    const entries = [{ file: null, isDirectory: true, entry: directoryEntry }]

    const result = await flattenEntries(entries, 'root', fakeClient, null)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      fileId: 'photos/2024/ski.jpg',
      relativePath: 'photos/2024/ski.jpg',
      folderId: 'dir-2024'
    })
  })

  it('should place loose files under the root directory without a relative path', async () => {
    const plainFile = new File(['a'], 'note.txt')
    const entries = [{ file: plainFile, isDirectory: false, entry: null }]

    const result = await flattenEntries(entries, 'root', fakeClient, null)

    expect(createDirectorySpy).not.toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      fileId: 'note.txt',
      relativePath: null,
      folderId: 'root'
    })
  })

  it('should route react-dropzone File.path entries through the folder cache', async () => {
    const nested = new File(['a'], 'a.txt')
    nested.path = '/album/2024/a.txt'
    const loose = new File(['b'], 'b.txt')
    loose.path = '/b.txt'
    const entries = [
      { file: nested, isDirectory: false, entry: null },
      { file: loose, isDirectory: false, entry: null }
    ]

    const result = await flattenEntries(entries, 'root', fakeClient, null)

    expect(createDirectorySpy).toHaveBeenCalledTimes(2)
    expect(createDirectorySpy).toHaveBeenNthCalledWith(1, {
      name: 'album',
      dirId: 'root'
    })
    expect(createDirectorySpy).toHaveBeenNthCalledWith(2, {
      name: '2024',
      dirId: 'dir-album'
    })
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      fileId: 'album/2024/a.txt',
      relativePath: 'album/2024/a.txt',
      folderId: 'dir-2024'
    })
    expect(result[1]).toMatchObject({
      fileId: 'b.txt',
      relativePath: null,
      folderId: 'root'
    })
  })
})

describe('addToUploadQueue placeholder flow', () => {
  beforeEach(() => {
    createDirectorySpy.mockReset()
    createFileSpy.mockReset()
    statByPathSpy.mockReset()
    updateFileSpy.mockReset()
    CozyFile.getFullpath.mockReset()
    createDirectorySpy.mockImplementation(async ({ name }) => ({
      data: { id: `dir-${name}`, name, type: 'directory' }
    }))
  })

  const runThunk = async (
    thunk,
    getState = () => ({ upload: { queue: [] } })
  ) => {
    const dispatched = []
    const pending = []
    const dispatch = jest.fn(action => {
      dispatched.push(action)
      if (typeof action !== 'function') return undefined
      const result = action(dispatch, getState)
      if (result && typeof result.then === 'function') pending.push(result)
      return result
    })
    await thunk(dispatch, getState)
    // Awaited thunks may dispatch further thunks, so drain in a loop
    // until no new promises are queued.
    while (pending.length) await Promise.all(pending.splice(0))
    return dispatched.filter(a => typeof a !== 'function')
  }

  it('emits a placeholder for each top-level folder and replaces it after flatten', async () => {
    const directoryEntry = createMockDirEntry('photos', [
      createMockFileEntry('img1.jpg'),
      createMockFileEntry('img2.jpg')
    ])
    const entries = [{ file: null, isDirectory: true, entry: directoryEntry }]

    const actions = await runThunk(
      addToUploadQueue(
        entries,
        'root',
        {},
        () => null,
        () => null,
        { client: fakeClient },
        null,
        () => null
      )
    )

    const adds = actions.filter(a => a.type === 'ADD_TO_UPLOAD_QUEUE')
    const resolves = actions.filter(a => a.type === 'RESOLVE_FOLDER_ITEMS')
    expect(adds).toHaveLength(1)
    expect(adds[0].files).toEqual([
      expect.objectContaining({
        fileId: expect.stringMatching(/^__pending_.+_0_photos__$/),
        status: 'resolving'
      })
    ])
    expect(resolves).toHaveLength(1)
    expect(resolves[0].placeholderIds).toEqual([
      expect.stringMatching(/^__pending_.+_0_photos__$/)
    ])
    expect(resolves[0].files).toHaveLength(2)
    expect(resolves[0].files[0]).toMatchObject({
      fileId: expect.stringMatching(/^.+_photos\/img1\.jpg$/),
      relativePath: 'photos/img1.jpg'
    })
  })

  it('skips placeholders for plain file drops', async () => {
    const plainFile = new File(['a'], 'note.txt')
    const entries = [{ file: plainFile, isDirectory: false, entry: null }]

    const actions = await runThunk(
      addToUploadQueue(
        entries,
        'root',
        {},
        () => null,
        () => null,
        { client: fakeClient },
        null,
        () => null
      )
    )

    const types = actions.map(a => a.type)
    expect(types).toContain('ADD_TO_UPLOAD_QUEUE')
    expect(types).not.toContain('RESOLVE_FOLDER_ITEMS')
  })

  it('marks placeholders as failed if flatten throws', async () => {
    const directoryEntry = createMockDirEntry('photos', [
      createMockFileEntry('img.jpg')
    ])
    createDirectorySpy.mockReset()
    createDirectorySpy.mockRejectedValue(new Error('server down'))
    const entries = [{ file: null, isDirectory: true, entry: directoryEntry }]

    const actions = await runThunk(
      addToUploadQueue(
        entries,
        'root',
        {},
        () => null,
        () => null,
        { client: fakeClient },
        null,
        () => null
      )
    )

    const errors = actions.filter(a => a.type === 'RECEIVE_UPLOAD_ERROR')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      fileId: expect.stringMatching(/^__pending_.+_0_photos__$/),
      status: 'failed'
    })
    expect(actions.some(a => a.type === 'RESOLVE_FOLDER_ITEMS')).toBe(false)
  })

  it('marks placeholders as unreadable if flatten throws NotFoundError', async () => {
    const directoryEntry = createMockDirEntry('photos', [
      createMockFileEntry('img.jpg')
    ])
    createDirectorySpy.mockReset()
    const notFound = new Error('vanished')
    notFound.name = 'NotFoundError'
    createDirectorySpy.mockRejectedValue(notFound)
    const entries = [{ file: null, isDirectory: true, entry: directoryEntry }]

    const actions = await runThunk(
      addToUploadQueue(
        entries,
        'root',
        {},
        () => null,
        () => null,
        { client: fakeClient },
        null,
        () => null
      )
    )

    const errors = actions.filter(a => a.type === 'RECEIVE_UPLOAD_ERROR')
    expect(errors[0]).toMatchObject({
      fileId: expect.stringMatching(/^__pending_.+_0_photos__$/),
      status: 'unreadable'
    })
  })

  it('fails placeholders and invokes onLimitExceeded when limit hit', async () => {
    const directoryEntry = createMockDirEntry('photos', [
      createMockFileEntry('a.jpg'),
      createMockFileEntry('b.jpg'),
      createMockFileEntry('c.jpg')
    ])
    const entries = [{ file: null, isDirectory: true, entry: directoryEntry }]
    const onLimitExceeded = jest.fn()

    const actions = await runThunk(
      addToUploadQueue(
        entries,
        'root',
        {},
        () => null,
        () => null,
        { client: fakeClient, maxFileCount: 2, onLimitExceeded },
        null,
        () => null
      )
    )

    expect(onLimitExceeded).toHaveBeenCalledTimes(1)
    const errors = actions.filter(a => a.type === 'RECEIVE_UPLOAD_ERROR')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      fileId: expect.stringMatching(/^__pending_.+_0_photos__$/),
      status: 'failed'
    })
    // No flatten happened: no folders should have been created
    expect(createDirectorySpy).not.toHaveBeenCalled()
    expect(actions.some(a => a.type === 'RESOLVE_FOLDER_ITEMS')).toBe(false)
  })

  it('does not invoke onLimitExceeded when count is under the limit', async () => {
    const directoryEntry = createMockDirEntry('photos', [
      createMockFileEntry('a.jpg')
    ])
    const entries = [{ file: null, isDirectory: true, entry: directoryEntry }]
    const onLimitExceeded = jest.fn()

    const actions = await runThunk(
      addToUploadQueue(
        entries,
        'root',
        {},
        () => null,
        () => null,
        { client: fakeClient, maxFileCount: 100, onLimitExceeded },
        null,
        () => null
      )
    )

    expect(onLimitExceeded).not.toHaveBeenCalled()
    // Make sure the under-limit path actually proceeded with flatten
    // and didn't silently no-op.
    expect(createDirectorySpy).toHaveBeenCalled()
    expect(actions.some(a => a.type === 'RESOLVE_FOLDER_ITEMS')).toBe(true)
  })
})

describe('onQueueEmpty', () => {
  it('does not fire the callback while resolving placeholders are present', () => {
    const callback = jest.fn()
    const dispatch = jest.fn()
    const getState = () => ({
      upload: {
        queue: [{ fileId: '__pending_0_photos__', status: 'resolving' }]
      }
    })
    onQueueEmpty(callback)(dispatch, getState)
    expect(callback).not.toHaveBeenCalled()
  })

  it('fires the callback when no resolving placeholders remain', () => {
    const callback = jest.fn()
    const dispatch = jest.fn()
    const getState = () => ({
      upload: {
        queue: [
          { fileId: 'a.txt', status: 'created', uploadedItem: { _id: 'a' } }
        ]
      }
    })
    onQueueEmpty(callback)(dispatch, getState)
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        createdItems: [{ _id: 'a' }]
      })
    )
  })
})
