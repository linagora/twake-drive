import {
  processNextFile,
  selectors,
  queue,
  conflictStrategies as conflictStrategiesReducer,
  overwriteFile,
  uploadProgress,
  extractFilesEntries,
  exceedsFileLimit,
  flattenEntries,
  addToUploadQueue,
  onQueueEmpty,
  retryUploadConflicts,
  uploadConflictStrategies
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
  const getUploadState = (queueState, conflictStrategies = {}) => ({
    upload: {
      queue: queueState,
      conflictStrategies
    }
  })

  beforeEach(() => {
    createFileSpy.mockReset()
    createDirectorySpy.mockReset()
    statByPathSpy.mockReset()
    updateFileSpy.mockReset()
    dispatchSpy.mockClear()
    fileUploadedCallbackSpy.mockClear()
    queueCompletedCallbackSpy.mockClear()
    CozyFile.getFullpath.mockReset()
    CozyFile.getFullpath.mockResolvedValue('/my-dir/my-doc.odt')
    logger.error = jest.fn()
  })

  const startProcessQueue = (
    initialQueue,
    conflictStrategies = {},
    callbacks = {}
  ) => {
    let state = getUploadState(initialQueue, conflictStrategies)
    const actions = []
    const pending = []
    const dispatch = jest.fn(action => {
      actions.push(action)
      if (typeof action === 'function') {
        const result = action(dispatch, () => state)
        if (result && typeof result.then === 'function') pending.push(result)
        return result
      }
      state = {
        upload: {
          queue: queue(state.upload.queue, action),
          conflictStrategies: conflictStrategiesReducer(
            state.upload.conflictStrategies,
            action
          )
        }
      }
      return action
    })
    const start = () =>
      processNextFile(
        callbacks.fileUploadedCallback || fileUploadedCallbackSpy,
        callbacks.queueCompletedCallback || queueCompletedCallbackSpy,
        dirId,
        sharingState,
        { client: fakeClient },
        callbacks.driveId,
        callbacks.addItems,
        callbacks.onUploadConflict
      )(dispatch, () => state)
    const drainPending = async () => {
      while (pending.length) await Promise.all(pending.splice(0))
    }
    return {
      actions,
      dispatch,
      drainPending,
      getState: () => state,
      start
    }
  }

  const runProcessQueue = async (
    initialQueue,
    conflictStrategies = {},
    callbacks = {}
  ) => {
    const runner = startProcessQueue(
      initialQueue,
      conflictStrategies,
      callbacks
    )
    await runner.start()
    await runner.drainPending()
    return {
      actions: runner.actions.filter(a => typeof a !== 'function'),
      state: runner.getState()
    }
  }

  const waitForCreateFileCall = async expectedCallCount => {
    for (let i = 0; i < 20; i += 1) {
      if (createFileSpy.mock.calls.length >= expectedCallCount) return
      await Promise.resolve()
    }
    throw new Error(
      `Expected createFile to be called ${expectedCallCount} times`
    )
  }

  const makeDeferredRejection = () => {
    let rejectUpload
    const promise = new Promise((_resolve, reject) => {
      rejectUpload = reject
    })
    return { promise, reject: rejectUpload }
  }

  const makeQueueItem = ({
    fileId,
    uploadBatchId = 'batch-1',
    status = 'pending',
    file: itemFile = file,
    ...rest
  }) => ({
    fileId,
    uploadBatchId,
    status,
    file: itemFile,
    entry: '',
    isDirectory: false,
    ...rest
  })

  it('should handle an empty queue', async () => {
    const getState = () => getUploadState([])
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
    const getState = () =>
      getUploadState([makeQueueItem({ fileId: 'my-doc.odt' })])
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
      fileId: 'my-doc.odt',
      file
    })
    expect(createFileSpy).toHaveBeenCalledWith(file, {
      dirId: 'my-dir',
      onUploadProgress: expect.any(Function)
    })
  })

  it('should collect a file conflict and continue the queue', async () => {
    const secondFile = new File(['bar'], 'second-doc.odt')
    createFileSpy
      .mockRejectedValueOnce({
        status: 409,
        title: 'Conflict',
        detail: 'file already exists',
        source: {}
      })
      .mockResolvedValueOnce({
        data: { _id: 'second-file-id', name: 'second-doc.odt' }
      })
    statByPathSpy.mockResolvedValueOnce({
      data: {
        type: 'file',
        id: 'existing-file-id',
        name: 'my-doc.odt'
      }
    })

    const onUploadConflict = jest.fn()
    const { actions, state } = await runProcessQueue(
      [
        makeQueueItem({ fileId: 'batch-1_my-doc.odt' }),
        makeQueueItem({
          fileId: 'batch-1_second-doc.odt',
          file: secondFile
        })
      ],
      {},
      { onUploadConflict }
    )

    expect(updateFileSpy).not.toHaveBeenCalled()
    expect(actions.filter(a => a.type === 'RECEIVE_UPLOAD_CONFLICT')).toEqual([
      expect.objectContaining({
        fileId: 'batch-1_my-doc.odt',
        uploadBatchId: 'batch-1'
      })
    ])
    expect(onUploadConflict).toHaveBeenCalledWith({
      fileId: 'batch-1_my-doc.odt',
      uploadBatchId: 'batch-1'
    })
    expect(state.upload.queue).toEqual([
      expect.objectContaining({
        fileId: 'batch-1_my-doc.odt',
        status: 'conflict'
      }),
      expect.objectContaining({
        fileId: 'batch-1_second-doc.odt',
        status: 'created'
      })
    ])
    expect(fileUploadedCallbackSpy).toHaveBeenCalledWith({
      _id: 'second-file-id',
      name: 'second-doc.odt'
    })
  })

  it('should fail instead of waiting for a modal when conflict stat fails', async () => {
    createFileSpy.mockRejectedValueOnce({ status: 409 })
    statByPathSpy.mockRejectedValueOnce({ status: 500 })

    const onUploadConflict = jest.fn()
    const { actions, state } = await runProcessQueue(
      [makeQueueItem({ fileId: 'batch-1_my-doc.odt' })],
      {},
      { onUploadConflict }
    )

    expect(
      actions.filter(a => a.type === 'RECEIVE_UPLOAD_CONFLICT')
    ).toHaveLength(0)
    expect(onUploadConflict).not.toHaveBeenCalled()
    expect(state.upload.queue[0]).toMatchObject({
      fileId: 'batch-1_my-doc.odt',
      status: 'failed'
    })
    expect(queueCompletedCallbackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [
          expect.objectContaining({
            fileId: 'batch-1_my-doc.odt',
            status: 'failed'
          })
        ]
      })
    )
  })

  it('should collect multiple file conflicts in one upload pass', async () => {
    const secondFile = new File(['bar'], 'second-doc.odt')
    createFileSpy
      .mockRejectedValueOnce({ status: 409 })
      .mockRejectedValueOnce({ status: 409 })
    statByPathSpy
      .mockResolvedValueOnce({
        data: { type: 'file', id: 'existing-1', name: 'my-doc.odt' }
      })
      .mockResolvedValueOnce({
        data: { type: 'file', id: 'existing-2', name: 'second-doc.odt' }
      })

    const { actions, state } = await runProcessQueue([
      makeQueueItem({ fileId: 'batch-1_my-doc.odt' }),
      makeQueueItem({
        fileId: 'batch-1_second-doc.odt',
        file: secondFile
      })
    ])

    expect(
      actions.filter(a => a.type === 'RECEIVE_UPLOAD_CONFLICT')
    ).toHaveLength(2)
    expect(state.upload.queue).toEqual([
      expect.objectContaining({
        fileId: 'batch-1_my-doc.odt',
        status: 'conflict'
      }),
      expect.objectContaining({
        fileId: 'batch-1_second-doc.odt',
        status: 'conflict'
      })
    ])
    expect(fileUploadedCallbackSpy).not.toHaveBeenCalled()
  })

  it('should apply keep-both to a later 409 after the modal answer', async () => {
    const secondFile = new File(['bar'], 'second-doc.odt')
    const secondUpload = makeDeferredRejection()
    createFileSpy
      .mockRejectedValueOnce({ status: 409 })
      .mockImplementationOnce(() => secondUpload.promise)
      .mockResolvedValueOnce({
        data: { _id: 'second-renamed-id', name: 'second-doc (1).odt' }
      })
      .mockRejectedValueOnce({ status: 409 })
      .mockResolvedValueOnce({
        data: { _id: 'first-renamed-id', name: 'my-doc (1).odt' }
      })
    statByPathSpy
      .mockResolvedValueOnce({
        data: { type: 'file', id: 'existing-1', name: 'my-doc.odt' }
      })
      .mockResolvedValueOnce({
        data: { type: 'file', id: 'existing-2', name: 'second-doc.odt' }
      })
      .mockResolvedValueOnce({
        data: { type: 'file', id: 'existing-1', name: 'my-doc.odt' }
      })

    const onUploadConflict = jest.fn()
    const runner = startProcessQueue(
      [
        makeQueueItem({ fileId: 'batch-1_my-doc.odt' }),
        makeQueueItem({
          fileId: 'batch-1_second-doc.odt',
          file: secondFile
        })
      ],
      {},
      { onUploadConflict }
    )

    await runner.start()
    await waitForCreateFileCall(2)
    retryUploadConflicts(
      'batch-1',
      uploadConflictStrategies.KEEP_BOTH,
      fileUploadedCallbackSpy,
      queueCompletedCallbackSpy,
      dirId,
      sharingState,
      { client: fakeClient }
    )(runner.dispatch, runner.getState)
    secondUpload.reject({ status: 409 })
    await runner.drainPending()

    const actions = runner.actions.filter(a => typeof a !== 'function')
    expect(
      actions.filter(a => a.type === 'RECEIVE_UPLOAD_CONFLICT')
    ).toHaveLength(1)
    expect(onUploadConflict).toHaveBeenCalledTimes(1)
    expect(createFileSpy).toHaveBeenNthCalledWith(3, secondFile, {
      dirId: 'my-dir',
      name: 'second-doc (1).odt',
      onUploadProgress: expect.any(Function)
    })
    expect(runner.getState().upload.queue).toEqual([
      expect.objectContaining({
        fileId: 'batch-1_my-doc.odt',
        finalName: 'my-doc (1).odt',
        status: 'created'
      }),
      expect.objectContaining({
        fileId: 'batch-1_second-doc.odt',
        finalName: 'second-doc (1).odt',
        status: 'created'
      })
    ])
  })

  it('should apply cancel to a later 409 after the modal answer', async () => {
    const secondFile = new File(['bar'], 'second-doc.odt')
    const secondUpload = makeDeferredRejection()
    createFileSpy
      .mockRejectedValueOnce({ status: 409 })
      .mockImplementationOnce(() => secondUpload.promise)
    statByPathSpy
      .mockResolvedValueOnce({
        data: { type: 'file', id: 'existing-1', name: 'my-doc.odt' }
      })
      .mockResolvedValueOnce({
        data: { type: 'file', id: 'existing-2', name: 'second-doc.odt' }
      })

    const onUploadConflict = jest.fn()
    const runner = startProcessQueue(
      [
        makeQueueItem({ fileId: 'batch-1_my-doc.odt' }),
        makeQueueItem({
          fileId: 'batch-1_second-doc.odt',
          file: secondFile
        })
      ],
      {},
      { onUploadConflict }
    )

    await runner.start()
    await waitForCreateFileCall(2)
    retryUploadConflicts(
      'batch-1',
      uploadConflictStrategies.CANCEL,
      fileUploadedCallbackSpy,
      queueCompletedCallbackSpy,
      dirId,
      sharingState,
      { client: fakeClient }
    )(runner.dispatch, runner.getState)
    secondUpload.reject({ status: 409 })
    await runner.drainPending()

    const actions = runner.actions.filter(a => typeof a !== 'function')
    expect(
      actions.filter(a => a.type === 'RECEIVE_UPLOAD_CONFLICT')
    ).toHaveLength(1)
    expect(onUploadConflict).toHaveBeenCalledTimes(1)
    expect(createFileSpy).toHaveBeenCalledTimes(2)
    expect(runner.getState().upload.queue).toEqual([
      expect.objectContaining({
        fileId: 'batch-1_my-doc.odt',
        status: 'cancel'
      }),
      expect.objectContaining({
        fileId: 'batch-1_second-doc.odt',
        status: 'cancel'
      })
    ])
  })

  it('should fail instead of waiting for a modal when replace returns a raw 409', async () => {
    createFileSpy.mockRejectedValueOnce({ status: 409 })
    statByPathSpy.mockResolvedValueOnce({
      data: { type: 'file', id: 'existing-file-id', name: 'my-doc.odt' }
    })
    updateFileSpy.mockRejectedValueOnce({ status: 409 })

    const onUploadConflict = jest.fn()
    const { actions, state } = await runProcessQueue(
      [makeQueueItem({ fileId: 'batch-1_my-doc.odt' })],
      { 'batch-1': uploadConflictStrategies.REPLACE },
      { onUploadConflict }
    )

    expect(statByPathSpy).toHaveBeenCalledTimes(1)
    expect(
      actions.filter(a => a.type === 'RECEIVE_UPLOAD_CONFLICT')
    ).toHaveLength(0)
    expect(onUploadConflict).not.toHaveBeenCalled()
    expect(state.upload.queue[0]).toMatchObject({
      fileId: 'batch-1_my-doc.odt',
      status: 'failed'
    })
    expect(queueCompletedCallbackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [
          expect.objectContaining({
            fileId: 'batch-1_my-doc.odt',
            status: 'failed'
          })
        ]
      })
    )
  })

  it('should fail instead of waiting for a modal when the existing item type is unsupported', async () => {
    createFileSpy.mockRejectedValueOnce({ status: 409 })
    statByPathSpy.mockResolvedValueOnce({
      data: {
        type: 'shortcut',
        id: 'existing-shortcut-id',
        name: 'my-doc.odt'
      }
    })

    const onUploadConflict = jest.fn()
    const { actions, state } = await runProcessQueue(
      [makeQueueItem({ fileId: 'batch-1_my-doc.odt' })],
      {},
      { onUploadConflict }
    )

    expect(
      actions.filter(a => a.type === 'RECEIVE_UPLOAD_CONFLICT')
    ).toHaveLength(0)
    expect(onUploadConflict).not.toHaveBeenCalled()
    expect(state.upload.queue[0]).toMatchObject({
      fileId: 'batch-1_my-doc.odt',
      status: 'failed'
    })
    expect(queueCompletedCallbackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [
          expect.objectContaining({
            fileId: 'batch-1_my-doc.odt',
            status: 'failed'
          })
        ]
      })
    )
  })

  it('should update the displayed generated name on keep-both retries', async () => {
    createFileSpy
      .mockRejectedValueOnce({ status: 409 })
      .mockRejectedValueOnce({ status: 409 })
      .mockResolvedValueOnce({
        data: { _id: 'renamed-file-id', name: 'my-doc (2).odt' }
      })
    statByPathSpy.mockResolvedValueOnce({
      data: { type: 'file', id: 'existing-file-id', name: 'my-doc.odt' }
    })

    const { actions, state } = await runProcessQueue(
      [
        makeQueueItem({
          fileId: 'batch-1_docs/my-doc.odt',
          relativePath: 'docs/my-doc.odt',
          folderId: 'docs-dir-id'
        })
      ],
      { 'batch-1': uploadConflictStrategies.KEEP_BOTH }
    )

    expect(actions.filter(a => a.type === 'RECEIVE_UPLOAD_RENAMED')).toEqual([
      {
        type: 'RECEIVE_UPLOAD_RENAMED',
        fileId: 'batch-1_docs/my-doc.odt',
        relativePath: 'docs/my-doc (1).odt'
      },
      {
        type: 'RECEIVE_UPLOAD_RENAMED',
        fileId: 'batch-1_docs/my-doc.odt',
        relativePath: 'docs/my-doc (2).odt'
      }
    ])
    expect(createFileSpy).toHaveBeenNthCalledWith(3, file, {
      dirId: 'docs-dir-id',
      name: 'my-doc (2).odt',
      onUploadProgress: expect.any(Function)
    })
    expect(state.upload.queue[0]).toMatchObject({
      status: 'created',
      relativePath: 'docs/my-doc (2).odt',
      finalName: 'my-doc (2).odt'
    })
  })

  it('should handle an error during upload', async () => {
    logger.warn = jest.fn()
    const getState = () =>
      getUploadState([makeQueueItem({ fileId: 'my-doc.odt' })])
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
      fileId: 'my-doc.odt',
      file,
      status: 'quota',
      type: 'RECEIVE_UPLOAD_ERROR'
    })
  })

  it('should classify NotFoundError (browser FileSystem API) as unreadable', async () => {
    logger.warn = jest.fn()
    const getState = () =>
      getUploadState([makeQueueItem({ fileId: 'my-doc.odt' })])
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
      fileId: 'my-doc.odt',
      file,
      status: 'unreadable',
      type: 'RECEIVE_UPLOAD_ERROR'
    })
  })

  it('should retry conflicts only when the current upload pass is idle', () => {
    const dispatch = jest.fn(action => action)

    retryUploadConflicts(
      'batch-1',
      uploadConflictStrategies.KEEP_BOTH,
      fileUploadedCallbackSpy,
      queueCompletedCallbackSpy,
      dirId,
      sharingState,
      { client: fakeClient }
    )(dispatch, () =>
      getUploadState([
        {
          fileId: 'batch-1_my-doc.odt',
          uploadBatchId: 'batch-1',
          status: 'conflict',
          file
        }
      ])
    )

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: 'SET_UPLOAD_CONFLICT_STRATEGY',
      uploadBatchId: 'batch-1',
      strategy: 'keep-both'
    })
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: 'RETRY_UPLOAD_CONFLICTS',
      uploadBatchId: 'batch-1'
    })
    expect(dispatch).toHaveBeenNthCalledWith(3, expect.any(Function))

    dispatch.mockClear()

    retryUploadConflicts(
      'batch-1',
      uploadConflictStrategies.CANCEL,
      fileUploadedCallbackSpy,
      queueCompletedCallbackSpy,
      dirId,
      sharingState,
      { client: fakeClient }
    )(dispatch, () =>
      getUploadState([
        {
          fileId: 'batch-1_my-doc.odt',
          uploadBatchId: 'batch-1',
          status: 'conflict',
          file
        },
        {
          fileId: 'batch-1_next.odt',
          uploadBatchId: 'batch-1',
          status: 'pending',
          file: new File(['next'], 'next.odt')
        }
      ])
    )

    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: 'CANCEL_UPLOAD_CONFLICTS',
      uploadBatchId: 'batch-1'
    })
  })
})

