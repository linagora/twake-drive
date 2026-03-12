import { useEffect, useState, useCallback, useRef } from 'react'

import { CozyBridge } from '@/lib/cozy-bridge'

/**
 * React hook wrapping CozyBridge lifecycle with intent state.
 *
 * Creates a CozyBridge instance on mount, registers handlers for
 * AI_TEXT_ASSISTANT intents (opens Scribe popover) and SHOW/HIDE_SCRIBE_BUTTON
 * intents (controls the floating button), and provides a respond callback
 * to send responses back to the plugin.
 *
 * @param {string[]} allowedOrigins - Stable array of allowed origins.
 *   In dev: ['*']. In prod: derive from instance URL and OO server URL.
 *   Must be memoized by the parent to avoid unnecessary re-renders.
 * @returns {{ pendingIntent: object|null, showScribeButton: object|null, respond: Function }}
 */
export function useCozyBridge(allowedOrigins, { onTogglePanel } = {}) {
  const [pendingIntent, setPendingIntent] = useState(null)
  const [showScribeButton, setShowScribeButton] = useState(null)
  const bridgeRef = useRef(null)
  const respondRef = useRef(null)
  const togglePanelRef = useRef(onTogglePanel)

  // Keep the ref current to avoid stale closure in bridge handler
  useEffect(() => {
    togglePanelRef.current = onTogglePanel
  }, [onTogglePanel])

  useEffect(() => {
    const bridge = new CozyBridge(allowedOrigins)
    bridgeRef.current = bridge

    bridge.onIntent('AI_TEXT_ASSISTANT', (intentMessage, respondFn) => {
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
