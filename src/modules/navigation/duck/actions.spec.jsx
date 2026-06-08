import CozyClient from 'cozy-client'
import flag from 'cozy-flags'

import { createFolder, uploadFiles } from './actions'
import { generateFile } from 'test/generate'
import { setupFolderContent } from 'test/setup'

import {
  addToUploadQueue,
  createUploadBatchId,
  extractFilesEntries,
  retryUploadConflicts,
  setUploadConflictStrategy,
  uploadConflictStrategies
} from '@/modules/upload'
import { hasPreflightUploadConflicts } from '@/modules/upload/preflightConflicts'

jest.mock('cozy-flags', () => jest.fn(() => null))

jest.mock('@/modules/upload', () => ({
  addToUploadQueue: jest.fn(() => () => {}),
  createUploadBatchId: jest.fn(() => 'preflight-batch-id'),
  extractFilesEntries: jest.fn(),
  retryUploadConflicts: jest.fn(() => () => {}),
  setUploadConflictStrategy: jest.fn((uploadBatchId, strategy) => ({
    type: 'SET_UPLOAD_CONFLICT_STRATEGY',
    uploadBatchId,
    strategy
  })),
  uploadConflictStrategies: {
    REPLACE: 'replace',
    KEEP_BOTH: 'keep-both',
    CANCEL: 'cancel'
  }
}))

jest.mock('@/modules/upload/preflightConflicts', () => ({
  hasPreflightUploadConflicts: jest.fn()
}))

jest.mock('@/modules/upload/UploadConflictDialog', () => {
  const React = require('react')
  return function MockUploadConflictDialog(props) {
    return React.createElement('div', {
      'data-testid': 'upload-conflict-dialog',
      ...props
    })
  }
})

jest.mock('@/modules/upload/UploadLimitDialog', () => {
  const React = require('react')
  return function MockUploadLimitDialog(props) {
    return React.createElement('div', {
      'data-testid': 'upload-limit-dialog',
      ...props
    })
  }
})

const showAlert = jest.fn()
const t = x => x

beforeEach(() => {
  const folders = Array(3)
    .fill(null)
    .map((x, i) => generateFile({ i, type: 'directory' }))
  const files = Array(3)
    .fill(null)
    .map((x, i) => generateFile({ i }))
  jest.spyOn(CozyClient.prototype, 'requestQuery').mockResolvedValue({
    data: files.concat(folders)
  })
})

afterEach(() => {
  CozyClient.prototype.requestQuery.mockRestore()
})

describe('createFolder', () => {
  beforeEach(() => {
    jest.spyOn(CozyClient.prototype, 'create').mockImplementation(() => {})
    jest.spyOn(CozyClient.prototype, 'collection').mockReturnValue({
      create: jest.fn().mockResolvedValue({})
    })
  })

  afterEach(() => {
    CozyClient.prototype.create.mockRestore()
    CozyClient.prototype.collection.mockRestore()
  })

  it('should not be possible to create a folder with a same name of an existing folder', async () => {
    const folderId = 'folder123456'
    const { client, store } = await setupFolderContent({
      folderId
    })
    await expect(
      store.dispatch(
        createFolder(client, 'foobar2', folderId, { showAlert, t })
      )
    ).rejects.toEqual(new Error('alert.folder_name'))
  })

  it('should be possible to create a folder', async () => {
    const folderId = 'folder123456'
    const { client, store } = await setupFolderContent({
      folderId
    })

    await store.dispatch(
      createFolder(client, 'foobar5', folderId, { showAlert, t })
    )

    expect(client.collection).toHaveBeenCalledWith('io.cozy.files', {
      driveId: undefined
    })
    const mockCollection = client.collection.mock.results[0].value
    expect(mockCollection.create).toHaveBeenCalledWith({
      dirId: 'folder123456',
      name: 'foobar5',
      type: 'directory'
    })
  })
})

