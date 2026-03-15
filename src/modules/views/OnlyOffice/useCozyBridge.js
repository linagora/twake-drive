import { useEffect, useState, useCallback, useRef } from 'react'

import { CozyBridge } from '@/lib/cozy-bridge'

/**
 * React hook wrapping CozyBridge lifecycle with intent state.
 *
 * Creates a CozyBridge instance on mount, registers handlers for:
 * - AI_TEXT_ASSISTANT: opens Scribe popover (or closes panel if panel is open)
 * - SHOW/HIDE_SCRIBE_BUTTON: controls the floating button visibility
 * - TOGGLE_SCRIBE_PANEL: toggles the side panel open/closed
 *
 * @param {string[]} allowedOrigins - Stable array of allowed origins.
 *   In dev: ['*']. In prod: derive from instance URL and OO server URL.
 *   Must be memoized by the parent to avoid unnecessary re-renders.
 * @param {object} [options]
 * @param {Function} [options.onTogglePanel] - Callback to toggle the panel (from ScribeContext)
 * @param {boolean} [options.isPanelOpen] - Current panel state; when true, AI_TEXT_ASSISTANT
 *   closes the panel instead of opening the popover (single Ctrl+Shift+I close)
 * @returns {{ pendingIntent: object|null, showScribeButton: object|null, respond: Function }}
 */
export function useCozyBridge(allowedOrigins, { onTogglePanel, isPanelOpen } = {}) {
  const [pendingIntent, setPendingIntent] = useState(null)
  const [showScribeButton, setShowScribeButton] = useState(null)
  const bridgeRef = useRef(null)
  const respondRef = useRef(null)
  const togglePanelRef = useRef(onTogglePanel)
  const isPanelOpenRef = useRef(isPanelOpen)

  // Keep refs current to avoid stale closures in bridge handlers
  useEffect(() => {
    togglePanelRef.current = onTogglePanel
  }, [onTogglePanel])
  useEffect(() => {
    isPanelOpenRef.current = isPanelOpen
  }, [isPanelOpen])

  useEffect(() => {
    const bridge = new CozyBridge(allowedOrigins)
    bridgeRef.current = bridge

    bridge.onIntent('AI_TEXT_ASSISTANT', (intentMessage, respondFn) => {
      // If panel is open, Ctrl+Shift+I should close the panel
      // instead of opening a popover
      if (isPanelOpenRef.current) {
        respondFn({ status: 'ok', action: 'cancel', data: {} })
        if (togglePanelRef.current) togglePanelRef.current()
        return
      }
      setPendingIntent(intentMessage)
      respondRef.current = respondFn
    })

    bridge.onIntent('SHOW_SCRIBE_BUTTON', intentMessage => {
      setShowScribeButton({ text: intentMessage.data.text })
    })

    bridge.onIntent('HIDE_SCRIBE_BUTTON', () => {
      setShowScribeButton(null)
    })

    bridge.onIntent('TOGGLE_SCRIBE_PANEL', () => {
      if (togglePanelRef.current) togglePanelRef.current()
    })

    return () => {
      bridge.destroy()
      bridgeRef.current = null
      respondRef.current = null
    }
  }, [allowedOrigins])

  const respond = useCallback(responsePayload => {
    if (!respondRef.current) {
      console.warn('[useCozyBridge] No pending intent to respond to')
      return
    }
    respondRef.current(responsePayload)
    respondRef.current = null
    setPendingIntent(null)
    setShowScribeButton(null)
  }, [])

  return { pendingIntent, showScribeButton, respond }
}
