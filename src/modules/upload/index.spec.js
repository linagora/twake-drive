import {
  processNextFile,
  selectors,
  queue,
  overwriteFile,
  uploadProgress
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
      { client: fakeClient, vaultClient: fakeVaultClient }
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
      dirId: 'my-dir',
      fileId: 'b552a167-1aa4',
      options: {
        onUploadProgress: expect.any(Function)
      }
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
      { client: fakeClient, vaultClient: fakeVaultClient }
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
      { client: fakeClient, vaultClient: fakeVaultClient }
    )
    await asyncProcess(dispatchSpy, getState, { client: fakeClient })

    expect(fileUploadedCallbackSpy).not.toHaveBeenCalled()

    expect(dispatchSpy).toHaveBeenNthCalledWith(2, {
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
      status: 'pending',
      file: {
        name: 'doc1.odt'
      },
      progress: null
    },
    {
      status: 'pending',
      file: {
        name: 'doc2.odt'
      },
      progress: null
    },
    {
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
      file: {
        name: 'doc1.odt'
      }
    }
    const expected = [
      {
        status: 'loading',
        file: {
          name: 'doc1.odt'
        },
        progress: null
      },
      {
        status: 'pending',
        file: {
          name: 'doc2.odt'
        },
        progress: null
      },
      {
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
      file: {
        name: 'doc3.odt'
      },
      progress: null
    }
    const expected = [
      {
        status: 'pending',
        file: {
          name: 'doc1.odt'
        },
        progress: null
      },
      {
        status: 'pending',
        file: {
          name: 'doc2.odt'
        },
        progress: null
      },
      {
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
      file: {
        name: 'doc3.odt'
      },
      isUpdate: true
    }
    const expected = [
      {
        status: 'pending',
        file: {
          name: 'doc1.odt'
        },
        progress: null
      },
      {
        status: 'pending',
        file: {
          name: 'doc2.odt'
        },
        progress: null
      },
      {
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
      file: {
        name: 'doc2.odt'
      },
      status: 'conflict',
      progress: null
    }
    const expected = [
      {
        status: 'pending',
        file: {
          name: 'doc1.odt'
        },
        progress: null
      },
      {
        status: 'conflict',
        file: {
          name: 'doc2.odt'
        },
        progress: null
      },
      {
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

  describe('progress action', () => {
    const file = {
      name: 'doc1.odt'
    }

    const date1 = 1000
    const date2 = 2000
    const event1 = { loaded: 100, total: 400 }
    const event2 = { loaded: 200, total: 400 }

    const expected = [
      {
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
        status: 'pending',
        file: {
          name: 'doc2.odt'
        },
        progress: null
      },
      {
        status: 'pending',
        file: {
          name: 'doc3.odt'
        },
        progress: null
      }
    ]

    it('should handle UPLOAD_PROGRESS', () => {
      const action = uploadProgress(file, event1, date1)
      const result = queue(state, action)
      expect(result).toEqual(expected)
    })

    it('should compute speed and remaining time', () => {
      const result = queue(state, uploadProgress(file, event1, date1))
      expect(result[0].progress.remainingTime).toBe(null)
      const result2 = queue(result, uploadProgress(file, event2, date2))
      expect(result2[0].progress).toEqual({
        lastUpdated: expect.any(Number),
        loaded: 200,
        remainingTime: 2,
        speed: 100,
        total: 400
      })
    })

    it('should handle upload error', () => {
      const result = queue(state, uploadProgress(file, event1, date1))
      const result2 = queue(result, uploadProgress(file, event2, date2))
      const result3 = queue(result2, { type: 'RECEIVE_UPLOAD_ERROR', file })
      expect(result3[0].progress).toEqual(null)
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
