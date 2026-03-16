import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'

import { useClient } from 'cozy-client'
import { useI18n } from 'twake-i18n'

import { callScribeAI, classifyScribeError } from '@/modules/views/OnlyOffice/Scribe/scribeAI'

const STORAGE_KEY = 'scribe-panel-open'

const ScribeContext = createContext(null)

const CHAT_SYSTEM_PROMPT =
  'You are a helpful writing assistant. Help the user with their writing tasks. Respond in the same language as the user\'s message. Use Markdown formatting when appropriate.'

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
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const client = useClient()
  const { t } = useI18n()

  // Use ref to always have current messages in sendMessage without re-creating the callback
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  useEffect(() => {
    writeStorage(isPanelOpen)
  }, [isPanelOpen])

  const togglePanel = useCallback(() => setIsPanelOpen(prev => !prev), [])
  const openPanel = useCallback(() => setIsPanelOpen(true), [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  const addMessage = useCallback(msg => {
    setMessages(prev => [...prev, msg])
  }, [])

  const sendMessage = useCallback(async text => {
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Build AI messages: system prompt + conversation history (skip error messages)
      const currentMessages = [...messagesRef.current, userMessage]
      const aiMessages = [
        { role: 'system', content: CHAT_SYSTEM_PROMPT },
        ...currentMessages
          .filter(m => m.role !== 'error')
          .map(m => ({ role: m.role, content: m.content }))
      ]

      const responseText = await callScribeAI(client, aiMessages)

      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: responseText,
          timestamp: new Date()
        }
      ])
    } catch (err) {
      const classified = classifyScribeError(err)
      // Skip adding error message for abort errors (empty messageKey)
      if (classified.messageKey) {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            role: 'error',
            content: t(classified.messageKey),
            timestamp: new Date()
          }
        ])
      }
    } finally {
      setIsLoading(false)
    }
  }, [client, t])

  const value = useMemo(
    () => ({
      isPanelOpen, togglePanel, openPanel, closePanel,
      messages, isLoading, sendMessage, addMessage
    }),
    [isPanelOpen, togglePanel, openPanel, closePanel,
     messages, isLoading, sendMessage, addMessage]
  )

  return (
    <ScribeContext.Provider value={value}>{children}</ScribeContext.Provider>
  )
}

export const useScribe = () => useContext(ScribeContext)
