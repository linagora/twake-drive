import { leaveSharedDrive } from './leaveSharedDrive'

describe('leaveSharedDrive', () => {
  const t = key => key
  const client = {
    collection: jest.fn(() => ({
      revokeSelf: jest.fn().mockResolvedValue()
    }))
  }
  const showAlert = jest.fn()

  const makeAction = ({ canLeave = () => true, isOwner = () => false } = {}) =>
    leaveSharedDrive({ client, showAlert, t, canLeave, isOwner })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('displayCondition', () => {
    it.each`
      label                                      | docs                                                          | canLeave       | isOwner        | expected
      ${'recipient of folder-root shared drive'} | ${[{ _id: 'folder-id', driveId: 'drive-id' }]}                | ${() => true}  | ${() => false} | ${true}
      ${'owner of folder-root shared drive'}     | ${[{ _id: 'folder-id', driveId: 'drive-id' }]}                | ${() => true}  | ${() => true}  | ${false}
      ${'org shared drive (B2B) recipient'}      | ${[{ _id: 'folder-id', driveId: 'drive-id' }]}                | ${() => false} | ${() => false} | ${false}
      ${'document outside shared drive'}         | ${[{ _id: 'file-id' }]}                                       | ${() => true}  | ${() => false} | ${false}
      ${'multiple documents selected'}           | ${[{ _id: 'a', driveId: 'd1' }, { _id: 'b', driveId: 'd2' }]} | ${() => true}  | ${() => false} | ${false}
    `(
      'returns $expected for $label',
      ({ docs, canLeave, isOwner, expected }) => {
        const action = makeAction({ canLeave, isOwner })
        expect(action.displayCondition(docs)).toBe(expected)
      }
    )

    it('hides the action for the owner even when canLeave returns true', () => {
      const action = makeAction({ canLeave: () => true, isOwner: () => true })
      expect(
        action.displayCondition([{ _id: 'folder-id', driveId: 'drive-id' }])
      ).toBe(false)
    })
  })

  describe('action', () => {
    it('revokes self on the sharing matching the driveId and shows a success alert', async () => {
      const revokeSelf = jest.fn().mockResolvedValue()
      client.collection.mockReturnValueOnce({ revokeSelf })

      const action = makeAction()
      await action.action([{ _id: 'folder-id', driveId: 'drive-id' }])

      expect(client.collection).toHaveBeenCalledWith('io.cozy.sharings')
      expect(revokeSelf).toHaveBeenCalledWith({ _id: 'drive-id' })
      expect(showAlert).toHaveBeenCalledWith({
        message: 'Files.share.revokeSelf.success',
        severity: 'success'
      })
    })
  })
})
