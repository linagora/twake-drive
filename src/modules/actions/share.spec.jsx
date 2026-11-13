import { share } from './share'

describe('share action', () => {
  it('preserves search params when opening the share modal', () => {
    const navigate = jest.fn()
    const action = share({
      allLoaded: true,
      hasWriteAccess: true,
      navigate,
      pathname: '/sharings/with-me',
      search: '?f.contact=person%3Aalice%40example.com',
      shouldHideIfSharedDriveRecipient: false,
      t: key => key
    })

    action.action([{ id: 'file-id' }])

    expect(navigate).toHaveBeenCalledWith({
      pathname: '/sharings/with-me/file/file-id/share',
      search: '?f.contact=person%3Aalice%40example.com'
    })
  })

  it('opens the share modal of a shared drive item under its drive', () => {
    const navigate = jest.fn()
    const action = share({
      allLoaded: true,
      hasWriteAccess: true,
      navigate,
      pathname: '/recent',
      t: key => key,
      withDriveIdInModalPath: true
    })

    action.action([{ id: 'file-id', driveId: 'drive-id' }])

    expect(navigate).toHaveBeenCalledWith(
      '/recent/shareddrive/drive-id/file/file-id/share'
    )
  })
})
