import { useCallback, useEffect, useMemo } from 'react'

import { shouldBlockKeyboardShortcuts } from '@/hooks/helpers'
import { useShiftSelection } from '@/hooks/useShiftSelection'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'

export const useFilePickerSelection = ({
  items,
  canSelectItem,
  multiple,
  selectionContainerRef,
  scrollElement,
  scrollToIndex
}) => {
  const {
    selectedItems,
    setSelectedItems,
    selectAll,
    clearSelection,
    isItemSelected,
    setIsSelectAll
  } = useSelectionContext()

  const selectableItems = useMemo(
    () => items.filter(canSelectItem),
    [items, canSelectItem]
  )

  const scrollToSelectableItem = useCallback(
    (index, align) => {
      const selectableItem = selectableItems[index]
      const itemIndex = items.findIndex(item => item._id === selectableItem._id)
      scrollToIndex?.(itemIndex, align)
    },
    [items, scrollToIndex, selectableItems]
  )

  const selectedItemsById = useMemo(
    () =>
      selectedItems.reduce((acc, item) => {
        acc[item._id] = item
        return acc
      }, {}),
    [selectedItems]
  )

  const selectedItemIds = useMemo(
    () => selectedItems.map(item => item._id),
    [selectedItems]
  )

  const { setLastInteractedItem, onShiftClick } = useShiftSelection(
    {
      items: multiple ? selectableItems : [],
      viewType: 'list',
      scrollElement,
      keyboardEventTarget: document,
      scrollToIndex: scrollToSelectableItem
    },
    selectionContainerRef
  )

  const focusSelectionContainer = useCallback(() => {
    selectionContainerRef.current?.focus()
  }, [selectionContainerRef])

  const handleToggleSelect = useCallback(
    item => {
      const nextSelectedItems = { ...selectedItemsById }

      if (nextSelectedItems[item._id]) {
        delete nextSelectedItems[item._id]
      } else {
        nextSelectedItems[item._id] = item
      }

      setSelectedItems(nextSelectedItems)
      setIsSelectAll(
        Object.keys(nextSelectedItems).length === selectableItems.length
      )
      setLastInteractedItem(item._id)
      focusSelectionContainer()
    },
    [
      focusSelectionContainer,
      selectableItems.length,
      selectedItemsById,
      setIsSelectAll,
      setLastInteractedItem,
      setSelectedItems
    ]
  )

  const handleItemClick = useCallback(
    (item, event) => {
      if (!canSelectItem(item)) return

      if (multiple && event?.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        onShiftClick(item._id, event)
        focusSelectionContainer()
        return
      }

      if (multiple && (event?.ctrlKey || event?.metaKey)) {
        event.preventDefault()
        event.stopPropagation()
        handleToggleSelect(item)
        return
      }

      setSelectedItems({ [item._id]: item })
      setIsSelectAll(selectableItems.length === 1)
      setLastInteractedItem(item._id)
      focusSelectionContainer()
    },
    [
      canSelectItem,
      focusSelectionContainer,
      handleToggleSelect,
      multiple,
      onShiftClick,
      selectableItems.length,
      setIsSelectAll,
      setLastInteractedItem,
      setSelectedItems
    ]
  )

  const handleSelectAll = useCallback(() => {
    if (selectableItems.length === 0) {
      clearSelection()
      return
    }

    const shouldClearSelection = selectableItems.every(item =>
      isItemSelected(item._id)
    )

    if (shouldClearSelection) {
      clearSelection()
      focusSelectionContainer()
      return
    }

    selectAll(selectableItems)
    focusSelectionContainer()
  }, [
    clearSelection,
    focusSelectionContainer,
    isItemSelected,
    selectableItems,
    selectAll
  ])

  useEffect(() => {
    if (!multiple) return

    const handleKeyDown = event => {
      if (shouldBlockKeyboardShortcuts(event.target)) return
      if (event.defaultPrevented) return

      const isSelectAllShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a'
      if (isSelectAllShortcut) {
        event.preventDefault()
        handleSelectAll()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleSelectAll, multiple])
  return { handleItemClick, selectedItemIds }
}
