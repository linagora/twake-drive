import { createMockClient } from 'cozy-client'
import { initQuery, receiveQueryResult } from 'cozy-client/dist/store'

import { trashFiles, downloadFiles } from './utils'
import { generateFile } from 'test/generate'

import { TRASH_DIR_ID } from '@/constants/config'

jest.mock('modules/navigation/AppRoute', () => ({
  routes: []
}))

jest.mock('cozy-stack-client/dist/utils', () => ({
  forceFileDownload: jest.fn()
}))

const showAlert = jest.fn()
const t = x => x

describe('trashFiles', () => {
  const setup = () => {
    const client = new createMockClient({})
    const store = client.store

    store.dispatch(
      initQuery('files', {
        doctype: 'io.cozy.files'
      })
    )

    const file = generateFile({ i: 0 })
    store.dispatch(
      receiveQueryResult('files', {
        data: file
      })
    )
    return { client, store, file }
  }

  it('should destroy the file and update queries', async () => {
    const { store, client, file } = setup()
    const mockedDestroy = jest.fn()
    client.collection = jest.fn(() => ({
      destroy: mockedDestroy
    }))

    mockedDestroy.mockResolvedValue({
      data: {
        ...file,
        dir_id: TRASH_DIR_ID
      }
    })
    const state = store.getState()

    expect(state.cozy.documents['io.cozy.files'][file._id]._id).toEqual(
      file._id
    )

    await trashFiles(client, [file], { showAlert, t })
    expect(mockedDestroy).toHaveBeenCalledWith(file)

    const state2 = store.getState()
    const updatedFile = state2.cozy.documents['io.cozy.files'][file._id]
    expect(updatedFile.dir_id).toEqual('io.cozy.files.trash-dir')
  })

  it('trashes each file through its own drive', async () => {
    const { client, file } = setup()
    const mockedDestroy = jest.fn().mockResolvedValue({ data: file })
    client.collection = jest.fn(() => ({
      destroy: mockedDestroy,
      revokeSharingLink: jest.fn()
    }))
    const driveFile = { ...file, driveId: 'drive-1' }
    const localFile = generateFile({ i: 1 })

    await trashFiles(client, [driveFile, localFile], {
      showAlert,
      t,
      driveId: 'drive-2'
    })

    expect(client.collection).toHaveBeenCalledWith('io.cozy.files', {
      driveId: 'drive-1'
    })
    expect(client.collection).toHaveBeenCalledWith('io.cozy.files', {
      driveId: 'drive-2'
    })
  })
})

describe('downloadFiles', () => {
  const mockClient = createMockClient({})
  mockClient.stackClient.uri = 'http://cozy.tools'
  const mockDownload = jest.fn()
  const mockDownloadArchive = jest.fn()

  beforeEach(() => {
    mockClient.collection = () => ({
      download: mockDownload,
      downloadArchive: mockDownloadArchive
    })
  })

  it('downloads a single file', async () => {
    const file = {
      id: 'file-id-1',
      name: 'my-file.pdf',
      type: 'file'
    }
    await downloadFiles(mockClient, [file])
    expect(mockDownload).toHaveBeenCalledWith(file, null, file.name)
  })

  it('downloads a folder', async () => {
    const folder = {
      id: 'folder-id-1',
      name: 'Classified',
      type: 'directory'
    }
    await downloadFiles(mockClient, [folder])
    expect(mockDownloadArchive).toHaveBeenCalledWith([folder.id])
  })

  it('downloads multiple files', async () => {
    const files = [
      { id: 'file-id-1', name: 'my-file-1.pdf', type: 'file' },
      { id: 'file-id-2', name: 'my-file-2.pdf', type: 'file' }
    ]
    await downloadFiles(mockClient, files)
    expect(mockDownloadArchive).toHaveBeenCalledWith(['file-id-1', 'file-id-2'])
  })

  it.each([
    [404, 'error.download_file.missing'],
    [451, 'antivirus.popover.title'],
    [500, 'error.download_file.offline']
  ])('shows the matching alert on a %i error', async (status, message) => {
    const file = { id: 'file-id-1', name: 'virus.txt', type: 'file' }
    mockDownload.mockRejectedValueOnce({ status })
    await downloadFiles(mockClient, [file], { showAlert, t })
    expect(showAlert).toHaveBeenLastCalledWith(
      expect.objectContaining({ message, severity: 'error' })
    )
  })

  it('shows the alert when an archive download fails', async () => {
    const folder = { id: 'folder-id-1', name: 'Classified', type: 'directory' }
    mockDownloadArchive.mockRejectedValueOnce({ status: 451 })
    await downloadFiles(mockClient, [folder], { showAlert, t })
    expect(showAlert).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'antivirus.popover.title' })
    )
  })
})
