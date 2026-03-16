import cloneDeep from 'lodash/cloneDeep'

import { IOCozyFile } from 'cozy-client/types/types'

import type { SelectedItems } from '@/modules/selection/types'

export const FORWARD_DIRECTION = 1 as const
export const BACKWARD_DIRECTION = -1 as const

interface HandleShiftSelectionResponse {
  newSelectedItems: SelectedItems
  lastInteractedItemId: string
}

interface FindNextBoundaryIndexParams {
  items: IOCozyFile[]
  startIdx: number
  direction: typeof FORWARD_DIRECTION | typeof BACKWARD_DIRECTION
  isMovingToSelect: boolean
  isReturnCurrent: boolean
  isItemSelected: (id: string) => boolean
}

interface ToggleSelectionParams {
  items: IOCozyFile[]
  selectedItems: SelectedItems
  currentIdx: number
  lastInteractedIdx: number
  isMovingToSelect: boolean
  isItemSelected: (id: string) => boolean
}

export interface HandleShiftArrowParams {
  direction: typeof FORWARD_DIRECTION | typeof BACKWARD_DIRECTION
  items: IOCozyFile[]
  selectedItems: SelectedItems
  lastInteractedIdx: number
  isItemSelected: (id: string) => boolean
}

export interface HandleShiftClickParams {
  startIdx: number
  endIdx: number
  selectedItems: SelectedItems
  items: IOCozyFile[]
}

/**
 * Clamps an index value to be within valid array bounds.
 * @param {number} maxLength The maximum length of the array
 * @param {number} index The index to clamp
 *
 * @returns {number} The clamped index value between 0 and maxLength-1
 */
const clamp = (maxLength: number, index: number): number =>
  Math.max(0, Math.min(maxLength - 1, index))

/**
 * Find the next index (in given direction) where selection state flips.
 * This defines the next "boundary" for select/deselect operations.
 * Used to determine where to stop when selecting or deselecting.
 *
 * @param {FindNextBoundaryIndexParams} params The parameters object
 * @param {IOCozyFile[]} params.items Array of all available items
 * @param {number} params.startIdx Starting index to search from
 * @param {number} params.direction Direction to search (1 for forward, -1 for backward)
 * @param {boolean} params.isMovingToSelect Whether we're moving to select or deselect items
 * @param {boolean} params.isReturnCurrent Determine if we have to find next index or not
 * @param {function} params.isItemSelected Function to check if an item is selected
 *
 * @returns {number} The index of the next boundary where selection state changes
 */
const findNextBoundaryIndex = ({
  items,
  startIdx,
  direction,
  isMovingToSelect,
  isReturnCurrent,
  isItemSelected
}: FindNextBoundaryIndexParams): number => {
  if (isReturnCurrent) return startIdx

  let idx = startIdx + direction

  while (
    idx >= 0 &&
    idx < items.length &&
    isMovingToSelect === isItemSelected(items[idx]?._id)
  ) {
    idx += direction
  }

  return clamp(items.length, idx - direction)
}

/**
 * Toggles the selection state of items based on keyboard navigation.
 * Handles the complex logic of selection or deselecting selections during Shift+Arrow operations.
 *
 * @param {ToggleSelectionParams} params The parameters object
 * @param {IOCozyFile[]} params.items Array of all available items
 * @param {SelectedItems} params.selectedItems Current selected items object
 * @param {number} params.currentIdx Current index being navigated to
 * @param {number} params.lastInteractedIdx Index of the last interacted item
 * @param {boolean} params.isMovingToSelect Whether we're moving to select or deselect items
 * @param {function} params.isItemSelected Function to check if an item is selected
 *
 * @returns {SelectedItems}
 */
const toggleSelection = ({
  items,
  selectedItems,
  currentIdx,
  lastInteractedIdx,
  isMovingToSelect,
  isItemSelected
}: ToggleSelectionParams): SelectedItems => {
  // Identify which item to modify (depends on selection direction)
  const targetItem = isMovingToSelect
    ? items[currentIdx]
    : isItemSelected(items[lastInteractedIdx]._id)
      ? items[lastInteractedIdx]
      : items[currentIdx]

  return Object.entries(selectedItems).reduce<SelectedItems>(
    (acc, [key, value]) => {
      if (isMovingToSelect) {
        acc[key] = value
        acc[targetItem._id] = targetItem
      } else {
        if (key !== targetItem._id) {
          acc[key] = value
        }
      }
      return acc
    },
    {}
  )
}