describe('conflictStrategies reducer', () => {
  it('clears strategies for completed upload batches', () => {
    const state = {
      'batch-1': uploadConflictStrategies.REPLACE,
      'batch-2': uploadConflictStrategies.KEEP_BOTH,
      'batch-3': uploadConflictStrategies.CANCEL
    }

    const result = conflictStrategiesReducer(state, {
      type: 'CLEAR_UPLOAD_CONFLICT_STRATEGIES',
      uploadBatchIds: ['batch-1', 'batch-3']
    })

    expect(result).toEqual({
      'batch-2': uploadConflictStrategies.KEEP_BOTH
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
    expect(result[1]).toMatchObject({ fileId: 'doc2.odt', status: 'failed' })
  })

  it('should handle RECEIVE_UPLOAD_CONFLICT action type', () => {
    const action = {
      type: 'RECEIVE_UPLOAD_CONFLICT',
      fileId: 'doc2.odt',
      uploadBatchId: 'batch-1'
    }
    const result = queue(state, action)
    expect(result[1]).toMatchObject({
      fileId: 'doc2.odt',
      status: 'conflict'
    })
    expect(result[1]).not.toHaveProperty('existingItem')
  })

  it('should store an early generated name for a loose file', () => {
    const result = queue(state, {
      type: 'RECEIVE_UPLOAD_RENAMED',
      fileId: 'doc2.odt',
      finalName: 'doc2 (1).odt'
    })
    expect(result[1]).toMatchObject({
      fileId: 'doc2.odt',
      finalName: 'doc2 (1).odt'
    })
    expect(result[1]).not.toHaveProperty('relativePath')
  })

  it('should update the relative path for an early generated folder-upload name', () => {
    const folderState = [
      {
        ...buildItem('batch-1_docs/doc2.odt'),
        relativePath: 'docs/doc2.odt'
      }
    ]
    const result = queue(folderState, {
      type: 'RECEIVE_UPLOAD_RENAMED',
      fileId: 'batch-1_docs/doc2.odt',
      relativePath: 'docs/doc2 (1).odt'
    })
    expect(result[0]).toMatchObject({
      fileId: 'batch-1_docs/doc2.odt',
      relativePath: 'docs/doc2 (1).odt'
    })
  })

  it('should reset accumulated conflicts for retry', () => {
    const conflictState = [
      {
        ...buildItem('doc1.odt'),
        status: 'conflict',
        uploadBatchId: 'batch-1'
      },
      {
        ...buildItem('doc2.odt'),
        status: 'conflict',
        uploadBatchId: 'batch-1'
      },
      {
        ...buildItem('doc3.odt'),
        status: 'conflict',
        uploadBatchId: 'batch-2'
      }
    ]
    const result = queue(conflictState, {
      type: 'RETRY_UPLOAD_CONFLICTS',
      uploadBatchId: 'batch-1'
    })
    expect(result[0]).toMatchObject({
      status: 'pending'
    })
    expect(result[1]).toMatchObject({
      status: 'pending'
    })
    expect(result[0]).not.toHaveProperty('conflictStrategy')
    expect(result[1]).not.toHaveProperty('conflictStrategy')
    expect(result[2]).toMatchObject({ status: 'conflict' })
  })

  it('should cancel accumulated conflicts', () => {
    const conflictState = [
      {
        ...buildItem('doc1.odt'),
        status: 'conflict',
        uploadBatchId: 'batch-1'
      },
      {
        ...buildItem('doc2.odt'),
        status: 'conflict',
        uploadBatchId: 'batch-2'
      }
    ]
    const result = queue(conflictState, {
      type: 'CANCEL_UPLOAD_CONFLICTS',
      uploadBatchId: 'batch-1'
    })
    expect(result[0]).toMatchObject({ status: 'cancel' })
    expect(result[1]).toMatchObject({ status: 'conflict' })
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

// A file entry whose file() rejects, simulating Windows long-path
// NotFoundError surfacing during File extraction.
const createUnreadableFileEntry = name => ({
  isFile: true,
  isDirectory: false,
  name,
  file: (_resolve, reject) => {
    const err = new Error('vanished')
    err.name = 'NotFoundError'
    reject(err)
  }
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

// A directory entry whose readEntries rejects, simulating Windows
// long-path NotFoundError when enumerating a deep folder.
const createUnreadableDirEntry = name => ({
  isFile: false,
  isDirectory: true,
  name,
  createReader: () => ({
    readEntries: (_resolve, reject) => {
      const err = new Error('path too long')
      err.name = 'NotFoundError'
      reject(err)
    }
  })
})

const createBrokenDirEntry = name => ({
  isFile: false,
  isDirectory: true,
  name,
  createReader: () => ({
    readEntries: (_resolve, reject) => reject(new Error('permission denied'))
  })
})

describe('extractFilesEntries', () => {
  it('should extract plain File objects', () => {
    const files = [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]
    const result = extractFilesEntries(files)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      file: files[0],
      isDirectory: false,
      entry: null,
      root: true
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
      entry: fileEntry,
      root: true
    })
  })

  it('should extract DataTransferItem with directory entry', () => {
    const dirEntry = { isFile: false, isDirectory: true, name: 'Photos' }
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
      entry: dirEntry,
      root: true
    })
  })

  it('should mark plain File.path entries as root without parsing the path', () => {
    const file = new File(['a'], 'img.jpg')
    file.path = './Photos/2026/img.jpg'

    const result = extractFilesEntries([file])

    expect(result[0]).toEqual({
      file,
      isDirectory: false,
      entry: null,
      root: true
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
      uploadBatchId: 'photos/img1.jpg',
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
      uploadBatchId: 'note.txt',
      relativePath: null,
      folderId: 'root'
    })
  })

  it('still creates the ancestor folders when the deepest one is unreadable', async () => {
    // We can't enumerate `e`, but every ancestor (and `e` itself)
    // should still be created server-side so the user can drop the
    // missing files into the right place by hand. A single UNREADABLE
    // row flags the folder whose contents we couldn't read.
    const e = createUnreadableDirEntry('e')
    const d = createMockDirEntry('d', [e])
    const c = createMockDirEntry('c', [d])
    const b = createMockDirEntry('b', [c])
    const a = createMockDirEntry('a', [b])
    const entries = [{ file: null, isDirectory: true, entry: a }]

    const result = await flattenEntries(entries, 'root', fakeClient, null)

    const createdNames = createDirectorySpy.mock.calls.map(c => c[0].name)
    expect(createdNames).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      relativePath: 'a/b/c/d/e',
      uploadBatchId: 'a/b/c/d/e',
      folderId: null,
      status: 'unreadable',
      isDirectory: true
    })
  })

  it('creates empty folders even when they contain no files', async () => {
    // Empty subfolders are part of the dropped structure; they should
    // land in Drive verbatim so the tree matches what was dropped.
    const empty = createMockDirEntry('empty', [])
    const top = createMockDirEntry('top', [empty])
    const entries = [{ file: null, isDirectory: true, entry: top }]

    const result = await flattenEntries(entries, 'root', fakeClient, null)

    const createdNames = createDirectorySpy.mock.calls.map(c => c[0].name)
    expect(createdNames).toEqual(['top', 'empty'])
    expect(result).toEqual([])
  })

  it('classifies non-NotFoundError read failures as failed, not unreadable', async () => {
    const broken = createBrokenDirEntry('broken')
    const top = createMockDirEntry('top', [broken])
    const entries = [{ file: null, isDirectory: true, entry: top }]

    const result = await flattenEntries(entries, 'root', fakeClient, null)

    const createdNames = createDirectorySpy.mock.calls.map(c => c[0].name)
    expect(createdNames).toEqual(['top', 'broken'])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      relativePath: 'top/broken',
      status: 'failed'
    })
  })

  it('uploads readable siblings and surfaces one row per unreadable subtree', async () => {
    // top/
    //   ok.txt              <- readable, should upload
    //   broken/             <- readEntries fails, one unreadable row
    //   nested/
    //     deep.txt          <- readable, should upload
    //     ghost.bin         <- entry.file() fails, one unreadable row
    const broken = createUnreadableDirEntry('broken')
    const nested = createMockDirEntry('nested', [
      createMockFileEntry('deep.txt'),
      createUnreadableFileEntry('ghost.bin')
    ])
    const top = createMockDirEntry('top', [
      createMockFileEntry('ok.txt'),
      broken,
      nested
    ])
    const entries = [{ file: null, isDirectory: true, entry: top }]

    const result = await flattenEntries(entries, 'root', fakeClient, null)

    const createdNames = createDirectorySpy.mock.calls.map(c => c[0].name)
    expect(createdNames).toEqual(['top', 'broken', 'nested'])

    const readable = result.filter(r => r.status !== 'unreadable')
    const unreadable = result.filter(r => r.status === 'unreadable')

    expect(readable).toHaveLength(2)
    expect(readable.map(r => r.relativePath).sort()).toEqual([
      'top/nested/deep.txt',
      'top/ok.txt'
    ])

    expect(unreadable).toHaveLength(2)
    expect(unreadable.map(r => r.relativePath).sort()).toEqual([
      'top/broken',
      'top/nested/ghost.bin'
    ])

    const brokenRow = unreadable.find(r => r.relativePath === 'top/broken')
    const ghostRow = unreadable.find(
      r => r.relativePath === 'top/nested/ghost.bin'
    )
    expect(brokenRow.isDirectory).toBe(true)
    expect(ghostRow.isDirectory).toBe(false)
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

  it('should ignore ./ prefixes in react-dropzone File.path entries', async () => {
    const nested = new File(['a'], 'a.txt')
    nested.path = './album/2024/a.txt'
    const entries = [{ file: nested, isDirectory: false, entry: null }]

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
    expect(result[0]).toMatchObject({
      fileId: 'album/2024/a.txt',
      relativePath: 'album/2024/a.txt',
      folderId: 'dir-2024'
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
        uploadBatchId: expect.stringMatching(/^.+_.+$/),
        status: 'resolving'
      })
    ])
    const uploadBatchId = adds[0].files[0].uploadBatchId
    expect(resolves).toHaveLength(1)
    expect(resolves[0].placeholderIds).toEqual([
      expect.stringMatching(/^__pending_.+_0_photos__$/)
    ])
    expect(resolves[0].files).toHaveLength(2)
    expect(resolves[0].files[0]).toMatchObject({
      fileId: expect.stringMatching(/^.+_photos\/img1\.jpg$/),
      uploadBatchId,
      relativePath: 'photos/img1.jpg'
    })
  })

  it('does not create a dot placeholder when a folder file path starts with ./', async () => {
    const file = new File(['a'], 'img1.jpg')
    file.path = './photos/img1.jpg'
    const entries = [{ file, isDirectory: false, entry: null }]

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
    expect(adds[0].files).toEqual([
      expect.objectContaining({
        file: expect.objectContaining({ name: 'photos' }),
        status: 'resolving'
      })
    ])
    expect(adds[0].files[0].file.name).not.toBe('.')
    expect(resolves[0].files[0]).toMatchObject({
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

  it('uses a provided upload batch id for preflight uploads', async () => {
    const plainFile = new File(['a'], 'note.txt')
    const entries = [{ file: plainFile, isDirectory: false, entry: null }]

    const actions = await runThunk(
      addToUploadQueue(
        entries,
        'root',
        {},
        () => null,
        () => null,
        {
          client: fakeClient,
          uploadBatchId: 'preflight-batch-id'
        },
        null,
        () => null
      )
    )

    const addAction = actions.find(a => a.type === 'ADD_TO_UPLOAD_QUEUE')
    expect(addAction.files[0]).toMatchObject({
      fileId: 'preflight-batch-id_note.txt',
      uploadBatchId: 'preflight-batch-id'
    })
    expect(addAction.files[0]).not.toHaveProperty('preflightConflict')
    expect(actions.some(a => a.type === 'SET_UPLOAD_CONFLICT_STRATEGY')).toBe(
      false
    )
  })

  it('replaces the placeholder with one unreadable row when an inner folder cannot be read', async () => {
    // Asserts the placeholder is resolved (not stuck on RESOLVING) by
    // an UNREADABLE row — otherwise the queue would silently swallow
    // the drop and the alert pipeline never fires.
    const e = createUnreadableDirEntry('e')
    const d = createMockDirEntry('d', [e])
    const c = createMockDirEntry('c', [d])
    const b = createMockDirEntry('b', [c])
    const a = createMockDirEntry('a', [b])
    const entries = [{ file: null, isDirectory: true, entry: a }]

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

    const createdNames = createDirectorySpy.mock.calls.map(c => c[0].name)
    expect(createdNames).toEqual(['a', 'b', 'c', 'd', 'e'])
    const resolves = actions.filter(a => a.type === 'RESOLVE_FOLDER_ITEMS')
    expect(resolves).toHaveLength(1)
    expect(resolves[0].placeholderIds).toEqual([
      expect.stringMatching(/^__pending_.+_0_a__$/)
    ])
    expect(resolves[0].files).toHaveLength(1)
    expect(resolves[0].files[0]).toMatchObject({
      relativePath: 'a/b/c/d/e',
      status: 'unreadable'
    })
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

  it('does not fire the callback while upload conflicts wait for a modal choice', () => {
    const callback = jest.fn()
    const dispatch = jest.fn()
    const getState = () => ({
      upload: {
        queue: [
          { fileId: 'doc.odt', status: 'conflict', uploadBatchId: 'batch-1' }
        ]
      }
    })
    onQueueEmpty(callback)(dispatch, getState)
    expect(callback).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('does not fire the callback for a cancel-only conflict choice', () => {
    const callback = jest.fn()
    const dispatch = jest.fn()
    const getState = () => ({
      upload: {
        queue: [
          { fileId: 'doc.odt', status: 'cancel', uploadBatchId: 'batch-1' }
        ]
      }
    })
    onQueueEmpty(callback)(dispatch, getState)
    expect(callback).not.toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalledWith({
      type: 'CLEAR_UPLOAD_CONFLICT_STRATEGIES',
      uploadBatchIds: ['batch-1']
    })
  })

  it('fires the callback when no resolving placeholders remain', () => {
    const callback = jest.fn()
    const dispatch = jest.fn()
    const getState = () => ({
      upload: {
        queue: [
          {
            fileId: 'a.txt',
            status: 'created',
            uploadBatchId: 'batch-1',
            uploadedItem: { _id: 'a' }
          }
        ]
      }
    })
    onQueueEmpty(callback)(dispatch, getState)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'CLEAR_UPLOAD_CONFLICT_STRATEGIES',
      uploadBatchIds: ['batch-1']
    })
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        createdItems: [{ _id: 'a' }]
      })
    )
  })
})
