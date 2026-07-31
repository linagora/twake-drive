import { destroyFileVersion } from './versions'

const setup = () => {
  const fetchJSON = jest.fn().mockResolvedValue(null)
  const client = {
    getStackClient: () => ({ fetchJSON }),
    collection: (doctype, options) => ({
      prefix: options?.driveId
        ? `/sharings/drives/${options.driveId}`
        : '/files'
    })
  }

  return { client, fetchJSON }
}

describe('destroyFileVersion', () => {
  it('deletes the version through the files route of a personal instance', async () => {
    const { client, fetchJSON } = setup()

    await destroyFileVersion({
      client,
      version: { id: 'file-id/2-fa3a3bec' }
    })

    expect(fetchJSON).toHaveBeenCalledWith(
      'DELETE',
      '/files/file-id/2-fa3a3bec'
    )
  })

  it('deletes the version through the shared drive route when a driveId is given', async () => {
    const { client, fetchJSON } = setup()

    await destroyFileVersion({
      client,
      driveId: 'drive-id',
      version: { id: 'file-id/2-fa3a3bec' }
    })

    expect(fetchJSON).toHaveBeenCalledWith(
      'DELETE',
      '/sharings/drives/drive-id/file-id/2-fa3a3bec'
    )
  })
})
