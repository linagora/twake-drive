import { uploadFileWithConflictStrategy } from 'cozy-client/dist/models/file'

import { isFilesUpload, uploadFilesToDrive } from './uploadFiles'

jest.mock('cozy-client/dist/models/file', () => ({
  ...jest.requireActual('cozy-client/dist/models/file'),
  uploadFileWithConflictStrategy: jest.fn()
}))

const sharing = { rules: [{ values: ['root'] }] }
const fakeClient = (data = sharing) => ({
  fetchQueryAndGetFromState: jest.fn().mockResolvedValue({ data })
})
const signal = new AbortController().signal
const files = ['a', 'b', 'c', 'd'].map(name => new File([name], `${name}.txt`))

describe('isFilesUpload', () => {
  it('tells files apart from a URL upload', () => {
    expect(isFilesUpload({ driveId: 'd1', files })).toBe(true)
    expect(
      isFilesUpload({ url: 'https://a.test', folderId: 'f', name: 'a' })
    ).toBe(false)
    expect(isFilesUpload(null)).toBe(false)
  })
})

describe('uploadFilesToDrive', () => {
  afterEach(() => jest.clearAllMocks())

  it('stores every file at the root of the drive, keeping both on a taken name', async () => {
    uploadFileWithConflictStrategy.mockImplementation(async (client, file) => ({
      data: { name: file.name }
    }))
    const client = fakeClient()

    const documents = await uploadFilesToDrive(
      client,
      { driveId: 'd1', files },
      signal
    )

    expect(documents.map(doc => doc.name)).toEqual([
      'a.txt',
      'b.txt',
      'c.txt',
      'd.txt'
    ])
    expect(uploadFileWithConflictStrategy).toHaveBeenCalledWith(
      client,
      files[0],
      {
        name: 'a.txt',
        dirId: 'root',
        driveId: 'd1',
        conflictStrategy: 'rename'
      }
    )
  })

  it('keeps uploading after a failed file, then fails', async () => {
    const quota = new Error('quota')
    uploadFileWithConflictStrategy.mockImplementation(async (client, file) => {
      if (file === files[1]) throw quota
      return { data: {} }
    })

    await expect(
      uploadFilesToDrive(fakeClient(), { driveId: 'd1', files }, signal)
    ).rejects.toBe(quota)
    expect(uploadFileWithConflictStrategy).toHaveBeenCalledTimes(4)
  })

  it('uploads one file at a time', async () => {
    let running = 0
    let most = 0
    uploadFileWithConflictStrategy.mockImplementation(async () => {
      most = Math.max(most, ++running)
      await Promise.resolve()
      running--
      return { data: {} }
    })

    await uploadFilesToDrive(fakeClient(), { driveId: 'd1', files }, signal)

    expect(most).toBe(1)
  })

  it.each([
    ['no drive', { files }],
    ['no files', { driveId: 'd1', files: [] }],
    ['something else than files', { driveId: 'd1', files: ['a.txt'] }]
  ])('refuses %s', async (_, data) => {
    await expect(
      uploadFilesToDrive(fakeClient(), data, signal)
    ).rejects.toThrow()
    expect(uploadFileWithConflictStrategy).not.toHaveBeenCalled()
  })

  it('refuses a drive without a folder', async () => {
    await expect(
      uploadFilesToDrive(fakeClient(null), { driveId: 'd1', files }, signal)
    ).rejects.toThrow('The destination is not a shared drive')
  })
})
