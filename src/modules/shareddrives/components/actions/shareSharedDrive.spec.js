import { shareSharedDrive } from './shareSharedDrive'

import { DRIVE_ROOT_TYPE } from '@/modules/shareddrives/types'

describe('shareSharedDrive', () => {
  const t = key => key
  const navigate = jest.fn()

  const makeAction = ({ isOwner = () => true, pathname = '/sharings' } = {}) =>
    shareSharedDrive({ navigate, t, isOwner, pathname })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each`
    label                                       | doc                                                                               | isOwner                     | expected
    ${'folder-root shared drive owned by user'} | ${{ _id: 'folder-id', driveId: 'drive-id' }}                                      | ${id => id === 'folder-id'} | ${true}
    ${'folder-root shared drive not owned'}     | ${{ _id: 'folder-id', driveId: 'drive-id' }}                                      | ${() => false}              | ${false}
    ${'file-root shared drive'}                 | ${{ _id: 'file-id', driveId: 'drive-id', drive_root_type: DRIVE_ROOT_TYPE.FILE }} | ${() => true}               | ${false}
    ${'document outside shared drive'}          | ${{ _id: 'file-id' }}                                                             | ${() => true}               | ${false}
  `('returns $expected for $label', ({ doc, isOwner, expected }) => {
    expect(makeAction({ isOwner }).displayCondition([doc])).toBe(expected)
  })

  it('layers the share modal over the sharings list', () => {
    makeAction({ pathname: '/sharings' }).action([
      {
        _id: 'folder-id',
        id: 'folder-id',
        driveId: 'drive-id'
      }
    ])

    expect(navigate).toHaveBeenCalledWith(
      '/sharings/shareddrive/drive-id/folder-id/share'
    )
  })

  it('opens the folder view share modal when outside /sharings', () => {
    makeAction({ pathname: '/shareddrive/drive-id/folder-id' }).action([
      {
        _id: 'folder-id',
        id: 'folder-id',
        driveId: 'drive-id'
      }
    ])

    expect(navigate).toHaveBeenCalledWith(
      '/shareddrive/drive-id/folder-id/file/folder-id/share'
    )
  })
})
