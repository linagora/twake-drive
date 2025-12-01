import { useEffect, useMemo, useRef } from 'react'

import flag from 'cozy-flags'

import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

/**
 * Scrolls the virtualized list to the latest highlighted item present in the
 * current dataset. This ensures that newly created files/folders become
 * visible even when inserted outside the current viewport.
 *
 * @param {React.MutableRefObject} virtuosoRef - Ref to the Virtuoso component instance
 * @param {Array} items - Current array of items rendered by the list
 */
const useScrollToHighlightedItem = (virtuosoRef, items) => {
  const { highlightedItems } = useNewItemHighlightContext()
  const lastScrolledIdRef = useRef(null)
  const isHighlightEnabled = useMemo(
    () => flag('drive.highlight-new-items.enabled'),
    []
  )

  useEffect(() => {
    if (!isHighlightEnabled) {
      lastScrolledIdRef.current = null
      return
    }

    if (!highlightedItems?.length) {
      lastScrolledIdRef.current = null
      return
    }

    if (!Array.isArray(items) || items.length === 0) {
      return
    }

    const indexById = new Map()
    for (const [index, current] of items.entries()) {
      if (current?._id) {
        indexById.set(current._id, index)
      }
    }

    const targetItem = highlightedItems[highlightedItems.length - 1]

    if (
      !targetItem?._id ||
      !indexById.has(targetItem._id) ||
      targetItem._id === lastScrolledIdRef.current
    )
      return

    const targetIndex = indexById.get(targetItem._id)
    const virtuosoHandle = virtuosoRef?.current

    if (targetIndex === -1 || !virtuosoHandle) {
      return
    }

    virtuosoHandle.scrollToIndex({
      index: targetIndex,
      align: 'center',
      behavior: 'smooth'
    })

    lastScrolledIdRef.current = targetItem._id
  }, [highlightedItems, items, virtuosoRef, isHighlightEnabled])
}

export default useScrollToHighlightedItem
