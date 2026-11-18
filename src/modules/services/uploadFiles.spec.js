import { uploadFileWithConflictStrategy } from 'cozy-client/dist/models/file'
import { makeSharingLink } from 'cozy-client/dist/models/sharing'

import { isFilesUpload, uploadFilesToDrive } from './uploadFiles'

jest.mock('cozy-client/dist/models/file', () => ({
  ...jest.requireActual('cozy-client/dist/models/file'),
  uploadFileWithConflictStrategy: jest.fn()
}))
jest.mock('cozy-client/dist/models/sharing', () => ({
  ...jest.requireActual('cozy-client/dist/models/sharing'),
  makeSharingLink: jest.fn()
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

  it('stores the files in a folder of the user Drive', async () => {
    uploadFileWithConflictStrategy.mockResolvedValue({ data: {} })
    const client = fakeClient({ _id: 'f1', type: 'directory' })

    await uploadFilesToDrive(client, { folderId: 'f1', files }, signal)

    expect(uploadFileWithConflictStrategy).toHaveBeenCalledWith(
      client,
      files[0],
      {
        name: 'a.txt',
        dirId: 'f1',
        driveId: undefined,
        conflictStrategy: 'rename'
      }
    )
  })

  it('refuses a folder of a shared drive', async () => {
    const client = fakeClient({ _id: 'f1', type: 'directory', driveId: 'd1' })

    await expect(
      uploadFilesToDrive(client, { folderId: 'f1', files }, signal)
    ).rejects.toThrow('The destination is not a local Drive folder')
  })

  it('keeps uploading after a failed file, then fails with a result per file', async () => {
    const quota = Object.assign(new Error('quota'), { status: 413 })
    uploadFileWithConflictStrategy.mockImplementation(async (client, file) => {
      if (file === files[1]) throw quota
      return { data: { name: file.name } }
    })

    const failure = await uploadFilesToDrive(
      fakeClient(),
      { driveId: 'd1', files },
      signal
    ).catch(error => error)

    expect(failure).toBe(quota)
    expect(failure.results).toEqual([
      { document: { name: 'a.txt' } },
      { error: { message: 'quota', status: 413 } },
      { document: { name: 'c.txt' } },
      { document: { name: 'd.txt' } }
    ])
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
    ['no destination', { files }],
    ['both a drive and a folder', { driveId: 'd1', folderId: 'f1', files }],
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

  describe('with a public link for each file', () => {
    const folder = { _id: 'f1', type: 'directory' }
    const stored = file => ({
      data: {
        _id: `id-${file.name}`,
        name: file.name,
        type: 'file',
        size: '1',
        mime: 'text/plain'
      }
    })

    it('returns the entries of the file picker, with a read-only link', async () => {
      uploadFileWithConflictStrategy.mockImplementation(async (client, file) =>
        stored(file)
      )
      makeSharingLink.mockImplementation(async (client, [id]) => `link-${id}`)
      const client = fakeClient(folder)

      const entries = await uploadFilesToDrive(
        client,
        { folderId: 'f1', files: files.slice(0, 2), sharingLink: true },
        signal
      )

      expect(entries).toMatchObject([
        {
          id: 'id-a.txt',
          name: 'a.txt',
          size: 1,
          mimeType: 'text/plain',
          sharingLink: 'link-id-a.txt'
        },
        {
          id: 'id-b.txt',
          name: 'b.txt',
          size: 1,
          mimeType: 'text/plain',
          sharingLink: 'link-id-b.txt'
        }
      ])
      expect(makeSharingLink).toHaveBeenCalledWith(client, ['id-a.txt'])
    })

    it('fails the file whose link cannot be created, keeping the others', async () => {
      uploadFileWithConflictStrategy.mockImplementation(async (client, file) =>
        stored(file)
      )
      makeSharingLink.mockImplementation(async (client, [id]) => {
        if (id === 'id-a.txt')
          throw Object.assign(new Error('denied'), { status: 403 })
        return `link-${id}`
      })

      const failure = await uploadFilesToDrive(
        fakeClient(folder),
        { folderId: 'f1', files: files.slice(0, 2), sharingLink: true },
        signal
      ).catch(error => error)

      expect(failure.results).toMatchObject([
        { error: { message: 'denied', status: 403 } },
        { document: { id: 'id-b.txt', sharingLink: 'link-id-b.txt' } }
      ])
    })

    it('turns the link on with an object too, as the File Picker does', async () => {
      uploadFileWithConflictStrategy.mockImplementation(async (client, file) =>
        stored(file)
      )
      makeSharingLink.mockResolvedValue('link')

      const entries = await uploadFilesToDrive(
        fakeClient(folder),
        { folderId: 'f1', files: files.slice(0, 1), sharingLink: {} },
        signal
      )

      expect(entries).toMatchObject([{ sharingLink: 'link' }])
    })

    it('makes no link for a file cancelled once stored', async () => {
      const controller = new AbortController()
      uploadFileWithConflictStrategy.mockImplementation(
        async (client, file) => {
          controller.abort()
          return stored(file)
        }
      )

      await expect(
        uploadFilesToDrive(
          fakeClient(folder),
          { folderId: 'f1', files: files.slice(0, 1), sharingLink: true },
          controller.signal
        )
      ).rejects.toThrow()
      expect(makeSharingLink).not.toHaveBeenCalled()
    })

    it('refuses a shared drive', async () => {
      await expect(
        uploadFilesToDrive(
          fakeClient(),
          { driveId: 'd1', files, sharingLink: true },
          signal
        )
      ).rejects.toThrow('sharingLink needs a folderId')
      expect(uploadFileWithConflictStrategy).not.toHaveBeenCalled()
    })
  })
})
