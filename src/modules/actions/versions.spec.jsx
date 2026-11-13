import { versions } from './versions'

describe('versions action', () => {
  it('opens the history of a shared drive item under its drive', () => {
    const navigate = jest.fn()
    const action = versions({
      navigate,
      pathname: '/recent',
      t: key => key,
      withDriveIdInModalPath: true
    })

    action.action([{ id: 'file-id', driveId: 'drive-id' }])

    expect(navigate).toHaveBeenCalledWith(
      '/recent/shareddrive/drive-id/file/file-id/revision'
    )
  })
})
