import { makeSharingLink } from 'cozy-client/dist/models/sharing'

import { makeTemporaryDownloadLinks } from './sharing'

jest.mock('cozy-client/dist/models/sharing', () => ({
  makeSharingLink: jest.fn()
}))

const getDownloadLinkById = jest.fn()

jest.mock('cozy-client', () => {
  const actual = jest.requireActual('cozy-client')
  const CozyClientMock = jest.fn().mockImplementation(() => ({
    collection: () => ({
      getDownloadLinkById: (...args) => getDownloadLinkById(...args)
    })
  }))
  return {
    __esModule: true,
    ...actual,
    default: CozyClientMock
  }
})

const client = {
  getStackClient: () => ({ uri: 'https://alice.example.org' }),
  capabilities: { flat_subdomains: true }
}

describe('makeTemporaryDownloadLinks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    makeSharingLink.mockImplementation((_client, ids) =>
      Promise.resolve(
        `https://alice-drive.example.org/public?sharecode=code-${ids[0]}`
      )
    )
    getDownloadLinkById.mockImplementation(id =>
      Promise.resolve(`/download/${id}`)
    )
  })

  it('should create one permission per file instead of one for the selection', async () => {
    const files = [
      { _id: 'a', name: 'a.txt', type: 'file' },
      { _id: 'b', name: 'b.txt', type: 'file' }
    ]

    await makeTemporaryDownloadLinks(client, files)

    expect(makeSharingLink).toHaveBeenCalledTimes(2)
    // Each call carries exactly one file id: a permission covering several
    // files can later be reactivated into a permanent link exposing them all.
    for (const call of makeSharingLink.mock.calls) {
      expect(call[1]).toHaveLength(1)
    }
    expect(makeSharingLink.mock.calls.map(call => call[1][0]).sort()).toEqual([
      'a',
      'b'
    ])
  })

  it('should return the download links in file order', async () => {
    const files = [
      { _id: 'a', name: 'a.txt', type: 'file' },
      { _id: 'b', name: 'b.txt', type: 'file' }
    ]

    const links = await makeTemporaryDownloadLinks(client, files)

    expect(links).toEqual(['/download/a', '/download/b'])
  })

  it('should throw when a temporary link carries no sharecode', async () => {
    makeSharingLink.mockResolvedValue('https://alice-drive.example.org/public')

    await expect(
      makeTemporaryDownloadLinks(client, [
        { _id: 'a', name: 'a.txt', type: 'file' }
      ])
    ).rejects.toThrow('sharecode')
  })
})
