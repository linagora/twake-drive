import CozyClient from 'cozy-client'
import flag from 'cozy-flags'

import { createFolder, uploadFiles } from './actions'
import { generateFile } from 'test/generate'
import { setupFolderContent } from 'test/setup'

import { addToUploadQueue, extractFilesEntries } from '@/modules/upload'

jest.mock('cozy-flags', () => jest.fn(() => null))

jest.mock('@/modules/upload', () => ({
  addToUploadQueue: jest.fn(() => () => {}),
  extractFilesEntries: jest.fn()
}))

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
