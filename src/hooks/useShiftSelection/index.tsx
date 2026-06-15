/* eslint-disable react-hooks/refs */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  RefObject
} from 'react'

import { IOCozyFile } from 'cozy-client/types/types'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import {
  handleShiftClick,
  handleShiftArrow,
  BACKWARD_DIRECTION,
  FORWARD_DIRECTION
} from './helpers'

import { isEditableTarget } from '@/hooks/helpers'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import { scrollElementIntoViewInContainer } from '@/modules/selection/scrollHelpers'
import { SelectedItems } from '@/modules/selection/types'

type ViewType = 'list' | 'grid'

interface UseShiftSelectionParams {
  items: IOCozyFile[]
  viewType?: ViewType
  scrollElement?: HTMLElement | null
}

interface UseShiftSelectionReturn {
  setLastInteractedItem: (id: string | null) => void
  onShiftClick: (clickedItemId: string, event: KeyboardEvent) => void
}

/**
 * Custom hook that provides shift-based range selection functionality for file/folder lists.
 *
 * This hook enables users to:
 * - Select ranges of items using Shift+Click (from last interacted item to clicked item)
 * - Navigate and extend selection using Shift+Arrow keys (direction depends on viewType)
 *
 * After each navigation the hook scrolls the rendered `[data-file-id]`
 * element of the new lastInteractedItem into view. It uses the same kind
 * of DOM scroll container as rectangular selection: compare item and
 * scroll container bounds, then call `scrollBy` only for the missing
 * distance.
 *
 * @param {UseShiftSelectionParams} params - Configuration object containing items and view type
 * @param {IOCozyFile[]} params.items - Array of IOCozyFile objects to enable selection on
 * @param {ViewType} params.viewType - View type ('list' or 'grid') that determines keyboard navigation behavior
 * @param {HTMLElement|null} params.scrollElement - Optional scrollable DOM container
 * @param ref - React ref to the container element that should receive keyboard events
 *
 * @returns {UseShiftSelectionReturn}
 */
const useShiftSelection = (
  { items, viewType = 'list', scrollElement = null }: UseShiftSelectionParams,
  ref: RefObject<HTMLElement>
): UseShiftSelectionReturn => {
  const { isMobile } = useBreakpoints()

  const itemsRef = useRef<IOCozyFile[]>([])
  itemsRef.current = useMemo(() => items, [items])

  /**
   * Scrolls the lastInteractedItem into view inside the scroll container.
   * This mirrors rectangular selection: use the actual scrollable element
   * and scroll only by the amount needed to reveal the current item.
   */
  const scrollToItem = useCallback(
    (id: string) => {
      const container = scrollElement || ref.current
      if (!container) return

      const element = container.querySelector(`[data-file-id="${id}"]`)
      if (!element) return

      scrollElementIntoViewInContainer(container, element)
    },
    [ref, scrollElement]
  )

  const { selectedItems, setSelectedItems, isItemSelected, setIsSelectAll } =
    useSelectionContext()

  const [lastInteractedItem, setLastInteractedItem] = useState<string | null>(
    null
  )

  const lastInteractedIdx = useMemo(() => {
    return lastInteractedItem
      ? itemsRef.current.findIndex(item => item._id === lastInteractedItem)
      : 0
  }, [lastInteractedItem])

  const selectedItemMap: SelectedItems = useMemo(() => {
    return selectedItems.reduce<SelectedItems>((acc, item) => {
      acc[item._id] = item
      return acc
    }, {})
  }, [selectedItems])

  /**
   * Handles shift+click events for range selection.
   *
   * When shift key is held and an item is clicked, selects or deselects all items
   * between the last interacted item and the clicked item (inclusive).
   *
   * @param {string} clickedItemId - ID of the item that was clicked
   * @param {KeyboardEvent} event - The keyboard event (must have shiftKey = true)
   */
  const onShiftClick = useCallback(
    (clickedItemId: string, event: KeyboardEvent) => {
      if (!event.shiftKey) return

      event.stopPropagation()

      const endIdx = items.findIndex(item => item._id === clickedItemId)
      const { newSelectedItems, lastInteractedItemId } = handleShiftClick({
        startIdx: lastInteractedIdx,
        endIdx,
        selectedItems: selectedItemMap,
        items
      })

      setSelectedItems(newSelectedItems)
      setLastInteractedItem(lastInteractedItemId)
      setIsSelectAll(
        Object.keys(newSelectedItems).length === itemsRef.current.length
      )
      scrollToItem(lastInteractedItemId)
    },
    [
      items,
      lastInteractedIdx,
      selectedItemMap,
      setSelectedItems,
      setIsSelectAll,
      setLastInteractedItem,
      scrollToItem
    ]
  )

  /**
   * Handles keyboard events for shift+arrow navigation.
   *
   * Listens for shift+arrow key combinations and extends/contracts selection
   * based on the navigation direction. The specific arrow keys depend on viewType:
   * - List view: ArrowUp (backward) / ArrowDown (forward)
   * - Grid view: ArrowLeft (backward) / ArrowRight (forward)
   *
   * @param {KeyboardEvent} event - The keyboard event to handle
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!event.shiftKey) return

      const key = event.key
      const isListKey =
        viewType === 'list' && ['ArrowUp', 'ArrowDown'].includes(key)
      const isGridKey =
        viewType === 'grid' && ['ArrowLeft', 'ArrowRight'].includes(key)

      if (!isListKey && !isGridKey) return

      event.preventDefault()

      const direction =
        key === 'ArrowUp' || key === 'ArrowLeft'
          ? BACKWARD_DIRECTION
          : FORWARD_DIRECTION

      const { newSelectedItems, lastInteractedItemId } = handleShiftArrow({
        direction,
        items: itemsRef.current,
        selectedItems: selectedItemMap,
        lastInteractedIdx,
        isItemSelected
      })

      setSelectedItems(newSelectedItems)
      setLastInteractedItem(lastInteractedItemId)
      setIsSelectAll(
        Object.keys(newSelectedItems).length === itemsRef.current.length
      )
      scrollToItem(lastInteractedItemId)
    },
    [
      viewType,
      selectedItemMap,
      lastInteractedIdx,
      selectedItems.length,
      setSelectedItems,
      isItemSelected,
      setIsSelectAll,
      setLastInteractedItem,
      scrollToItem
    ]
  )

  /**
   * Sets up keyboard event listeners on the container element.
   *
   * - Focuses the container to ensure it can receive keyboard events
   * - Adds keydown event listener for shift+arrow navigation
   * - Skips setup on mobile devices or when no items/container available
   */
  useEffect(() => {
    if (isMobile || !itemsRef.current.length || !ref.current) return

    const container = ref.current
    if (!isEditableTarget(document.activeElement)) {
      container.focus()
    }

    container.addEventListener('keydown', handleKeyDown)
    return (): void => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobile, ref, handleKeyDown])

  return {
    setLastInteractedItem,
    onShiftClick
  }
}

export { useShiftSelection }
