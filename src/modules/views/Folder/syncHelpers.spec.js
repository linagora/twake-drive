import {
  isThereFileReferencedBySharingId,
  createSyncingFakeFile,
  computeSyncingFakeFile,
  checkSyncingFakeFileObsolescence,
  isReferencedByShareInSharingContext,
  isReceivedShare,
  filterOutReceivedShares
} from './syncHelpers'

const queryResults = [
  {
    id: 'directory',
    data: [
      {
        referenced_by: [
          {
            type: 'io.cozy.sharings',
            id: 'directory-sharing-id'
          },
          {
            type: 'io.cozy.otherType',
            id: 'other-type-id'
          }
        ]
      }
    ]
  },
  {
    id: 'file',
    data: [
      {
        referenced_by: []
      },
      {
        referenced_by: [
          {
            type: 'io.cozy.sharings',
            id: 'file-with-sharing-id'
          }
        ]
      }
    ]
  }
]

let sharingsValue

const setupComputeSyncingFakeFile = ({
  isEmpty = false,
  isSharingContextEmpty = false,
  queryResults,
  sharingId = '',
  sharingsValue,
  setSharingsValue = jest.fn(),
  fileValue = undefined
} = {}) => {
  const syncingFakeFile = computeSyncingFakeFile({
    isEmpty,
    isSharingContextEmpty,
    queryResults,
    sharingId,
    sharingsValue,
    setSharingsValue,
    fileValue
  })

  return { syncingFakeFile }
}

