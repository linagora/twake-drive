import {
  processNextFile,
  selectors,
  queue,
  overwriteFile,
  uploadProgress,
  extractFilesEntries,
  exceedsFileLimit,
  flattenEntries,
  flattenEntriesFromPaths
} from './index'

import { getEncryptionKeyFromDirId } from '@/lib/encryption'
import logger from '@/lib/logger'
import { CozyFile } from '@/models'

jest.mock('cozy-doctypes')

jest.mock('lib/encryption', () => ({
  ...jest.requireActual('lib/encryption'),
  getEncryptionKeyFromDirId: jest.fn()
}))

const createFileSpy = jest.fn().mockName('createFile')
const statByPathSpy = jest.fn().mockName('statByPath')
const updateFileSpy = jest.fn().mockName('updateFile')
const fakeClient = {
  collection: () => ({
    createFile: createFileSpy,
    statByPath: statByPathSpy,
    updateFile: updateFileSpy
  }),
  query: jest.fn()
}
const fakeVaultClient = {
  encryptFile: jest.fn()
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

  beforeEach(() => {
    getEncryptionKeyFromDirId.mockResolvedValue(null)
  })

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
      { client: fakeClient, vaultClient: fakeVaultClient }
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
      updatedItems: [],
      fileTooLargeErrors: []
    })
  })

  it('should process files in the queue', async () => {
    const getState = () => ({
      upload: {
        queue: [
          {
            fileId: 'my-doc.odt',
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
      { client: fakeClient, vaultClient: fakeVaultClient }
    )
    await asyncProcess(dispatchSpy, getState)
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'UPLOAD_FILE',
      fileId: 'my-doc.odt',
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
            fileId: 'my-doc.odt',
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
      { client: fakeClient, vaultClient: fakeVaultClient }
    )
    await asyncProcess(dispatchSpy, getState)

    expect(dispatchSpy).toHaveBeenNthCalledWith(1, {
      type: 'UPLOAD_FILE',
      fileId: 'my-doc.odt',
      file
    })
    expect(createFileSpy).toHaveBeenCalledWith(file, {
      dirId: 'my-dir',
      onUploadProgress: expect.any(Function)
    })

    expect(updateFileSpy).toHaveBeenCalledWith(file, {
      dirId: 'my-dir',
      fileId: 'b552a167-1aa4',
      options: {
        onUploadProgress: expect.any(Function)
      }
    })

    expect(fileUploadedCallbackSpy).toHaveBeenCalledWith(file)

    expect(dispatchSpy).toHaveBeenNthCalledWith(2, {
      type: 'RECEIVE_UPLOAD_SUCCESS',
      fileId: 'my-doc.odt',
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
            fileId: 'my-doc.odt',
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
      { client: fakeClient, vaultClient: fakeVaultClient }
    )
    await asyncProcess(dispatchSpy, getState, { client: fakeClient })

    expect(fileUploadedCallbackSpy).not.toHaveBeenCalled()

    expect(dispatchSpy).toHaveBeenNthCalledWith(2, {
      fileId: 'my-doc.odt',
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
            fileId: 'my-doc.odt',
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
      { client: fakeClient, vaultClient: fakeVaultClient }
    )
    await asyncProcess(dispatchSpy, getState, { client: fakeClient })

    expect(fileUploadedCallbackSpy).not.toHaveBeenCalled()

    expect(dispatchSpy).toHaveBeenNthCalledWith(2, {
      fileId: 'my-doc.odt',
      file,
      status: 'quota',
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
  const state = [
    {
      fileId: 'doc1.odt',
      status: 'pending',
      file: {
        name: 'doc1.odt'
      },
      progress: null
    },
    {
      fileId: 'doc2.odt',
      status: 'pending',
      file: {
        name: 'doc2.odt'
      },
      progress: null
    },
    {
      fileId: 'doc3.odt',
      status: 'pending',
      file: {
        name: 'doc3.odt'
      },
      progress: null
    }
  ]
  it('should be empty (initial state)', () => {
    const result = queue(undefined, {})
    expect(result).toEqual([])
  })

  it('should update existing items and append new ones on RESOLVE_FOLDER_ITEMS', () => {
    const initialState = [
      {
        fileId: 'report.pdf',
        status: 'pending',
        file: { name: 'report.pdf' },
        progress: null
      }
    ]
    const action = {
      type: 'RESOLVE_FOLDER_ITEMS',
      resolvedItems: [
        {
          fileId: 'report.pdf',
          file: { name: 'report.pdf' },
          folderId: 'resolved-dir',
          relativePath: null
        },
        {
          fileId: 'photos/img.jpg',
          file: { name: 'img.jpg' },
          folderId: 'photos-dir',
          relativePath: 'photos/img.jpg'
        }
      ]
    }
    const result = queue(initialState, action)
    expect(result).toHaveLength(2)
    expect(result[0].folderId).toBe('resolved-dir')
    expect(result[1].fileId).toBe('photos/img.jpg')
    expect(result[1].status).toBe('pending')
  })

  it('should handle PURGE_UPLOAD_QUEUE action type', () => {
    const action = {
      type: 'PURGE_UPLOAD_QUEUE'
    }
    const state = [{ status: 'created', id: '1' }]
    const result = queue(state, action)
    expect(result).toEqual([])
  })

  it('should handle UPLOAD_FILE action type', () => {
    const action = {
      type: 'UPLOAD_FILE',
      fileId: 'doc1.odt',
      file: {
        name: 'doc1.odt'
      }
    }
    const expected = [
      {
        fileId: 'doc1.odt',
        status: 'loading',
        file: {
          name: 'doc1.odt'
        },
        progress: null
      },
      {
        fileId: 'doc2.odt',
        status: 'pending',
        file: {
          name: 'doc2.odt'
        },
        progress: null
      },
      {
        fileId: 'doc3.odt',
        status: 'pending',
        file: {
          name: 'doc3.odt'
        },
        progress: null
      }
    ]
    const result = queue(state, action)
    expect(result).toEqual(expected)
  })

  it('should handle RECEIVE_UPLOAD_SUCCESS action type', () => {
    const action = {
      type: 'RECEIVE_UPLOAD_SUCCESS',
      fileId: 'doc3.odt',
      file: {
        name: 'doc3.odt'
      },
      progress: null
    }
    const expected = [
      {
        fileId: 'doc1.odt',
        status: 'pending',
        file: {
          name: 'doc1.odt'
        },
        progress: null
      },
      {
        fileId: 'doc2.odt',
        status: 'pending',
        file: {
          name: 'doc2.odt'
        },
        progress: null
      },
      {
        fileId: 'doc3.odt',
        status: 'created',
        file: {
          name: 'doc3.odt'
        },
        progress: null
      }
    ]
    const result = queue(state, action)
    expect(result).toEqual(expected)
  })

  it('should handle RECEIVE_UPLOAD_SUCCESS action type (update)', () => {
    const action = {
      type: 'RECEIVE_UPLOAD_SUCCESS',
      fileId: 'doc3.odt',
      file: {
        name: 'doc3.odt'
      },
      isUpdate: true
    }
    const expected = [
      {
        fileId: 'doc1.odt',
        status: 'pending',
        file: {
          name: 'doc1.odt'
        },
        progress: null
      },
      {
        fileId: 'doc2.odt',
        status: 'pending',
        file: {
          name: 'doc2.odt'
        },
        progress: null
      },
      {
        fileId: 'doc3.odt',
        status: 'updated',
        file: {
          name: 'doc3.odt'
        },
        progress: null
      }
    ]
    const result = queue(state, action)
    expect(result).toEqual(expected)
  })

  it('should handle RECEIVE_UPLOAD_ERROR action type', () => {
    const action = {
      type: 'RECEIVE_UPLOAD_ERROR',
      fileId: 'doc2.odt',
      file: {
        name: 'doc2.odt'
      },
      status: 'conflict',
      progress: null
    }
    const expected = [
      {
        fileId: 'doc1.odt',
        status: 'pending',
        file: {
          name: 'doc1.odt'
        },
        progress: null
      },
      {
        fileId: 'doc2.odt',
        status: 'conflict',
        file: {
          name: 'doc2.odt'
        },
        progress: null
      },
      {
        fileId: 'doc3.odt',
        status: 'pending',
        file: {
          name: 'doc3.odt'
        },
        progress: null
      }
    ]
    const result = queue(state, action)
    expect(result).toEqual(expected)
  })

  it('should only update the targeted item when files share the same name', () => {
    const stateWithDuplicateNames = [
      {
        fileId: 'summer/photo.jpg',
        status: 'pending',
        file: { name: 'photo.jpg' },
        progress: null
      },
      {
        fileId: 'winter/photo.jpg',
        status: 'pending',
        file: { name: 'photo.jpg' },
        progress: null
      }
    ]
    const action = {
      type: 'UPLOAD_FILE',
      fileId: 'summer/photo.jpg',
      file: { name: 'photo.jpg' }
    }
    const result = queue(stateWithDuplicateNames, action)

    expect(result[0].status).toBe('loading')
    expect(result[1].status).toBe('pending')
  })

  it('should correctly track success for files with duplicate names', () => {
    const stateWithDuplicateNames = [
      {
        fileId: 'summer/photo.jpg',
        status: 'loading',
        file: { name: 'photo.jpg' },
        progress: null
      },
      {
        fileId: 'winter/photo.jpg',
        status: 'pending',
        file: { name: 'photo.jpg' },
        progress: null
      }
    ]
    const action = {
      type: 'RECEIVE_UPLOAD_SUCCESS',
      fileId: 'summer/photo.jpg',
      file: { name: 'photo.jpg' }
    }
    const result = queue(stateWithDuplicateNames, action)

    expect(result[0].status).toBe('created')
    expect(result[1].status).toBe('pending')
  })

  it('should correctly track errors for files with duplicate names', () => {
    const stateWithDuplicateNames = [
      {
        fileId: 'summer/photo.jpg',
        status: 'loading',
        file: { name: 'photo.jpg' },
        progress: null
      },
      {
        fileId: 'winter/photo.jpg',
        status: 'loading',
        file: { name: 'photo.jpg' },
        progress: null
      }
    ]
    const action = {
      type: 'RECEIVE_UPLOAD_ERROR',
      fileId: 'summer/photo.jpg',
      file: { name: 'photo.jpg' },
      status: 'failed'
    }
    const result = queue(stateWithDuplicateNames, action)

    expect(result[0].status).toBe('failed')
    expect(result[1].status).toBe('loading')
  })

  it('should fall back to file.name when action has no fileId (Flagship compat)', () => {
    const stateWithItems = [
      {
        fileId: 'my-doc.odt',
        status: 'loading',
        file: { name: 'my-doc.odt' },
        progress: null
      }
    ]
    const action = {
      type: 'RECEIVE_UPLOAD_SUCCESS',
      file: { name: 'my-doc.odt' }
    }
    const result = queue(stateWithItems, action)
    expect(result[0].status).toBe('created')
  })

  describe('progress action', () => {
    const file = {
      name: 'doc1.odt'
    }
    const fileId = 'doc1.odt'

    const date1 = 1000
    const date2 = 2000
    const event1 = { loaded: 100, total: 400 }
    const event2 = { loaded: 200, total: 400 }

    const expected = [
      {
        fileId: 'doc1.odt',
        status: 'pending',
        file: {
          name: 'doc1.odt'
        },
        progress: {
          lastUpdated: date1,
          remainingTime: null,
          speed: null,
          loaded: event1.loaded,
          total: event1.total
        }
      },
      {
        fileId: 'doc2.odt',
        status: 'pending',
        file: {
          name: 'doc2.odt'
        },
        progress: null
      },
      {
        fileId: 'doc3.odt',
        status: 'pending',
        file: {
          name: 'doc3.odt'
        },
        progress: null
      }
    ]

    it('should handle UPLOAD_PROGRESS', () => {
      const action = uploadProgress(fileId, file, event1, date1)
      const result = queue(state, action)
      expect(result).toEqual(expected)
    })

    it('should compute speed and remaining time', () => {
      const result = queue(state, uploadProgress(fileId, file, event1, date1))
      expect(result[0].progress.remainingTime).toBe(null)
      const result2 = queue(result, uploadProgress(fileId, file, event2, date2))
      expect(result2[0].progress).toEqual({
        lastUpdated: expect.any(Number),
        loaded: 200,
        remainingTime: 2,
        speed: 100,
        total: 400
      })
    })

    it('should handle upload error', () => {
      const result = queue(state, uploadProgress(fileId, file, event1, date1))
      const result2 = queue(result, uploadProgress(fileId, file, event2, date2))
      const result3 = queue(result2, {
        type: 'RECEIVE_UPLOAD_ERROR',
        fileId,
        file
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
    const fileEntry = { isFile: true, isDirectory: false, fullPath: '/a.txt' }
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
      fileId: '/a.txt',
      isDirectory: false,
      entry: fileEntry
    })
  })

  it('should extract DataTransferItem with directory entry', () => {
    const dirEntry = { isFile: false, isDirectory: true, fullPath: '/photos' }
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
      fileId: '/photos',
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

describe('flattenEntries (FileSystemEntry-based)', () => {
  const createDirSpy = jest.fn().mockName('createDirectory')
  const flattenClient = {
    collection: () => ({
      createDirectory: createDirSpy
    })
  }

  beforeEach(() => {
    createDirSpy.mockReset()
    createDirSpy.mockImplementation(({ name }) => ({
      data: { id: `dir-id-${name}`, name }
    }))
  })

  it('should flatten a single-level directory', async () => {
    const dirEntry = createMockDirEntry('photos', [
      createMockFileEntry('img1.jpg'),
      createMockFileEntry('img2.jpg')
    ])
    const entries = [{ file: null, isDirectory: true, entry: dirEntry }]

    const result = await flattenEntries(
      entries,
      'root-dir',
      flattenClient,
      null
    )

    expect(createDirSpy).toHaveBeenCalledWith({
      name: 'photos',
      dirId: 'root-dir'
    })
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      fileId: 'photos/img1.jpg',
      relativePath: 'photos/img1.jpg',
      folderId: 'dir-id-photos',
      folderName: 'photos'
    })
  })

  it('should flatten nested directories', async () => {
    const subDir = createMockDirEntry('2024', [createMockFileEntry('ski.jpg')])
    const topDir = createMockDirEntry('photos', [
      createMockFileEntry('beach.jpg'),
      subDir
    ])
    const entries = [{ file: null, isDirectory: true, entry: topDir }]

    const result = await flattenEntries(
      entries,
      'root-dir',
      flattenClient,
      null
    )

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      fileId: 'photos/beach.jpg',
      relativePath: 'photos/beach.jpg',
      folderId: 'dir-id-photos',
      folderName: 'photos'
    })
    expect(result[1]).toMatchObject({
      fileId: 'photos/2024/ski.jpg',
      relativePath: 'photos/2024/ski.jpg',
      folderId: 'dir-id-2024',
      folderName: 'photos'
    })
  })

  it('should handle empty directories', async () => {
    const emptyDir = createMockDirEntry('empty', [])
    const entries = [{ file: null, isDirectory: true, entry: emptyDir }]

    const result = await flattenEntries(
      entries,
      'root-dir',
      flattenClient,
      null
    )

    expect(createDirSpy).toHaveBeenCalledWith({
      name: 'empty',
      dirId: 'root-dir'
    })
    expect(result).toHaveLength(0)
  })
})

describe('flattenEntriesFromPaths (file.path-based)', () => {
  const createDirSpy = jest.fn().mockName('createDirectory')
  const pathClient = {
    collection: () => ({
      createDirectory: createDirSpy,
      statById: jest.fn().mockResolvedValue({ data: { path: '/root' } }),
      statByPath: jest.fn().mockImplementation(path => {
        const name = path.split('/').pop()
        return Promise.resolve({ data: { id: `existing-${name}` } })
      })
    })
  }

  beforeEach(() => {
    createDirSpy.mockReset()
    createDirSpy.mockImplementation(({ name }) => ({
      data: { id: `dir-id-${name}`, name }
    }))
  })

  it('should pass through flat files without creating folders', async () => {
    const file = new File(['a'], 'report.pdf')
    const entries = [{ file, isDirectory: false, entry: null }]

    const result = await flattenEntriesFromPaths(
      entries,
      'root-dir',
      pathClient,
      null
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      fileId: 'report.pdf',
      relativePath: null,
      folderId: 'root-dir',
      folderName: null
    })
    expect(createDirSpy).not.toHaveBeenCalled()
  })

  it('should create folders from file.path and set relativePath', async () => {
    const file1 = new File(['a'], '10.txt')
    Object.defineProperty(file1, 'path', { value: '/fichiers/10.txt' })
    const file2 = new File(['b'], '103.txt')
    Object.defineProperty(file2, 'path', {
      value: '/fichiers/dossier 1/103.txt'
    })
    const file3 = new File(['c'], '88.txt')
    Object.defineProperty(file3, 'path', {
      value: '/fichiers/dossier 1/sous dossier 1/88.txt'
    })

    const entries = [
      { file: file1, isDirectory: false, entry: null },
      { file: file2, isDirectory: false, entry: null },
      { file: file3, isDirectory: false, entry: null }
    ]

    const result = await flattenEntriesFromPaths(
      entries,
      'root-dir',
      pathClient,
      null
    )

    expect(createDirSpy).toHaveBeenCalledTimes(3)
    expect(createDirSpy).toHaveBeenCalledWith({
      name: 'fichiers',
      dirId: 'root-dir'
    })
    expect(createDirSpy).toHaveBeenCalledWith({
      name: 'dossier 1',
      dirId: 'dir-id-fichiers'
    })
    expect(createDirSpy).toHaveBeenCalledWith({
      name: 'sous dossier 1',
      dirId: 'dir-id-dossier 1'
    })

    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({
      fileId: 'fichiers/10.txt',
      relativePath: 'fichiers/10.txt',
      folderId: 'dir-id-fichiers',
      folderName: 'fichiers'
    })
    expect(result[1]).toMatchObject({
      fileId: 'fichiers/dossier 1/103.txt',
      relativePath: 'fichiers/dossier 1/103.txt',
      folderId: 'dir-id-dossier 1',
      folderName: 'fichiers'
    })
    expect(result[2]).toMatchObject({
      fileId: 'fichiers/dossier 1/sous dossier 1/88.txt',
      relativePath: 'fichiers/dossier 1/sous dossier 1/88.txt',
      folderId: 'dir-id-sous dossier 1',
      folderName: 'fichiers'
    })
  })

  it('should not create the same folder twice', async () => {
    const file1 = new File(['a'], 'a.txt')
    Object.defineProperty(file1, 'path', { value: '/photos/a.txt' })
    const file2 = new File(['b'], 'b.txt')
    Object.defineProperty(file2, 'path', { value: '/photos/b.txt' })

    const entries = [
      { file: file1, isDirectory: false, entry: null },
      { file: file2, isDirectory: false, entry: null }
    ]

    const result = await flattenEntriesFromPaths(
      entries,
      'root-dir',
      pathClient,
      null
    )

    expect(createDirSpy).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(2)
    expect(result[0].folderId).toBe('dir-id-photos')
    expect(result[1].folderId).toBe('dir-id-photos')
  })

  it('should handle 409 conflict when folder already exists', async () => {
    const conflictError = new Error('Conflict')
    conflictError.status = 409
    createDirSpy.mockRejectedValueOnce(conflictError)

    const file = new File(['a'], 'doc.txt')
    Object.defineProperty(file, 'path', {
      value: '/existing-folder/doc.txt'
    })

    const entries = [{ file, isDirectory: false, entry: null }]
    const result = await flattenEntriesFromPaths(
      entries,
      'root-dir',
      pathClient,
      null
    )

    expect(result).toHaveLength(1)
    expect(result[0].folderId).toBe('existing-existing-folder')
  })

  it('should handle file.path without leading slash', async () => {
    const file = new File(['a'], 'img.jpg')
    Object.defineProperty(file, 'path', { value: 'photos/img.jpg' })

    const entries = [{ file, isDirectory: false, entry: null }]
    const result = await flattenEntriesFromPaths(
      entries,
      'root-dir',
      pathClient,
      null
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      fileId: 'photos/img.jpg',
      relativePath: 'photos/img.jpg',
      folderId: 'dir-id-photos'
    })
  })
})

describe('overwriteFile function', () => {
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
    const result = await overwriteFile(fakeClient, file, '/parent/mydoc.odt')
    expect(updateFileSpy).toHaveBeenCalledWith(file, {
      dirId: '972bc693-f015',
      fileId: 'b7cb22be72d2',
      options: {}
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
