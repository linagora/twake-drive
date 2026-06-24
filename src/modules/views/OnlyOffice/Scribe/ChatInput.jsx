import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle
} from 'react'

import { useTheme } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'
import { ScribeIncludeZone } from '@/modules/views/OnlyOffice/Scribe/ScribeIncludeZone'
import { SelectionChip } from '@/modules/views/OnlyOffice/Scribe/SelectionChip'

const SCRIBE_PURPLE = '#7C3AED'
const MAX_ROWS = 4
const LINE_HEIGHT = 20

export const ChatInput = forwardRef(({ onArrowUp } = {}, ref) => {
  const {
    sendMessage,
    isLoading,
    currentSelection,
    includeSelection,
    dismissSelection,
    pendingDraft,
    clearPendingDraft
  } = useScribe()
  // Seed from a draft handed over by the inline popover (empty otherwise).
  const [text, setText] = useState(() => pendingDraft || '')
  const { t } = useI18n()
  const theme = useTheme()
  const textareaRef = useRef(null)
  // True until the carried-over draft's caret has been placed at the end.
  const seededRef = useRef(false)

  // Imperative focus() exposed to the thread keyboard controller so it can
  // return focus to the input on Escape / Down-past-newest. This is a SINGLE
  // focus() call — NOT the open-time reclaim burst below (Pitfall 4: a reclaim
  // loop fights the cross-origin OO editor iframe). See T-v3.1-04-13.
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (textareaRef.current) textareaRef.current.focus()
      }
    }),
    []
  )

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
      return
    }
    // KBD-01: ArrowUp from an EMPTY draft leaves the input and hands focus to
    // the thread controller (most-recent card). The text.length === 0 guard
    // keeps ArrowUp editing a multi-line draft when text is present.
    if (e.key === 'ArrowUp' && text.length === 0 && onArrowUp) {
      e.preventDefault()
      onArrowUp()
    }
  }, [handleSend, text, onArrowUp])

  const handleChange = useCallback(e => {
    setText(e.target.value)
    // Auto-grow textarea
    const el = e.target
    el.style.height = 'auto'
    const maxHeight = LINE_HEIGHT * MAX_ROWS + 16 // padding
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
  }, [])

  // Consume the carried-over popover draft once: clear it from context (so it
  // doesn't reseed) and size the textarea to fit the seeded text.
  useEffect(() => {
    if (!pendingDraft) return
    clearPendingDraft()
    seededRef.current = true
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      const maxHeight = LINE_HEIGHT * MAX_ROWS + 16
      el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
      // Drop the caret at the end so the user can keep typing immediately.
      const len = el.value.length
      el.selectionStart = len
      el.selectionEnd = len
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (!el) return
      if (document.activeElement !== el) {
        if (document.activeElement) {
          try { document.activeElement.blur() } catch (e) { /* cross-origin */ }
        }
        el.focus()
      }
      // Re-assert end-of-text caret for a carried-over draft, since focus()
      // can reset the caret to the start.
      if (seededRef.current && document.activeElement === el) {
        const len = el.value.length
        el.selectionStart = len
        el.selectionEnd = len
        seededRef.current = false
      }
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
      <ScribeIncludeZone />
      {currentSelection && includeSelection && (
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
})

ChatInput.displayName = 'ChatInput'
