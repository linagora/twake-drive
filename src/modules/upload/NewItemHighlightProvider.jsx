import React, { createContext, useCallback, useContext, useState } from 'react'

const NewItemHighlightContext = createContext()

const NewItemHighlightProvider = ({ children }) => {
  const [highlightedItems, setHighlightedItems] = useState([])
  const [ids, setIds] = useState(new Set())

  const addItems = newItems => {
    if (!Array.isArray(newItems)) {
      throw new Error('addItems expects an array')
    }

    const validItems = newItems.filter(item => item?._id)
    if (validItems.length === 0) return

    setHighlightedItems(validItems)
    setIds(new Set(validItems.map(item => item._id)))
  }

  const clearItems = useCallback(() => {
    setHighlightedItems([])
    setIds(new Set())
  }, [setHighlightedItems, setIds])

  const isNew = item => {
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

  if (!ctx)
    throw new Error(
      'useNewItemHighlightContext must be used within NewItemHighlightProvider'
    )

  return ctx
}

export { NewItemHighlightProvider, useNewItemHighlightContext }
