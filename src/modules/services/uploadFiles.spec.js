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

  it('retries a file that lost a same-name race', async () => {
    const conflict = Object.assign(new Error('Conflict'), { status: 409 })
    const twin = new File(['a2'], 'a.txt')
    uploadFileWithConflictStrategy
      .mockResolvedValueOnce({ data: { name: 'a.txt' } })
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce({ data: { name: 'a (1).txt' } })

    const documents = await uploadFilesToDrive(
      fakeClient(),
      { driveId: 'd1', files: [files[0], twin] },
      signal
    )

    expect(documents.map(doc => doc.name)).toEqual(['a.txt', 'a (1).txt'])
    expect(uploadFileWithConflictStrategy).toHaveBeenLastCalledWith(
      expect.anything(),
      twin,
      expect.objectContaining({ name: 'a.txt', conflictStrategy: 'rename' })
    )
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
