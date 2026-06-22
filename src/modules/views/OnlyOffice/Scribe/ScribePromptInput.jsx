import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
  forwardRef,
  useImperativeHandle
} from 'react'
import PropTypes from 'prop-types'

import { useTheme } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

const LINE_HEIGHT = 20
const TEXTAREA_VPAD = 12 // 6px top + 6px bottom
const INNER_VPAD = 4 // 2px top + 2px bottom on the content row
const BORDER = 2
// Single-line content height (one text line) and the resulting pill height.
const SINGLE_LINE = LINE_HEIGHT + TEXTAREA_VPAD // 32
const PILL_HEIGHT = SINGLE_LINE + INNER_VPAD + BORDER * 2 // 40
// Fixed corner radius = half the single-line height → a pill when one line,
// a rounded RECTANGLE (constant corner radius) once it grows taller. A 9999px
// radius would instead keep rounding the left/right edges into half-circles.
const PILL_RADIUS = PILL_HEIGHT / 2 // 20
// The pill stays compact while empty and jumps straight to its full
// (viewport-capped) width the instant the first character is typed. Going
// directly to the max — rather than growing per-keystroke — means the text
// never wraps at an intermediate width, so there is no flicker.
const COMPACT_WIDTH = 240
const MAX_WIDTH = 420
const SEND_BUTTON = 30
const VIEWPORT_MARGIN = 24 // keep the popover off the very edge of the screen

// Pill width = the cap, but never wider than the viewport allows (smaller
// screens get a smaller pill, and `maxWidth:100%` still clamps inside a narrow
// mobile drawer).
const computePillWidth = () => {
  if (typeof window === 'undefined') return MAX_WIDTH
  return Math.min(MAX_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)
}

// The animated gradient liseré can't be expressed with inline styles: it needs
// @property (so the conic-gradient angle interpolates smoothly) and @keyframes.
// Inject a single global stylesheet once, rather than relying on scribe.styl —
// CSS-modules scoping would mangle the @keyframes/@property names and the
// placeholder color has to read a per-instance CSS var. prefers-reduced-motion
// disables the spin. If @property is unsupported the gradient simply renders
// static — still a multicolor border, graceful degradation.
const STYLE_ID = 'scribe-prompt-input-styles'
const injectStyles = () => {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = `
@property --scribe-grad-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
@keyframes scribe-grad-spin { to { --scribe-grad-angle: 360deg; } }
.scribe-prompt-pill, .scribe-prompt-send {
  background:
    linear-gradient(var(--scribe-inner), var(--scribe-inner)) padding-box,
    conic-gradient(
      from var(--scribe-grad-angle),
      #4d8dff, #8b5cf6, #ff5fa2, #ff9d4d, #4d8dff
    ) border-box;
  border: var(--scribe-bw, 2px) solid transparent;
}
.scribe-prompt-pill { animation: scribe-grad-spin 6s linear infinite; }
.scribe-prompt-send { animation: scribe-grad-spin 6s linear infinite; }
.scribe-prompt-pill textarea::placeholder {
  color: var(--scribe-ph, #9aa0a6);
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .scribe-prompt-pill, .scribe-prompt-send { animation: none; }
}`
  document.head.appendChild(el)
}

