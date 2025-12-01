import React, { createContext, useCallback, useContext, useState } from 'react'

import flag from 'cozy-flags'

const NewItemHighlightContext = createContext()

const NewItemHighlightProvider = ({ children }) => {
  const [highlightedItems, setHighlightedItems] = useState([])
  const [ids, setIds] = useState(new Set())

  const addItems = newItems => {
    if (!flag('drive.highlight-new-items.enabled')) return

    if (!Array.isArray(newItems)) {
      throw new Error('addItems expects an array')
    }

    const validItems = newItems.filter(item => item?._id)
    if (validItems.length === 0) return

    setHighlightedItems(validItems)
    setIds(new Set(validItems.map(item => item._id)))
  }

  const clearItems = useCallback(() => {
    if (!flag('drive.highlight-new-items.enabled')) return

    setHighlightedItems([])
    setIds(new Set())
  }, [setHighlightedItems, setIds])

  const isNew = item => {
    if (!flag('drive.highlight-new-items.enabled')) return false

    return item?._id ? ids.has(item._id) : false
  }

  return (
    <NewItemHighlightContext.Provider
      value={{ highlightedItems, addItems, clearItems, isNew }}
    >
      {children}
    </NewItemHighlightContext.Provider>
  )
}

const useNewItemHighlightContext = () => {
  const ctx = useContext(NewItemHighlightContext)

  if (!flag('drive.highlight-new-items.enabled')) {
    return {
      highlightedItems: [],
      addItems: () => {},
      clearItems: () => {},
      isNew: () => false
    }
  }

  if (!ctx)
    throw new Error(
      'useNewItemHighlightContext must be used within NewItemHighlightProvider'
    )

  return ctx
}

export { NewItemHighlightProvider, useNewItemHighlightContext }
