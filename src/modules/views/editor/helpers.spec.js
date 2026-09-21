import {
  fetchFileBinary,
  makePublicEditorUrl,
  makeShareUrl,
  shouldBeOpenedOnOtherInstance
} from '@/modules/views/editor/helpers'

describe('shouldBeOpenedOnOtherInstance', () => {
  it('should return true if current instance is different from document instance', () => {
    expect(
      shouldBeOpenedOnOtherInstance(
        {
          data: {
            attributes: {
              instance: 'alice.cozy.localhost:8080'
            }
          }
        },
        'http://bob.cozy.localhost:8080'
      )
    ).toBe(true)
  })

  it('should return true if current instance is different from document instance without port', () => {
    expect(
      shouldBeOpenedOnOtherInstance(
        {
          data: {
            attributes: {
              instance: 'alice.cozy.localhost'
            }
          }
        },
        'http://bob.cozy.localhost'
      )
    ).toBe(true)
  })

  it('should return true if current instance is different from document instance with org instance', () => {
    expect(
      shouldBeOpenedOnOtherInstance(
        {
          data: {
            attributes: {
              instance: 'myorgc81729.example.com:8080'
            }
          }
        },
        ' http://myusermyorgc81729.example.com:8080'
      )
    ).toBe(true)
  })

  it('should return false if current instance is equal to document instance', () => {
    expect(
      shouldBeOpenedOnOtherInstance(
        {
          data: {
            attributes: {
              instance: 'alice.cozy.localhost:8080'
            }
          }
        },
        'http://alice.cozy.localhost:8080'
      )
    ).toBe(false)
  })

  it('should return false if current instance is equal to document instance without port', () => {
    expect(
      shouldBeOpenedOnOtherInstance(
        {
          data: {
            attributes: {
              instance: 'alice.cozy.localhost'
            }
          }
        },
        'http://alice.cozy.localhost'
      )
    ).toBe(false)
  })

  it('should return false without a current instance uri', () => {
    expect(
      shouldBeOpenedOnOtherInstance(
        { data: { attributes: { instance: 'alice.cozy.localhost' } } },
        undefined
      )
    ).toBe(false)
  })
})

describe('makePublicEditorUrl', () => {
  const attributes = {
    protocol: 'https',
    instance: 'alice.cozy.example',
    subdomain: 'flat',
    sharecode: 'abc123',
    public_name: 'Bob'
  }

  it('points at the public drive page of the resolved instance', () => {
    expect(
      makePublicEditorUrl({ attributes, hash: '/excalidraw/owner-file-id' })
    ).toBe(
      'https://alice-drive.cozy.example/public/?sharecode=abc123&username=Bob#/excalidraw/owner-file-id'
    )
  })

  it('honours a nested subdomain', () => {
    expect(
      makePublicEditorUrl({
        attributes: { ...attributes, subdomain: 'nested' },
        hash: '/pdf/owner-file-id'
      })
    ).toContain('https://drive.alice.cozy.example/public/')
  })

  it('forwards the link to come back to', () => {
    expect(
      makePublicEditorUrl({
        attributes,
        hash: '/excalidraw/owner-file-id',
        redirectLink: 'drive#/folder/io.cozy.files.root-dir'
      })
    ).toContain('redirectLink=drive%23%2Ffolder%2Fio.cozy.files.root-dir')
  })

  it('forwards the link to manage the sharing', () => {
    expect(
      makePublicEditorUrl({
        attributes,
        hash: '/excalidraw/owner-file-id',
        shareUrl: 'https://bob-drive.cozy.example/#/sharings/with-me'
      })
    ).toContain(
      'shareUrl=https%3A%2F%2Fbob-drive.cozy.example%2F%23%2Fsharings%2Fwith-me'
    )
  })

  it('omits the username when the stack could not name the visitor', () => {
    expect(
      makePublicEditorUrl({
        attributes: { ...attributes, public_name: undefined },
        hash: '/excalidraw/owner-file-id'
      })
    ).not.toContain('username')
  })

  // generateWebLink turns a missing hash into a bare '#/'.
  it('carries the extra params an editor needs instead of a hash', () => {
    expect(
      makePublicEditorUrl({
        attributes,
        searchParams: [
          ['isOnlyOfficeDocShared', true],
          ['onlyOfficeDocId', 'owner-file-id']
        ]
      })
    ).toBe(
      'https://alice-drive.cozy.example/public/?sharecode=abc123&isOnlyOfficeDocShared=true&onlyOfficeDocId=owner-file-id&username=Bob#/'
    )
  })
})

describe('fetchFileBinary', () => {
  const fetch = jest.fn().mockResolvedValue('response')
  const collection = jest.fn((doctype, options) => ({
    prefix: options.driveId ? `/sharings/drives/${options.driveId}` : '/files',
    stackClient: { fetch }
  }))
  const client = { collection }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('downloads the binary bypassing the HTTP cache', async () => {
    const response = await fetchFileBinary(client, 'file1')

    expect(response).toBe('response')
    expect(collection).toHaveBeenCalledWith('io.cozy.files', {})
    expect(fetch).toHaveBeenCalledWith(
      'GET',
      '/files/download/file1',
      undefined,
      { cache: 'no-store' }
    )
  })

  it('downloads from the shared drive when a driveId is given', async () => {
    await fetchFileBinary(client, 'file1', 'drive9')

    expect(collection).toHaveBeenCalledWith('io.cozy.files', {
      driveId: 'drive9'
    })
    expect(fetch).toHaveBeenCalledWith(
      'GET',
      '/sharings/drives/drive9/download/file1',
      undefined,
      { cache: 'no-store' }
    )
  })
})

describe('makeShareUrl', () => {
  const client = {
    getStackClient: () => ({ uri: 'https://bob.cozy.example' }),
    getInstanceOptions: () => ({ subdomain: 'flat' })
  }

  it('opens the share modal over the shared-with-me tab of the recipient drive', () => {
    expect(makeShareUrl(client, { fileId: 'recipient-file-id' })).toBe(
      'https://bob-drive.cozy.example/#/sharings/with-me/file/recipient-file-id/share'
    )
  })

  it('opens the share modal over the shared drive folder the file comes from', () => {
    expect(
      makeShareUrl(client, {
        fileId: 'file-id',
        driveId: 'drive-id',
        redirectLink: 'drive#/sharings/with-me/shareddrive/drive-id/folder-id'
      })
    ).toBe(
      'https://bob-drive.cozy.example/#/sharings/with-me/shareddrive/drive-id/folder-id/file/file-id/share'
    )
  })

  it('offers nothing for a shared drive file opened without a folder to come back to', () => {
    expect(
      makeShareUrl(client, { fileId: 'file-id', driveId: 'drive-id' })
    ).toBeUndefined()
  })
})
