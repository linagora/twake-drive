import React, { useState, useCallback, useEffect, useRef } from 'react'

import { useTheme } from 'cozy-ui/transpiled/react/styles'

import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'

export const ResizeHandle = () => {
  const { setPanelWidth } = useScribe()
  const theme = useTheme()
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const isDraggingRef = useRef(false)

  const primaryColor = theme.palette.primary.main

  const onMouseMove = useCallback(e => {
    if (!isDraggingRef.current) return
    const newWidth = window.innerWidth - e.clientX
    setPanelWidth(newWidth)
  }, [setPanelWidth])

  const onMouseUp = useCallback(() => {
    isDraggingRef.current = false
    setIsDragging(false)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }, [onMouseMove])

  const onMouseDown = useCallback(e => {
    e.preventDefault()
    isDraggingRef.current = true
    setIsDragging(true)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [onMouseMove, onMouseUp])

  // Clean up listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [onMouseMove, onMouseUp])

  const showAccent = isHovered || isDragging
  const accentOpacity = isDragging ? 0.8 : 0.4

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: 6,
        flexShrink: 0,
        cursor: 'col-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
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
