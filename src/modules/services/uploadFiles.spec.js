import { MessageChannel } from 'node:worker_threads'

import { uploadFileWithConflictStrategy } from 'cozy-client/dist/models/file'
import { makeSharingLink } from 'cozy-client/dist/models/sharing'
import { errorSerializer } from 'cozy-interapp/dist/helpers'
import { FetchError } from 'cozy-stack-client/dist/errors'

import { isFilesUpload, uploadFilesToDrive } from './uploadFiles'

import logger from '@/lib/logger'

jest.mock('@/lib/logger', () => ({ warn: jest.fn() }))

/**
 * The error as the caller of the intent gets it: serialized by the service,
 * posted (a structured clone, which refuses a `Response`), deserialized
 */
async function deliver(error) {
  const { port1, port2 } = new MessageChannel()
  const received = new Promise(resolve => port2.once('message', resolve))
  try {
    port1.postMessage(errorSerializer.serialize(error))
    return errorSerializer.deserialize(await received)
  } finally {
    port1.close()
  }
}

const fetchError = status =>
  new FetchError(new Response('', { status }), 'Forbidden')

jest.mock('cozy-client/dist/models/file', () => ({
  ...jest.requireActual('cozy-client/dist/models/file'),
  uploadFileWithConflictStrategy: jest.fn()
}))
jest.mock('cozy-client/dist/models/sharing', () => ({
  ...jest.requireActual('cozy-client/dist/models/sharing'),
  makeSharingLink: jest.fn()
}))

