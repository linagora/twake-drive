import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback
} from 'react'
import { useLocation } from 'react-router-dom'

import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

/**
 * @typedef TSelectionContext
 * @property {Function} showSelectionBar Show the SelectionBar
 * @property {Function} hideSelectionBar Hide the SelectionBar
 * @property {boolean} isSelectionBarVisible Whether the SelectionBar is visible or not
 * @property {Array} selectedItems List of selected items
 * @property {Function} toggleSelectedItem Select an item if it is already selected, otherwise deselect it
 * @property {Function} isItemSelected Find out if an item is selected by its id
 * @property {boolean} isSelectAll Whether all the items are selected or not
 * @property {Function} toggleSelectAllItems Toggle selects all items
 * @property {Function} selectAll Select all items
 * @property {Function} clearSelection Clear all the selected items
 */

/** @type {import('react').Context<TSelectionContext>} */
const SelectionContext = createContext()

/**
 * This provider allows you to manage item selection
 */
const SelectionProvider = ({ children }) => {
  const location = useLocation()
  const [selectedItems, setSelectedItems] = useState({})
  const [isSelectionBarOpen, setSelectionBarOpen] = useState(false)
  const [isSelectAll, setIsSelectAll] = useState(false)

  const { highlightedItems, clearItems } = useNewItemHighlightContext()

  const isItemSelected = id => {
    return selectedItems[id] !== undefined
  }

  const toggleSelectedItem = item => {
    if (highlightedItems?.length) {
      clearItems()
    }

    if (isItemSelected(item._id)) {
      // eslint-disable-next-line no-unused-vars
      const { [item._id]: _, ...stillSelected } = selectedItems
      setSelectedItems(stillSelected)
    } else {
      setSelectedItems({ ...selectedItems, [item._id]: item })
    }
  }

  const selectAll = items => {
    const newSelectedItems = items.reduce((acc, item) => {
      acc[item._id] = item
      return acc
    }, {})
    setSelectedItems(newSelectedItems)
    setIsSelectAll(true)
  }

  const clearSelection = useCallback(() => {
    setIsSelectAll(false)
    setSelectedItems({})
  }, [])

  const toggleSelectAllItems = items => {
    if (isSelectAll) {
      clearSelection()
    } else {
      selectAll(items)
    }
  }

  const showSelectionBar = () => setSelectionBarOpen(true)
  const hideSelectionBar = useCallback(() => {
    clearSelection()
    setSelectionBarOpen(false)
  }, [clearSelection])

  const isSelectionBarVisible = useMemo(() => {
    return Object.keys(selectedItems).length !== 0 || isSelectionBarOpen
  }, [isSelectionBarOpen, selectedItems])

  useEffect(() => {
    hideSelectionBar()
  }, [location, hideSelectionBar])

  return (
    <SelectionContext.Provider
      value={{
        showSelectionBar,
        hideSelectionBar,
        clearSelection,
        isSelectionBarVisible,
        selectedItems: Object.values(selectedItems),
        toggleSelectedItem,
        selectAll,
        isItemSelected,
        isSelectAll,
        toggleSelectAllItems,
        setSelectedItems,
        setIsSelectAll
      }}
    >
      {children}
    </SelectionContext.Provider>
  )
}

const useSelectionContext = () => useContext(SelectionContext)

export { SelectionProvider, useSelectionContext }
