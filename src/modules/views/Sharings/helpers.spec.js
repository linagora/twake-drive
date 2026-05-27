import { buildSharingsActionsOptions } from './helpers'

describe('buildSharingsActionsOptions', () => {
  it('should pass isOwner from sharing context to actions options', () => {
    const isOwner = jest.fn()
    const refresh = jest.fn()
    const toggleSelectAllItems = jest.fn()
    const data = [{ _id: 'file-1' }]

    const actionsOptions = buildSharingsActionsOptions({
      base: { toggleSelectAllItems },
      nativeSharing: {},
      sharingContext: {
        allLoaded: true,
        refresh,
        isOwner
      },
      filteredResult: { data }
    })

    expect(actionsOptions).toMatchObject({
      isOwner,
      refresh,
      allLoaded: true
    })

    actionsOptions.selectAll()
    expect(toggleSelectAllItems).toHaveBeenCalledWith(data)
  })
})
