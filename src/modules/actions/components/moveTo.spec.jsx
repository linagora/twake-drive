import { moveTo } from './moveTo'

const makeAction = navigate =>
  moveTo({
    t: key => key,
    canMove: true,
    pathname: '/recent',
    navigate,
    isMobile: false,
    withDriveIdInModalPath: true
  })

describe('moveTo action', () => {
  it('opens the move modal of shared drive items in their drive folder', () => {
    const navigate = jest.fn()
    const action = makeAction(navigate)

    action.action([{ id: 'file-1', driveId: 'drive-1', dir_id: 'folder-1' }])

    expect(navigate).toHaveBeenCalledWith(
      { pathname: '/recent/shareddrive/drive-1/folder-1/move', search: '' },
      { state: { fileIds: ['file-1'] } }
    )
  })

  it('is shown for items of the same drive folder', () => {
    const action = makeAction(jest.fn())

    expect(
      action.displayCondition([
        { id: 'file-1', driveId: 'drive-1', dir_id: 'folder-1' },
        { id: 'file-2', driveId: 'drive-1', dir_id: 'folder-1' }
      ])
    ).toBe(true)
  })

  it('is hidden when the items come from different folders or drives', () => {
    const action = makeAction(jest.fn())

    expect(
      action.displayCondition([
        { id: 'file-1', driveId: 'drive-1', dir_id: 'folder-1' },
        { id: 'file-2', driveId: 'drive-1', dir_id: 'folder-2' }
      ])
    ).toBe(false)
    expect(
      action.displayCondition([
        { id: 'file-1', driveId: 'drive-1', dir_id: 'folder-1' },
        { id: 'file-2', dir_id: 'folder-1' }
      ])
    ).toBe(false)
  })

  it('is shown for local items from different folders', () => {
    const action = makeAction(jest.fn())

    expect(
      action.displayCondition([
        { id: 'file-1', dir_id: 'folder-1' },
        { id: 'file-2', dir_id: 'folder-2' }
      ])
    ).toBe(true)
  })
})