const sharing = { rules: [{ values: ['root'] }] }
const revokeSharingLink = jest.fn()
const fakeClient = (data = sharing) => ({
  fetchQueryAndGetFromState: jest.fn().mockResolvedValue({ data }),
  collection: jest.fn(doctype =>
    doctype === 'io.cozy.permissions' ? { revokeSharingLink } : null
  )
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
        conflictStrategy: 'rename',
        onUploadProgress: null
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
        conflictStrategy: 'rename',
        onUploadProgress: null
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

    expect(failure).toMatchObject({ message: 'quota', status: 413 })
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

    it('revokes the link a failed call may have created, so that no public share is left', async () => {
      uploadFileWithConflictStrategy.mockImplementation(async (client, file) =>
        stored(file)
      )
      makeSharingLink.mockImplementation(async (client, [id]) => {
        if (id === 'id-a.txt') throw new Error('Network error')
        return `link-${id}`
      })

      await uploadFilesToDrive(
        fakeClient(folder),
        { folderId: 'f1', files: files.slice(0, 2), sharingLink: true },
        signal
      ).catch(error => error)

      expect(revokeSharingLink.mock.calls).toEqual([[stored(files[0]).data]])
    })

    it('delivers the link of a file and the 403 of the next to the caller', async () => {
      uploadFileWithConflictStrategy.mockImplementation(async (client, file) =>
        stored(file)
      )
      makeSharingLink.mockImplementation(async (client, [id]) => {
        if (id === 'id-b.txt') throw fetchError(403)
        return `link-${id}`
      })

      const failure = await uploadFilesToDrive(
        fakeClient(folder),
        { folderId: 'f1', files: files.slice(0, 2), sharingLink: true },
        signal
      ).catch(error => error)

      const received = await deliver(failure)
      expect(received.status).toBe(403)
      expect(received.results).toMatchObject([
        { document: { id: 'id-a.txt', sharingLink: 'link-id-a.txt' } },
        { error: { status: 403 } }
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

  it('reports the upload progress of each file', async () => {
    uploadFileWithConflictStrategy.mockImplementation(
      async (client, file, { onUploadProgress }) => {
        onUploadProgress({ loaded: 1, total: 2 })
        return { data: {} }
      }
    )
    const onProgress = jest.fn()

    await uploadFilesToDrive(
      fakeClient(),
      { driveId: 'd1', files: files.slice(0, 2) },
      signal,
      onProgress
    )

    expect(onProgress.mock.calls).toEqual([
      [{ index: 0, loaded: 1, total: 2 }],
      [{ index: 1, loaded: 1, total: 2 }]
    ])
  })

  it('delivers the stored files and the 413 of a failed upload to the caller', async () => {
    uploadFileWithConflictStrategy.mockImplementation(async (client, file) => {
      if (file === files[1]) throw fetchError(413)
      return { data: { _id: `id-${file.name}` } }
    })

    const failure = await uploadFilesToDrive(
      fakeClient(),
      { driveId: 'd1', files: files.slice(0, 2) },
      signal
    ).catch(error => error)

    const received = await deliver(failure)
    expect(received.status).toBe(413)
    expect(received.results).toMatchObject([
      { document: { _id: 'id-a.txt' } },
      { error: { status: 413 } }
    ])
  })

  it('references each stored file from its attachment', async () => {
    uploadFileWithConflictStrategy
      .mockResolvedValueOnce({ data: { _id: 'stored-a', _rev: '1-created' } })
      .mockResolvedValueOnce({ data: { _id: 'stored-b', _rev: '1-created' } })
    // As cozy-stack-client gives the answer of the write
    const addReferencedBy = jest.fn().mockResolvedValue({
      data: [{ _id: 'a1:e1:b1', _type: 'io.cozy.mails.attachments' }],
      meta: { rev: '2-referenced', count: 1 }
    })
    const client = {
      ...fakeClient({ _id: 'f1', type: 'directory' }),
      collection: jest.fn(() => ({ addReferencedBy }))
    }
    const reference = { type: 'io.cozy.mails.attachments', id: 'a1:e1:b1' }

    const stored = await uploadFilesToDrive(
      client,
      {
        folderId: 'f1',
        files: files.slice(0, 2),
        references: [reference, null]
      },
      signal
    )

    expect(addReferencedBy).toHaveBeenCalledTimes(1)
    expect(addReferencedBy).toHaveBeenCalledWith(
      { _id: 'stored-a', _rev: '1-created' },
      [{ _id: 'a1:e1:b1', _type: 'io.cozy.mails.attachments' }]
    )
    // The revision and the references of the write, without a new read
    expect(stored).toEqual([
      {
        _id: 'stored-a',
        _rev: '2-referenced',
        relationships: {
          referenced_by: {
            data: [{ id: 'a1:e1:b1', type: 'io.cozy.mails.attachments' }]
          }
        }
      },
      { _id: 'stored-b', _rev: '1-created' }
    ])
  })

  it('refuses references that do not match the files', async () => {
    const client = fakeClient({ _id: 'f1', type: 'directory' })

    await expect(
      uploadFilesToDrive(
        client,
        { folderId: 'f1', files, references: [null] },
        signal
      )
    ).rejects.toThrow('references must hold one entry per file')
  })

  it.each([
    [{ type: 'io.cozy.photos.albums', id: 'album' }],
    [{ type: 'io.cozy.mails.attachments', id: 'a1:e1' }]
  ])('refuses the reference %j before storing anything', async reference => {
    const client = fakeClient({ _id: 'f1', type: 'directory' })

    await expect(
      uploadFilesToDrive(
        client,
        { folderId: 'f1', files: files.slice(0, 1), references: [reference] },
        signal
      )
    ).rejects.toThrow('Unsupported reference')
    expect(uploadFileWithConflictStrategy).not.toHaveBeenCalled()
  })

  it('refuses references for a shared drive before storing anything', async () => {
    const client = fakeClient()

    await expect(
      uploadFilesToDrive(
        client,
        {
          driveId: 'd1',
          files: files.slice(0, 1),
          references: [{ type: 'io.cozy.mails.attachments', id: 'a1:e1:b1' }]
        },
        signal
      )
    ).rejects.toThrow('references needs a folderId')
    expect(uploadFileWithConflictStrategy).not.toHaveBeenCalled()
  })

  it('keeps the stored file when its reference fails', async () => {
    uploadFileWithConflictStrategy.mockResolvedValue({
      data: { _id: 'stored-a' }
    })
    const client = {
      ...fakeClient({ _id: 'f1', type: 'directory' }),
      collection: jest.fn(() => ({
        addReferencedBy: jest.fn().mockRejectedValue(new Error('500'))
      }))
    }

    await expect(
      uploadFilesToDrive(
        client,
        {
          folderId: 'f1',
          files: files.slice(0, 1),
          references: [{ type: 'io.cozy.mails.attachments', id: 'a1:e1:b1' }]
        },
        signal
      )
    ).resolves.toEqual([{ _id: 'stored-a' }])
    expect(logger.warn).toHaveBeenCalledWith(
      'Upload intent could not reference a stored file',
      expect.any(Error)
    )
  })
})
