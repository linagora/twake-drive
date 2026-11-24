import { download } from './download'

describe('download', () => {
  const { displayCondition } = download({ t: key => key })

  it('is offered for items of one drive', () => {
    expect(
      displayCondition([
        { _id: 'a', driveId: 'drive-1' },
        { _id: 'b', driveId: 'drive-1' }
      ])
    ).toBe(true)
    expect(displayCondition([{ _id: 'a' }, { _id: 'b' }])).toBe(true)
  })

  it('is not offered for items of several drives', () => {
    expect(
      displayCondition([{ _id: 'a' }, { _id: 'b', driveId: 'drive-1' }])
    ).toBe(false)
  })
})
