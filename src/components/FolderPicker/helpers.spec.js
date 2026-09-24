import { areTargetsInCurrentDir, getParentFolder } from './helpers'

describe('getParentFolder', () => {
  it('leaves a federated root without fetching its private parent on the owner', async () => {
    const root = { _id: 'io.cozy.files.root-dir' }
    const client = {
      fetchQueryAndGetFromState: jest
        .fn()
        .mockResolvedValueOnce({
          data: { rules: [{ values: ['shared-root'] }] }
        })
        .mockResolvedValueOnce({ data: root })
    }
    const result = await getParentFolder(
      client,
      {
        _id: 'shared-root',
        _type: 'io.cozy.files',
        dir_id: 'private-owner-parent',
        driveId: 'sharing-1'
      },
      {}
    )
    expect(result).toBe(root)
    expect(
      client.fetchQueryAndGetFromState.mock.calls[1][0].definition.id
    ).toBe(root._id)
  })

  it('uses the real parent of an ordinary file in the legacy folder', async () => {
    const parent = { _id: 'io.cozy.files.shared-drives-dir' }
    const client = {
      fetchQueryAndGetFromState: jest.fn().mockResolvedValue({ data: parent })
    }
    expect(
      await getParentFolder(
        client,
        {
          _id: 'kept-file',
          _type: 'io.cozy.files',
          dir_id: parent._id
        },
        {}
      )
    ).toBe(parent)
    expect(
      client.fetchQueryAndGetFromState.mock.calls[0][0].definition.id
    ).toBe(parent._id)
  })
})

describe('areTargetsInCurrentDir', () => {
  it('should return false if the current folder is undefined', () => {
    const targets = [
      { _id: 'folder1', path: '/folder1' },
      { _id: 'folder2', path: '/folder2' }
    ]
    const folder = undefined

    expect(areTargetsInCurrentDir(targets, folder)).toBe(false)
  })

  it('should return true if all targets are in the current folder', () => {
    const targets = [
      { _id: 'folder1', path: '/folder1', dir_id: 'currentFolder' },
      { _id: 'folder2', path: '/folder2', dir_id: 'currentFolder' }
    ]
    const folder = { _id: 'currentFolder', path: '/currentFolder' }

    expect(areTargetsInCurrentDir(targets, folder)).toBe(true)
  })

  it('should return false if not all targets are in the current folder', () => {
    const targets = [
      { _id: 'folder1', path: '/folder1', dir_id: 'currentFolder' },
      { _id: 'folder2', path: '/folder2', dir_id: 'otherFolder' }
    ]
    const folder = { _id: 'currentFolder', path: '/currentFolder' }

    expect(areTargetsInCurrentDir(targets, folder)).toBe(false)
  })

  it('should return true if all targets are in the root folder', () => {
    const targets = [
      { _id: 'folder1', path: '/folder1' },
      { _id: 'file1', path: '/file1.png' }
    ]
    const folder = { _id: 'io.cozy.files.root-dir', path: '/' }

    expect(areTargetsInCurrentDir(targets, folder)).toBe(true)
  })

  it('should return true if all targets are in a subfolder', () => {
    const targets = [
      { _id: 'folder3', path: '/folder1/folder2/folder3' },
      { _id: 'file1', path: '/folder1/folder2/file1.png' }
    ]
    const folder = { _id: 'folder2', path: '/folder1/folder2' }

    expect(areTargetsInCurrentDir(targets, folder)).toBe(true)
  })

  it('should return false if all targets deeper inside subfolders', () => {
    const targets = [
      { _id: 'folder3', path: '/folder1/folder2/folder3' },
      { _id: 'file1', path: '/folder1/folder2/file1.png' }
    ]
    const folder = { _id: 'folder1', path: '/folder1' }

    expect(areTargetsInCurrentDir(targets, folder)).toBe(false)
  })
})
