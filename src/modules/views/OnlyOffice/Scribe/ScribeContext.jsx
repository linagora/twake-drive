import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

const STORAGE_KEY = 'scribe-panel-open'

const ScribeContext = createContext(null)

const readStorage = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch (e) {
    return false
  }
}

const writeStorage = value => {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch (e) {
    // localStorage unavailable
  }
}

export const ScribeProvider = ({ children }) => {
  const [isPanelOpen, setIsPanelOpen] = useState(readStorage)

  useEffect(() => {
    writeStorage(isPanelOpen)
  }, [isPanelOpen])

  const togglePanel = useCallback(() => setIsPanelOpen(prev => !prev), [])
  const openPanel = useCallback(() => setIsPanelOpen(true), [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  const value = useMemo(
    () => ({ isPanelOpen, togglePanel, openPanel, closePanel }),
    [isPanelOpen, togglePanel, openPanel, closePanel]
  )

  return (
    <ScribeContext.Provider value={value}>{children}</ScribeContext.Provider>
  )
}

export const useScribe = () => useContext(ScribeContext)