describe('syncHelpers', () => {
  beforeEach(() => {
    sharingsValue = {
      id1: {
        id: 'id1',
        attributes: {
          description: 'fileName.ext'
        }
      },
      'file-with-sharing-id': {
        id: 'file-with-sharing-id',
        attributes: {
          description: 'folderName'
        }
      }
    }
  })

  describe('isThereFileReferencedBySharingId', () => {
    it('should return true if a directory is referenced by the sharing id', () => {
      expect(
        isThereFileReferencedBySharingId(queryResults, 'directory-sharing-id')
      ).toBeTruthy()
    })

    it('should return true if a file is referenced by the sharing id', () => {
      expect(
        isThereFileReferencedBySharingId(queryResults, 'file-with-sharing-id')
      ).toBeTruthy()
    })

    it('should return false if no directory/file is referenced by the sharing id', () => {
      expect(
        isThereFileReferencedBySharingId(queryResults, 'no-sharing-id')
      ).toBeFalsy()
    })

    it('should return false if the reference id is not for io.cozy.sharings', () => {
      expect(
        isThereFileReferencedBySharingId(queryResults, 'other-type-id')
      ).toBeFalsy()
    })
  })

  describe('createSyncingFakeFile', () => {
    it('should return null if no sharing value', () => {
      expect(createSyncingFakeFile({})).toBeNull()
    })

    it('should return fake file well formated according to the sharing value', () => {
      expect(
        createSyncingFakeFile({
          sharingValue: sharingsValue.id1
        })
      ).toMatchObject({
        name: 'fileName.ext',
        id: 'id1',
        type: 'directory'
      })
    })
  })

  describe('checkSyncingFakeFileObsolescence', () => {
    it('should return syncingFakeFile if there is no file with the same id', () => {
      const syncingFakeFile = {
        id: 'fakeFileId'
      }

      expect(
        checkSyncingFakeFileObsolescence({
          queryResults,
          sharingId: 'id1',
          sharingsValue,
          setSharingsValue: jest.fn(),
          syncingFakeFile
        })
      ).toMatchObject(syncingFakeFile)
    })

    it('should return null if there is a file with the same id', () => {
      expect(
        checkSyncingFakeFileObsolescence({
          queryResults,
          sharingId: 'file-with-sharing-id',
          sharingsValue,
          setSharingsValue: jest.fn()
        })
      ).toBeNull()
    })
  })

  describe('computeSyncingFakeFile', () => {
    it('should return null if no content', () => {
      const { syncingFakeFile } = setupComputeSyncingFakeFile({ isEmpty: true })
      expect(syncingFakeFile).toBeNull()
    })

    it('should return null if no sharing context', () => {
      const { syncingFakeFile } = setupComputeSyncingFakeFile({
        isSharingContextEmpty: true
      })
      expect(syncingFakeFile).toBeNull()
    })

    it('should return null if no syncingFakeFile created (for example because no sharing context found)', () => {
      const { syncingFakeFile } = setupComputeSyncingFakeFile({
        sharingId: 'no-id',
        sharingsValue
      })
      expect(syncingFakeFile).toBeNull()
    })

    it('should return null if syncingFakeFile is no longer needed', () => {
      const { syncingFakeFile } = setupComputeSyncingFakeFile({
        sharingId: 'file-with-sharing-id',
        sharingsValue,
        queryResults
      })
      expect(syncingFakeFile).toBeNull()
    })

    it('should return syncingFakeFile if still needed', () => {
      const { syncingFakeFile } = setupComputeSyncingFakeFile({
        sharingId: 'id1',
        sharingsValue,
        queryResults
      })
      expect(syncingFakeFile).toMatchObject({
        name: 'fileName.ext',
        id: 'id1',
        type: 'directory'
      })
    })
  })

  describe('isReceivedShare', () => {
    const sharingRoot = {
      _id: 'shared-folder-id',
      relationships: {
        referenced_by: {
          data: [{ id: 'sharing-id', type: 'io.cozy.sharings' }]
        }
      }
    }
    const ownFile = {
      _id: 'own-file-id',
      relationships: {
        referenced_by: {
          data: [{ id: 'album-id', type: 'io.cozy.photos.albums' }]
        }
      }
    }

    it('returns true when referenced by a sharing the user does not own', () => {
      expect(isReceivedShare(sharingRoot, () => false)).toBe(true)
    })

    it('returns false for the owner of the sharing', () => {
      expect(isReceivedShare(sharingRoot, () => true)).toBe(false)
    })

    it('returns false when not referenced by any sharing', () => {
      expect(isReceivedShare(ownFile, () => false)).toBe(false)
    })

    it('returns false when there is no referenced_by relationship', () => {
      expect(isReceivedShare({ _id: 'x' }, () => false)).toBe(false)
    })

    it('returns false when referenced_by.data is null', () => {
      const file = {
        _id: 'x',
        relationships: { referenced_by: { data: null } }
      }
      expect(isReceivedShare(file, () => false)).toBe(false)
    })
  })

  describe('filterOutReceivedShares', () => {
    const isOwner = id => id === 'own-shared-folder'
    const results = [
      {
        data: [
          { _id: 'own-folder' },
          {
            _id: 'own-shared-folder',
            relationships: {
              referenced_by: {
                data: [{ id: 's1', type: 'io.cozy.sharings' }]
              }
            }
          },
          {
            _id: 'received-share',
            relationships: {
              referenced_by: {
                data: [{ id: 's2', type: 'io.cozy.sharings' }]
              }
            }
          }
        ],
        hasMore: true,
        fetchMore: jest.fn()
      }
    ]

    it('drops received shares but keeps own and own-shared files', () => {
      const [filtered] = filterOutReceivedShares(results, isOwner)
      expect(filtered.data.map(f => f._id)).toEqual([
        'own-folder',
        'own-shared-folder'
      ])
      expect(filtered.count).toBe(2)
    })

    it('preserves the other result properties', () => {
      const [filtered] = filterOutReceivedShares(results, isOwner)
      expect(filtered.hasMore).toBe(true)
      expect(filtered.fetchMore).toBe(results[0].fetchMore)
    })

    it('passes through results without data untouched', () => {
      const noData = [{ fetchStatus: 'loading' }]
      expect(filterOutReceivedShares(noData, isOwner)).toEqual(noData)
    })
  })

  describe('isReferencedByShareInSharingContext', () => {
    it('should return true or false if the file is referenced or not by a share in sharing context', () => {
      const referencedFile = {
        id: 'fileId',
        relationships: {
          referenced_by: {
            data: [{ id: 'file-with-sharing-id', type: 'io.cozy.sharings' }]
          }
        }
      }
      const notReferencedFile = {
        id: 'fileId',
        relationships: {
          referenced_by: {
            data: [{ id: 'file-without-sharing-id', type: 'io.cozy.sharings' }]
          }
        }
      }
      const FileWithNoReference = {
        id: 'fileId',
        relationships: {
          referenced_by: undefined
        }
      }

      expect(
        isReferencedByShareInSharingContext(referencedFile, sharingsValue)
      ).toBeTruthy()
      expect(
        isReferencedByShareInSharingContext(notReferencedFile, sharingsValue)
      ).toBeFalsy()
      expect(
        isReferencedByShareInSharingContext(FileWithNoReference, sharingsValue)
      ).toBeFalsy()
    })
  })
})