const ScribePromptInput = forwardRef(({ onSubmit, onArrow, onEscape }, ref) => {
  const { t } = useI18n()
  const theme = useTheme()
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [maxPillWidth, setMaxPillWidth] = useState(computePillWidth)
  const [maxHeight, setMaxHeight] = useState(LINE_HEIGHT * 6 + TEXTAREA_VPAD)
  // Compact until something is typed, then snap to the full width.
  const effectiveWidth = value.length > 0 ? maxPillWidth : COMPACT_WIDTH
  const inputRef = useRef(null)
  const wrapperRef = useRef(null)
  // Pending caret position to restore after a controlled-value newline insert.
  const pendingCaretRef = useRef(null)

  const palette = theme.palette || {}
  const isDark = (palette.type || palette.mode) === 'dark'
  const innerBg = (palette.background && palette.background.paper) || (isDark ? '#1e1e1e' : '#fff')
  const textColor = (palette.text && palette.text.primary) || (isDark ? '#fff' : '#000')
  const placeholderColor = '#9aa0a6'

  useEffect(() => { injectStyles() }, [])

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (inputRef.current) inputRef.current.focus()
    },
    // Lets the menu carry the in-progress prompt over to the side panel.
    getValue: () => value
  }))

  // Max textarea height = space the popover actually has below the input, with
  // a viewport-fraction ceiling. Measured from the pill's own position so it is
  // a function of the available modal height, not a fixed line count.
  const computeMaxHeight = useCallback(() => {
    if (typeof window === 'undefined') return LINE_HEIGHT * 6 + TEXTAREA_VPAD
    const rect = wrapperRef.current
      ? wrapperRef.current.getBoundingClientRect()
      : null
    const top = rect ? rect.top : 0
    const avail = window.innerHeight - top - VIEWPORT_MARGIN
    const ceil = window.innerHeight * 0.6
    return Math.max(LINE_HEIGHT + TEXTAREA_VPAD, Math.min(avail, ceil))
  }, [])

  // Width is fixed (set on mount/resize), so the value only drives HEIGHT:
  // auto-grow the textarea up to the available popover space, then it scrolls.
  useLayoutEffect(() => {
    const mh = computeMaxHeight()
    setMaxHeight(mh)

    const ta = inputRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, mh) + 'px'
    }
  }, [value, computeMaxHeight])

  // Restore the caret after a controlled newline insertion (Ctrl/Shift+Enter).
  useLayoutEffect(() => {
    if (pendingCaretRef.current != null && inputRef.current) {
      const pos = pendingCaretRef.current
      pendingCaretRef.current = null
      inputRef.current.selectionStart = pos
      inputRef.current.selectionEnd = pos
    }
  }, [value])

  useEffect(() => {
    const onResize = () => {
      setMaxPillWidth(computePillWidth())
      setMaxHeight(computeMaxHeight())
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [computeMaxHeight])

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed) {
      onSubmit(trimmed)
      setValue('')
    }
  }, [value, onSubmit])

  const insertNewline = useCallback(() => {
    const el = inputRef.current
    const start = el ? el.selectionStart : value.length
    const end = el ? el.selectionEnd : value.length
    const next = value.slice(0, start) + '\n' + value.slice(end)
    pendingCaretRef.current = start + 1
    setValue(next)
  }, [value])

  const handleKeyDown = useCallback(
    e => {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        // Ctrl/Cmd/Shift+Enter inserts a line break; plain Enter submits.
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          insertNewline()
        } else {
          handleSubmit()
        }
      } else if (e.key === 'ArrowUp') {
        // Shift+Arrow extends the text selection — leave that to the browser.
        if (e.shiftKey) return
        // Hand off to the menu only at the first line; otherwise let the caret
        // move up within a multi-line draft.
        const el = inputRef.current
        const atFirstLine =
          !el || value.lastIndexOf('\n', el.selectionStart - 1) === -1
        if (atFirstLine) {
          e.preventDefault()
          e.stopPropagation()
          if (onArrow) onArrow('up')
        }
      } else if (e.key === 'ArrowDown') {
        if (e.shiftKey) return
        const el = inputRef.current
        const atLastLine = !el || value.indexOf('\n', el.selectionStart) === -1
        if (atLastLine) {
          e.preventDefault()
          e.stopPropagation()
          if (onArrow) onArrow('down')
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (onEscape) onEscape()
      }
    },
    [handleSubmit, insertNewline, onArrow, onEscape, value]
  )

  const canSend = value.trim().length > 0

  return (
    <div style={{ padding: '4px 8px 4px 12px', display: 'flex' }}>
      <div
        ref={wrapperRef}
        className="scribe-prompt-pill"
        style={{
          '--scribe-bw': '2px',
          '--scribe-inner': innerBg,
          position: 'relative',
          width: effectiveWidth,
          maxWidth: '100%',
          borderRadius: PILL_RADIUS,
          boxSizing: 'border-box',
          boxShadow: focused ? '0 0 0 3px rgba(139, 92, 246, 0.18)' : 'none',
          // Width only ever toggles compact<->max (max always fits the content),
          // so animating it cannot cause a wrap-flicker.
          transition: 'width 140ms ease, box-shadow 150ms ease'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            padding: '2px 8px 2px 14px'
          }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            placeholder={t('Scribe.prompt.placeholder')}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              '--scribe-ph': placeholderColor,
              flex: 1,
              minWidth: 0,
              display: 'block',
              boxSizing: 'border-box',
              verticalAlign: 'bottom',
              border: 'none',
              background: 'transparent',
              color: textColor,
              fontFamily: 'inherit',
              fontSize: 14,
              lineHeight: `${LINE_HEIGHT}px`,
              resize: 'none',
              outline: 'none',
              margin: 0,
              padding: '6px 0',
              minHeight: SINGLE_LINE,
              maxHeight,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          />
          <button
            type="button"
            className="scribe-prompt-send"
            onClick={handleSubmit}
            aria-label="Send"
            style={{
              '--scribe-bw': '2px',
              '--scribe-inner': innerBg,
              width: SEND_BUTTON,
              height: SEND_BUTTON,
              borderRadius: '50%',
              boxSizing: 'border-box',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              cursor: canSend ? 'pointer' : 'default',
              opacity: canSend ? 1 : 0.55,
              marginBottom: 1,
              transition: 'opacity 150ms ease'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient
                  id="scribe-send-grad"
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="1"
                >
                  <stop offset="0" stopColor="#ff5fa2" />
                  <stop offset="1" stopColor="#ff9d4d" />
                </linearGradient>
              </defs>
              <path
                d="M4 12h13M12 6l6 6-6 6"
                stroke="url(#scribe-send-grad)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
})

ScribePromptInput.displayName = 'ScribePromptInput'

ScribePromptInput.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  onArrow: PropTypes.func,
  onEscape: PropTypes.func
}

ScribePromptInput.defaultProps = {
  onArrow: null,
  onEscape: null
}

export { ScribePromptInput }
