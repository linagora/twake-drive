import { makeSharingLink } from 'cozy-client/dist/models/sharing'

import { buildPickResult } from './buildPickResult'

jest.mock('cozy-client/dist/models/sharing', () => ({
  makeSharingLink: jest.fn()
}))

const makeFakeFile = ({ _id, name, mime, size }) => ({
  _id,
  name,
  mime,
  size,
  attributes: { name, mime, size }
})

const makeClient = (
  filesById,
  { downloadLink = 'https://d.example/file' } = {}
) => {
  const query = jest.fn(async id => {
    // cozy-client's Q(...).getById returns a definition whose `id` matches
    // the one passed above. For the test we just look it up in a map by the
    // string id embedded in the definition.
    const docId = id && id.id
    return { data: filesById[docId] }
  })
  const collection = jest.fn(() => ({
    getDownloadLinkById: jest.fn(async () => downloadLink)
  }))
  return { query, collection }
}

beforeEach(() => {
  makeSharingLink.mockReset()
  global.fetch = jest.fn()
})

describe('buildPickResult', () => {
  const filesById = {
    'file-1': makeFakeFile({
      _id: 'file-1',
      name: 'photo.jpg',
      mime: 'image/jpeg',
      size: '204800'
    }),
    'file-2': makeFakeFile({
      _id: 'file-2',
      name: 'note.pdf',
      mime: 'application/pdf',
      size: '1024'
    })
  }

  it('returns name, mimeType, size for every selected file', async () => {
    const client = makeClient(filesById)
    const results = await buildPickResult(client, ['file-1'], [])
    expect(results).toEqual([
      { name: 'photo.jpg', mimeType: 'image/jpeg', size: 204800 }
    ])
  })

  it('includes sharingUrl when requested', async () => {
    const client = makeClient(filesById)
    makeSharingLink.mockResolvedValueOnce(
      'https://drive.example/public?sharecode=abc'
    )
    const results = await buildPickResult(client, ['file-1'], ['sharingUrl'])
    expect(results[0].sharingUrl).toBe(
      'https://drive.example/public?sharecode=abc'
    )
    expect(makeSharingLink).toHaveBeenCalledWith(client, ['file-1'])
  })

  it('includes downloadUrl when requested', async () => {
    const client = makeClient(filesById, {
      downloadLink: 'https://d.example/photo.jpg'
    })
    const results = await buildPickResult(client, ['file-1'], ['downloadUrl'])
    expect(results[0].downloadUrl).toBe('https://d.example/photo.jpg')
    expect(client.collection).toHaveBeenCalledWith('io.cozy.files')
  })

  it('includes payload as data URL when requested', async () => {
    const client = makeClient(filesById, {
      downloadLink: 'https://d.example/photo.jpg'
    })
    global.fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([72, 105]).buffer // 'Hi'
    })
    const results = await buildPickResult(client, ['file-1'], ['payload'])
    expect(results[0].payload).toBe('data:image/jpeg;base64,SGk=')
    expect(global.fetch).toHaveBeenCalledWith('https://d.example/photo.jpg')
  })

  it('includes all three representations when requested together', async () => {
    const client = makeClient(filesById, {
      downloadLink: 'https://d.example/photo.jpg'
    })
    makeSharingLink.mockResolvedValueOnce(
      'https://drive.example/public?sharecode=abc'
    )
    global.fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([72, 105]).buffer
    })
    const [result] = await buildPickResult(
      client,
      ['file-1'],
      ['sharingUrl', 'downloadUrl', 'payload']
    )
    expect(result.sharingUrl).toBeDefined()
    expect(result.downloadUrl).toBeDefined()
    expect(result.payload).toBeDefined()
  })

  it('resolves multiple files', async () => {
    const client = makeClient(filesById)
    const results = await buildPickResult(client, ['file-1', 'file-2'], [])
    expect(results.map(r => r.name)).toEqual(['photo.jpg', 'note.pdf'])
  })

  it('propagates failure when a file lookup throws', async () => {
    const client = {
      query: jest.fn(async () => {
        throw new Error('not found')
      }),
      collection: jest.fn()
    }
    await expect(buildPickResult(client, ['file-1'], [])).rejects.toThrow(
      'not found'
    )
  })
})
