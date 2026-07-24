import { generateWebLink } from 'cozy-client'

import { makeSharedDriveNoteReturnUrl } from './helpers'

jest.mock('cozy-client', () => ({
  generateWebLink: jest.fn(({ hash }) => hash)
}))

describe('makeSharedDriveNoteReturnUrl', () => {
  const client = {
    getStackClient: () => ({ uri: 'https://alice.example' }),
    getInstanceOptions: () => ({ subdomain: 'flat' })
  }
  const file = {
    driveId: 'drive-1',
    dir_id: 'folder-1'
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns to a shared drive inside the active sharings tab', () => {
    makeSharedDriveNoteReturnUrl(
      client,
      file,
      '/sharings/with-me/shareddrive/drive-1/folder-1'
    )

    expect(generateWebLink).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: '/sharings/with-me/shareddrive/drive-1/folder-1'
      })
    )
  })

  it('keeps the direct shared-drive return route outside sharings', () => {
    makeSharedDriveNoteReturnUrl(client, file, '/shareddrive/drive-1/folder-1')

    expect(generateWebLink).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: '/shareddrive/drive-1/folder-1'
      })
    )
  })
})