describe('uploadFiles', () => {
  const mockFiles = [new File([''], 'test.txt')]
  const mockEntries = [{ file: mockFiles[0], isDirectory: false, entry: null }]
  const deps = {
    client: {},
    showAlert: jest.fn(),
    t: x => x
  }

  beforeEach(() => {
    jest.clearAllMocks()
    extractFilesEntries.mockReturnValue(mockEntries)
    hasPreflightUploadConflicts.mockResolvedValue(false)
    flag.mockReturnValue(null)
  })

  const getAddToUploadQueueOptions = () => addToUploadQueue.mock.calls[0][5]

  it('passes the flag-driven limit and a modal-opening onLimitExceeded callback', async () => {
    flag.mockReturnValue(100)

    const dispatch = jest.fn()
    await uploadFiles(mockFiles, 'dir-id', {}, () => null, deps)(dispatch)

    const options = getAddToUploadQueueOptions()
    expect(options).toMatchObject({ client: deps.client, maxFileCount: 100 })
    expect(typeof options.onLimitExceeded).toBe('function')

    options.onLimitExceeded()
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SHOW_MODAL' })
    )
  })

  it('falls back to the default limit when no flag is set', async () => {
    flag.mockReturnValue(null)

    const dispatch = jest.fn()
    await uploadFiles(mockFiles, 'dir-id', {}, () => null, deps)(dispatch)

    expect(getAddToUploadQueueOptions()).toMatchObject({ maxFileCount: 500 })
  })

  it('does not show the modal eagerly', async () => {
    const dispatch = jest.fn()
    await uploadFiles(mockFiles, 'dir-id', {}, () => null, deps)(dispatch)

    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SHOW_MODAL' })
    )
  })

  it('opens the upload conflict modal before enqueueing when first-level conflicts exist', async () => {
    hasPreflightUploadConflicts.mockResolvedValueOnce(true)

    const dispatch = jest.fn(action => action)
    await uploadFiles(mockFiles, 'dir-id', {}, () => null, deps)(dispatch)

    expect(hasPreflightUploadConflicts).toHaveBeenCalledWith({
      client: deps.client,
      entries: mockEntries,
      folderId: 'dir-id',
      driveId: undefined
    })
    expect(addToUploadQueue).not.toHaveBeenCalled()
    const modalAction = dispatch.mock.calls
      .map(([action]) => action)
      .find(action => action.type === 'SHOW_MODAL')
    modalAction.component.props.onConfirm(uploadConflictStrategies.KEEP_BOTH)

    expect(createUploadBatchId).toHaveBeenCalled()
    expect(setUploadConflictStrategy).toHaveBeenCalledWith(
      'preflight-batch-id',
      uploadConflictStrategies.KEEP_BOTH
    )
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_UPLOAD_CONFLICT_STRATEGY',
      uploadBatchId: 'preflight-batch-id',
      strategy: uploadConflictStrategies.KEEP_BOTH
    })
    expect(addToUploadQueue).toHaveBeenCalledWith(
      mockEntries,
      'dir-id',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        uploadBatchId: 'preflight-batch-id'
      }),
      undefined,
      undefined
    )
  })

  it('does not enqueue the upload when the preflight conflict modal is cancelled', async () => {
    hasPreflightUploadConflicts.mockResolvedValueOnce(true)

    const dispatch = jest.fn(action => action)
    await uploadFiles(mockFiles, 'dir-id', {}, () => null, deps)(dispatch)

    const modalAction = dispatch.mock.calls
      .map(([action]) => action)
      .find(action => action.type === 'SHOW_MODAL')
    modalAction.component.props.onCancel()

    expect(addToUploadQueue).not.toHaveBeenCalled()
  })

  it('opens one upload conflict modal per batch', async () => {
    const dispatch = jest.fn()
    await uploadFiles(mockFiles, 'dir-id', {}, () => null, deps)(dispatch)

    const options = getAddToUploadQueueOptions()
    options.onUploadConflict({ uploadBatchId: 'batch-1' })
    options.onUploadConflict({ uploadBatchId: 'batch-1' })
    options.onUploadConflict({ uploadBatchId: 'batch-2' })

    const modalActions = dispatch.mock.calls
      .map(([action]) => action)
      .filter(action => action.type === 'SHOW_MODAL')
    expect(modalActions).toHaveLength(2)
    expect(modalActions[0].component.props.file).toBeUndefined()
  })

  it('applies the selected upload conflict strategy to the batch', async () => {
    const dispatch = jest.fn(action => action)
    const addItems = jest.fn()
    const fileUploadedCallback = jest.fn()
    const sharingState = { sharedPaths: [] }
    await uploadFiles(
      mockFiles,
      'dir-id',
      sharingState,
      fileUploadedCallback,
      deps,
      'drive-id',
      addItems
    )(dispatch)

    const options = getAddToUploadQueueOptions()
    options.onUploadConflict({ uploadBatchId: 'batch-1' })
    const modalAction = dispatch.mock.calls
      .map(([action]) => action)
      .find(action => action.type === 'SHOW_MODAL')

    modalAction.component.props.onConfirm(uploadConflictStrategies.KEEP_BOTH)
    expect(retryUploadConflicts).toHaveBeenCalledWith(
      'batch-1',
      uploadConflictStrategies.KEEP_BOTH,
      fileUploadedCallback,
      expect.any(Function),
      'dir-id',
      sharingState,
      { client: deps.client },
      'drive-id',
      addItems
    )

    retryUploadConflicts.mockClear()
    modalAction.component.props.onCancel()
    expect(retryUploadConflicts).toHaveBeenCalledWith(
      'batch-1',
      uploadConflictStrategies.CANCEL,
      fileUploadedCallback,
      expect.any(Function),
      'dir-id',
      sharingState,
      { client: deps.client },
      'drive-id',
      addItems
    )
  })

  it('passes pre-extracted entries to addToUploadQueue', async () => {
    const dispatch = jest.fn()
    await uploadFiles(mockFiles, 'dir-id', {}, () => null, deps)(dispatch)

    expect(extractFilesEntries).toHaveBeenCalledWith(mockFiles)
    expect(addToUploadQueue).toHaveBeenCalledWith(
      mockEntries,
      'dir-id',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ client: deps.client }),
      undefined,
      undefined
    )
  })
})
