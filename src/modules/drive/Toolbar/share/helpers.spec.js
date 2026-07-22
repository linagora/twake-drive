import {
  getPathToShareDisplayedFolder,
  makeDisplayedFolderShareLocation
} from '@/modules/drive/Toolbar/share/helpers'

describe('getPathToShareDisplayedFolder', () => {
  it('should return path to displayed folder share modal', () => {
    expect(getPathToShareDisplayedFolder('/path/to/folder/123')).toBe(
      '/path/to/folder/123/share'
    )
  })

  it('should return correct path if pathname ends with /', () => {
    expect(getPathToShareDisplayedFolder('/path/to/folder/123/')).toBe(
      '/path/to/folder/123/share'
    )
  })
})

describe('makeDisplayedFolderShareLocation', () => {
  it('preserves the active Sharings tab', () => {
    expect(
      makeDisplayedFolderShareLocation({
        location: {
          pathname: '/sharings/shareddrive/drive-id/folder-id',
          search: '?tab=drives'
        }
      })
    ).toEqual({
      pathname: '/sharings/shareddrive/drive-id/folder-id/share',
      search: '?tab=drives'
    })
  })
})
