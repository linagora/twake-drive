import { shareSharedDrive } from './shareSharedDrive'

import { DRIVE_ROOT_TYPE } from '@/modules/shareddrives/types'

jest.mock('@/modules/actions/helpers', () => ({
  navigateToModal: jest.fn(({ navigate, pathname, files, path }) =>
    navigate(`MOCKED_MODAL?pathname=${pathname}&path=${path}`, { files })
  )
}))

const { navigateToModal } = require('@/modules/actions/helpers')

describe('shareSharedDrive', () => {
  const t = key => key
  const navigate = jest.fn()

  const makeAction = ({ isOwner = () => true } = {}) =>
    shareSharedDrive({ navigate, t, isOwner })

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

  it('opens the folder-root shared drive share modal', () => {
    makeAction().action([
      {
        _id: 'folder-id',
        id: 'folder-id',
        driveId: 'drive-id'
      }
    ])

    expect(navigateToModal).toHaveBeenCalledWith({
      navigate,
      pathname: '/shareddrive/drive-id/folder-id',
      files: [{ _id: 'folder-id', id: 'folder-id', driveId: 'drive-id' }],
      path: 'share'
    })
  })
})