/**
 * Handle Shift + Arrow keyboard selection.
 * - If no items are selected, selects the first/last item based on direction
 * - Return selected items based on selection state
 * - Return focus position for continued navigation
 *
 * @param {HandleShiftArrowParams} params The parameters object
 * @param {number} params.direction Direction of arrow key (FORWARD_DIRECTION or BACKWARD_DIRECTION)
 * @param {IOCozyFile[]} [params.items] Array of all available items (defaults to empty array)
 * @param {SelectedItems} [params.selectedItems] Current selected items object (defaults to empty object)
 * @param {number} params.lastInteractedIdx Index of the last interacted item
 * @param {function} params.isItemSelected Function to check if an item is selected by _id
 *
 * @returns {HandleShiftSelectionResponse}
 */
export const handleShiftArrow = ({
  direction,
  items,
  selectedItems = {},
  lastInteractedIdx,
  isItemSelected
}: HandleShiftArrowParams): HandleShiftSelectionResponse => {
  if (Object.keys(selectedItems).length === 0) {
    const autoSelectedItem =
      direction === FORWARD_DIRECTION ? items[0] : items[items.length - 1]
    return {
      newSelectedItems: {
        [autoSelectedItem._id]: autoSelectedItem
      },
      lastInteractedItemId: autoSelectedItem._id
    }
  }

  const nextIdx = lastInteractedIdx + direction
  const currentIdx = clamp(items.length, nextIdx)

  const prevSelected = isItemSelected(items[lastInteractedIdx]?._id)
  const currSelected = isItemSelected(items[currentIdx]?._id)
  const isMovingToSelect = prevSelected && !currSelected

  const newSelectedItems = toggleSelection({
    items,
    selectedItems,
    currentIdx,
    lastInteractedIdx,
    isMovingToSelect,
    isItemSelected
  })

  // Updates focus position for continued navigation
  const finalIdx = findNextBoundaryIndex({
    items,
    startIdx: currentIdx,
    direction,
    isMovingToSelect,
    isItemSelected,
    isReturnCurrent: Object.keys(newSelectedItems).length <= 1
  })

  return {
    newSelectedItems,
    lastInteractedItemId: items[finalIdx]._id
  }
}

/**
 * Handle Shift + Click range selection.
 * - Selects all items in range if end item is not selected
 * - Deselects all items in range if end item is already selected
 * - Handles reverse ranges (endIdx < startIdx) automatically
 * - Return the last interacted item to the clicked item and new selections
 *
 * @param {HandleShiftClickParams} params The parameters object
 * @param {number} params.startIdx Starting index of the selection range (last interacted item)
 * @param {number} params.endIdx Ending index of the selection range (last clicked item)
 * @param {SelectedItems} params.selectedItems Current selected items object
 * @param {IOCozyFile[]} params.items Array of all available items
 *
 * @returns {HandleShiftSelectionResponse}
 */
export const handleShiftClick = ({
  startIdx,
  endIdx,
  selectedItems,
  items
}: HandleShiftClickParams): HandleShiftSelectionResponse => {
  const endItem = items[endIdx]
  const isMovingToSelect = !Object.hasOwn(selectedItems, endItem._id)
  const start = Math.min(startIdx, endIdx)
  const end = Math.max(startIdx, endIdx)

  const newSelectedItems = Array.from(
    { length: end - start + 1 },
    (_, i) => start + i
  ).reduce((acc, i) => {
    const item = items[i]
    if (isMovingToSelect) {
      acc[item._id] = item
    } else {
      const { [item._id]: _, ...rest } = acc
      return rest
    }
    return acc
  }, cloneDeep(selectedItems))

  return {
    newSelectedItems,
    lastInteractedItemId: items[endIdx]._id
  }
}
