import React, { useState, useRef, useCallback, useEffect } from 'react'

import { useTheme } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'
import { SelectionChip } from '@/modules/views/OnlyOffice/Scribe/SelectionChip'

const SCRIBE_PURPLE = '#7C3AED'
const MAX_ROWS = 4
const LINE_HEIGHT = 20

export const ChatInput = () => {
  const [text, setText] = useState('')
  const { sendMessage, isLoading, currentSelection, dismissSelection } = useScribe()
  const { t } = useI18n()
  const theme = useTheme()
  const textareaRef = useRef(null)

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    if (currentSelection) {
      sendMessage(trimmed, { text: currentSelection.text, markdown: currentSelection.markdown })
    } else {
      sendMessage(trimmed)
    }
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, isLoading, sendMessage, currentSelection])

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

  // Focus guard: OO editor aggressively reclaims focus to its iframe.
  // When the textarea is focused and loses focus unexpectedly (relatedTarget is
  // null/iframe = cross-origin steal), refocus it on the next frame.
  const userFocusedRef = useRef(false)
  const handleFocus = useCallback(() => { userFocusedRef.current = true }, [])
  const handleBlur = useCallback(e => {
    // If focus moved to another element inside our panel, that's intentional
    if (e.relatedTarget) {
      userFocusedRef.current = false
      return
    }
    // relatedTarget is null → focus went to an iframe or outside the document.
    // OO stole it. Reclaim on next frame so the browser settles first.
    requestAnimationFrame(() => {
      if (userFocusedRef.current && textareaRef.current) {
        textareaRef.current.focus()
      }
    })
  }, [])

  // Clear the guard when the component unmounts or user clicks elsewhere intentionally
  useEffect(() => {
    const handlePointerDown = e => {
      // If the click is outside the panel, let focus go naturally
      if (textareaRef.current && !e.target.closest('[data-scribe-panel]')) {
        userFocusedRef.current = false
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [])

  const canSend = text.trim().length > 0 && !isLoading

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: `1px solid ${theme.palette.divider}`,
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {currentSelection && (
        <SelectionChip selection={currentSelection} onDismiss={dismissSelection} />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
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
    </div>
  )
}
