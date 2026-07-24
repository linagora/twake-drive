import { computeIsSharingsOwner } from './useFileLink'

describe('computeIsSharingsOwner', () => {
  const ownerSharingContext = {
    allLoaded: true,
    byDocId: { 'file-1': {} },
    isOwner: jest.fn((docId: string) => docId === 'file-1')
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns true for an owner shared document opened from a tab route', () => {
    expect(
      computeIsSharingsOwner({
        file: {
          _id: 'file-1',
          _type: 'io.cozy.files',
          type: 'file',
          name: 'file.pdf',
          dir_id: 'io.cozy.files.root-dir'
        },
        pathname: '/sharings/by-me',
        isPublic: false,
        sharingContext: ownerSharingContext
      })
    ).toBe(true)
  })

  it('returns false for a document absent from byDocId', () => {
    expect(
      computeIsSharingsOwner({
        file: {
          _id: 'nested-file-1',
          _type: 'io.cozy.files',
          type: 'file',
          name: 'nested-file.pdf',
          dir_id: 'shared-folder-1'
        },
        pathname: '/sharings/with-me/folder/shared-folder-1',
        isPublic: false,
        sharingContext: {
          allLoaded: true,
          byDocId: {},
          isOwner: jest.fn(() => true)
        }
      })
    ).toBe(false)
  })

  it('returns false while sharings are not loaded', () => {
    expect(
      computeIsSharingsOwner({
        file: {
          _id: 'file-1',
          _type: 'io.cozy.files',
          type: 'file',
          name: 'file.pdf',
          dir_id: 'io.cozy.files.root-dir'
        },
        pathname: '/sharings/by-me',
        isPublic: false,
        sharingContext: {
          ...ownerSharingContext,
          allLoaded: false
        }
      })
    ).toBe(false)
  })

  it('returns false in public mode', () => {
    expect(
      computeIsSharingsOwner({
        file: {
          _id: 'file-1',
          _type: 'io.cozy.files',
          type: 'file',
          name: 'file.pdf',
          dir_id: 'io.cozy.files.root-dir'
        },
        pathname: '/sharings/by-me',
        isPublic: true,
        sharingContext: ownerSharingContext
      })
    ).toBe(false)
  })
})
