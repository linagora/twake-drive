import { useEffect, useState, useCallback, useRef } from 'react'

import { CozyBridge } from '@/lib/cozy-bridge'
import { createPanelActionIntent } from '@/lib/cozy-bridge/protocol'

/**
 * React hook wrapping CozyBridge lifecycle with intent state.
 *
 * Creates a CozyBridge instance on mount, registers handlers for:
 * - AI_TEXT_ASSISTANT: opens Scribe popover (or closes panel if panel is open)
 * - TOGGLE_SCRIBE_PANEL: toggles the side panel open/closed
 *
 * @param {string[]} allowedOrigins - Stable array of allowed origins.
 *   In dev: ['*']. In prod: derive from instance URL and OO server URL.
 *   Must be memoized by the parent to avoid unnecessary re-renders.
 * @param {object} [options]
 * @param {Function} [options.onTogglePanel] - Callback to toggle the panel (from ScribeContext)
 * @param {boolean} [options.isPanelOpen] - Current panel state; when true, AI_TEXT_ASSISTANT
 *   closes the panel instead of opening the popover (single Ctrl+Shift+I close)
 * @param {Function} [options.onSelectionChanged] - Called when plugin reports selection change
 * @returns {{ pendingIntent: object|null, respond: Function }}
 */
export function useCozyBridge(allowedOrigins, { onTogglePanel, isPanelOpen, onSelectionChanged } = {}) {
  const [pendingIntent, setPendingIntent] = useState(null)
  const bridgeRef = useRef(null)
  const respondRef = useRef(null)
  const togglePanelRef = useRef(onTogglePanel)
  const isPanelOpenRef = useRef(isPanelOpen)
  const onSelectionChangedRef = useRef(onSelectionChanged)

  // Keep refs current to avoid stale closures in bridge handlers
  useEffect(() => {
    togglePanelRef.current = onTogglePanel
  }, [onTogglePanel])
  useEffect(() => {
    isPanelOpenRef.current = isPanelOpen
  }, [isPanelOpen])
  useEffect(() => {
    onSelectionChangedRef.current = onSelectionChanged
  }, [onSelectionChanged])

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

    bridge.onIntent('TOGGLE_SCRIBE_PANEL', () => {
      if (togglePanelRef.current) togglePanelRef.current()
    })

    bridge.onIntent('SELECTION_CHANGED', intentMessage => {
      if (onSelectionChangedRef.current) {
        onSelectionChangedRef.current(intentMessage.data)
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
  }, [])

  /**
   * Cast a one-way PANEL_ACTION intent from host (Cozy Drive) DOWN into the
   * plugin iframe. Unlike respond(), this does not require a pending intent
   * and bypasses the intentId/pendingIntents bookkeeping entirely.
   *
   * Used by the Scribe side panel to trigger Replace/Insert on AI messages
   * even when no inline popover was ever opened (pure chat flow).
   *
   * @param {{action: 'replace'|'insert', text: string, html?: string, md?: string, partialTableInfo?: any}} payload
   */
  const castPanelAction = useCallback(payload => {
    const intent = createPanelActionIntent(payload)
    // Attach optional passthrough fields (e.g. partialTableInfo) so the
    // plugin sees the same payload shape as the response path.
    if (payload && payload.partialTableInfo) {
      intent.data.partialTableInfo = payload.partialTableInfo
    }
    // Broadcast into every descendant iframe. The plugin lives two levels
    // deep (Cozy Drive > OO editor iframe > plugin iframe) and filters by
    // message type/action, so a wide broadcast is safe and matches the
    // existing cozy-bridge:trigger-intent pattern used by View.jsx.
    const walk = win => {
      try {
        for (let i = 0; i < win.frames.length; i++) {
          try {
            win.frames[i].postMessage(intent, '*')
            walk(win.frames[i])
          } catch (e) {
            // cross-origin frame, skip
          }
        }
      } catch (e) {
        // access denied
      }
    }
    walk(window)
  }, [])

  return { pendingIntent, respond, castPanelAction }
}
