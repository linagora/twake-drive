import { shareFileRootSharedDrive } from './shareFileRootSharedDrive'

import { DRIVE_ROOT_TYPE } from '@/modules/shareddrives/types'

describe('shareFileRootSharedDrive', () => {
  const t = key => key
  const navigate = jest.fn()

  const makeAction = ({
    isOwner = () => true,
    location = { pathname: '/sharings', search: '?tab=drives' }
  } = {}) => shareFileRootSharedDrive({ navigate, t, isOwner, location })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each`
    label                                     | docs                                                                                                      | isOwner                   | expected
    ${'file-root shared drive owned by user'} | ${[{ _id: 'file-id', driveId: 'drive-id', drive_root_type: DRIVE_ROOT_TYPE.FILE }]}                       | ${id => id === 'file-id'} | ${true}
    ${'file-root shared drive not owned'}     | ${[{ _id: 'file-id', driveId: 'drive-id', drive_root_type: DRIVE_ROOT_TYPE.FILE }]}                       | ${() => false}            | ${false}
    ${'folder-root shared drive'}             | ${[{ _id: 'folder-id', driveId: 'drive-id', drive_root_type: DRIVE_ROOT_TYPE.DIRECTORY }]}                | ${() => true}             | ${false}
    ${'document outside shared drive'}        | ${[{ _id: 'file-id' }]}                                                                                   | ${() => true}             | ${false}
    ${'multiple docs'}                        | ${[{ _id: 'file-id', driveId: 'drive-id', drive_root_type: DRIVE_ROOT_TYPE.FILE }, { _id: 'file-id-2' }]} | ${() => true}             | ${false}
  `('returns $expected for $label', ({ docs, isOwner, expected }) => {
    expect(makeAction({ isOwner }).displayCondition(docs)).toBe(expected)
  })

  it('layers the share modal over the sharings list', () => {
    makeAction().action([
      {
        _id: 'file-id',
        driveId: 'drive-id',
        drive_root_type: DRIVE_ROOT_TYPE.FILE
      }
    ])

    expect(navigate).toHaveBeenCalledWith({
      pathname: '/sharings/shareddrive/drive-id/file-id/share',
      search: '?tab=drives'
    })
  })

  it('navigates to the direct share route when pathname is outside /sharings', () => {
    makeAction({
      location: { pathname: '/recent', search: '?tab=by-me' }
    }).action([
      {
        _id: 'file-id',
        driveId: 'drive-id',
        drive_root_type: DRIVE_ROOT_TYPE.FILE
      }
    ])

    expect(navigate).toHaveBeenCalledWith({
      pathname: '/shareddrive/drive-id/file/file-id/share',
      search: ''
    })
  })
})
