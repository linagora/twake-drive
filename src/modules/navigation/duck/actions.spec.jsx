import CozyClient from 'cozy-client'
import flag from 'cozy-flags'
import { WebVaultClient } from 'cozy-keys-lib'

import { createFolder, uploadFiles } from './actions'
import { generateFile } from 'test/generate'
import { setupFolderContent } from 'test/setup'

import {
  addToUploadQueue,
  extractFilesEntries,
  exceedsFileLimit
} from '@/modules/upload'

jest.mock('cozy-flags', () => jest.fn(() => null))

jest.mock('@/modules/upload', () => ({
  addToUploadQueue: jest.fn(() => () => {}),
  extractFilesEntries: jest.fn(),
  exceedsFileLimit: jest.fn()
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

jest.mock('cozy-keys-lib', () => ({
  withVaultClient: jest.fn().mockReturnValue({}),
  useVaultClient: jest.fn(),
  WebVaultClient: jest.fn().mockReturnValue({})
}))

const vaultClient = new WebVaultClient('http://alice.cozy.cloud')
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
        createFolder(client, vaultClient, 'foobar2', folderId, { showAlert, t })
      )
    ).rejects.toEqual(new Error('alert.folder_name'))
  })

  it('should be possible to create a folder', async () => {
    const folderId = 'folder123456'
    const { client, store } = await setupFolderContent({
      folderId
    })

    await store.dispatch(
      createFolder(client, vaultClient, 'foobar5', folderId, { showAlert, t })
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
    vaultClient: {},
    showAlert: jest.fn(),
    t: x => x
  }

  beforeEach(() => {
    jest.clearAllMocks()
    extractFilesEntries.mockReturnValue(mockEntries)
    flag.mockReturnValue(null)
  })

  it('should block upload and show limit dialog when limit is exceeded', async () => {
    exceedsFileLimit.mockResolvedValue(true)

    const dispatch = jest.fn()
    await uploadFiles(mockFiles, 'dir-id', {}, () => null, deps)(dispatch)

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SHOW_MODAL' })
    )
    expect(addToUploadQueue).not.toHaveBeenCalled()
  })

  it('should proceed with upload when limit is not exceeded', async () => {
    exceedsFileLimit.mockResolvedValue(false)

    const dispatch = jest.fn()
    await uploadFiles(mockFiles, 'dir-id', {}, () => null, deps)(dispatch)

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
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SHOW_MODAL' })
    )
  })

  it('should use flag value as limit when set', async () => {
    flag.mockReturnValue(100)
    exceedsFileLimit.mockResolvedValue(true)

    const dispatch = jest.fn()
    await uploadFiles(mockFiles, 'dir-id', {}, () => null, deps)(dispatch)

    expect(exceedsFileLimit).toHaveBeenCalledWith(mockEntries, 100)
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SHOW_MODAL' })
    )
  })

  it('should fall back to default limit when flag is not set', async () => {
    flag.mockReturnValue(null)
    exceedsFileLimit.mockResolvedValue(false)

    const dispatch = jest.fn()
    await uploadFiles(mockFiles, 'dir-id', {}, () => null, deps)(dispatch)

    expect(exceedsFileLimit).toHaveBeenCalledWith(mockEntries, 500)
    expect(addToUploadQueue).toHaveBeenCalled()
  })

  it('should pass pre-extracted entries to addToUploadQueue', async () => {
    exceedsFileLimit.mockResolvedValue(false)

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
