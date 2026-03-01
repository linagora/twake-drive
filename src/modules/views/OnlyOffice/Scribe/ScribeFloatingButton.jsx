import React, { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'

const BUTTON_HEIGHT = 32
const OFFSET = 8

const SPARKLE_ICON = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
  </svg>
)

const ScribeFloatingButton = ({ visible, position, onClick, buttonRef }) => {
  const [show, setShow] = useState(false)
  const internalRef = useRef(null)
  const ref = buttonRef || internalRef

  // Fade-in: set show=true after mount to trigger CSS transition
  useEffect(() => {
    if (visible && position) {
      const frame = requestAnimationFrame(() => setShow(true))
      return () => cancelAnimationFrame(frame)
    } else {
      setShow(false)
    }
  }, [visible, position])

  if (!visible || !position) return null

  return createPortal(
    <button
      ref={ref}
      className="scribe-floating-button"
      onClick={onClick}
      style={{
        position: 'fixed',
        top: position.top - BUTTON_HEIGHT - OFFSET,
        left: position.left,
        zIndex: 99999,
        opacity: show ? 1 : 0,
        transition: 'opacity 150ms ease-in',
        pointerEvents: 'auto'
      }}
    >
      {SPARKLE_ICON}
      <span className="scribe-floating-button-label">Scribe</span>
    </button>,
    document.body
  )
}

ScribeFloatingButton.propTypes = {
  visible: PropTypes.bool.isRequired,
  position: PropTypes.shape({
    top: PropTypes.number.isRequired,
    left: PropTypes.number.isRequired
  }),
  onClick: PropTypes.func.isRequired,
  buttonRef: PropTypes.object
}

export { ScribeFloatingButton }
