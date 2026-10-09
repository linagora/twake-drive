import React, { createContext, useContext, useMemo, useState } from 'react'

const AssistantContext = createContext({ isAvailable: false, isOpen: false })

export const useAssistant = () => useContext(AssistantContext)

export const AssistantProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false)

  const value = useMemo(
    () => ({
      isAvailable: true,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false)
    }),
    [isOpen]
  )

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  )
}
