import { shareSharedDrive } from './shareSharedDrive'

import { DRIVE_ROOT_TYPE } from '@/modules/shareddrives/types'

describe('shareSharedDrive', () => {
  const t = key => key
  const navigate = jest.fn()

  const makeAction = ({
    isOwner,
    location = { pathname: '/sharings', search: '?tab=drives' }
  } = {}) => shareSharedDrive({ navigate, t, isOwner, location })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each`
    label                                             | doc                                                                               | expected
    ${'folder-root shared drive owned by user'}       | ${{ _id: 'folder-id', driveId: 'drive-id' }}                                      | ${true}
    ${'folder-root shared drive received from owner'} | ${{ _id: 'folder-id', driveId: 'drive-id' }}                                      | ${true}
    ${'file-root shared drive'}                       | ${{ _id: 'file-id', driveId: 'drive-id', drive_root_type: DRIVE_ROOT_TYPE.FILE }} | ${false}
    ${'document outside shared drive'}                | ${{ _id: 'file-id' }}                                                             | ${false}
  `('returns $expected for $label', ({ doc, expected }) => {
    expect(makeAction().displayCondition([doc])).toBe(expected)
  })

  it('shows the action for received folder-root shared drives', () => {
    const action = makeAction({ isOwner: () => false })

    expect(
      action.displayCondition([{ _id: 'folder-id', driveId: 'drive-id' }])
    ).toBe(true)
  })

  it('hides the action when multiple documents are selected', () => {
    const action = makeAction()

    expect(
      action.displayCondition([
        { _id: 'folder-id', driveId: 'drive-id' },
        { _id: 'other-folder-id', driveId: 'drive-id' }
      ])
    ).toBe(false)
  })

  it('layers the share modal over the sharings list', () => {
    makeAction().action([
      {
        _id: 'folder-id',
        id: 'folder-id',
        driveId: 'drive-id'
      }
    ])

    expect(navigate).toHaveBeenCalledWith({
      pathname: '/sharings/shareddrive/drive-id/folder-id/share',
      search: '?tab=drives'
    })
  })

  it('opens the folder view share modal when outside /sharings', () => {
    makeAction({
      location: {
        pathname: '/shareddrive/drive-id/folder-id',
        search: '?tab=by-me'
      }
    }).action([
      {
        _id: 'folder-id',
        id: 'folder-id',
        driveId: 'drive-id'
      }
    ])

    expect(navigate).toHaveBeenCalledWith({
      pathname: '/shareddrive/drive-id/folder-id/file/folder-id/share',
      search: ''
    })
  })
})
