import { useEffect, useState, useCallback, useRef } from 'react'

import { CozyBridge } from '@/lib/cozy-bridge'

/**
 * React hook wrapping CozyBridge lifecycle with intent state.
 *
 * Creates a CozyBridge instance on mount, registers a handler for
 * AI_TEXT_EDIT intents, and provides a respond callback to send
 * responses back to the plugin.
 *
 * @param {string[]} allowedOrigins - Stable array of allowed origins.
 *   In dev: ['*']. In prod: derive from instance URL and OO server URL.
 *   Must be memoized by the parent to avoid unnecessary re-renders.
 * @returns {{ pendingIntent: import('@/lib/cozy-bridge/types').IntentMessage|null, respond: Function }}
 */
export function useCozyBridge(allowedOrigins) {
  const [pendingIntent, setPendingIntent] = useState(null)
  const [selectionState, setSelectionState] = useState(null)
  const bridgeRef = useRef(null)
  const respondRef = useRef(null)

  useEffect(() => {
    const bridge = new CozyBridge(allowedOrigins)
    bridgeRef.current = bridge

    bridge.onIntent('AI_TEXT_EDIT', (intentMessage, respondFn) => {
      setPendingIntent(intentMessage)
      respondRef.current = respondFn
    })

    bridge.onSelectionState(data => {
      if (data.hasSelection) {
        setSelectionState({
          hasSelection: true,
          text: data.text,
          top: data.top,
          left: data.left
        })
      } else {
        setSelectionState(null)
      }
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
    setSelectionState(null)
  }, [])

  return { pendingIntent, selectionState, respond }
}
