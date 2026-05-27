import { shareSharedDrive } from './shareSharedDrive'

import { DRIVE_ROOT_TYPE } from '@/modules/shareddrives/types'

describe('shareSharedDrive', () => {
  const t = key => key
  const navigate = jest.fn()

  const makeAction = ({ isOwner = () => true } = {}) =>
    shareSharedDrive({ navigate, t, isOwner })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each`
    label                                     | doc                                        | isOwner                   | expected
    ${'shared drive recipient owned by user'} | ${{ _id: 'file-id', driveId: 'drive-id' }} | ${id => id === 'file-id'} | ${true}
    ${'shared drive recipient not owned'}     | ${{ _id: 'file-id', driveId: 'drive-id' }} | ${() => false}            | ${false}
    ${'document outside shared drive'}        | ${{ _id: 'file-id' }}                      | ${() => true}             | ${false}
  `('returns $expected for $label', ({ doc, isOwner, expected }) => {
    expect(makeAction({ isOwner }).displayCondition([doc])).toBe(expected)
  })

  it('navigates file-root shared drive with _id', () => {
    makeAction().action([
      {
        _id: 'file-id',
        driveId: 'drive-id',
        drive_root_type: DRIVE_ROOT_TYPE.FILE
      }
    ])

    expect(navigate).toHaveBeenCalledWith(
      '/sharings/shareddrive/drive-id/file/file-id/share'
    )
  })

  it('should open the folder-root shared drive share modal', () => {
    makeAction().action([
      {
        _id: 'folder-id',
        driveId: 'drive-id',
        drive_root_type: DRIVE_ROOT_TYPE.DIRECTORY
      }
    ])

    expect(navigate).toHaveBeenCalledWith(
      '/shareddrive/drive-id/folder-id/file/folder-id/share'
    )
  })
})
