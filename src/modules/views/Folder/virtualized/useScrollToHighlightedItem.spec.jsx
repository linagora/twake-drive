import { renderHook } from '@testing-library/react-hooks'

import flag from 'cozy-flags'

import useScrollToHighlightedItem from './useScrollToHighlightedItem'

import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

jest.mock('cozy-flags', () => jest.fn())
jest.mock('@/modules/upload/NewItemHighlightProvider', () => ({
  useNewItemHighlightContext: jest.fn()
}))

describe('useScrollToHighlightedItem', () => {
  let highlightedItemsValue
  let virtuosoRef

  beforeEach(() => {
    highlightedItemsValue = []
    virtuosoRef = {
      current: {
        scrollToIndex: jest.fn()
      }
    }

    flag.mockReturnValue(true)
    useNewItemHighlightContext.mockImplementation(() => ({
      highlightedItems: highlightedItemsValue
    }))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const setHighlightedItems = items => {
    highlightedItemsValue = items
    useNewItemHighlightContext.mockImplementation(() => ({
      highlightedItems: highlightedItemsValue
    }))
  }

  it('scrolls to the highlighted item present in the dataset', async () => {
    setHighlightedItems([{ _id: 'match' }])
    const items = [{ _id: 'foo' }, { _id: 'match' }, { _id: 'bar' }]

    const { waitFor } = renderHook(() =>
      useScrollToHighlightedItem(virtuosoRef, items)
    )

    await waitFor(() =>
      expect(virtuosoRef.current.scrollToIndex).toHaveBeenCalledWith({
        index: 1,
        align: 'center',
        behavior: 'smooth'
      })
    )
  })

  it('does nothing when the highlight feature flag is disabled', async () => {
    flag.mockReturnValue(false)
    setHighlightedItems([{ _id: 'match' }])
    const items = [{ _id: 'match' }]

    renderHook(() => useScrollToHighlightedItem(virtuosoRef, items))

    expect(virtuosoRef.current.scrollToIndex).not.toHaveBeenCalled()
  })
})
