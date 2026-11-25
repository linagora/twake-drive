import { restore } from './restore'

const trashedDriveItem = {
  _id: 'hello',
  driveId: 'drive-1',
  type: 'file',
  trashed: true
}

const isRestoreOffered = hasItemWriteAccess =>
  restore({ t: key => key, hasItemWriteAccess }).displayCondition([
    trashedDriveItem
  ])

describe('restore', () => {
  it('is offered on a trashed item of a drive the user can write', () => {
    expect(isRestoreOffered(() => true)).toBe(true)
  })

  it('is not offered on a trashed item of a drive the user can only read', () => {
    expect(isRestoreOffered(() => false)).toBe(false)
  })

  it('is offered without a write check, as in the Bin view', () => {
    expect(isRestoreOffered(undefined)).toBe(true)
  })
})
