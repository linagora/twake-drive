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

  // Focus the input when the panel opens (this component mounts on open). The
  // OO editor lives in a cross-origin iframe that holds focus, so a single
  // focus() can lose the race: we blur whatever holds focus and focus the
  // textarea in a short burst, stopping as soon as it sticks. This is a
  // one-shot grab on open only — we deliberately do NOT keep reclaiming focus
  // afterwards, so clicking into the document to make a selection works.
  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const tryFocus = () => {
      if (cancelled) return
      const el = textareaRef.current
      if (!el || document.activeElement === el) return
      if (document.activeElement && document.activeElement !== el) {
        try { document.activeElement.blur() } catch (e) { /* cross-origin */ }
      }
      el.focus()
      attempts += 1
      if (attempts < 6 && document.activeElement !== el) {
        timer = setTimeout(tryFocus, 90)
      }
    }
    let timer = setTimeout(tryFocus, 80)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
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
