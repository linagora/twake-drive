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
// Pill width-growth bounds (per UI decision): start compact, grow with content
// up to a hard cap, then the textarea wraps to multiple lines instead.
const MIN_WIDTH = 240
const MAX_WIDTH = 420
const SEND_BUTTON = 30
// Horizontal chrome around the measured text: left pad + gap + send button +
// right pad + the two 2px gradient borders. Used to convert measured text
// width into an outer pill width.
const CHROME_WIDTH = 14 + 8 + SEND_BUTTON + 8 + BORDER * 2
const VIEWPORT_MARGIN = 24 // keep the popover off the very edge of the screen

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
  const [width, setWidth] = useState(MIN_WIDTH)
  const [maxHeight, setMaxHeight] = useState(LINE_HEIGHT * 6 + TEXTAREA_VPAD)
  const inputRef = useRef(null)
  const wrapperRef = useRef(null)
  const mirrorRef = useRef(null)
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
    }
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

  // Recompute pill width (from the hidden mirror) and textarea height whenever
  // the value changes. Width grows with content up to MAX_WIDTH; past that the
  // textarea wraps and height takes over.
  useLayoutEffect(() => {
    const mh = computeMaxHeight()
    setMaxHeight(mh)

    const measured = mirrorRef.current ? mirrorRef.current.scrollWidth : 0
    const next = Math.min(
      MAX_WIDTH,
      Math.max(MIN_WIDTH, Math.ceil(measured) + CHROME_WIDTH + 6)
    )
    setWidth(next)

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
    const onResize = () => setMaxHeight(computeMaxHeight())
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
          width,
          maxWidth: '100%',
          borderRadius: PILL_RADIUS,
          boxSizing: 'border-box',
          boxShadow: focused ? '0 0 0 3px rgba(139, 92, 246, 0.18)' : 'none',
          transition: 'width 120ms ease, box-shadow 150ms ease'
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
        {/* Hidden mirror used to measure the single-line text width so the pill
            can grow horizontally with content up to MAX_WIDTH. */}
        <span
          ref={mirrorRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            visibility: 'hidden',
            whiteSpace: 'pre',
            pointerEvents: 'none',
            left: -9999,
            top: 0,
            fontFamily: 'inherit',
            fontSize: 14,
            lineHeight: `${LINE_HEIGHT}px`
          }}
        >
          {value || t('Scribe.prompt.placeholder')}
        </span>
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
