import { infos } from './infos'

import { DRIVE_ROOT_TYPE } from '@/modules/shareddrives/types'

describe('infos', () => {
  const t = key => key

  it('should navigate file-root shared drive recipients to the shared drive viewer route', () => {
    const navigate = jest.fn()
    const action = infos({ t, isMobile: false, navigate })

    action.action([
      {
        _id: 'file-id',
        type: 'file',
        driveId: 'drive-id',
        drive_root_type: DRIVE_ROOT_TYPE.FILE
      }
    ])

    expect(navigate).toHaveBeenCalledWith(
      '/shareddrive/drive-id/file/file-id',
      {
        state: { fromPathname: '' }
      }
    )
  })

  it('should keep file-root shared drive details inside sharings when opened from sharings', () => {
    const navigate = jest.fn()
    const action = infos({
      t,
      isMobile: false,
      navigate,
      pathname: '/sharings'
    })

    action.action([
      {
        _id: 'file-id',
        type: 'file',
        driveId: 'drive-id',
        drive_root_type: DRIVE_ROOT_TYPE.FILE
      }
    ])

    expect(navigate).toHaveBeenCalledWith(
      '/sharings/shareddrive/drive-id/file/file-id',
      { state: { fromPathname: '/sharings' } }
    )
  })

  it('should keep the regular file route for other files', () => {
    const navigate = jest.fn()
    const action = infos({ t, isMobile: false, navigate })

    action.action([
      {
        _id: 'file-id',
        type: 'file'
      }
    ])

    expect(navigate).toHaveBeenCalledWith('file/file-id')
  })
})
