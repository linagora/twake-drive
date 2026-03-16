import React, { useState, useRef, useCallback } from 'react'

import { useTheme } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'

const SCRIBE_PURPLE = '#7C3AED'
const MAX_ROWS = 4
const LINE_HEIGHT = 20

export const ChatInput = () => {
  const [text, setText] = useState('')
  const { sendMessage, isLoading } = useScribe()
  const { t } = useI18n()
  const theme = useTheme()
  const textareaRef = useRef(null)

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    sendMessage(trimmed)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, isLoading, sendMessage])

  const handleKeyDown = useCallback(e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleChange = useCallback(e => {
    setText(e.target.value)
    // Auto-grow textarea
    const el = e.target
    el.style.height = 'auto'
    const maxHeight = LINE_HEIGHT * MAX_ROWS + 16 // padding
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
  }, [])

  const canSend = text.trim().length > 0 && !isLoading

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: `1px solid ${theme.palette.divider}`,
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={t('Scribe.prompt.placeholder')}
        disabled={isLoading}
        rows={1}
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          color: theme.palette.text.primary,
          fontFamily: 'inherit',
          fontSize: 14,
          lineHeight: `${LINE_HEIGHT}px`,
          resize: 'none',
          outline: 'none',
          padding: '8px 0',
          minHeight: LINE_HEIGHT + 16,
          maxHeight: LINE_HEIGHT * MAX_ROWS + 16
        }}
      />
      <button
        onClick={handleSend}
        disabled={!canSend}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: 'none',
          background: canSend ? SCRIBE_PURPLE : theme.palette.action.disabledBackground,
          color: canSend ? '#fff' : theme.palette.action.disabled,
          cursor: canSend ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 16,
          lineHeight: 1,
          padding: 0,
          transition: 'background 150ms ease'
        }}
        aria-label="Send"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M2 14l12-6L2 2v5l8 1-8 1v5z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  )
}
