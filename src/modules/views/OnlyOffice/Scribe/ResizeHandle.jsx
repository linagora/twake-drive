import React, { useState, useCallback, useEffect, useRef } from 'react'

import { useTheme } from 'cozy-ui/transpiled/react/styles'

import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'

export const ResizeHandle = () => {
  const { setPanelWidth } = useScribe()
  const theme = useTheme()
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const isDraggingRef = useRef(false)
  const pointerIdRef = useRef(null)

  const primaryColor = theme.palette.primary.main

  const onPointerDown = useCallback(e => {
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch (err) {
      // ignore — setPointerCapture may throw on unsupported pointer types
    }
    pointerIdRef.current = e.pointerId
    isDraggingRef.current = true
    setIsDragging(true)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }, [])

  const onPointerMove = useCallback(e => {
    if (!isDraggingRef.current) return
    const newWidth = window.innerWidth - e.clientX
    setPanelWidth(newWidth)
  }, [setPanelWidth])

  const onPointerUp = useCallback(e => {
    if (!isDraggingRef.current) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch (err) {
      // already released or not captured — safe to ignore
    }
    pointerIdRef.current = null
    isDraggingRef.current = false
    setIsDragging(false)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  // Reset body styles on unmount (pointer capture releases automatically)
  useEffect(() => {
    return () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [])

  const showAccent = isHovered || isDragging
  const accentOpacity = isDragging ? 0.8 : 0.4

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: 6,
        flexShrink: 0,
        cursor: 'col-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        touchAction: 'none'
      }}
    >
      {showAccent && (
        <div
          style={{
            width: 2,
            height: '100%',
            borderRadius: 1,
            backgroundColor: primaryColor,
            opacity: accentOpacity,
            transition: 'opacity 150ms ease'
          }}
        />
      )}
    </div>
  )
}
